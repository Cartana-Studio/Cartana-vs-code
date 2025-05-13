const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { Dashboard_TreeDataProvider } = require('./src/DataProvider/dashboardTreeDataProvider');
const ExecutionSimulatorTreeViewProvider = require('./src/DataProvider/executionSimulatorTreeViewProvider');
const PerformanceAnalyticsTreeViewProvider = require('./src/DataProvider/performanceAnalyticsTreeViewProvider');
const { createTemplate } = require('./src/utils/templateManager');
const dAppTemplates = {
  'Calculator dApp': require('./src/templates/calculatorDAppTemplate'),
  'Converter dApp': require('./src/templates/converterDAppTemplate.js'),
  'SQLite dApp': require('./src/templates/sqliteDAppTemplate.js'),
  'Auction dApp': require('./src/templates/auctionDAppTemplate.js')
};

function activate(context) {
  console.log('Cartana extension is now active');

  // Register the dashboard view provider
  const dashboardTreeDataProvider = new Dashboard_TreeDataProvider(context);
  vscode.window.registerTreeDataProvider('DashboardView', dashboardTreeDataProvider);

  // Ensure the DashboardView is refreshed when activated
  context.subscriptions.push(
    vscode.commands.registerCommand('cartana.refreshDashboard', () => {
      dashboardTreeDataProvider.refresh();
    })
  );

  // Register Execution Simulator view provider
  const executionSimulatorProvider = new ExecutionSimulatorTreeViewProvider();
  vscode.window.registerTreeDataProvider('ExecutionSimulatorView', executionSimulatorProvider);

  // Register Performance Analytics view provider
  const performanceAnalyticsProvider = new PerformanceAnalyticsTreeViewProvider();
  vscode.window.registerTreeDataProvider('PerformanceAnalyticsView', performanceAnalyticsProvider);

  // Register the command to create a new project 
  context.subscriptions.push(
    vscode.commands.registerCommand('cartana.create', () => {
      vscode.commands.executeCommand('cartana.openTreeView');
    })
  );

  // Register the command to create a new project and open existing project
  context.subscriptions.push(
    vscode.commands.registerCommand('cartana.createNewProject', async () => {
      const options = {
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Select Folder'
      };

      const folderUri = await vscode.window.showOpenDialog(options);

      if (folderUri && folderUri[0]) {
        const templates = ['Python', 'C++', 'Rust', 'Js', 'Lua', 'go', 'ruby', 'typescript'];
        const selectedTemplate = await vscode.window.showQuickPick(templates, {
          placeHolder: 'Select a project template'
        });

        if (selectedTemplate) {
          const projectName = await vscode.window.showInputBox({ prompt: 'Enter Project Name' });
          if (projectName) {
            const projectPath = path.join(folderUri[0].fsPath, projectName);
            fs.mkdirSync(projectPath);

            // Delegate template creation to templateManager
            createTemplate(projectPath, projectName, selectedTemplate);

            // Open the project folder in a new VS Code window
            vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), { forceNewWindow: true });
          }
        }
      }
    })
  );

  // Register the command to open the templates menu
  context.subscriptions.push(
    vscode.commands.registerCommand('cartana.openTemplatesMenu', async () => {
      const templates = Object.keys(dAppTemplates);
      const selectedTemplate = await vscode.window.showQuickPick(templates, {
        placeHolder: 'Select a template to use'
      });

      if (selectedTemplate) {
        const options = {
          canSelectFolders: true,
          canSelectFiles: false,
          canSelectMany: false,
          openLabel: 'Select Folder'
        };

        const folderUri = await vscode.window.showOpenDialog(options);
        if (folderUri && folderUri[0]) {
          const projectPath = path.join(folderUri[0].fsPath, selectedTemplate);
          fs.mkdirSync(projectPath);

          // Delegate template creation to the specific dApp template module
          dAppTemplates[selectedTemplate].createTemplate(projectPath);

          // Open the project folder in a new VS Code window
          vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), { forceNewWindow: true });
        }
      }
    })
  );

  // Register the command to build a Cartesi DApp
  context.subscriptions.push(
    vscode.commands.registerCommand('cartana.buildCartesiDApp', async () => {
      vscode.window.showInformationMessage('Build Cartesi DApp command executed.');
    })
  );

  // Register the command to run a Cartesi Machine
  context.subscriptions.push(
    vscode.commands.registerCommand('cartana.runCartesiMachine', async () => {
      vscode.window.showInformationMessage('Run Cartesi Machine command executed.');
    })
  );

  // Register the command to deploy an application
  context.subscriptions.push(
    vscode.commands.registerCommand('cartana.deployApplication', async () => {
      vscode.window.showInformationMessage('Deploy Application command executed.');
    })
  );

}

exports.activate = activate;

function deactivate() {}

exports.deactivate = deactivate;