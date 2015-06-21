(function() {
  var m = angular.module('ugraph', []);

  /* object that is being sent out on ugraph-hover-highlighted if no highlight
   * is active */
  var NoHighlight = {x: null, data: []};
  var NoRange = {x: null, y: null, xend: null, yend: null};
  var NoFocus = {xstart: null, xend: null};

  var ClickThreshold = 5;

  var DragStyle = 'rgba(0, 0, 0, 0.3)';

  var LineCap = 'round';
  var LineWidth = 2;
  var LineColors = [
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

  var HighlightCap = 'butt';
  var HighlightWidth = 3;
  var HighlightColor = 'rgba(0, 0, 0, 1.0)';

  var Renderers = {
    'line': Ugraph_Renderer_Line,
    'stacked-line': Ugraph_Renderer_StackedLine
  };

  var DefaultRenderer = Ugraph_Renderer_Line;

  function UgraphCtrl($scope, $element) {
    this.$scope = $scope;

    if (!$element.length)
      throw new Error('no element available');

    this.element = $element[0];
    this.context = $element[0].getContext('2d');

    this.graphElement = document.createElement('canvas');

    this.source = null;

    /* options */
    this.zeroBased = false;

    this.highlight = true;
    this.padding = 10;
    this.cadence = null;

    /* all entries in this time series, slice over the x-axis */
    this._entries = [];
    /* all x-axis values in this time series, used to lookup highlighting */
    this.range = [];

    this.x = d3.scale.linear();
    this.y = d3.scale.linear();

    this.height = this.element.offsetHeight;
    this.width = this.element.offsetWidth;

    this.translation = {x: 0, y: 0};

    this.__gap = this.gap.bind(this);
    this.__zeroBased = (function() { return this.zeroBased; }).bind(this);

    this._renderer = DefaultRenderer;

    /* if there is an active animation frame request */
    this._requested = false;

    /* active focus */
    this._focus = NoFocus;

    this._highlightMap = {range: [], entries: []};

    /* render range */
    this._range = NoRange;

    /* drag/drop */
    this._localrange = NoRange;
    this._localdrag = false;
    this._autorange = NoRange;

    /* local hover position */
    this._localxval = null;
    this._localhover = false;

    /* current position being updated through hovering */
    this._autoxval = null;
    this._previousxval = null;

    /* local highlight */
    this._highlight = NoHighlight;

    /* self-bound render function to optimize requestRender */
    this.__render = this.render.bind(this);

    this.aOnHighlighted = angular.noop;
    this.aOnHoverHighlighted = angular.noop;
    this.aOnRange = angular.noop;
    this.aOnDragRange = angular.noop;
    this.aOnFocus = angular.noop;

    this.$$onFocus = function(focus) {
      this.aOnFocus({$focus: focus});
    };

    this.$onFocus = function(focus) {
      $scope.$apply(this.aOnFocus.bind(this, {$focus: focus}));
    };

    this.$onRange = function(range) {
      $scope.$apply(this.aOnRange.bind(this, {$range: range}));
    };

    this.$onRangeAll = function(range) {
      var update = {$range: range};

      $scope.$apply(function() {
        this.aOnRange(update);
        this.aOnDragRange(update);
      }.bind(this));
    };

    this.$onHighlight = function(highlight) {
      $scope.$apply(this.aOnHighlighted.bind(this, {$highlight: highlight}));
    };

    this.$onHighlightedAll = function(highlight) {
      var update = {$highlight: highlight};

      $scope.$apply(function() {
        this.aOnHighlighted(update);
        this.aOnHoverHighlighted(update);
      }.bind(this));
    };
  }

  UgraphCtrl.prototype.gap = function(p1, p2) {
    if (this.cadence === null)
      return false;

    return (p2[0] - p1[0]) > this.cadence;
  };

  /**
   * Update state caused by this graph being hovered.
   */
  UgraphCtrl.prototype.reconcileLocalHighlight = function() {
    /* just left hovered area */
    if (this._localxval === null) {
      if (this._highlight === NoHighlight) {
        this._localhover = false;
        return;
      }

      this.$onHighlightedAll(NoHighlight);
      this._highlight = NoHighlight;
      this._localhover = false;
      return;
    }

    var highlight = this.findHighlighted(this._localxval);

    if (this._highlight === highlight)
      return;

    this.$onHighlightedAll(highlight);
    this._highlight = highlight;
  };

  /**
   * Update state caused by other graph being hovered and communicated
   * through ugraph-xval
   */
  UgraphCtrl.prototype.reconcileAutoHighlight = function() {
    if (this._autoxval === null) {
      if (this._highlight == NoHighlight)
        return;

      this.$onHighlight(NoHighlight);
      this._previousxval = null;
      this._highlight = NoHighlight;
      return;
    }

    /* external value has not changed */
    if (this._autoxval === this._previousxval)
      return;

    this._previousxval = this._autoxval;

    var highlight = this.findExactHighlighted(this._autoxval);

    /* nothing has changed */
    if (this._highlight === highlight)
      return;

    this.$onHighlight(highlight);
    this._highlight = highlight;
  };

  UgraphCtrl.prototype.reconcileAutoRange = function() {
    if (this._autorange === NoRange) {
      this._range = NoRange;
      this.$onRange(NoRange);
      return;
    }

    if (this._range === this._autorange)
      return;

    this.$onRange(this._autorange);
    this._range = this._autorange;
  };

  UgraphCtrl.prototype.reconcileLocalRange = function() {
    if (this._localrange === NoRange) {
      this._localdrag = false;
      this._range = NoRange;
      this.$onRangeAll(NoRange);
      return;
    }

    if (this._range === this._localrange)
      return;

    this.$onRangeAll(this._localrange);
    this._range = this._localrange;
  };

  UgraphCtrl.prototype.reconcile = function() {
    (this._localhover ? this.reconcileLocalHighlight : this.reconcileAutoHighlight).call(this);
    (this._localdrag ? this.reconcileLocalRange : this.reconcileAutoRange).call(this);
  };

  UgraphCtrl.prototype.render = function() {
    this.reconcile();

    var ctx = this.context;

    ctx.clearRect(0, 0, this.width, this.height);
    ctx.drawImage(this.graphElement, this.translation.x, this.translation.y);

    if (this._highlight !== NoHighlight && !!this.highlight) {
      ctx.save();
      this.renderHighlight(ctx, this._highlight);
      ctx.restore();
    }

    if (this._range !== NoRange) {
      ctx.save();
      this.renderDrag(ctx, this._range);
      ctx.restore();
    }

    this._requested = false;
  };

  /* makes sure that only one render (at most) is requested per frame */
  UgraphCtrl.prototype.requestRender = function() {
    if (!!this._requested)
      return;

    requestAnimationFrame(this.__render);
    this._requested = true;
  };

  UgraphCtrl.prototype.updateAutoXval = function(_) {
    if (this._autoxval === _)
      return;

    this._autoxval = _;
    this.requestRender();
  };

  UgraphCtrl.prototype.updateAutoRange = function(_) {
    _ = _ || NoRange;

    if (this._autorange === _)
      return;

    this._autorange = _;
    this.requestRender();
  };

  UgraphCtrl.prototype.updateFocus = function(_) {
    _ = _ || NoFocus;

    if (this._focus === _)
      return;

    this._focus = _;
    this.$$onFocus(this._focus);
    this.update();
  };

  UgraphCtrl.prototype.updateRenderer = function(_) {
    var renderer = Renderers[_];

    if (!renderer)
      throw new Error('no such renderer: ' + String(_));

    if (this._renderer === renderer)
      return;

    this._renderer = renderer;
    this.update();
  };

  /**
   * Function that updates the x-value cache
   */
  UgraphCtrl.prototype.eachPoint = function(xcache) {
    var focus = this._focus;

    return function(entry, x, y, y0) {
      var axle = xcache[x] || {x: x, data: []};
      axle.data.push({entry: entry, value: y, stackValue: y0});
      xcache[x] = axle;

      if (focus === NoFocus)
        return true;

      return focus.xstart <= x && focus.xend >= x;
    };
  };

  UgraphCtrl.prototype.updateHighlightMap = function(xcache) {
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

    this._highlightMap = {range: range, entries: entries};
  };

  UgraphCtrl.prototype.updateProjection = function(calculated) {
    var xmin = calculated.xmin,
        xmax = calculated.xmax,
        ymin = calculated.ymin,
        ymax = calculated.ymax;

    if (this._focus !== NoFocus) {
      xmin = this._focus.xstart;
      xmax = this._focus.xend;
    }

    this.x.range([this.padding, this.width - this.padding]).domain([xmin, xmax]);
    this.y.range([this.height - this.padding, this.padding]).domain([ymin, ymax]);
  };

  UgraphCtrl.prototype.update = function(newSource) {
    if (!!newSource)
      this.source = newSource;

    this.element.width = this.width;
    this.element.height = this.height;

    this.graphElement.width = this.width;
    this.graphElement.height = this.height;

    var graph = this.graphElement.getContext('2d');

    if (!graph)
      throw new Error('failed to access backing graph element for rendering');

    if (!this.source)
      return;

    var r = this._renderer()
      .x(this.x)
      .y(this.y)
      .gap(this.__gap)
      .zeroBased(this.__zeroBased);

    var xcache = {};
    var calculated = r.calculate(this.source, this.eachPoint(xcache));

    this.updateProjection(calculated);
    this.updateHighlightMap(xcache);

    graph.clearRect(0, 0, this.width, this.height);

    graph.save();
    r(graph, calculated.data);
    graph.restore();

    this.requestRender();
  };

  UgraphCtrl.prototype.mousedown = function(e) {
    var x = this.x.invert(e.offsetX), y = this.y.invert(e.offsetY);
    this._localrange = {x: x, y: y, xend: x, yend: y};
    this._localdrag = true;
  };

  UgraphCtrl.prototype.mouseup = function(e) {
    if (this._localrange === NoRange)
      return;

    this.stopDrag(this.x.invert(e.offsetX), this.y.invert(e.offsetY));
  };

  UgraphCtrl.prototype.stopDrag = function(x, y) {
    if (this._localrange === NoRange)
      return;

    var xmx = Math.max(this._localrange.x, x),
        xmn = Math.min(this._localrange.x, x),
        diff = this.x(xmx) - this.x(xmn);

    this._localrange = NoRange;

    if (diff < ClickThreshold) {
      this._focus = NoFocus;
    } else {
      this._focus = {xstart: xmn, xend: xmx};
    }

    this.$onFocus(this._focus);
    this.update();
  };

  UgraphCtrl.prototype.mousemove = function(e) {
    if (this._localrange !== NoRange) {
      var x = this.x.invert(e.offsetX),
          y = this.y.invert(e.offsetY),
          l = this._localrange;

      if (l.xend !== x || l.yend !== y) {
        this._localrange = {x: l.x, y: l.y, xend: x, yend: y};
        this.$onRange(this._localrange);
      }
    }

    if (this.highlight) {
      var newX = this.x.invert(e.offsetX);

      this._localhover = true;

      if (this._localxval !== newX) {
        this._localxval = newX;
        this.requestRender();
      }
    }
  };

  UgraphCtrl.prototype.mouseleave = function(e) {
    if (this._localrange !== NoRange)
      this.stopDrag(this.x.invert(e.offsetX), this.y.invert(e.offsetY));

    if (this._localxval !== null) {
      this._localxval = null;
      this.requestRender();
    }
  };

  UgraphCtrl.prototype.resize = function() {
    var dirty = false;
    var newWidth = this.element.offsetWidth;
    var newHeight = this.element.offsetHeight;

    if (this.width !== newWidth) {
      this.width = newWidth;
      dirty = true;
    }

    if (this.height !== newHeight) {
      this.height = newHeight;
      dirty = true;
    }

    if (dirty)
      this.update();
  };

  UgraphCtrl.prototype.renderDrag = function(ctx, drag) {
    var x1 = this.x(drag.x),
        x2 = this.x(drag.xend);

    var xmn = Math.min(x1, x2),
        xmx = Math.max(x1, x2),
        w = xmx - xmn;

    if (w < ClickThreshold)
      return;

    var h = this.height - this.padding * 2;

    ctx.fillStyle = DragStyle;
    ctx.fillRect(this.padding, this.padding, xmn - this.padding, h);
    ctx.fillRect(xmx, this.padding, this.width - xmx - this.padding, h);
  };

  UgraphCtrl.prototype.renderHighlight = function(ctx, highlight) {
    var x = this.x(highlight.x);

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, this.height);

    // canvas settings
    ctx.lineCap = HighlightCap;
    ctx.lineWidth = HighlightWidth;
    ctx.strokeStyle = HighlightColor;

    ctx.stroke();
  };

  /**
   * Finds the exact matching set of series to highlight.
   */
  UgraphCtrl.prototype.findExactHighlighted = function(xval) {
    var range = this._highlightMap.range,
        entries = this._highlightMap.entries;

    /* nothing to highlight */
    if (!range.length)
      return NoHighlight;

    /* the closest (right hand side) index of the highlighted value */
    var index = d3.bisect(range, xval);

    if (index === 0)
      return NoHighlight;

    var candidate = entries[index - 1];

    if (candidate.x !== xval)
      return NoHighlight;

    return candidate;
  };

  UgraphCtrl.prototype.findHighlighted = function(xval) {
    var range = this._highlightMap.range,
        entries = this._highlightMap.entries;

    /* nothing to highlight */
    if (!range.length)
      return NoHighlight;

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
  };

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
        zeroBased = d3.functor(false);

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
        ctx.lineCap = LineCap;
        ctx.lineWidth = LineWidth;
        ctx.strokeStyle = LineColors[i % LineColors.length].stroke;

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

    return renderer;
  }

  function Ugraph_Renderer_StackedLine() {
    var xs = d3.identity,
        xy = d3.identity,
        gap = d3.functor(false),
        zeroBased = d3.functor(false);

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

        var color = LineColors[i % LineColors.length];

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

    return renderer;
  }

  m.directive('ugraph', function($parse, $window) {
    return {
      restrict: 'A',
      require: 'ugraph',
      controller: UgraphCtrl,
      link: function($scope, $element, $attr, ctrl) {
        if (!!$attr.ugraphOnHighlighted) {
          var onHighlightedFn = $parse($attr.ugraphOnHighlighted);
          ctrl.aOnHighlighted = onHighlightedFn.bind(onHighlightedFn, $scope);
        }

        if (!!$attr.ugraphOnHoverHighlighted) {
          var onHoverHighlightedFn = $parse($attr.ugraphOnHoverHighlighted);
          ctrl.aOnHoverHighlighted = onHoverHighlightedFn.bind(onHoverHighlightedFn, $scope);
        }

        if (!!$attr.ugraphOnRange) {
          var onRangeFn = $parse($attr.ugraphOnRange);
          ctrl.aOnRange = onRangeFn.bind(onRangeFn, $scope);
        }

        if (!!$attr.ugraphOnDragRange) {
          var onDragRangeFn = $parse($attr.ugraphOnDragRange);
          ctrl.aOnDragRange = onDragRangeFn.bind(onDragRangeFn, $scope);
        }

        if (!!$attr.ugraphOnFocus) {
          var onFocusFn = $parse($attr.ugraphOnFocus);
          ctrl.aOnFocus = onFocusFn.bind(onFocusFn, $scope);
        }

        // watches

        if (!!$attr.ugraphAutoXval) {
          /* watch for updates on x value to change highlighting */
          $scope.$watch($attr.ugraphAutoXval, ctrl.updateAutoXval.bind(ctrl));
        }

        if (!!$attr.ugraphAutoRange) {
          /* watch for updates on x value to change highlighting */
          $scope.$watch($attr.ugraphAutoRange, ctrl.updateAutoRange.bind(ctrl));
        }

        if (!!$attr.ugraphAutoFocus) {
          /* watch for updates on x value to change highlighting */
          $scope.$watch($attr.ugraphAutoFocus, ctrl.updateFocus.bind(ctrl));
        }

        if (!!$attr.ugraphRenderer) {
          $scope.$watch($attr.ugraphRenderer, ctrl.updateRenderer.bind(ctrl));
        }

        if (!!$attr.ugraphHighlight) {
          $scope.$watch($attr.ugraphHighlight, function(highlight) {
            ctrl.highlight = !!highlight;
          });
        }

        if (!!$attr.ugraphPadding) {
          $scope.$watch($attr.ugraphPadding, function(_) {
            _ = !!_;

            if (ctrl.padding === _)
              return;

            ctrl.padding = _;
            ctrl.update();
          });
        }

        if (!!$attr.ugraphCadence) {
          $scope.$watch($attr.ugraphCadence, function(_) {
            if (ctrl.cadence === _)
              return;

            ctrl.cadence = _;
            ctrl.update();
          });
        }

        if (!!$attr.ugraphZeroBased) {
          $scope.$watch($attr.ugraphZeroBased, function(_) {
            _ = !!_;

            if (ctrl.zeroBased === _)
              return;

            ctrl.zeroBased = _;
            ctrl.update();
          });
        }

        if (!!$attr.ugraph) {
          $scope.$watch($attr.ugraph, ctrl.update.bind(ctrl));
        }

        var $w = angular.element($window);

        var mousedown = ctrl.mousedown.bind(ctrl);
        var mouseup = ctrl.mouseup.bind(ctrl);
        var mousemove = ctrl.mousemove.bind(ctrl);
        var mouseleave = ctrl.mouseleave.bind(ctrl);
        var resize = ctrl.resize.bind(ctrl);

        $element.bind('mousedown', mousedown);
        $element.bind('mouseup', mouseup);
        $element.bind('mousemove', mousemove);
        $element.bind('mouseleave', mouseleave);
        $w.bind('resize', resize);

        $scope.$on('$destroy', function() {
          $element.unbind('mousedown', mousedown);
          $element.unbind('mouseup', mouseup);
          $element.unbind('mousemove', mousemove);
          $element.unbind('mouseleave', mousemove);
          $w.unbind('resize', resize);
        });

        /* detect initial sizing */
        ctrl.resize();
      }
    };
  });
})();
