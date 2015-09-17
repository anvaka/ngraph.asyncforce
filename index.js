var work = require('webworkify');
var tojson = require('ngraph.tojson');

var createLayout = require('./lib/createLayout.js');
var validateOptions = require('./options.js');

module.exports = createAsyncLayout;

function createAsyncLayout(graph, options) {
  options = validateOptions(options);

  var assignPosition = options.is3d ? assignPosition3d : assignPosition2d;

  var pendingInitialization = false;
  var initRequestSent = false;
  var systemStable = false;

  var positions = Object.create(null);

  var layoutWorker = work(require('./lib/layoutWorker.js'));
  layoutWorker.addEventListener('message', handleMessageFromWorker);

  initWorker();
  initPositions();

  var api = {
    /**
     * Request to perform one iteration of force layout. The request is
     * forwarded to web worker
     *
     * @returns {boolean} true if system is considered stable; false otherwise.
     */
    step: asyncStep,

    /**
     * Gets the last known position of a given node by its identifier.
     *
     * @param {string} nodeId identifier of a node in question.
     * @returns {object} {x: number, y: number, z: number} coordinates of a node.
     */
    getNodePosition: getNodePosition,
  };

  return api;

  function asyncStep() {
    // we cannot do anything until we receive 'initialized' message from worker
    // to confirm that it's ready to process layout requests.
    if (pendingInitialization) return;

    layoutWorker.postMessage({
      kind: 'step'
    });

    return systemStable;
  }

  function initWorker() {
    if (initRequestSent) {
      throw new Error('Init request is already sent to the worker');
    }

    layoutWorker.postMessage({
      kind: 'init',
      payload: {
        graph: tojson(graph),
        options: JSON.stringify(options)
      }
    });

    initRequestSent = true;
  }

  function initPositions() {
    // we need to initialize positions just once
    var layout = createLayout(graph, options);
    graph.forEachNode(initPosition);

    function initPosition(node) {
      positions[node.id] = layout.getNodePosition(node.id);
    }
  }

  function getNodePosition(nodeId) {
    return positions[nodeId];
  }

  function handleMessageFromWorker(message) {
    var messageKind = message.data.kind;
    var payload = message.data.payload

    if (messageKind === 'pos') {
      setPositions(payload.positions, payload.systemStable);
    } if (messageKind === 'initialized') {
      pendingInitialization = false;
      asyncStep();
    }
  }

  function setPositions(newPositions, newSystemStable) {
    systemStable = newSystemStable;
    Object.keys(newPositions).forEach(updatePosition);
    return;

    function updatePosition(nodeId) {
      var newPosition = newPositions[nodeId];
      var oldPosition = positions[nodeId];
      if (!oldPosition) {
        positions[nodeId] = newPosition;
      } else {
        assignPosition(oldPosition, newPosition);
      }
    }
  }
}

function assignPosition3d(oldPos, newPos) {
  oldPos.x = newPos.x;
  oldPos.y = newPos.y;
  oldPos.z = newPos.z;
}

function assignPosition2d(oldPos, newPos) {
  oldPos.x = newPos.x;
  oldPos.y = newPos.y;
}
