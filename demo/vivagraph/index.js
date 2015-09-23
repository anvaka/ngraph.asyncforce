var asyncLayout = require('../../index.js');
var Viva = require('vivagraphjs');

var graph = makeGraphFromQueryString();

var layout = asyncLayout(graph, {
  physics: {
    springLength: 10,
    springCoeff: 0.0005,
    dragCoeff: 0.02,
    gravity: -1.2
  }
});

var graphics = Viva.Graph.View.webglGraphics();
var renderer = Viva.Graph.View.renderer(graph, {
    layout : layout,
    graphics: graphics
});
renderer.run();
return;

function makeGraphFromQueryString() {
  var query = require('query-string').parse(window.location.search.substring(1));
  var graphGenerators = require('ngraph.generators');
  var createGraph = graphGenerators[query.graph] || graphGenerators.grid3;

  return createGraph(getNumber(query.n), getNumber(query.m), getNumber(query.k));

  function getNumber(string, defaultValue) {
    var number = parseFloat(string);
    return (typeof number === 'number') && !isNaN(number) ? number : (defaultValue || 10);
  }
}
