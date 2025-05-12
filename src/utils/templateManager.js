const fs = require('fs');
const path = require('path');

function createTemplate(projectPath, projectName, selectedTemplate) {
  switch (selectedTemplate) {
    case 'Python':
      fs.mkdirSync(path.join(projectPath, 'src'));
      fs.writeFileSync(path.join(projectPath, 'src', 'main.py'), `
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
import logging
import requests

logging.basicConfig(level="INFO")
logger = logging.getLogger(__name__)

rollup_server = environ["ROLLUP_HTTP_SERVER_URL"]
logger.info(f"HTTP rollup_server url is {rollup_server}")

def handle_advance(data):
    logger.info(f"Received advance request data {data}")
    logger.info("Adding notice")
    notice = {"payload": data["payload"]}
    response = requests.post(rollup_server + "/notice", json=notice)
    logger.info(f"Received notice status {response.status_code} body {response.content}")
    return "accept"

def handle_inspect(data):
    logger.info(f"Received inspect request data {data}")
    logger.info("Adding report")
    report = {"payload": data["payload"]}
    response = requests.post(rollup_server + "/report", json=report)
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
  `.trim());
      // Create a requirements.txt file
      fs.writeFileSync(path.join(projectPath, 'requirements.txt'), 'requests == 2.23.0');
      // Create a .gitignore file
      fs.writeFileSync(path.join(projectPath, '.gitignore'), 'venv/\n__pycache__/\n*.pyc');
      // Create a Dockerfile
      fs.writeFileSync(path.join(projectPath, 'Dockerfile'), `
# syntax=docker.io/docker/dockerfile:1.4
FROM cartesi/toolchain:0.14.0 as dapp-build

WORKDIR /opt/cartesi/dapp
COPY . .
  `.trim());
      // Create a docker-bake.hcl file
      fs.writeFileSync(path.join(projectPath, 'docker-bake.hcl'), '../build/std-rootfs/base.hcl');
      // Create a docker-bake.override.hcl file
      fs.writeFileSync(path.join(projectPath, 'docker-bake.override.hcl'), `
target "dapp" {
  # default context is "."
  # default dockerfile is "Dockerfile"
}

variable "TAG" {
  default = "devel"
}

variable "DOCKER_ORGANIZATION" {
  default = "cartesi"
}

target "server" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:echo-python-\${TAG}-server"]
}

target "console" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:echo-python-\${TAG}-console"]
}

target "machine" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:echo-python-\${TAG}-machine"]
}
  `.trim());
      // Create a docker-compose.override.yml file
      fs.writeFileSync(path.join(projectPath, 'docker-compose.override.yml'), `
version: "3"

services:
  server_manager:
    image: \${DAPP_IMAGE:-cartesi/dapp:echo-python-devel-server}
  `.trim());
    // Create a entrypoint.sh file
      fs.writeFileSync(path.join(projectPath, 'entrypoint.sh'), `
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
rollup-init python3 echo.py
  `.trim());
  // Create a dapp.json file
      fs.writeFileSync(path.join(projectPath, 'dapp.json'), `
{
  "fs": {
    "files": ["echo.py", "entrypoint.sh"]
  }
}
  `.trim());
      break;
    case 'C++':
      fs.mkdirSync(path.join(projectPath, 'src'));
      // Create a src directory
      fs.writeFileSync(path.join(projectPath, 'src', 'main.cpp'), `
// Copyright 2022 Cartesi Pte. Ltd.
//
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use
// this file except in compliance with the License. You may obtain a copy of the
// License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.

#include <stdio.h>
#include <iostream>

#include "3rdparty/cpp-httplib/httplib.h"
#include "3rdparty/picojson/picojson.h"

std::string handle_advance(httplib::Client &cli, picojson::value data) {
    std::cout << "Received advance request data " << data << std::endl;
    std::cout << "Adding notice" << std::endl;
    auto payload = data.get("payload").get<std::string>();
    auto notice = std::string("{\"payload\":\"") + payload + std::string("\"}");
    auto r = cli.Post("/notice", notice, "application/json");
    std::cout << "Received notice status " << r.value().status << " body " << r.value().body << std::endl;
    return "accept";
}

std::string handle_inspect(httplib::Client &cli, picojson::value data) {
    std::cout << "Received inspect request data " << data << std::endl;
    std::cout << "Adding report" << std::endl;
    auto payload = data.get("payload").get<std::string>();
    auto report = std::string("{\"payload\":\"") + payload + std::string("\"}");
    auto r = cli.Post("/report", report, "application/json");
    std::cout << "Received report status " << r.value().status << " body " << r.value().body << std::endl;
    return "accept";
}

int main(int argc, char** argv) {
    std::map<std::string, decltype(&handle_advance)> handlers = {
        {std::string("advance_state"), &handle_advance},
        {std::string("inspect_state"), &handle_inspect},
    };
    httplib::Client cli(getenv("ROLLUP_HTTP_SERVER_URL"));
    cli.set_read_timeout(20, 0);
    std::string status("accept");
    while (true) {
        std::cout << "Sending finish" << std::endl;
        auto finish = std::string("{\"status\":\"") + status + std::string("\"}");
        auto r = cli.Post("/finish", finish, "application/json");
        std::cout << "Received finish status " << r.value().status << std::endl;
        if (r.value().status == 202) {
            std::cout << "No pending rollup request, trying again" << std::endl;
        } else {
            picojson::value rollup_request;
            picojson::parse(rollup_request, r.value().body);

            auto request_type = rollup_request.get("request_type").get<std::string>();
            auto handler = handlers.find(request_type)->second;
            auto data = rollup_request.get("data");
            status = (*handler)(cli, data);
        }
    }
    return 0;
}
      `.trim());
      // Create a Makefile
      fs.writeFileSync(path.join(projectPath, 'Makefile'), `
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

CXX  := riscv64-cartesi-linux-gnu-g++
CXX_HOST := g++

.PHONY: clean 3rdparty

echo-backend: echo-backend.cpp
	make -C 3rdparty
	$(CXX) -pthread -std=c++11 -o $@ $^

echo-backend-host: echo-backend.cpp
	make -C 3rdparty
	$(CXX_HOST) -pthread -std=c++11 -o $@ $^

clean:
	@rm -rf echo-backend echo-backend-host
	make -C 3rdparty clean
      `.trim());
      // Create a .gitignore file
      fs.writeFileSync(path.join(projectPath, '.gitignore'), 'build/\n*.o\n*.exe');
      
      // Create a docker-bake.hcl file
      fs.writeFileSync(path.join(projectPath, 'docker-bake.hcl'), '../build/std-rootfs/base.hcl');
      
      // Create a docker-bake.override.hcl file
      fs.writeFileSync(path.join(projectPath, 'docker-bake.override.hcl'), `
target "dapp" {
}

variable "TAG" {
  default = "devel"
}

variable "DOCKER_ORGANIZATION" {
  default = "cartesi"
}

target "server" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:echo-cpp-\${TAG}-server"]
}

target "console" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:echo-cpp-\${TAG}-console"]
}

target "machine" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:echo-cpp-\${TAG}-machine"]
}
  `.trim());

  // Create a docker-compose.override.yml file
      fs.writeFileSync(path.join(projectPath, 'docker-compose.override.yml'), `
version: "3"

services:
  server_manager:
    image: \${DAPP_IMAGE:-cartesi/dapp:echo-cpp-devel-server}
  `.trim());

  // Create a Dockerfile
      fs.writeFileSync(path.join(projectPath, 'Dockerfile'), `
# syntax=docker.io/docker/dockerfile:1.4
FROM cartesi/toolchain:0.14.0

WORKDIR /opt/cartesi/dapp
COPY . .
RUN make
  `.trim());

  // Create a entrypoint.sh file
      fs.writeFileSync(path.join(projectPath, 'entrypoint.sh'), `
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
rollup-init ./main
  `.trim());

  // Create a dapp.json file
      fs.writeFileSync(path.join(projectPath, 'dapp.json'), `
{
  "fs": {
    "files": ["main", "entrypoint.sh"]
  }
}
  `.trim());
  
  // Create a run-host.sh file
      fs.writeFileSync(path.join(projectPath, 'run-host.sh'), ``);
      break;
      
    case 'Rust':
      fs.mkdirSync(path.join(projectPath, 'src'));
      fs.writeFileSync(path.join(projectPath, 'src', 'main.rs'), `
// Copyright 2022 Cartesi Pte. Ltd.
//
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use
// this file except in compliance with the License. You may obtain a copy of the
// License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.

use json::{object, JsonValue};
use std::env;

async fn print_response<T: hyper::body::HttpBody>(
    response: hyper::Response<T>,
) -> Result<(), Box<dyn std::error::Error>>
where
    <T as hyper::body::HttpBody>::Error: 'static,
    <T as hyper::body::HttpBody>::Error: std::error::Error,
{
    let response_status = response.status().as_u16();
    let response_body = hyper::body::to_bytes(response).await?;
    println!(
        "Received notice status {} body {}",
        response_status,
        std::str::from_utf8(&response_body)?
    );
    Ok(())
}

pub async fn handle_advance(
    client: &hyper::Client<hyper::client::HttpConnector>,
    server_addr: &str,
    request: JsonValue,
) -> Result<&'static str, Box<dyn std::error::Error>> {
    println!("Received advance request data {}", &request);
    let payload = request["data"]["payload"]
        .as_str()
        .ok_or("Missing payload")?;
    println!("Adding notice");
    let notice = object! {"payload" => format!("{}", payload)};
    let req = hyper::Request::builder()
        .method(hyper::Method::POST)
        .header(hyper::header::CONTENT_TYPE, "application/json")
        .uri(format!("{}/notice", server_addr))
        .body(hyper::Body::from(notice.dump()))?;
    let response = client.request(req).await?;
    print_response(response).await?;
    Ok("accept")
}

pub async fn handle_inspect(
    client: &hyper::Client<hyper::client::HttpConnector>,
    server_addr: &str,
    request: JsonValue,
) -> Result<&'static str, Box<dyn std::error::Error>> {
    println!("Received inspect request data {}", &request);
    let payload = request["data"]["payload"]
        .as_str()
        .ok_or("Missing payload")?;
    println!("Adding report");
    let report = object! {"payload" => format!("{}", payload)};
    let req = hyper::Request::builder()
        .method(hyper::Method::POST)
        .header(hyper::header::CONTENT_TYPE, "application/json")
        .uri(format!("{}/report", server_addr))
        .body(hyper::Body::from(report.dump()))?;
    let response = client.request(req).await?;
    print_response(response).await?;
    Ok("accept")
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = hyper::Client::new();
    let server_addr = env::var("ROLLUP_HTTP_SERVER_URL")?;

    let mut status = "accept";
    loop {
        println!("Sending finish");
        let response = object! {"status" => status.clone()};
        let request = hyper::Request::builder()
            .method(hyper::Method::POST)
            .header(hyper::header::CONTENT_TYPE, "application/json")
            .uri(format!("{}/finish", &server_addr))
            .body(hyper::Body::from(response.dump()))?;
        let response = client.request(request).await?;
        println!("Received finish status {}", response.status());

        if response.status() == hyper::StatusCode::ACCEPTED {
            println!("No pending rollup request, trying again");
        } else {
            let body = hyper::body::to_bytes(response).await?;
            let utf = std::str::from_utf8(&body)?;
            let req = json::parse(utf)?;

            let request_type = req["request_type"]
                .as_str()
                .ok_or("request_type is not a string")?;
            status = match request_type {
                "advance_state" => handle_advance(&client, &server_addr[..], req).await?,
                "inspect_state" => handle_inspect(&client, &server_addr[..], req).await?,
                &_ => {
                    eprintln!("Unknown request type");
                    "reject"
                }
            };
        }
    }
}
      `.trim());
      // Create a Cargo.toml file
      fs.writeFileSync(path.join(projectPath, 'Cargo.toml'), `
[package]
name = "echo-backend"
version = "0.3.0"
edition = "2021"
authors = ["Alex Mikhalevich <alex.mikhalevich@cartesi.io>"]

[dependencies]
json = "0.12"
hyper = { version = "0.14", features = ["http1", "runtime", "client"] }
tokio = { version = "1.18", features = ["macros", "rt-multi-thread"] }
      `.trim());
      // Create a Cargo.lock file
      fs.writeFileSync(path.join(projectPath, 'Cargo.lock'), `
# This file is automatically @generated by Cargo.
# It is not intended for manual editing.
version = 3

[[package]]
name = "bytes"
version = "1.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c4872d67bab6358e59559027aa3b9157c53d9358c51423c17554809a8858e0f8"

[[package]]
name = "cfg-if"
version = "1.0.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "baf1de4339761588bc0619e3cbc0120ee582ebb74b53b4efbf79117bd2da40fd"

[[package]]
name = "echo-backend"
version = "0.3.0"
dependencies = [
 "hyper",
 "json",
 "tokio",
]

[[package]]
name = "fnv"
version = "1.0.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3f9eec918d3f24069decb9af1554cad7c880e2da24a9afd88aca000531ab82c1"

[[package]]
name = "futures-channel"
version = "0.3.21"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c3083ce4b914124575708913bca19bfe887522d6e2e6d0952943f5eac4a74010"
dependencies = [
 "futures-core",
]

[[package]]
name = "futures-core"
version = "0.3.21"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0c09fd04b7e4073ac7156a9539b57a484a8ea920f79c7c675d05d289ab6110d3"

[[package]]
name = "futures-task"
version = "0.3.21"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "57c66a976bf5909d801bbef33416c41372779507e7a6b3a5e25e4749c58f776a"

[[package]]
name = "futures-util"
version = "0.3.21"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d8b7abd5d659d9b90c8cba917f6ec750a74e2dc23902ef9cd4cc8c8b22e6036a"
dependencies = [
 "futures-core",
 "futures-task",
 "pin-project-lite",
 "pin-utils",
]

[[package]]
name = "hermit-abi"
version = "0.1.19"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "62b467343b94ba476dcb2500d242dadbb39557df889310ac77c5d99100aaac33"
dependencies = [
 "libc",
]

[[package]]
name = "http"
version = "0.2.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ff8670570af52249509a86f5e3e18a08c60b177071826898fde8997cf5f6bfbb"
dependencies = [
 "bytes",
 "fnv",
 "itoa",
]

[[package]]
name = "http-body"
version = "0.4.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1ff4f84919677303da5f147645dbea6b1881f368d03ac84e1dc09031ebd7b2c6"
dependencies = [
 "bytes",
 "http",
 "pin-project-lite",
]

[[package]]
name = "httparse"
version = "1.7.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "496ce29bb5a52785b44e0f7ca2847ae0bb839c9bd28f69acac9b99d461c0c04c"

[[package]]
name = "httpdate"
version = "1.0.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c4a1e36c821dbe04574f602848a19f742f4fb3c98d40449f11bcad18d6b17421"

[[package]]
name = "hyper"
version = "0.14.18"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b26ae0a80afebe130861d90abf98e3814a4f28a4c6ffeb5ab8ebb2be311e0ef2"
dependencies = [
 "bytes",
 "futures-channel",
 "futures-core",
 "futures-util",
 "http",
 "http-body",
 "httparse",
 "httpdate",
 "itoa",
 "pin-project-lite",
 "socket2",
 "tokio",
 "tower-service",
 "tracing",
 "want",
]

[[package]]
name = "itoa"
version = "1.0.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1aab8fc367588b89dcee83ab0fd66b72b50b72fa1904d7095045ace2b0c81c35"

[[package]]
name = "json"
version = "0.12.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "078e285eafdfb6c4b434e0d31e8cfcb5115b651496faca5749b88fafd4f23bfd"

[[package]]
name = "lazy_static"
version = "1.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e2abad23fbc42b3700f2f279844dc832adb2b2eb069b2df918f455c4e18cc646"

[[package]]
name = "libc"
version = "0.2.125"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5916d2ae698f6de9bfb891ad7a8d65c09d232dc58cc4ac433c7da3b2fd84bc2b"

[[package]]
name = "log"
version = "0.4.17"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "abb12e687cfb44aa40f41fc3978ef76448f9b6038cad6aef4259d3c095a2382e"
dependencies = [
 "cfg-if",
]

[[package]]
name = "mio"
version = "0.8.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "52da4364ffb0e4fe33a9841a98a3f3014fb964045ce4f7a45a398243c8d6b0c9"
dependencies = [
 "libc",
 "log",
 "miow",
 "ntapi",
 "wasi",
 "winapi",
]

[[package]]
name = "miow"
version = "0.3.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b9f1c5b025cda876f66ef43a113f91ebc9f4ccef34843000e0adf6ebbab84e21"
dependencies = [
 "winapi",
]

[[package]]
name = "ntapi"
version = "0.3.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c28774a7fd2fbb4f0babd8237ce554b73af68021b5f695a3cebd6c59bac0980f"
dependencies = [
 "winapi",
]

[[package]]
name = "num_cpus"
version = "1.13.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "19e64526ebdee182341572e50e9ad03965aa510cd94427a4549448f285e957a1"
dependencies = [
 "hermit-abi",
 "libc",
]

[[package]]
name = "once_cell"
version = "1.10.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "87f3e037eac156d1775da914196f0f37741a274155e34a0b7e427c35d2a2ecb9"

[[package]]
name = "pin-project-lite"
version = "0.2.9"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e0a7ae3ac2f1173085d398531c705756c94a4c56843785df85a60c1a0afac116"

[[package]]
name = "pin-utils"
version = "0.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8b870d8c151b6f2fb93e84a13146138f05d02ed11c7e7c54f8826aaaf7c9f184"

[[package]]
name = "proc-macro2"
version = "1.0.38"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9027b48e9d4c9175fa2218adf3557f91c1137021739951d4932f5f8268ac48aa"
dependencies = [
 "unicode-xid",
]

[[package]]
name = "quote"
version = "1.0.18"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a1feb54ed693b93a84e14094943b84b7c4eae204c512b7ccb95ab0c66d278ad1"
dependencies = [
 "proc-macro2",
]

[[package]]
name = "socket2"
version = "0.4.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "66d72b759436ae32898a2af0a14218dbf55efde3feeb170eb623637db85ee1e0"
dependencies = [
 "libc",
 "winapi",
]

[[package]]
name = "syn"
version = "1.0.92"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7ff7c592601f11445996a06f8ad0c27f094a58857c2f89e97974ab9235b92c52"
dependencies = [
 "proc-macro2",
 "quote",
 "unicode-xid",
]

[[package]]
name = "tokio"
version = "1.18.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "dce653fb475565de9f6fb0614b28bca8df2c430c0cf84bcd9c843f15de5414cc"
dependencies = [
 "libc",
 "mio",
 "num_cpus",
 "once_cell",
 "pin-project-lite",
 "socket2",
 "tokio-macros",
 "winapi",
]

[[package]]
name = "tokio-macros"
version = "1.7.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b557f72f448c511a979e2564e55d74e6c4432fc96ff4f6241bc6bded342643b7"
dependencies = [
 "proc-macro2",
 "quote",
 "syn",
]

[[package]]
name = "tower-service"
version = "0.3.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "360dfd1d6d30e05fda32ace2c8c70e9c0a9da713275777f5a4dbb8a1893930c6"

[[package]]
name = "tracing"
version = "0.1.34"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5d0ecdcb44a79f0fe9844f0c4f33a342cbcbb5117de8001e6ba0dc2351327d09"
dependencies = [
 "cfg-if",
 "pin-project-lite",
 "tracing-core",
]

[[package]]
name = "tracing-core"
version = "0.1.26"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f54c8ca710e81886d498c2fd3331b56c93aa248d49de2222ad2742247c60072f"
dependencies = [
 "lazy_static",
]

[[package]]
name = "try-lock"
version = "0.2.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "59547bce71d9c38b83d9c0e92b6066c4253371f15005def0c30d9657f50c7642"

[[package]]
name = "unicode-xid"
version = "0.2.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "957e51f3646910546462e67d5f7599b9e4fb8acdd304b087a6494730f9eebf04"

[[package]]
name = "want"
version = "0.3.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1ce8a968cb1cd110d136ff8b819a556d6fb6d919363c61534f6860c7eb172ba0"
dependencies = [
 "log",
 "try-lock",
]

[[package]]
name = "wasi"
version = "0.11.0+wasi-snapshot-preview1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9c8d87e72b64a3b4db28d11ce29237c246188f4f51057d65a7eab63b7987e423"

[[package]]
name = "winapi"
version = "0.3.9"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5c839a674fcd7a98952e593242ea400abe93992746761e38641405d28b00f419"
dependencies = [
 "winapi-i686-pc-windows-gnu",
 "winapi-x86_64-pc-windows-gnu",
]

[[package]]
name = "winapi-i686-pc-windows-gnu"
version = "0.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ac3b87c63620426dd9b991e5ce0329eff545bccbbb34f3be09ff6fb6ab51b7b6"

[[package]]
name = "winapi-x86_64-pc-windows-gnu"
version = "0.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "712e227841d057c1ee1cd2fb22fa7e5a5461ae8e48fa2ca79ec42cfc1931183f"
      `.trim());
      // Create a .gitignore file
      fs.writeFileSync(path.join(projectPath, '.gitignore'), 'target/\n*.rs.bk');
      // Create a Package.json file
      fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({
        fs: {
          files: [
            "target/riscv64g-cartesi-linux-gnu/release/echo-backend",
            "entrypoint.sh"
          ]
        }
      }, null, 2));
      
      // Create a Dockerfile 
      fs.writeFileSync(path.join(projectPath, 'Dockerfile'), `
# syntax=docker.io/docker/dockerfile:1.4
FROM cartesi/toolchain:0.14.0

WORKDIR /opt/cartesi/dapp

COPY . .
RUN cargo build -Z build-std=std,core,alloc,panic_abort,proc_macro --target riscv64g-cartesi-linux-gnu.json --release
      `.trim());
      
      // Create a docker-bake.hcl file
      fs.writeFileSync(path.join(projectPath, 'docker-bake.hcl'), '../build/std-rootfs/base.hcl');
      // Create a docker-bake.override.hcl file
      fs.writeFileSync(path.join(projectPath, 'docker-bake.override.hcl'), `
target "dapp" {
}

variable "TAG" {
  default = "devel"
}

variable "DOCKER_ORGANIZATION" {
  default = "cartesi"
}

target "server" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:echo-rust-\${TAG}-server"]
}

target "console" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:echo-rust-\${TAG}-console"]
}

target "machine" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:echo-rust-\${TAG}-machine"]
}
      `.trim());
      //  Create an entrypoint.sh file
      fs.writeFileSync(path.join(projectPath, 'entrypoint.sh'), `
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
rollup-init ./target/riscv64g-cartesi-linux-gnu/release/echo-backend
      `.trim());
      // Create a .dockerignore file
      fs.writeFileSync(path.join(projectPath, '.dockerignore'), 'node_modules/\ndist/\n*.log\n*.rs.bk\nsrc/*.rs\nsrc/*.c\nsrc/*.h\nsrc/*.o\nsrc/*.so\nsrc/*.a\nsrc/*.o\nsrc/*.a\nsrc/*.so\nsrc/*.h\nsrc/*.c\nsrc/*.lua');
      // Create a docker-compose.override.yml file
      fs.writeFileSync(path.join(projectPath, 'docker-compose.override.yml'), `
version: "3"

services:
  server_manager:
    image: \${DAPP_IMAGE:-cartesi/dapp:echo-rust-devel-server}
  `.trim());
  // Create a riscv64g-cartesi-linux-gnu.json file
  fs.writeFileSync(path.join(projectPath, 'riscv64g-cartesi-linux-gnu.json'), `
{
    "arch": "riscv64",
    "code-model": "medium",
    "cpu": "generic-rv64",
    "crt-static-respected": true,
    "data-layout": "e-m:e-p:64:64-i64:64-i128:128-n64-S128",
    "dynamic-linking": true,
    "env": "gnu",
    "executables": true,
    "features": "+m,+a,+f,+d",
    "has-rpath": true,
    "is-builtin": false,
    "llvm-abiname": "lp64d",
    "llvm-target": "riscv64",
    "max-atomic-width": 64,
    "os": "linux",
    "position-independent-executables": true,
    "relro-level": "full",
    "target-family": [
      "unix"
    ],
    "linker-flavor": "gcc",
    "linker": "riscv64-cartesi-linux-gnu-gcc",
    "pre-link-args": {
        "gcc": []
    },
    "post-link-args": {
        "gcc": [
            "-Wl,--allow-multiple-definition",
            "-Wl,--start-group,-lc,-lm,-lgcc,-lstdc++,-lsupc++,--end-group"
        ]
    },
    "target-pointer-width": "64",
    "panic-strategy": "abort"
}
  `.trim());
  
      break;

    case 'Js':
      fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true }); // Ensure directory creation is recursive
      
      // Create a dapp.js file
      fs.writeFileSync(path.join(projectPath, 'src', 'index.js'), `// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use
// this file except in compliance with the License. You may obtain a copy of the
// License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.

const { ethers } = require("ethers");

const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);

async function handle_advance(data) {
    console.log("Received advance request data " + JSON.stringify(data));
    const payload = data["payload"];
    try {
        const payloadStr = ethers.utils.toUtf8String(payload);
        console.log(\`Adding notice "\${payloadStr}"\`);
    } catch (e) {
        console.log(\`Adding notice with binary value "\${payload}"\`);
    }
    const advance_req = await fetch(rollup_server + '/notice', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payload })
    });
    const json = await advance_req.json();
    console.log("Received notice status " + advance_req.status + " with body " + JSON.stringify(json));
    return "accept";
}

async function handle_inspect(data) {
    console.log("Received inspect request data " + JSON.stringify(data));
    const payload = data["payload"];
    try {
        const payloadStr = ethers.utils.toUtf8String(payload);
        console.log(\`Adding report "\${payloadStr}"\`);
    } catch (e) {
        console.log(\`Adding report with binary value "\${payload}"\`);
    }
    const inspect_req = await fetch(rollup_server + '/report', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payload })
    });
    console.log("Received report status " + inspect_req.status);
    return "accept";
}

var handlers = {
    advance_state: handle_advance,
    inspect_state: handle_inspect,
}

var finish = { status: "accept" };

(async () => {
    while (true) {
        console.log("Sending finish")

        const finish_req = await fetch(rollup_server + '/finish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'accept' })
        });

        console.log("Received finish status " + finish_req.status);


        if (finish_req.status == 202) {
            console.log("No pending rollup request, trying again");
        } else {
            const rollup_req = await finish_req.json();
            var handler = handlers[rollup_req["request_type"]];
            finish["status"] = await handler(rollup_req["data"]);

        }
    }
})();
      `.trim());

      // Create a package.json file
      fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({
        name: projectName.toLowerCase().replace(/\s+/g, '-'),
        version: "0.16.0",
        description: "Cartesi Echo JS DApp",
        dependencies: {
          ethers: "^5.5.4"
        },
        devDependencies: {
          webpack: "^5.44.0",
          "webpack-cli": "^4.7.2"
        },
        scripts: {
          build: "webpack --entry ./dapp.js --mode production",
          start: "ROLLUP_HTTP_SERVER_URL=\"http://127.0.0.1:5004\" node dapp.js"
        },
        keywords: [
          "cartesi"
        ],
        author: "Milton Jonathan <milton.jonathan@cartesi.io>",
        license: "Apache-2.0"
      }, null, 2));
      // Create a .gitignore file
      fs.writeFileSync(path.join(projectPath, '.gitignore'), 'node_modules/\ndist/\n*.log');
      fs.writeFileSync(path.join(projectPath, '.dockerignore'), 'node_modules/\ndist/');
      fs.writeFileSync(path.join(projectPath, 'docker-bake.hcl'), '../build/docker-riscv/base.hcl');
      fs.writeFileSync(path.join(projectPath, 'docker-bake.override.hcl'), `
variable "TAG" {
  default = "devel"
}

variable "DOCKER_ORGANIZATION" {
  default = "cartesi"
}

target "dapp" {
  # default context is "."
  # default dockerfile is "Dockerfile"
}

target "server" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:echo-js-\${TAG}-server"]
}

target "console" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:echo-js-\${TAG}-console"]
}

target "machine" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:echo-js-\${TAG}-machine"]
}
      `.trim());
      fs.writeFileSync(path.join(projectPath, 'docker-compose.override.yml'), `
version: "3"

services:
  server_manager:
    image: \${DAPP_IMAGE:-cartesi/dapp:echo-js-devel-server}
      `.trim());
      
      // Add Dockerfile
      fs.writeFileSync(path.join(projectPath, 'Dockerfile'), `
# syntax=docker.io/docker/dockerfile:1.4

# build stage: includes resources necessary for installing dependencies
FROM node:19-bullseye as build-stage
WORKDIR /opt/cartesi/dapp
COPY . .
RUN yarn
RUN yarn build

# runtime stage: produces final image that will be executed
FROM --platform=linux/riscv64 cartesi/node:19-jammy-slim
WORKDIR /opt/cartesi/dapp
COPY --from=build-stage /opt/cartesi/dapp/dist ./dist/
COPY ./entrypoint.sh ./
      `.trim());

      // Add entrypoint.sh
      fs.writeFileSync(path.join(projectPath, 'entrypoint.sh'), `
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
rollup-init node dist/main.js
      `.trim());
      break;

    case 'Lua':
      fs.mkdirSync(path.join(projectPath, 'src'));
      fs.writeFileSync(path.join(projectPath, 'src', 'main.lua'), `
-- Copyright 2022 Cartesi Pte. Ltd.
--
-- SPDX-License-Identifier: Apache-2.0
-- Licensed under the Apache License, Version 2.0 (the "License"); you may not use
-- this file except in compliance with the License. You may obtain a copy of the
-- License at http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software distributed
-- under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
-- CONDITIONS OF ANY KIND, either express or implied. See the License for the
-- specific language governing permissions and limitations under the License.

local http = require("socket.http")
local ltn12 = require("ltn12")
local json = require("dkjson")

local rollup_server = assert(os.getenv("ROLLUP_HTTP_SERVER_URL"), "missing ROLLUP_HTTP_SERVER_URL")

local function info(...)
    print(string.format(...))
end

local function http_post(url, body)
    local request_body = json.encode(body)
    local response_body = {}
    local result, code = http.request {
        method = "POST",
        url = url,
        source = ltn12.source.string(request_body),
        headers = {
            ["Content-Type"] = "application/json",
            ["Content-Length"] = #request_body
        },
        sink = ltn12.sink.table(response_body)
    }
    if result == nil then error("HTTP POST Request to " .. url .. " failed. " .. code) end
    return code, table.concat(response_body)
end

local handlers = {}
function handlers.advance_state(data)
    info("Received advance request data %s", json.encode(data))
    info("Adding notice")
    local notice = {payload = data.payload}
    local code, response = http_post(rollup_server .. "/notice", notice)
    info("Received notice status %d body %s", code, response)
    return "accept"
end

function handlers.inspect_state(data)
    info("Received inspect request data %s", json.encode(data))
    info("Adding report")
    local report = {payload = data.payload}
    local code, response = http_post(rollup_server .. "/report", report)
    info("Received report status %d body %s", code, response)
    return "accept"
end

local mt = {__index = function(t, k) error("Invalid request type: " .. k) end}
setmetatable(handlers, mt)

local finish = {status = "accept"}
while true do
    info("Sending finish")
    local code, response = http_post(rollup_server .. "/finish", finish)
    info("Received finish status %d", code)
    if code == 202 then
        info("No pending rollup request, trying again")
    else
        local rollup_request = json.decode(response)
        
        finish.status = handlers[rollup_request.request_type](rollup_request.data)
        
    end
end
      `.trim());
      // Create a Package.json file
      fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({
        fs: {
          files: ["echo.lua", "entrypoint.sh"]
        }
      }, null, 2));

      // Create a .gitignore file
      fs.writeFileSync(path.join(projectPath, '.gitignore'), '*.luac');

      // Create a docker file
      fs.writeFileSync(path.join(projectPath, 'Dockerfile'), `
# syntax=docker.io/docker/dockerfile:1.4
FROM cartesi/toolchain:0.14.0

WORKDIR /opt/cartesi/dapp
COPY . .
      `.trim());
      // Create a .dockerignore file
      fs.writeFileSync(path.join(projectPath, '.dockerignore'), 'node_modules/\ndist/\n*.log\n*.luac\nsrc/*.lua\nsrc/*.c\nsrc/*.h\nsrc/*.o\nsrc/*.so\nsrc/*.a\nsrc/*.o\nsrc/*.a\nsrc/*.so\nsrc/*.h\nsrc/*.c\nsrc/*.lua');
      // create a docker-bake.hcl file
      fs.writeFileSync(path.join(projectPath, 'docker-bake.hcl'), '../build/docker-riscv/base.hcl');
      // create a docker-bake.override.hcl file
      fs.writeFileSync(path.join(projectPath, 'docker-bake.override.hcl'), `
target "dapp" {
}

variable "TAG" {
  default = "devel"
}

variable "DOCKER_ORGANIZATION" {
  default = "cartesi"
}

target "server" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:echo-lua-\${TAG}-server"]
}

target "console" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:echo-lua-\${TAG}-console"]
}

target "machine" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:echo-lua-\${TAG}-machine"]
}
      `.trim());
      // Create a docker-compose.override.yml file
      fs.writeFileSync(path.join(projectPath, 'docker-compose.override.yml'), `
version: "3"

services:
  server_manager:
    image: \${DAPP_IMAGE:-cartesi/dapp:echo-lua-devel-server}
  `.trim());

      // Create an entrypoint.sh file
      fs.writeFileSync(path.join(projectPath, 'entrypoint.sh'), `
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
rollup-init lua echo.lua
      `.trim());
      break;
    case 'go':
      fs.mkdirSync(path.join(projectPath, 'src'));
      fs.writeFileSync(path.join(projectPath, 'src', 'main.go'), '// Entry point for the Go project\n\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, Go Project!")\n}');
       break;
    case 'ruby':
      fs.mkdirSync(path.join(projectPath, 'src'));
      fs.writeFileSync(path.join(projectPath, 'src', 'main.rb'), '# Entry point for the Ruby project\n\nputs "Hello, Ruby Project!"'); 
       break;
    case 'typescript':
      fs.mkdirSync(path.join(projectPath, 'src'));
      fs.writeFileSync(path.join(projectPath, 'src', 'index.ts'), '// Entry point for the TypeScript project\n\nconsole.log("Hello, TypeScript Project!");');
  }

  // Create a README file
  fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${projectName}\n\nTemplate: ${selectedTemplate}\n\n## Project Structure\n\n- src/: Source code directory\n- README.md: Project documentation\n- .gitignore: Git ignore rules\n`);
}

module.exports = { createTemplate };
