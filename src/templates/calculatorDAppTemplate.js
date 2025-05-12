const fs = require('fs');
const path = require('path');

function createTemplate(projectPath) {
  const mainFilePath = path.join(projectPath, 'calculator.py');
  const readmeFilePath = path.join(projectPath, 'README.md');
  const dockerbakeFilePath = path.join(projectPath, 'docker-bake.json');
  const dockerfilePath = path.join(projectPath, 'Dockerfile');
  const dockerignoreFilePath = path.join(projectPath, '.dockerignore'); 
  const gitignoreFilePath = path.join(projectPath, '.gitignore');
  const dockerbakeoverrideFilePath = path.join(projectPath, 'docker-bake.override.hcl');
  const dockercomposeoverrideFilePath = path.join(projectPath, 'docker-compose.override.yml');
  const entrypointFilePath = path.join(projectPath, 'entrypoint.sh');
  const requirementsFilePath = path.join(projectPath, 'requirements.txt');
  
  fs.writeFileSync(
    mainFilePath,
    `# Copyright 2022 Cartesi Pte. Ltd.
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
from py_expression_eval import Parser

logging.basicConfig(level="INFO")
logger = logging.getLogger(__name__)

rollup_server = environ["ROLLUP_HTTP_SERVER_URL"]
logger.info(f"HTTP rollup_server url is {rollup_server}")

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

def handle_advance(data):
    logger.info(f"Received advance request data {data}")

    status = "accept"
    try:
        input = hex2str(data["payload"])
        logger.info(f"Received input: {input}")

        # Evaluates expression
        parser = Parser()
        output = parser.parse(input).evaluate({})

        # Emits notice with result of calculation
        logger.info(f"Adding notice with payload: '{output}'")
        response = requests.post(rollup_server + "/notice", json={"payload": str2hex(str(output))})
        logger.info(f"Received notice status {response.status_code} body {response.content}")

    except Exception as e:
        status = "reject"
        msg = f"Error processing data {data}\\n{traceback.format_exc()}"
        logger.error(msg)
        response = requests.post(rollup_server + "/report", json={"payload": str2hex(msg)})
        logger.info(f"Received report status {response.status_code} body {response.content}")

    return status

def handle_inspect(data):
    logger.info(f"Received inspect request data {data}")
    logger.info("Adding report")
    response = requests.post(rollup_server + "/report", json={"payload": data["payload"]})
    logger.info(f"Received report status {response.status_code}")
    return "accept"

handlers = {
    "advance_state": handle_advance,
    "inspect_state": handle_inspect,
}

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
        
        handler = handlers[rollup_request["request_type"]]
        finish["status"] = handler(rollup_request["data"])
`
  );

  fs.writeFileSync(
    readmeFilePath,
    "# Calculator dApp\nThis is a template for a Calculator decentralized application."
  );

  fs.writeFileSync(
    dockerbakeFilePath,
    "../build/docker-riscv/base.hcl"
  );

  fs.writeFileSync(
    dockerfilePath,
    `
# syntax=docker.io/docker/dockerfile:1.4
FROM --platform=linux/riscv64 cartesi/python:3.10-slim-jammy

WORKDIR /opt/cartesi/dapp

COPY ./requirements.txt .
RUN pip install -r requirements.txt --no-cache \
    && find /usr/local/lib -type d -name __pycache__ -exec rm -r {} +

COPY ./entrypoint.sh .
COPY ./calculator.py .

    `
  );

  fs.writeFileSync(
    dockerignoreFilePath,
    ""
  );

  fs.writeFileSync(
    gitignoreFilePath,
    ".venv"
  );

  fs.writeFileSync(
    dockerbakeoverrideFilePath,
    `target "dapp" {
}

variable "TAG" {
  default = "devel"
}

variable "DOCKER_ORGANIZATION" {
  default = "cartesi"
}

target "server" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:calculator-\${TAG}-server"]
}

target "console" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:calculator-\${TAG}-console"]
}

target "machine" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:calculator-\${TAG}-machine"]
}
`
  );

  fs.writeFileSync(
    dockercomposeoverrideFilePath,
    `version: "3"

services:
  server_manager:
    image: \${DAPP_IMAGE:-cartesi/dapp:calculator-devel-server}
`
  );

  fs.writeFileSync(
    entrypointFilePath,
    `#!/bin/sh
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
rollup-init python3 calculator.py
`
);

fs.writeFileSync(
    requirementsFilePath,
  `requests == 2.23.0
   py_expression_eval == 0.3.14
`
);

}

module.exports = { createTemplate };
