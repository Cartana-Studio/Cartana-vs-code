const vscode = require('vscode');

class PerformanceAnalyticsTreeViewProvider {
  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (!element) {
      // Return mock data for the root level
      return [
        { 
          label: 'Performance Analytics is under development', 
          collapsibleState: vscode.TreeItemCollapsibleState.None 
        }
      ];
    }
    return [];
  }
}

module.exports = PerformanceAnalyticsTreeViewProvider;
