const vscode = require('vscode');

class CartesiMachineTreeViewProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  getTreeItem(element) {
    return element;
  }

  getChildren() {
    return [
      new vscode.TreeItem('Cartesi Machine 1', vscode.TreeItemCollapsibleState.None),
      new vscode.TreeItem('Cartesi Machine 2', vscode.TreeItemCollapsibleState.None)
    ];
  }
}

module.exports = CartesiMachineTreeViewProvider;
