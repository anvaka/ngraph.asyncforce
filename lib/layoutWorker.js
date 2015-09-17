var createLayout = require('./createLayout.js');
var fromjson = require('ngraph.fromjson');
var validateOptions = require('../options.js');

module.exports = layoutWorker;

/**
 * This method is executed as a webworker thread. It expects 'init' signal
 * from the main thread to start layout.
 */
function layoutWorker(self) {
  var layout; // main thread will send a message to initialize this
  var asyncOptions;
  var completedIterations = 0;
  var stepCalled = false;
  var timeoutId = 0;
  var systemStable = false;

  var positions = Object.create(null);
  self.addEventListener('message', handleMessageFromMainThread);

  return; // public API is over. Below are private methods only.

  function handleMessageFromMainThread(message) {
    var kind = message.data.kind;
    var payload = message.data.payload;

    if (kind === 'init') {
      var graph = fromjson(payload.graph);
      var options = JSON.parse(payload.options);

      init(graph, options);
    } else if (kind === 'step') {
      step();
    }
    // TODO: listen for graph changes from main thread and update layout here.
  }

  function init(graph, options) {
    // unfortunately we need to revalidate here, since POSITIVE_INFINITY could
    // be lost during threads transition
    options = validateOptions(options);
    asyncOptions = options.async;

    layout = createLayout(graph, options);
    graph.forEachNode(initPosition);

    // let main thread know that we can process layout
    self.postMessage({ kind: 'initialized' });
  }

  function initPosition(node) {
    positions[node.id] = layout.getNodePosition(node.id);
  }

  function step() {
    if (!layout) {
      throw new Error('step() was called without layout being initialized. Make sure to send `init` first');
    }

    stepCalled = true;

    if (!timeoutId) {
      runLayoutCycleAsync();
    }
  }

  function runLayoutCycleAsync() {
    if (systemStable) return;

    // we have to unblock this thread to receive messages from the main thread.
    timeoutId = setTimeout(function() {
      runLayoutCycle();

      // We either wait until next `step` event from RAF, or run now if asked to
      // not wait for `step`.
      if (stepCalled || !asyncOptions.waitForStep) {
        stepCalled = false;
        runLayoutCycleAsync();
      }
      timeoutId = 0;
    }, 0);
  }

  function runLayoutCycle() {
    var wasStable = systemStable;
    for (var i = 0; i < asyncOptions.stepsPerCycle; ++i) {
      systemStable = layout.step();
      completedIterations += 1;
    }

    if (completedIterations >= asyncOptions.maxIterations) {
      systemStable = true;
    }
    if (wasStable !== systemStable) debugger;

    self.postMessage({
      kind: 'pos',
      payload: {
        positions: positions,
        systemStable: systemStable
      }
    });
  }
};
