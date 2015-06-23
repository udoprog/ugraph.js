import "renderer";
import "../globals";
import "../calculate/default";

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
