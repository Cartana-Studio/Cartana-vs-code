const assert = require('assert');
const vscode = require('vscode');
const sinon = require('sinon');
const myExtension = require('../extension');

suite('Extension Tests', () => {
  let context;

  setup(() => {
    // Mock the context object
    context = {
      subscriptions: [],
    };
  });

  teardown(() => {
    sinon.restore();
  });

  test('Extension should activate without errors', () => {
    assert.doesNotThrow(() => {
      myExtension.activate(context);
    });
  });

  test('Commands should be registered', () => {
    const registerCommandStub = sinon.stub(vscode.commands, 'registerCommand');
    myExtension.activate(context);

    // Check if specific commands are registered
    assert(registerCommandStub.calledWith('cartana.create'));
    assert(registerCommandStub.calledWith('cartana.openTreeView'));
    assert(registerCommandStub.calledWith('cartana.createNewProject'));
    assert(registerCommandStub.calledWith('cartana.openTemplatesMenu'));
  });

  test('TreeDataProviders should be registered', () => {
    const registerTreeDataProviderStub = sinon.stub(vscode.window, 'registerTreeDataProvider');
    myExtension.activate(context);

    // Check if specific TreeDataProviders are registered
    assert(registerTreeDataProviderStub.calledWith('DashboardView'));
    assert(registerTreeDataProviderStub.calledWith('ExecutionSimulatorView'));
    assert(registerTreeDataProviderStub.calledWith('PerformanceAnalyticsView'));
  });
});
