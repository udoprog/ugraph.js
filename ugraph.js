!function() {
  var ugraph = {version: "0.0.3"};
/* object that is being sent out on ugraph-hover-highlighted if no highlight
 * is active */
var ugraph_NoHighlight = ugraph.NoHighlight = {x: null, data: []};
var ugraph_NoRange = ugraph.NoRange = {x: null, y: null, x1: null, y1: null};
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

ugraph.renderer = {};
ugraph.calculate = {};
var ugraph_min = Math.min;
var ugraph_max = Math.max;

var ugraph_calculate_normal = ugraph.calculate.normal = ugraph_calculate_default(Infinity, -Infinity, Infinity, -Infinity);
var ugraph_calculate_zerobased = ugraph.calculate.zerobased = ugraph_calculate_default(Infinity, -Infinity, 0, -Infinity);

function ugraph_calculate_default(x0, x1, y0, y1) {
  function calculate(source, cb) {
    var i = -1, l = source.length;

    var xmin = x0, xmax = x1;
    var ymin = y0, ymax = y1;

    var dst = [];

    while (++i < l) {
      var entry = source[i].data;
      var si = -1, sl = entry.length;

      while (++si < sl) {
        var p = entry[si], x = p[0], y = p[1];

        if (!cb(entry, x, y, null))
          continue;

        xmin = ugraph_min(x, xmin);
        xmax = ugraph_max(x, xmax);
        ymin = ugraph_min(y, ymin);
        ymax = ugraph_max(y, ymax);
      }

      dst.push({data: entry});
    }

    return {
      width: xmax - xmin, height: ymax - ymin,
      xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax,
      data: dst
    };
  }

  return calculate;
}

ugraph.renderer.line = ugraph_renderer_line;

function ugraph_renderer_line() {
  var xs = d3.identity,
      ys = d3.identity,
      gap = d3.functor(false),
      zeroBased = d3.functor(false),
      lineCap = ugraph.LineCap,
      lineWidth = ugraph.LineWidth,
      lineColors = ugraph.LineColors;

  var calculator = function(source, cb) {
    if (zeroBased())
      return ugraph_calculate_zerobased(source, cb);

    return ugraph_calculate_normal(source, cb);
  };

  var renderLine = function(ctx, entry) {
    var data = entry.data, l = data.length;
    var prev, p, x, y, y0;

    if (!l)
      return;

    p = data[0]; x = p[0]; y = p[1]; y0 = p[2];

    ctx.beginPath();
    ctx.moveTo(xs(x), ys(y));

    var i = 0;

    prev = p;

    while (++i < l) {
      p = data[i]; x = p[0]; y = p[1]; y0 = p[2];

      if (gap(prev, p)) {
        ctx.moveTo(xs(x), ys(y));
      } else {
        ctx.lineTo(xs(x), ys(y));
      }

      prev = p;
    }

    ctx.stroke();
  };

  var renderer = function(ctx, data) {
    var i = -1, l = data.length;

    while (++i < l) {
      // canvas settings
      ctx.lineCap = lineCap;
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = lineColors[i % lineColors.length].stroke;

      renderLine(ctx, data[i]);
    }
  };

  renderer.calculate = function(source, cb) {
    return calculator(source, cb);
  };

  renderer.x = function(_) {
    xs = _;
    return this;
  };

  renderer.y = function(_) {
    ys = _;
    return this;
  };

  renderer.gap = function(_) {
    gap = _;
    return this;
  };

  renderer.zeroBased = function(_) {
    zeroBased = _;
    return this;
  };

  renderer.lineCap = function(_) {
    lineCap = _;
    return this;
  };

  renderer.lineWidth = function(_) {
    lineWidth = _;
    return this;
  };

  renderer.lineColors = function(_) {
    lineColors = _;
    return this;
  };

  return renderer;
}

ugraph.calculate.stacked = ugraph_calculate_stacked;

function ugraph_calculate_stacked(source, cb) {
  var xmin = Infinity, xmax = -Infinity;
  var ymin = Infinity, ymax = -Infinity;

  var dst = [];

  var stacking = {};

  var i = -1, l = source.length;

  while (++i < l) {
    var entry = source[i].data;
    var si = -1, sl = entry.length;
    var data = [];

    while (++si < sl) {
      var p = entry[si], x = p[0], y = p[1];
      var y0 = stacking[x] || 0;

      data.push([x, y, y0]);
      stacking[x] = y0 + y;

      if (!cb(entry, x, y, y0))
        continue;

      var ys = y + y0;

      xmin = ugraph_min(x, xmin);
      xmax = ugraph_max(x, xmax);
      ymin = ugraph_min(y0, ymin);
      ymax = ugraph_max(ys, ymax);
    }

    dst.push({data: data});
  }

  return {
    width: xmax - xmin, height: ymax - ymin,
    xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax,
    data: dst
  };
}

ugraph.renderer.stackedline = ugraph_renderer_stackedline;

function ugraph_renderer_stackedline() {
  var xs = d3.identity,
      ys = d3.identity,
      gap = d3.functor(false),
      zeroBased = d3.functor(false),
      lineCap = ugraph.LineCap,
      lineWidth = ugraph.LineWidth,
      lineColors = ugraph.LineColors;

  /**
  * Perform initial calculation for a stacked line graph.
  */
  var calculator = ugraph_calculate_stacked;

  /**
  * Renders fills, including gap calculations.
  *
  * Fills are areas below the line that fills all from y0 - y over the x-axis.
  */
  var renderFill = function(ctx, entry) {
    var data = entry.data;
    var p, x, y, y0;

    var index = 0, length = data.length;

    if (!length)
      return;

    while (index < length) {
      var i = index;

      p = data[i++]; x = p[0]; y = p[1]; y0 = p[2];

      ctx.beginPath();
      ctx.lineTo(xs(x), ys(y0 + y));

      /* previous datapoint for gap calculation */
      var prev = p;

      while (i < length) {
        p = data[i]; x = p[0]; y = p[1]; y0 = p[2];

        if (gap(prev, p))
          break;

        ++i;
        ctx.lineTo(xs(x), ys(y0 + y));
        prev = p;
      }

      var backTo = index;
      index = i;
      --i;

      while (i >= backTo) {
        p = data[i]; x = p[0]; y = p[1]; y0 = p[2];
        ctx.lineTo(xs(x), ys(y0));
        --i;
      }

      ctx.closePath();
      ctx.fill();
    }
  };

  var renderer = function(ctx, data) {
    var i = -1, l = data.length, d;

    while (++i < l) {
      d = data[i];

      var color = lineColors[i % lineColors.length];

      // canvas settings
      ctx.fillStyle = color.fill || color.stroke;
      renderFill(ctx, d);
    }
  };

  renderer.calculate = function(source, cb) {
    return calculator(source, cb);
  };

  renderer.x = function(_) {
    xs = _;
    return this;
  };

  renderer.y = function(_) {
    ys = _;
    return this;
  };

  renderer.gap = function(_) {
    gap = _;
    return this;
  };

  renderer.zeroBased = function(_) {
    zeroBased = _;
    return this;
  };

  renderer.lineCap = function(_) {
    lineCap = _;
    return this;
  };

  renderer.lineWidth = function(_) {
    lineWidth = _;
    return this;
  };

  renderer.lineColors = function(_) {
    lineColors = _;
    return this;
  };

  return renderer;
}
function ugraph_noop() { }

function ugraph_graph() {
  var clickThreshold = ugraph.ClickThreshold;
  var dragStyle = ugraph.DragStyle;

  var lineCap = ugraph.LineCap;
  var lineWidth = ugraph.LineWidth;
  var lineColors = ugraph.LineColors;

  var highlightCap = ugraph.HighlightCap;
  var highlightStyle = ugraph.HighlightStyle;
  var highlightWidth = ugraph.HighlightWidth;

  var renderers = {
    'line': ugraph_renderer_line,
    'stacked-line': ugraph_renderer_stackedline
  };

  var defaultRenderer = ugraph_renderer_line;

  function graph(element, apply) {
    if (!element)
      throw new Error('no element available');

    apply = apply || function(f) { f.apply(this, arguments); };

    var gap = function(p1, p2) {
      if (cadence === null)
        return false;

      return (p2[0] - p1[0]) > cadence;
    };

    /* options */
    var zeroBased = false;
    var highlight = true;
    var padding = 10;
    var cadence = null;

    var context = element.getContext('2d');
    var graphRendered = true;
    var graphElement = document.createElement('canvas');

    /* active data source */
    var source = null;

    /* current renderer */
    var current = null;

    var xScale = d3.scale.linear();
    var yScale = d3.scale.linear();

    var height = element.offsetHeight;
    var width = element.offsetWidth;

    /* getter for the current zero-based state */
    var zeroBasedFn = (function() { return zeroBased; });

    var renderer = defaultRenderer;

    /* current focus */
    var currentFocus = ugraph_NoFocus;

    /* mapping to support x-value bisecting to quickly find highlighted values */
    var highlightMap = {range: [], entries: []};

    /* render range */
    var currentRange = ugraph_NoRange;
    var renderedRange = ugraph_NoRange;

    /* drag/drop */
    var localRange = ugraph_NoRange;

    /* if the user is currently dragging in the graph in a way that effects
     * the highlighted range */
    var localDragRange = false;

    /* range as seen through updateAutoRange */
    var autoRange = ugraph_NoRange;

    /* local hover position */
    var localHighlightX = null;
    var localHover = false;

    /* current position being updated through hovering */
    var autoHighlightX = null;
    var previousHighlightX = null;

    /* the current highlight */
    var currentHighlight = ugraph_NoHighlight;
    var renderedHighlight = ugraph_NoHighlight;

    /* callback when highlight has changed */
    var onHighlight = ugraph_noop;
    /* callback when highlight has changed because of local hovering */
    var onHoverHighlight = ugraph_noop;
    /* callback when range has changed */
    var onRange = ugraph_noop;
    /* callback when range has changed because of local dragging */
    var onDragRange = ugraph_noop;
    /* callback when focus has been changed */
    var onFocus = ugraph_noop;

    /**
    * Update state caused by this graph being hovered.
    */
    function reconcileLocalHighlight() {
      /* just left hovered area */
      if (localHighlightX === null) {
        if (currentHighlight === ugraph_NoHighlight) {
          localHover = false;
          return;
        }

        $onHighlightAll(ugraph_NoHighlight);
        currentHighlight = ugraph_NoHighlight;
        localHover = false;
        return;
      }

      var highlight = findHighlight(localHighlightX);

      if (currentHighlight === highlight)
        return;

      $onHighlightAll(highlight);
      currentHighlight = highlight;
    }

    /**
    * Update state caused by other graph being hovered and communicated
    * through ugraph-xval
    */
    function reconcileAutoHighlight() {
      if (autoHighlightX === null) {
        if (currentHighlight == ugraph_NoHighlight)
          return;

        $onHighlight(ugraph_NoHighlight);
        currentHighlight = ugraph_NoHighlight;
        previousHighlightX = null;
        return;
      }

      /* external value has not changed */
      if (autoHighlightX === previousHighlightX)
        return;

      var highlight = findExactHighlight(autoHighlightX);

      previousHighlightX = autoHighlightX;

      /* nothing has changed */
      if (currentHighlight === highlight)
        return;

      $onHighlight(highlight);
      currentHighlight = highlight;
    }

    function reconcileAutoRange() {
      if (autoRange === ugraph_NoRange) {
        currentRange = ugraph_NoRange;
        $onRange(ugraph_NoRange);
        return;
      }

      if (currentRange === autoRange)
        return;

      $onRange(autoRange);
      currentRange = autoRange;
    }

    function reconcileLocalRange() {
      if (localRange === ugraph_NoRange) {
        localDragRange = false;
        currentRange = ugraph_NoRange;
        $onRangeAll(ugraph_NoRange);
        return;
      }

      if (currentRange === localRange)
        return;

      $onRangeAll(localRange);
      currentRange = localRange;
    }

    /**
    * Function that updates the x-value cache
    */
    function eachPoint(xcache) {
      // store local copy to avoid higher scope lookups and abrupt changes
      var focus = currentFocus;

      return function(entry, x, y, y0) {
        var axle = xcache[x] || {x: x, data: []};
        axle.data.push({entry: entry, value: y, stackValue: y0});
        xcache[x] = axle;

        if (focus === ugraph_NoFocus)
          return true;

        return focus.x0 <= x && focus.x1 >= x;
      };
    }

    function updateHighlightMap(xcache) {
      var ascending = d3.ascending;

      /* sort the generated cache by x-value */
      var sorted = Object.keys(xcache).map(function(k) {
        return xcache[k];
      }).sort(function(a, b) {
        return ascending(a.x, b.x);
      });

      var entries = [], range = [];

      var i = -1, l = sorted.length;

      while (++i < l) {
        var e = sorted[i];
        entries.push(e);
        range.push(e.x);
      }

      highlightMap = {range: range, entries: entries};
    }

    function updateProjection(c) {
      var xmin = c.xmin, xmax = c.xmax,
          ymin = c.ymin, ymax = c.ymax;

      if (currentFocus !== ugraph_NoFocus) {
        xmin = currentFocus.x0;
        xmax = currentFocus.x1;
      }

      xScale.range([padding, width - padding]).domain([xmin, xmax]);
      yScale.range([height - padding, padding]).domain([ymin, ymax]);
    }

    function stopDrag(x, y) {
      if (localRange === ugraph_NoRange)
        return;

      var xmx = Math.max(localRange.x, x),
          xmn = Math.min(localRange.x, x),
          diff = xScale(xmx) - xScale(xmn);

      localRange = ugraph_NoRange;

      if (diff < clickThreshold) {
        currentFocus = ugraph_NoFocus;
      } else {
        currentFocus = {x0: xmn, x1: xmx};
      }

      apply(function() {
        $onFocus(currentFocus);
        g.updateSource();
      });
    }

    function renderDrag(ctx, drag) {
      var x1 = xScale(drag.x),
          x2 = xScale(drag.x1);

      var xmn = Math.min(x1, x2),
          xmx = Math.max(x1, x2),
          w = xmx - xmn;

      if (w < clickThreshold)
        return;

      var h = height - padding * 2;

      ctx.fillStyle = dragStyle;
      ctx.fillRect(padding, padding, xmn - padding, h);
      ctx.fillRect(xmx, padding, width - xmx - padding, h);
    }

    function renderHighlight(ctx, highlight) {
      var x = xScale(highlight.x);

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);

      // canvas settings
      ctx.lineCap = highlightCap;
      ctx.lineWidth = highlightWidth;
      ctx.strokeStyle = highlightStyle;

      ctx.stroke();
    }

    /**
    * Finds the exact matching set of series to highlight.
    */
    function findExactHighlight(xval) {
      var range = highlightMap.range,
          entries = highlightMap.entries;

      /* nothing to highlight */
      if (!range.length)
        return ugraph_NoHighlight;

      /* the closest (right hand side) index of the highlighted value */
      var index = d3.bisect(range, xval);

      if (index === 0)
        return ugraph_NoHighlight;

      var candidate = entries[index - 1];

      if (candidate.x !== xval)
        return ugraph_NoHighlight;

      return candidate;
    }

    function findHighlight(xval) {
      var range = highlightMap.range,
          entries = highlightMap.entries;

      /* nothing to highlight */
      if (!range.length)
        return ugraph_NoHighlight;

      /* the closest (right hand side) index of the highlighted value */
      var index = d3.bisect(range, xval);

      if (index === entries.length)
        return entries[entries.length - 1];

      var smallest = entries[index];

      if (index > 0) {
        var prev = entries[index - 1];

        if (Math.abs(prev.x - xval) < Math.abs(smallest.x - xval))
          smallest = prev;
      }

      return smallest;
    }

    function $onFocus(focus) {
      onFocus({$focus: focus});
    }

    function $onRange(range) {
      onRange({$range: range});
    }

    function $onRangeAll(range) {
      var update = {$range: range};
      onRange(update);
      onDragRange(update);
    }

    function $onHighlight(highlight) {
      onHighlight({$highlight: highlight});
    }

    function $onHighlightAll(highlight) {
      var update = {$highlight: highlight};
      onHighlight(update);
      onHoverHighlight(update);
    }

    function render() {
      /*
       * Reconcile state from local, and automatic sources.
       *
       * This is done here, instead of in various event-triggered method to make
       * use of the fact that requestAnimationFrame is rate-limited.
       */
      (localHover ? reconcileLocalHighlight : reconcileAutoHighlight)();
      (localDragRange ? reconcileLocalRange : reconcileAutoRange)();

      var dirtyHighlight = currentHighlight !== renderedHighlight;
      var dirtyRange = currentRange !== renderedRange;

      var dirty = !graphRendered || dirtyHighlight || dirtyRange;

      if (dirty) {
        context.clearRect(0, 0, width, height);
        context.drawImage(graphElement, 0, 0);
        graphRendered = true;
      }

      if (currentHighlight !== renderedHighlight) {
        if (currentHighlight !== ugraph_NoHighlight) {
          context.save();
          renderHighlight(context, currentHighlight);
          context.restore();
        }

        renderedHighlight = currentHighlight;
      }

      if (currentRange !== renderedRange) {
        if (renderedRange !== ugraph_NoRange) {
          context.save();
          renderDrag(context, currentRange);
          context.restore();
        }

        renderedRange = currentRange;
      }
    }

    function g() {
    }

    g.updateSource = function(newSource) {
      if (!!newSource)
        source = newSource;

      element.width = width;
      element.height = height;

      /* size image after total rendering, to make sure we understand how to
       * translate the position */
      graphElement.width = width;
      graphElement.height = height;

      if (!source)
        return;

      var r = renderer()
        .x(xScale)
        .y(yScale)
        .gap(gap)
        .zeroBased(zeroBasedFn)
        .lineCap(lineCap)
        .lineWidth(lineWidth)
        .lineColors(lineColors);

      var xcache = {};
      var c = r.calculate(source, eachPoint(xcache));
      updateHighlightMap(xcache);

      current = [r, c];

      g.updateGraph();
    };

    g.updateGraph = function() {
      if (!current)
        return;

      var r = current[0], c = current[1];

      updateProjection(c);

      var graph = graphElement.getContext('2d');

      if (!graph)
        throw new Error('failed to access backing graph element for rendering');

      graph.save();
      graph.clearRect(0, 0, width, height);
      r(graph, c.data);
      graph.restore();

      graphRendered = false;
      render();
    };

    g.updateAutoXval = function(_) {
      if (autoHighlightX === _)
        return;

      autoHighlightX = _;
      render();
    };

    g.updateAutoRange = function(_) {
      _ = _ || ugraph_NoRange;

      if (autoRange === _)
        return;

      autoRange = _;
      render();
    };

    g.updateFocus = function(_) {
      _ = _ || ugraph_NoFocus;

      if (currentFocus === _)
        return;

      currentFocus = _;
      $onFocus(currentFocus);
      g.updateSource();
    };

    g.updateRenderer = function(_) {
      var _renderer = renderers[_];

      if (!_renderer)
        throw new Error('no such renderer: ' + String(_));

      if (renderer === _renderer)
        return;

      renderer = _renderer;
      g.updateSource();
    };

    g.updatePadding = function(_) {
      _ = !!_;

      if (padding === _)
        return;

      padding = _;
      g.updateSource();
    };

    g.updateHighlight = function(_) {
      highlight = !!_;
    };

    g.updateCadence = function(_) {
      if (cadence === _)
        return;

      cadence = _;
      g.updateSource();
    };

    g.updateZeroBased = function(_) {
      _ = !!_;

      if (zeroBased === _)
        return;

      zeroBased = _;
      g.updateSource();
    };

    g.mousedown = function(e) {
      if (e.button === 0) {
        var x = xScale.invert(e.offsetX), y = yScale.invert(e.offsetY);
        localRange = {x: x, y: y, x1: x, y1: y};
        localDragRange = true;
      }
    };

    g.mouseup = function(e) {
      if (localRange === ugraph_NoRange)
        return;

      stopDrag(xScale.invert(e.offsetX), yScale.invert(e.offsetY));
    };

    g.mousemove = function(e) {
      if (localRange !== ugraph_NoRange) {
        var x = xScale.invert(e.offsetX),
            y = yScale.invert(e.offsetY),
            l = localRange;

        if (l.x1 !== x || l.y1 !== y) {
          localRange = {x: l.x, y: l.y, x1: x, y1: y};
          apply($onRange.bind(localRange));
        }
      }

      if (highlight) {
        var newX = xScale.invert(e.offsetX);

        localHover = true;

        if (localHighlightX !== newX) {
          localHighlightX = newX;
          apply(render);
        }
      }
    };

    g.mouseleave = function(e) {
      if (localRange !== ugraph_NoRange)
        stopDrag(xScale.invert(e.offsetX), yScale.invert(e.offsetY));

      if (localHighlightX !== null) {
        localHighlightX = null;
        apply(render);
      }
    };

    g.resize = function() {
      var dirty = false;
      var newWidth = element.offsetWidth;
      var newHeight = element.offsetHeight;

      if (width !== newWidth) {
        width = newWidth;
        dirty = true;
      }

      if (height !== newHeight) {
        height = newHeight;
        dirty = true;
      }

      if (dirty)
        g.updateSource();
    };

    g.onHighlight = function(_) {
      onHighlight = _;
      return this;
    };

    g.onHoverHighlight = function(_) {
      onHoverHighlight = _;
      return this;
    };

    g.onRange = function(_) {
      onRange = _;
      return this;
    };

    g.onDragRange = function(_) {
      onDragRange = _;
      return this;
    };

    g.onFocus = function(_) {
      onFocus = _ || ugraph_noop;
      return this;
    };

    return g;
  }

  /**
   * Set the minimal movement needed to count a 'drag' event, as a click.
   */
  graph.clickThreshold = function(_) {
    if (!arguments.length) return clickThreshold;
    clickThreshold = _;
    return this;
  };

  graph.dragStyle = function(_) {
    if (!arguments.length) return dragStyle;
    dragStyle = _;
    return this;
  };

  graph.lineCap = function(_) {
    if (!arguments.length) return lineCap;
    lineCap = _;
    return this;
  };

  graph.lineWidth = function(_) {
    if (!arguments.length) return lineWidth;
    lineWidth = _;
    return this;
  };

  graph.lineWidth = function(_) {
    if (!arguments.length) return lineWidth;
    lineWidth = _;
    return this;
  };

  graph.highlightCap = function(_) {
    if (!arguments.length) return highlightCap;
    highlightCap = _;
    return this;
  };

  graph.highlightStyle = function(_) {
    if (!arguments.length) return highlightStyle;
    highlightStyle = _;
    return this;
  };

  graph.highlightWidth = function(_) {
    if (!arguments.length) return highlightWidth;
    highlightWidth = _;
    return this;
  };

  graph.lineColors = function(_) {
    if (!arguments.length) return lineColors;
    lineColors = _;
    return this;
  };

  return graph;
}

  if (typeof define === "function" && define.amd) define(ugraph);
  else if (typeof module === "object" && module.exports) module.exports = ugraph;
  this.ugraph = ugraph;
}();
