const fs = require('fs');
const path = require('path');

function createTemplate(projectPath) {
  const mainFilePath = path.join(projectPath, 'sqlite.py');
  const readmeFilePath = path.join(projectPath, 'README.md');
  const dockerbakeFilePath = path.join(projectPath, 'docker-bake.hcl');
  const dockerfilePath = path.join(projectPath, 'Dockerfile');
  const dockerignoreFilePath = path.join(projectPath, '.dockerignore');
  const gitignoreFilePath = path.join(projectPath, '.gitignore'); 
  const dockerbakeoverrideFilePath = path.join(projectPath, 'docker-bake.override.hcl');
  const dockercomposeoverrideFilePath = path.join(projectPath, 'docker-compose.override.yml');
  const entrypointFilePath = path.join(projectPath, 'entrypoint.sh');
  const requirementsFilePath = path.join(projectPath, 'requirements.txt');

  fs.writeFileSync(mainFilePath, `
# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

from os import environ
import traceback
import logging
import requests
import sqlite3
import json
import sys

logging.basicConfig(level="INFO")
logger = logging.getLogger(__name__)

rollup_server = environ["ROLLUP_HTTP_SERVER_URL"]
logger.info(f"HTTP rollup_server url is {rollup_server}")

# connects to internal database
con = sqlite3.connect("data.db")


def hex2str(hex):
    """
    Decodes a hex string into a regular string
    """
    return bytes.fromhex(hex[2:]).decode("utf-8")

def str2hex(str):
    """
    Encodes a string as a hex string
    """
    return "0x" + str.encode("utf-8").hex()

def post(endpoint, payloadStr, logLevel):
    logger.log(logLevel, f"Adding {endpoint} with payload: {payloadStr}")
    payload = str2hex(payloadStr)
    response = requests.post(f"{rollup_server}/{endpoint}", json={"payload": payload})
    logger.info(f"Received {endpoint} status {response.status_code} body {response.content}")


def handle_request(data, request_type):
    logger.info(f"Received {request_type} data {data}")

    status = "accept"
    try:
        # retrieves SQL statement from input payload
        statement = hex2str(data["payload"])
        logger.info(f"Processing statement: '{statement}'")

        # retrieves a cursor to the internal database
        try:
            cur = con.cursor()
        except Exception as e:
            # critical error if database is no longer accessible: DApp can no longer proceed
            msg = f"Critical error connecting to database: {e}"
            post("exception", msg, logging.ERROR)
            sys.exit(1)

        result = None
        status = "accept"
        try:
            # attempts to execute the statement and fetch any results
            cur.execute(statement)
            result = cur.fetchall()

        except Exception as e:
            status = "reject"
            msg = f"Error executing statement '{statement}': {e}"
            post("report", msg, logging.ERROR)

        if result:
            # if there is a result, converts it to JSON and posts it as a notice or report
            payloadJson = json.dumps(result)
            if request_type == "advance_state":
                post("notice", payloadJson, logging.INFO)
            else:
                post("report", payloadJson, logging.INFO)

    except Exception as e:
        status = "reject"
        msg = f"Error processing data {data}\n{traceback.format_exc()}"
        post("report", msg, logging.ERROR)

    return status


finish = {"status": "accept"}

while True:
    logger.info("Sending finish")
    response = requests.post(rollup_server + "/finish", json=finish)
    logger.info(f"Received finish status {response.status_code}")
    if response.status_code == 202:
        logger.info("No pending rollup request, trying again")
    else:
        rollup_request = response.json()
        data = rollup_request["data"]
        
        finish["status"] = handle_request(data, rollup_request["request_type"])
  
  `);
  fs.writeFileSync(readmeFilePath, `
# SQLite DApp

This example shows how to build and interact with a Cartesi Rollups application that internally runs an [SQLite database](https://www.sqlite.org/index.html). You can send any valid SQL command as input and if it produces results you get those back as a notice.
You can also directly retrieve information from the database by sending SQL queries in the form of inspect requests.

The example highlights how common mainstream technologies such as an SQL database can be easily used in a Cartesi DApp. It also introduces how errors should be handled by an application, in the case that invalid SQL statements are submitted or if a critical error occurs (in this case, failure to communicate with the database).

## Interacting with the application

We can use the [frontend-console](../frontend-console) application to interact with the DApp.
Ensure that the [application has already been built](../frontend-console/README.md#building) before using it.

First, go to a separate terminal window and switch to the \`frontend-console\` directory:

\`\`\`shell
cd frontend-console
\`\`\`

Then, send an input to create a table as follows:

\`\`\`shell
yarn start input send --payload "CREATE TABLE Persons (name text, age int)"
\`\`\`

Next, add an entry to the newly created table by submitting an SQL \`INSERT\` statement as an input:

\`\`\`shell
yarn start input send --payload "INSERT INTO Persons VALUES ('Peter', 32)"
\`\`\`

Once data has been inserted into the database, it can be queried by sending an inspect request with a regular SQL \`SELECT\` statement, such as the following:

\`\`\`shell
yarn start inspect --payload "SELECT * FROM Persons"
\`\`\`

Alternatively, the same information can also be retrieved in the form of a _notice_, so that it can be independently verified by third-parties and used in smart contracts.
In order to do that, simply send the same SQL query as an input's payload:

\`\`\`shell
yarn start input send --payload "SELECT * FROM Persons"
\`\`\`

Note that in this case the query's results will not be retrieved immediately. Notices will be generated asynchronously by the DApp whenever a submitted input corresponds to a valid SQL query.

In order to verify the notices generated by your inputs, run the command:

\`\`\`shell
yarn start notice list
\`\`\`

The payload of the notice should be something like this:

\`\`\`json
"[[\\"Peter\\", 32]]"
\`\`\`

## Running the environment in host mode

When developing an application, it is often important to easily test and debug it. For that matter, it is possible to run the Cartesi Rollups environment in [host mode](../README.md#host-mode), so that the DApp's back-end can be executed directly on the host machine, allowing it to be debugged using regular development tools such as an IDE.

This DApp's back-end is written in Python, so to run it in your machine you need to have \`python3\` installed.

In order to start the back-end, run the following commands in a dedicated terminal:

\`\`\`shell
cd sqlite/
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
ROLLUP_HTTP_SERVER_URL="http://127.0.0.1:5004" python3 sqlite.py
\`\`\`

The final command will effectively run the back-end and send corresponding outputs to port \`5004\`.
It can optionally be configured in an IDE to allow interactive debugging using features like breakpoints.

You can also use a tool like [entr](https://eradman.com/entrproject/) to restart the back-end automatically when the code changes. For example:

\`\`\`shell
ls *.py | ROLLUP_HTTP_SERVER_URL="http://127.0.0.1:5004" entr -r python3 sqlite.py
\`\`\`

After the back-end successfully starts, it should print an output like the following:

\`\`\`log
INFO:__main__:HTTP rollup_server url is http://127.0.0.1:5004
INFO:__main__:Sending finish
\`\`\`

After that, you can interact with the application normally [as explained above](#interacting-with-the-application).
`);
  fs.writeFileSync(dockerbakeFilePath, "../build/docker-riscv/base.hcl");
  fs.writeFileSync(dockerfilePath, `
    # syntax=docker.io/docker/dockerfile:1.4
FROM --platform=linux/riscv64 cartesi/python:3.10-slim-jammy

# installs required sqlite libs
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    sqlite3=3.37.2-2ubuntu0.1 \
    && rm -rf /var/lib/apt/lists/* \
    && find /var/log \( -name '*.log' -o -name '*.log.*' \) -exec truncate -s 0 {} \; \
    && truncate -s 0 /var/cache/ldconfig/aux-cache

WORKDIR /opt/cartesi/dapp

COPY ./requirements.txt .
RUN pip install -r requirements.txt --no-cache \
    && find /usr/local/lib -type d -name __pycache__ -exec rm -r {} +

COPY ./entrypoint.sh .
COPY ./sqlite.py .
  `);

  fs.writeFileSync(dockerignoreFilePath, ``);
  fs.writeFileSync(gitignoreFilePath, `.venv
*.db
`);

fs.writeFileSync(dockerbakeoverrideFilePath, `
  
target "dapp" {
}

variable "TAG" {
  default = "devel"
}

variable "DOCKER_ORGANIZATION" {
  default = "cartesi"
}

target "server" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:sqlite-\${TAG}-server"]
}

target "console" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:sqlite-\${TAG}-console"]
}

target "machine" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:sqlite-\${TAG}-machine"]
}
  
`);

fs.writeFileSync(dockercomposeoverrideFilePath, `
version: "3"

services:
  server_manager:
    image: \${DAPP_IMAGE:-cartesi/dapp:sqlite-devel-server}  
`);
fs.writeFileSync(entrypointFilePath, `
  #!/bin/sh
  # Copyright 2022 Cartesi Pte. Ltd.
  #
  # SPDX-License-Identifier: Apache-2.0
  # Licensed under the Apache License, Version 2.0 (the "License"); you may not use
  # this file except in compliance with the License. You may obtain a copy of the
  # License at http://www.apache.org/licenses/LICENSE-2.0
  #
  # Unless required by applicable law or agreed to in writing, software distributed
  # under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
  # CONDITIONS OF ANY KIND, either express or implied. See the License for the
  # specific language governing permissions and limitations under the License.

  set -e
  rollup-init python3 sqlite.py
`);

fs.writeFileSync(requirementsFilePath, "requests == 2.23.0");
}

module.exports = { createTemplate };
