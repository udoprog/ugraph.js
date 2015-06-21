(function() {
  var ugraph = {};

  /* object that is being sent out on ugraph-hover-highlighted if no highlight
   * is active */
  var ugraph_NoHighlight = ugraph.NoHighlight = {x: null, data: []};
  var ugraph_NoRange = ugraph.NoRange = {x: null, y: null, xend: null, yend: null};
  var ugraph_NoFocus = ugraph.NoFocus = {xstart: null, xend: null};

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
      'line': Ugraph_Renderer_Line,
      'stacked-line': Ugraph_Renderer_StackedLine
    };

    var defaultRenderer = Ugraph_Renderer_Line;

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

      var source = null;

      /* options */
      var zeroBased = false;

      var highlight = true;
      var padding = 10;
      var cadence = null;

      /* all entries in this time series, slice over the x-axis */
      var _entries = [];
      /* all x-axis values in this time series, used to lookup highlighting */
      var range = [];

      var xscale = d3.scale.linear();
      var yscale = d3.scale.linear();

      var height = element.offsetHeight;
      var width = element.offsetWidth;

      var translation = {x: 0, y: 0};

      var __zeroBased = (function() { return zeroBased; });

      var _renderer = defaultRenderer;

      /* if there is an active animation frame request */
      var _requested = false;

      /* active focus */
      var _focus = ugraph_NoFocus;

      var _highlightMap = {range: [], entries: []};

      /* render range */
      var _range = ugraph_NoRange;

      /* drag/drop */
      var _localrange = ugraph_NoRange;
      var _localdrag = false;
      var _autorange = ugraph_NoRange;

      /* local hover position */
      var _localxval = null;
      var _localhover = false;

      /* current position being updated through hovering */
      var _autoxval = null;
      var _previousxval = null;

      /* local highlight */
      var _highlight = ugraph_NoHighlight;

      var onHighlight = ugraph_noop;
      var onHoverHighlight = ugraph_noop;
      var onRange = ugraph_noop;
      var onDragRange = ugraph_noop;
      var onFocus = ugraph_noop;

      /**
      * Update state caused by this graph being hovered.
      */
      function reconcileLocalHighlight() {
        /* just left hovered area */
        if (_localxval === null) {
          if (_highlight === ugraph_NoHighlight) {
            _localhover = false;
            return;
          }

          $onHighlightAll(ugraph_NoHighlight);
          _highlight = ugraph_NoHighlight;
          _localhover = false;
          return;
        }

        var highlight = findHighlight(_localxval);

        if (_highlight === highlight)
          return;

        $onHighlightAll(highlight);
        _highlight = highlight;
      }

      /**
      * Update state caused by other graph being hovered and communicated
      * through ugraph-xval
      */
      function reconcileAutoHighlight() {
        if (_autoxval === null) {
          if (_highlight == ugraph_NoHighlight)
            return;

          $onHighlight(ugraph_NoHighlight);
          _highlight = ugraph_NoHighlight;
          _previousxval = null;
          return;
        }

        /* external value has not changed */
        if (_autoxval === _previousxval)
          return;

        _previousxval = _autoxval;

        var highlight = findExactHighlight(_autoxval);

        /* nothing has changed */
        if (_highlight === highlight)
          return;

        $onHighlight(highlight);
        _highlight = highlight;
      }

      function reconcileAutoRange() {
        if (_autorange === ugraph_NoRange) {
          _range = ugraph_NoRange;
          $onRange(ugraph_NoRange);
          return;
        }

        if (_range === _autorange)
          return;

        $onRange(_autorange);
        _range = _autorange;
      }

      function reconcileLocalRange() {
        if (_localrange === ugraph_NoRange) {
          _localdrag = false;
          _range = ugraph_NoRange;
          $onRangeAll(ugraph_NoRange);
          return;
        }

        if (_range === _localrange)
          return;

        $onRangeAll(_localrange);
        _range = _localrange;
      }

      function reconcile() {
        (_localhover ? reconcileLocalHighlight : reconcileAutoHighlight)();
        (_localdrag ? reconcileLocalRange : reconcileAutoRange)();
      }

      /**
      * Function that updates the x-value cache
      */
      function eachPoint(xcache) {
        var focus = _focus;

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

        _highlightMap = {range: range, entries: entries};
      }

      function updateProjection(calculated) {
        var xmin = calculated.xmin,
            xmax = calculated.xmax,
            ymin = calculated.ymin,
            ymax = calculated.ymax;

        if (_focus !== ugraph_NoFocus) {
          xmin = _focus.xstart;
          xmax = _focus.xend;
        }

        xscale.range([padding, width - padding]).domain([xmin, xmax]);
        yscale.range([height - padding, padding]).domain([ymin, ymax]);
      }

      function stopDrag(x, y) {
        if (_localrange === ugraph_NoRange)
          return;

        var xmx = Math.max(_localrange.x, x),
            xmn = Math.min(_localrange.x, x),
            diff = xscale(xmx) - xscale(xmn);

        _localrange = ugraph_NoRange;

        if (diff < clickThreshold) {
          _focus = ugraph_NoFocus;
        } else {
          _focus = {xstart: xmn, xend: xmx};
        }

        $onFocus(_focus);
        g.update();
      }

      function renderDrag(ctx, drag) {
        var x1 = xscale(drag.x),
            x2 = xscale(drag.xend);

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
        var x = xscale(highlight.x);

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
        var range = _highlightMap.range,
            entries = _highlightMap.entries;

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
        var range = _highlightMap.range,
            entries = _highlightMap.entries;

        /* nothing to highlight */
        if (!range.length)
          return ugraph_NoHighlight;

        /* the closest (right hand side) index of the highlighted value */
        var index = d3.bisect(range, xval);

        if (index === entries.length)
          return entries[entries.length - 1];

        var smallest = entries[index];

        var c = [];

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

        var r = _renderer()
          .x(xscale)
          .y(yscale)
          .gap(gap)
          .zeroBased(__zeroBased)
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

        if (_highlight !== ugraph_NoHighlight && !!highlight) {
          context.save();
          renderHighlight(context, _highlight);
          context.restore();
        }

        if (_range !== ugraph_NoRange) {
          context.save();
          renderDrag(context, _range);
          context.restore();
        }

        _requested = false;
      };

      /* makes sure that only one render (at most) is requested per frame */
      g.requestRender = function() {
        if (!!_requested)
          return;

        requestAnimationFrame(this.render.bind(this));
        _requested = true;
      };

      g.updateAutoXval = function(_) {
        if (_autoxval === _)
          return;

        _autoxval = _;
        this.requestRender();
      };

      g.updateAutoRange = function(_) {
        _ = _ || ugraph_NoRange;

        if (_autorange === _)
          return;

        _autorange = _;
        this.requestRender();
      };

      g.updateFocus = function(_) {
        _ = _ || ugraph_NoFocus;

        if (_focus === _)
          return;

        _focus = _;
        $$onFocus(_focus);
        g.update();
      };

      g.updateRenderer = function(_) {
        var renderer = renderers[_];

        if (!renderer)
          throw new Error('no such renderer: ' + String(_));

        if (_renderer === renderer)
          return;

        _renderer = renderer;
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
        var x = xscale.invert(e.offsetX), y = yscale.invert(e.offsetY);
        _localrange = {x: x, y: y, xend: x, yend: y};
        _localdrag = true;
      };

      g.mouseup = function(e) {
        if (_localrange === ugraph_NoRange)
          return;

        stopDrag(xscale.invert(e.offsetX), yscale.invert(e.offsetY));
      };

      g.mousemove = function(e) {
        if (_localrange !== ugraph_NoRange) {
          var x = xscale.invert(e.offsetX),
              y = yscale.invert(e.offsetY),
              l = _localrange;

          if (l.xend !== x || l.yend !== y) {
            _localrange = {x: l.x, y: l.y, xend: x, yend: y};
            $onRange(_localrange);
          }
        }

        if (highlight) {
          var newX = xscale.invert(e.offsetX);

          _localhover = true;

          if (_localxval !== newX) {
            _localxval = newX;
            this.requestRender();
          }
        }
      };

      g.mouseleave = function(e) {
        if (_localrange !== ugraph_NoRange)
          stopDrag(xscale.invert(e.offsetX), yscale.invert(e.offsetY));

        if (_localxval !== null) {
          _localxval = null;
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

  function Ugraph_Calculate_Normal(source, cb) {
    var i = -1, l = source.length;

    var xmin = Infinity, xmax = -Infinity;
    var ymin = Infinity, ymax = -Infinity;

    var dst = [];

    while (++i < l) {
      var entry = source[i].data;
      var si = -1, sl = entry.length;
      var data = [];

      while (++si < sl) {
        var p = entry[si], x = p[0], y = p[1];
        data.push([x, y]);

        if (!cb(entry, x, y, null))
          continue;

        xmin = Math.min(x, xmin);
        xmax = Math.max(x, xmax);
        ymin = Math.min(y, ymin);
        ymax = Math.max(y, ymax);
      }

      dst.push({data: data});
    }

    return {
      width: xmax - xmin, height: ymax - ymin,
      xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax,
      data: dst
    };
  }

  function Ugraph_Calculate_ZeroBased(source, cb) {
    var i = -1, l = source.length;

    var xmin = Infinity, xmax = -Infinity;
    var ymin = 0, ymax = -Infinity;

    var dst = [];

    while (++i < l) {
      var entry = source[i].data;
      var si = -1, sl = entry.length;
      var data = [];

      while (++si < sl) {
        var p = entry[si], x = p[0], y = p[1];
        data.push([x, y]);

        if (!cb(entry, x, y, null))
          continue;

        xmin = Math.min(x, xmin);
        xmax = Math.max(x, xmax);
        ymin = Math.min(y, ymin);
        ymax = Math.max(y, ymax);
      }

      dst.push({data: data});
    }

    return {
      width: xmax - xmin, height: ymax - ymin,
      xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax,
      data: dst
    };
  }

  function Ugraph_Calculate_Stacked(source, cb) {
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

        xmin = Math.min(x, xmin);
        xmax = Math.max(x, xmax);
        ymin = Math.min(y0, ymin);
        ymax = Math.max(ys, ymax);
      }

      dst.push({data: data});
    }

    return {
      width: xmax - xmin, height: ymax - ymin,
      xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax,
      data: dst
    };
  }

  function Ugraph_Renderer_Line() {
    var xs = d3.identity,
        xy = d3.identity,
        gap = d3.functor(false),
        zeroBased = d3.functor(false),
        lineCap = ugraph.LineCap,
        lineWidth = ugraph.LineWidth,
        lineColors = ugraph.LineColors;

    var calculator = function(source, cb) {
      if (zeroBased())
        return Ugraph_Calculate_ZeroBased(source, cb);

      return Ugraph_Calculate_Normal(source, cb);
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

  function Ugraph_Renderer_StackedLine() {
    var xs = d3.identity,
        xy = d3.identity,
        gap = d3.functor(false),
        zeroBased = d3.functor(false),
        lineCap = ugraph.LineCap,
        lineWidth = ugraph.LineWidth,
        lineColors = ugraph.LineColors;

    /**
    * Perform initial calculation for a stacked line graph.
    */
    var calculator = Ugraph_Calculate_Stacked;

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

  window.ugraph = ugraph;
})();
