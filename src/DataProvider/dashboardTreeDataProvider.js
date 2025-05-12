const vscode = require('vscode');
const path = require('path');

class Dashboard_TreeDataProvider {
  constructor(context) {
    this.context = context;
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (!element) {
      const items = this.getDashboardItems();
      if (items.length === 0) {
        return [{ 
          label: 'Dashboard is under development', 
          collapsibleState: vscode.TreeItemCollapsibleState.None 
        }];
      }
      return items;
    }
    return [];
  }

  getDashboardItems() {
    // Dashboard data or UI elements
    return [
    ];
  }

  openDashboardWebview() {
    const panel = vscode.window.createWebviewPanel(
      'dashboardWebview',
      'Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'webview', 'dashbord'))],
      }
    );

    const dashboardData = this.getDashboardItems().map(item => item.label);

    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'webview', 'dashbord', 'index.js'))
    );

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard</title>
      </head>
      <body>
        <div id="root"></div>
        <script>
          const root = document.getElementById('root');
          root.innerHTML = '<h1>Dashboard is under development</h1>';
          const dashboardData = ${JSON.stringify(dashboardData)};
        </script>
        <script src="${scriptUri}"></script>
      </body>
      </html>
    `;

    panel.webview.html = htmlContent;
  }
}

module.exports = { Dashboard_TreeDataProvider };
