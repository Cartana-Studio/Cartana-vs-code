**<p align="center"> Cartana Visual studio code Extention </p>**

Cartana provides seamless support for compiling, debuging and testing smart contract diretly with in VS code. It enhances developer experiance and productivity, especially when using the github codespaces, by enabling unifide managment of front-end and back-end development with in the same repository.

[🚀 Getting Started](#-getting-started)

[🛠 Prerequisites](#-prerequisites)

[✅ System Requirements](#-system-requirements)

[🔧 Required Dependencies](#-required-dependencies)

[📥 Installation](#installation)

[🖥️ Interface Overview](#️-interface-overview)

**Cartana** is designed to streamline the development of Cartesi Rollup applications. By integrating essential tools directly into the VS Code environment, Cartana simplifies the process of **creating**, **building**, **running**, and **deploying** Cartesi applications.

Whether you are working with **generic inputs**, **Ether**, **ERC20**, **ERC721**, or **dApp addresses**, Cartana provides a seamless workflow to manage your Cartesi projects. With features like local node execution, build artifact management, and system requirement verification, Cartana ensures a smooth and efficient development experience.

Cartana offers a comprehensive suite of features designed to enhance the development experience for Cartesi Rollup applications.

Below are some of the key functionalities that make Cartana an essential tool for developers:

🔥 **Language and Code Support**

1. Syntax Highlighting for smart contract code.
2. Autocomplete & Intellisense for Cartesi Rollups functions.
3. Code Snippets for common Cartesi development patterns.

🛠 **Cartesi SDK Integration**

1. Built-in Terminal Shortcuts for running cartesi-machine, cartesi-node, etc.
2. SDK Command Execution directly inside VS Code.
3. Auto-setup of Cartesi Environment for first-time users.

🚀 **Deployment Tools**

1. One-click Deployment to Testnet/Mainnets using Docker-based workflows.
2. Automated compilation & Containerization of Cartesi Rollups.
3. Customizable Development Settings (gas, fees, network selection).

🐞 **Debugging & Simulation**

1. Transaction Simulator for testing Rollup interactions.
2. Live Log Viewer for step-by-step contract execution monitoring.
3. Breakpoints & Error Logging tailored for Cartesi architecture.

🎨 **User Experience Enhancements**

1. Custom sidebar for structured development (Create dapp, Build, Deploy and Simulate).
2. Inline Documentation & Tooling for quick guidance.
3. Status indicators to monitor Rollup execution health & Logs.

✅ **Testing Framework**

1. Built-in support for Mocha & Jest for smart contract testing.
2. Unit Testing Integration within VS Code.
3. Automated Test Execution for dApp validation.

🔴 **live Excution preview**

1. Real-time logs & metrics inside VS Code.
2. Performance Analytics on Rollup execution time & resource usage.
3. History of transactions & Debugging sessions for easy troubleshooting.

🚀 Join the Cartesi ecosystem and leverage the power of Cartana to accelerate your blockchain application development.

### 📞 Contact

If you have any questions, feel free to reach out to us at [support@cartana.io](mailto:support@cartanalabs.studio).

### 📄 License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/Cartana-Studio/Cartana-vs-code/blob/674b87cdd1cb92181cd7b5b613f78e9bb1aadca8/LICENSE.md) file for details.

### 📚 Documentation

For detailed documentation, please visit our [official documentation](https://docs.cartana.studio).

### 🔗 Related Content

- [Cartana Official Website](https://cartana.Studio)
- [Cartana Repository](https://github.com/cartana-Studio)
- [Cartana Community Forum](https://forum.cartana.Studio)
- [Cartana Discord Server](https://discord.com/cartana)

---

<p align="center">Made with ❤️ by Cartana Studio</p>

#

#

## 🚀 Getting Started

1, Install a Cartana extention

2, open the VS code sidebar

3, Write & test Smart contract with syntax Highlighting and debugging tools.

4, Compile, Build and Deploy Dapp to a testnet/mainet in one click !

#

### 🛠 Prerequisites

Before installing and using the Cartana visual stideo Code Extension, ensure your system meets the following requirements:

#### ✅ System Requirements

1. Operating System: Windows, macOS, or Linux
2. VS Code Version: v1.70 or later
3. RAM: Minimum 4GB (Recommended: 8GB+ for smooth development)
4. Storage: At least 2GB of free space

#

### 🔧 Required Dependencies

Ensure the following dependencies are installed before setting up the extension:

1️⃣ Visual Studio Code

Download and install VS Code from VS Code Download

2️⃣ Cartesi SDK

Install the Cartesi SDK by following the official guide

Or install via command line:

```sh
curl -sSL https://get.cartesi.io | sh
```

3️⃣ Docker (for Rollup deployment & containerization)

Install Docker from: Docker Official Site

Ensure Docker daemon is running:

```sh
  code docker --version
```

4️⃣ Node.js & NPM (for smart contract development)

Download and install from: Node.js Official Site

Verify installation:

```sh
  code node -v
  code npm -v
```

5️⃣ Python (for scripting & simulations)

Install Python (version 3.8+ recommended): Python Official Site

Verify installation:

```sh
  python3 --version
```

6️⃣ Rust & Cargo (for Rust-based Cartesi smart contracts)

- Install Rust via Rustup:

  ```sh
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

- Verify installation:
  ```sh
  rustc --version
  ```

7️⃣ Git (for version control & repository management)

Install Git from: Git Official Site

Verify installation:

```sh
git --version
```

#

# 📥Installation

1, Open VS code.

2, Go to Extentions Marketplace

3, Search for "**Cartana**".

4, Click install.

Alternative, install via command line:

```sh
code --install-extention cartana
```

#

# 🖥️ Interface Overview

The cartana visual studio code Extention provide a user-friendly interface to streamline cartesi Rollup dapp development.

1️⃣ **Working Area - Code Editor**

The main area in the vs code Editor, Where you can write smart contract and dApp configerations.
the extention enhance the experience with:

- **Syntax Highlighting**:

  1. Provides color-coded syntax for Cartesi smart contracts and Rollup scripts.
  2. Supports Python, JavaScript, Rust, and other programming languages.
  3. Highlights Cartesi-specific keywords, functions, and contract structures.

- **Autocomplete & Intellisense**

  1. Smart suggestions for Cartesi Rollup APIs and functions.
  2. Hover tooltips provide inline documentation for Cartesi commands.
  3. Bracket matching & auto-closing to avoid syntax errors.

- **Code Snippets for Faster Development**

- **Use predefined Cartesi snippets to quickly insert common patterns**
- **Automatically fills in default Cartesi Machine Parameters.**

- **Snippets available for stateful execution, transaction handling and Rollup verification.**

2️⃣ **Sidebar - Navigation**

Acsses the cartana Sidebar from the Activity Bar. The Sidebar provides a stractured workflow for Rollup Development to organize and navigate your dapp project.

- **Project Explorer - View and manage smart contract and script.**

- **Quick Actions**

1. Run a Cartesi dApp
2. Build & Deploy Smart Contract
3. Simulate Transactions
4. View Execution Logs

3️⃣ **Integrated development Tools - Terminal**

- **Terminal with SDK Commands**

  The Extention integrate Cartesi SDK tools into the VS Code terminal

  - Run `run` to excute smart contracts. - Compile Rollups with `build.` - Deploy with `deploy --network testnet.`
  - Debugging & Error Logging

    - Breakpoints Pause excution at key points.
    - Live Execution Logs for monitor real-time contract activity.
    - Transaction Simulator for test interactions before deploying.
