(function() {
  var m = angular.module('ugraph', []);

  /* object that is being sent out on ugraph-hover-highlighted if no highlight
   * is active */
  var NoHighlight = {x: null, data: []};

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

  function UgraphCtrl($scope, $element) {
    this.$scope = $scope;

    if (!$element.length)
      throw new Error('no element available');

    this.element = $element[0];
    this.context = $element[0].getContext('2d');

    this.graphElement = document.createElement('canvas');

    this.source = null;

    this._renderer = UgraphCtrl.defaultRenderer;
    this.highlight = true;
    this.padding = 10;
    this.cadence = null;

    /* all entries in this time series, slice over the x-axis */
    this._entries = [];
    /* all x-axis values in this time series, used to lookup highlighting */
    this.range = [];

    this.x = d3.scale.linear();
    this.y = d3.scale.linear();

    this.translation = {x: 0, y: 0};
    this._requested = false;

    this._focus = null;

    /* drag/drop */
    this._drag = null;
    this._dragend = null;
    this._dragging = false;

    this.height = this.element.offsetHeight;
    this.width = this.element.offsetWidth;

    /* local hover position */
    this.localxpos = null;
    this.localhover = false;

    /* current position being updated through hovering */
    this.externalxval = null;
    this.previousxval = null;

    /* local highlight */
    this.localhighlight = NoHighlight;

    /* self-bound render function to optimize requestRender */
    this.__render = this.render.bind(this);

    this.aHighlighted = angular.noop;
    this.aHoverHighlighted = angular.noop;

    this.__highlight = function(highlight) {
      $scope.$apply(function() {
        this.aHighlighted({$highlight: highlight});
      }.bind(this));
    };

    this.__highlightAll = function(highlight) {
      $scope.$apply(function() {
        this.aHighlighted({$highlight: highlight});
        this.aHoverHighlighted({$highlight: highlight});
      }.bind(this));
    };
  }

  /**
   * Update state caused by this graph being hovered.
   */
  UgraphCtrl.prototype.reconcileLocal = function() {
    /* just left hovered area */
    if (this.localxpos === null) {
      if (this.localhighlight == NoHighlight) {
        this.localhover = false;
        return;
      }

      this.__highlightAll(NoHighlight);
      this.localhighlight = NoHighlight;
      this.localhover = false;
      return;
    }

    var highlight = this.findHighlighted(this.x.invert(this.localxpos));

    if (this.localhighlight === highlight)
      return;

    this.__highlightAll(highlight);
    this.localhighlight = highlight;
  };

  /**
   * Update state caused by other graph being hovered and communicated
   * through ugraph-xval
   */
  UgraphCtrl.prototype.reconcileExternal = function() {
    if (this.externalxval === null) {
      if (this.localhighlight == NoHighlight)
        return;

      this.__highlight(NoHighlight);
      this.previousxval = null;
      this.localhighlight = NoHighlight;
      return;
    }

    /* external value has not changed */
    if (this.externalxval === this.previousxval)
      return;

    this.previousxval = this.externalxval;

    var highlight = this.findExactHighlighted(this.externalxval);

    /* nothing has changed */
    if (this.localhighlight === highlight)
      return;

    this.__highlight(highlight);
    this.localhighlight = highlight;
  };

  UgraphCtrl.prototype.reconcile = function() {
    (this.localhover ? this.reconcileLocal : this.reconcileExternal).call(this);
  };

  UgraphCtrl.prototype.render = function() {
    this.reconcile();
    this.context.clearRect(0, 0, this.width, this.height);
    this.context.drawImage(this.graphElement, this.translation.x, this.translation.y);

    if (this.localhighlight !== NoHighlight && !!this.highlight)
      this.renderHighlight(this.localhighlight);

    if (this._drag !== null)
      this.renderDrag(this._drag);

    this._requested = false;
  };

  /* makes sure that only one render (at most) is requested per frame */
  UgraphCtrl.prototype.requestRender = function() {
    if (!!this._requested)
      return;

    requestAnimationFrame(this.__render);
    this._requested = true;
  };

  UgraphCtrl.prototype.updateRenderer = function(_) {
    var renderer = UgraphCtrl.renderers[_];

    if (!renderer)
      throw new Error('no such renderer: ' + String(_));

    this._renderer = renderer;
    this.update();
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

    var r = new this._renderer(this);

    var axisCache = {};

    var analyzed = r.calculate(
      this.source,
      (function(entry, x, y, y0) {
        var axle = axisCache[x] || {x: x, data: []};
        axle.data.push({entry: entry, value: y, stackValue: y0});
        axisCache[x] = axle;

        if (this._focus === null)
          return true;

        return this._focus.xstart <= x && this._focus.xend >= x;
      }).bind(this));

    this.x.range([this.padding, this.width - this.padding]).domain([analyzed.xmin, analyzed.xmax]);
    this.y.range([this.height - this.padding, this.padding]).domain([analyzed.ymin, analyzed.ymax]);

    graph.clearRect(0, 0, this.width, this.height);
    r.render(graph, analyzed.data);

    var sorted = Object.keys(axisCache).map(function(k) {
      return axisCache[k];
    }).sort(function(a, b) {
      if (a.x < b.x)
        return -1;

      if (a.x > b.x)
        return 1;

      return 0;
    });

    var entries = [], range = [];

    sorted.map(function(e) {
      entries.push(e);
      range.push(e.x);
    });

    this._entries = entries;
    this._range = range;
    this.requestRender();
  };

  UgraphCtrl.prototype.mousedown = function(e) {
    var x = e.offsetX, y = e.offsetY;
    this._drag = {x: x, y: y, xend: x, yend: y};
  };

  UgraphCtrl.prototype.mouseup = function(e) {
    if (this._drag !== null)
      this.stopDrag(e.offsetX, e.offsetY);
  };

  UgraphCtrl.prototype.stopDrag = function(x, y) {
    if (this._drag === null)
      return;

    var xmx = Math.max(this._drag.x, x),
        xmn = Math.min(this._drag.x, x),
        diff = xmx - xmn;

    this._drag = null;

    if (diff < ClickThreshold) {
      this._focus = null;
    } else {
      this._focus = {xstart: this.x.invert(xmn), xend: this.x.invert(xmx)};
    }

    this.update();
  };

  UgraphCtrl.prototype.mousemove = function(e) {
    if (this._drag !== null) {
      var x = e.offsetX, y = e.offsetY;
      this._drag.xend = e.offsetX;
      this._drag.yend = e.offsetY;
    }

    if (this.highlight) {
      this.localxpos = e.offsetX;
      this.localhover = true;
      this.requestRender();
    }
  };

  UgraphCtrl.prototype.mouseleave = function(e) {
    if (this._drag !== null)
      this.stopDrag(e.offsetX, e.offsetY);

    if (this.localxpos !== null) {
      this.localxpos = null;
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

  UgraphCtrl.prototype.renderDrag = function(drag) {
    var x1 = drag.x,
        x2 = drag.xend,
        ctx = this.context;

    var xmn = Math.min(x1, x2),
        xmx = Math.max(x1, x2),
        w = xmx - xmn;

    ctx.fillStyle = DragStyle;
    ctx.fillRect(xmn, 0, w, this.height);
  };

  UgraphCtrl.prototype.renderHighlight = function(highlight) {
    var x = this.x(highlight.x),
        ctx = this.context;

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
    var range = this._range,
        entries = this._entries;

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
    var range = this._range,
        entries = this._entries;

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

  function Ugraph_Renderer_Line(ctrl) {
    this.ctrl = ctrl;
  }

  /**
   * Perform initial calculation for a line graph.
   */
  Ugraph_Renderer_Line.prototype.calculate = function(source, cb) {
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
  };

  Ugraph_Renderer_Line.prototype.renderLine = function(ctx, entry) {
    var data = entry.data, l = data.length;
    var p, x, y, y0;

    var xs = this.ctrl.x,
        ys = this.ctrl.y;

    if (!l)
      return;

    p = data[0]; x = p[0]; y = p[1]; y0 = p[2];

    ctx.beginPath();
    ctx.moveTo(xs(x), ys(y));

    var i = 0;

    while (++i < l) {
      p = data[i]; x = p[0]; y = p[1]; y0 = p[2];
      ctx.lineTo(xs(x), ys(y));
    }

    ctx.stroke();
  };

  Ugraph_Renderer_Line.prototype.render = function(ctx, data) {
    var i = -1, l = data.length;

    while (++i < l) {
      // canvas settings
      ctx.lineCap = LineCap;
      ctx.lineWidth = LineWidth;
      ctx.strokeStyle = LineColors[i % LineColors.length].stroke;

      this.renderLine(ctx, data[i]);
    }
  };

  function Ugraph_Renderer_StackedLine(ctrl) {
    this.ctrl = ctrl;
  }

  /**
   * Perform initial calculation for a stacked line graph.
   */
  Ugraph_Renderer_StackedLine.prototype.calculate = function(source, cb) {
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
        ymin = Math.min(ys, ymin);
        ymax = Math.max(ys, ymax);
      }

      dst.push({data: data});
    }

    return {
      width: xmax - xmin, height: ymax - ymin,
      xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax,
      data: dst
    };
  };

  Ugraph_Renderer_StackedLine.prototype.renderFill = function(ctx, entry) {
    var data = entry.data, l = data.length;
    var p, x, y, y0;

    var xs = this.ctrl.x,
        ys = this.ctrl.y;

    if (!l)
      return;

    p = data[0]; x = p[0]; y = p[1]; y0 = p[2];

    ctx.beginPath();
    ctx.moveTo(xs(x), ys(y0));
    ctx.lineTo(xs(x), ys(y0 + y));

    var i = 0;

    while (++i < l) {
      p = data[i]; x = p[0]; y = p[1]; y0 = p[2];
      ctx.lineTo(xs(x), ys(y0 + y));
    }

    while (--i >= 0) {
      p = data[i]; x = p[0]; y = p[1]; y0 = p[2];
      ctx.lineTo(xs(x), ys(y0));
    }

    ctx.closePath();
    ctx.fill();
  };

  Ugraph_Renderer_StackedLine.prototype.renderLine = function(ctx, entry) {
    var data = entry.data, l = data.length;
    var p, x, y, y0;

    var xs = this.ctrl.x,
        ys = this.ctrl.y;

    if (!l)
      return;

    p = data[0]; x = p[0]; y = p[1]; y0 = p[2];

    ctx.beginPath();
    ctx.moveTo(xs(x), ys(y0 + y));

    var i = 0;

    while (++i < l) {
      p = data[i]; x = p[0]; y = p[1]; y0 = p[2];
      ctx.lineTo(xs(x), ys(y0 + y));
    }

    ctx.stroke();
  };

  Ugraph_Renderer_StackedLine.prototype.render = function(ctx, data) {
    var i = -1, l = data.length, d;

    while (++i < l) {
      d = data[i];

      var color = LineColors[i % LineColors.length];

      // canvas settings
      ctx.fillStyle = color.fill || color.stroke;

      this.renderFill(ctx, d);
    }

    i = -1; l = data.length;

    while (++i < l) {
      d = data[i];

      // canvas settings
      ctx.lineCap = LineCap;
      ctx.lineWidth = LineWidth;
      ctx.strokeStyle = LineColors[i % LineColors.length].stroke;

      this.renderLine(ctx, d);
    }
  };

  UgraphCtrl.renderers = {
    'line': Ugraph_Renderer_Line,
    'stacked-line': Ugraph_Renderer_StackedLine
  };

  UgraphCtrl.defaultRenderer = Ugraph_Renderer_Line;

  m.directive('ugraph', function($parse, $window) {
    return {
      restrict: 'A',
      require: 'ugraph',
      controller: UgraphCtrl,
      link: function($scope, $element, $attr, ctrl) {
        if (!!$attr.ugraphHighlighted) {
          var highlightedFn = $parse($attr.ugraphHighlighted);

          ctrl.aHighlighted = function(model) {
            return highlightedFn($scope, model);
          };
        }

        if (!!$attr.ugraphHoverHighlighted) {
          var hoverHighlightedFn = $parse($attr.ugraphHoverHighlighted);

          ctrl.aHoverHighlighted = function(model) {
            return hoverHighlightedFn($scope, model);
          };
        }

        // watches

        if (!!$attr.ugraphXval) {
          /* watch for updates on x value to change highlighting */
          $scope.$watch($attr.ugraphXval, function(xval) {
            ctrl.externalxval = xval;
            ctrl.requestRender();
          });
        }

        if (!!$attr.ugraphRenderer) {
          $scope.$watch($attr.ugraphRenderer, function(renderer) {
            ctrl.updateRenderer(renderer);
          });
        }

        if (!!$attr.ugraphHighlight) {
          $scope.$watch($attr.ugraphHighlight, function(highlight) {
            ctrl.highlight = !!highlight;
            ctrl.update();
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
