import "globals";
import "renderer/line";
import "renderer/stackedline";
import "core/noop";

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

    var context = element.getContext('2d');
    var graphElement = document.createElement('canvas');

    /* active data source */
    var source = null;

    /* options */
    var zeroBased = false;

    var highlight = true;
    var padding = 10;
    var cadence = null;

    var xScale = d3.scale.linear();
    var yScale = d3.scale.linear();

    var height = element.offsetHeight;
    var width = element.offsetWidth;

    var translation = {x: 0, y: 0};

    /* getter for the current zero-based state */
    var zeroBasedFn = (function() { return zeroBased; });

    var renderer = defaultRenderer;

    /* if there is an active animation frame request */
    var requested = false;

    /* current focus */
    var currentFocus = ugraph_NoFocus;

    /* mapping to support x-value bisecting to quickly find highlighted values */
    var highlightMap = {range: [], entries: []};

    /* render range */
    var currentRange = ugraph_NoRange;

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
     * Reconcile state from local, and automatic sources.
     *
     * This is done here, instead of in various event-triggered method to make
     * use of the fact that requestAnimationFrame is rate-limited.
     */
    function reconcile() {
      (localHover ? reconcileLocalHighlight : reconcileAutoHighlight)();
      (localDragRange ? reconcileLocalRange : reconcileAutoRange)();
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

        return focus.xstart <= x && focus.xend >= x;
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

    function updateProjection(calculated) {
      var xmin = calculated.xmin,
          xmax = calculated.xmax,
          ymin = calculated.ymin,
          ymax = calculated.ymax;

      if (currentFocus !== ugraph_NoFocus) {
        xmin = currentFocus.xstart;
        xmax = currentFocus.xend;
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
        currentFocus = {xstart: xmn, xend: xmx};
      }

      $onFocus(currentFocus);
      g.update();
    }

    function renderDrag(ctx, drag) {
      var x1 = xScale(drag.x),
          x2 = xScale(drag.xend);

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

    function $$onFocus(focus) {
      onFocus({$focus: focus});
    }

    function $onFocus(focus) {
      apply(onFocus.bind(onFocus, {$focus: focus}));
    }

    function $onRange(range) {
      apply(onRange.bind(onRange, {$range: range}));
    }

    function $onRangeAll(range) {
      var update = {$range: range};

      apply(function() {
        onRange(update);
        onDragRange(update);
      });
    }

    function $onHighlight(highlight) {
      apply(onHighlight.bind(onHighlight, {$highlight: highlight}));
    }

    function $onHighlightAll(highlight) {
      var update = {$highlight: highlight};

      apply(function() {
        onHighlight(update);
        onHoverHighlight(update);
      });
    }

    function g() {
    }

    g.update = function(newSource) {
      if (!!newSource)
        source = newSource;

      element.width = width;
      element.height = height;

      graphElement.width = width;
      graphElement.height = height;

      var graph = graphElement.getContext('2d');

      if (!graph)
        throw new Error('failed to access backing graph element for rendering');

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
      var calculated = r.calculate(source, eachPoint(xcache));

      updateProjection(calculated);
      updateHighlightMap(xcache);

      graph.clearRect(0, 0, width, height);

      graph.save();
      r(graph, calculated.data);
      graph.restore();

      this.requestRender();
    };

    g.render = function() {
      reconcile();

      context.clearRect(0, 0, width, height);
      context.drawImage(graphElement, translation.x, translation.y);

      if (currentHighlight !== ugraph_NoHighlight && !!highlight) {
        context.save();
        renderHighlight(context, currentHighlight);
        context.restore();
      }

      if (currentRange !== ugraph_NoRange) {
        context.save();
        renderDrag(context, currentRange);
        context.restore();
      }

      requested = false;
    };

    /* makes sure that only one render (at most) is requested per frame */
    g.requestRender = function() {
      if (!!requested)
        return;

      requestAnimationFrame(this.render.bind(this));
      requested = true;
    };

    g.updateAutoXval = function(_) {
      if (autoHighlightX === _)
        return;

      autoHighlightX = _;
      this.requestRender();
    };

    g.updateAutoRange = function(_) {
      _ = _ || ugraph_NoRange;

      if (autoRange === _)
        return;

      autoRange = _;
      this.requestRender();
    };

    g.updateFocus = function(_) {
      _ = _ || ugraph_NoFocus;

      if (currentFocus === _)
        return;

      currentFocus = _;
      $$onFocus(currentFocus);
      g.update();
    };

    g.updateRenderer = function(_) {
      var _renderer = renderers[_];

      if (!_renderer)
        throw new Error('no such renderer: ' + String(_));

      if (renderer === _renderer)
        return;

      renderer = _renderer;
      g.update();
    };

    g.updatePadding = function(_) {
      _ = !!_;

      if (g.padding === _)
        return;

      g.padding = _;
      g.update();
    };

    g.updateHighlight = function(_) {
      highlight = !!_;
    };

    g.updateCadence = function(_) {
      if (cadence === _)
        return;

      cadence = _;
      this.update();
    };

    g.updateZeroBased = function(_) {
      _ = !!_;

      if (zeroBased === _)
        return;

      zeroBased = _;
      this.update();
    };

    g.mousedown = function(e) {
      var x = xScale.invert(e.offsetX), y = yScale.invert(e.offsetY);
      localRange = {x: x, y: y, xend: x, yend: y};
      localDragRange = true;
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

        if (l.xend !== x || l.yend !== y) {
          localRange = {x: l.x, y: l.y, xend: x, yend: y};
          $onRange(localRange);
        }
      }

      if (highlight) {
        var newX = xScale.invert(e.offsetX);

        localHover = true;

        if (localHighlightX !== newX) {
          localHighlightX = newX;
          this.requestRender();
        }
      }
    };

    g.mouseleave = function(e) {
      if (localRange !== ugraph_NoRange)
        stopDrag(xScale.invert(e.offsetX), yScale.invert(e.offsetY));

      if (localHighlightX !== null) {
        localHighlightX = null;
        this.requestRender();
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
        g.update();
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