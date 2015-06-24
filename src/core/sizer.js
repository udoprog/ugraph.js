ugraph.parentSizer = ugraph_parentSizer;

/**
 * Size the rendering area after the parent element of the canvas.
 */
function ugraph_parentSizer(element) {
  return {
    w: element.parentElement.offsetWidth,
    h: element.parentElement.offsetHeight
  };
}
