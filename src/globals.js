/* object that is being sent out on ugraph-hover-highlighted if no highlight
 * is active */
var ugraph_NoHighlight = ugraph.NoHighlight = {x: null, data: []};
var ugraph_NoRange = ugraph.NoRange = {x: null, y: null, x1: null, y1: null};
var ugraph_NoExtent = ugraph.NoExtent = {
  domain: {x: null, y: null, xend: null, yend: null},
  width: null, height: null
};
var ugraph_NoFocus = ugraph.NoFocus = {x0: null, x1: null};

ugraph.ClickThreshold = 5;

ugraph.DragStyle = 'rgba(0, 0, 0, 0.3)';

ugraph.LineCap = 'round';
ugraph.LineWidth = 2;
ugraph.LineColors = [
  {stroke: '#a6cee3'},
  {stroke: '#1f78b4'},
  {stroke: '#b2df8a'},
  {stroke: '#33a02c'},
  {stroke: '#fb9a99'},
  {stroke: '#e31a1c'},
  {stroke: '#fdbf6f'},
  {stroke: '#ff7f00'},
  {stroke: '#cab2d6'},
  {stroke: '#6a3d9a'},
  {stroke: '#ffff99'},
  {stroke: '#b15928'}
];

ugraph.HighlightCap = 'butt';
ugraph.HighlightWidth = 3;
ugraph.HighlightStyle = 'rgba(0, 0, 0, 1.0)';

ugraph.graph = ugraph_graph;
