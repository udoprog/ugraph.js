import "calculate";

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
