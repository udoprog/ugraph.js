import "calculate";
import "../core/min";
import "../core/max";

ugraph.calculate.stacked = ugraph_calculate_stacked;

function ugraph_calculate_stacked(source, cb) {
  var xmin = Infinity, xmax = -Infinity;
  var ymin = Infinity, ymax = -Infinity;

  var xmin_r = Infinity, xmax_r = -Infinity;
  var ymin_r = Infinity, ymax_r = -Infinity;

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

      var ys = y + y0;

      xmin_r = ugraph_min(x, xmin_r);
      xmax_r = ugraph_max(x, xmax_r);
      ymin_r = ugraph_min(y0, ymin_r);
      ymax_r = ugraph_max(ys, ymax_r);

      if (!cb(entry, x, y, y0))
        continue;

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
    width_r: xmax_r - xmin_r, height_r: ymax_r - ymin_r,
    xmin_r: xmin_r, xmax_r: xmax_r, ymin_r: ymin_r, ymax_r: ymax_r,
    data: dst
  };
}
