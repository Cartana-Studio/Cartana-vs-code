const vscode = require('vscode');

class ExecutionSimulatorTreeViewProvider {
  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (!element) {
      // Return mock data for the root level
      return [
        { 
          label: 'Execution Simulator is under development', 
          collapsibleState: vscode.TreeItemCollapsibleState.None 
        }
      ];
    }
    return [];
  }
}

module.exports = ExecutionSimulatorTreeViewProvider;
