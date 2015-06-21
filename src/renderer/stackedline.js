import "renderer";
import "../globals";
import "../calculate/stacked";

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
