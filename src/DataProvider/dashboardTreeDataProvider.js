const vscode = require('vscode');
class Dashboard_TreeDataProvider {
  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (!element) {
      // Return mock data for the root level
      return [
        { 
          label: 'Dashboard is under development', 
          collapsibleState: vscode.TreeItemCollapsibleState.None 
        }
      ];
    }
    return [];
  }
}

module.exports = { Dashboard_TreeDataProvider };
