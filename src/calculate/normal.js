import "calculate";

ugraph.calculate.normal = ugraph_calculate_normal;

function ugraph_calculate_normal(source, cb) {
  var i = -1, l = source.length;

  var xmin = Infinity, xmax = -Infinity;
  var ymin = Infinity, ymax = -Infinity;

  var xmin_r = Infinity, xmax_r = -Infinity;
  var ymin_r = Infinity, ymax_r = -Infinity;

  var dst = [];

  while (++i < l) {
    var entry = source[i].data;
    var si = -1, sl = entry.length;
    var data = [];

    while (++si < sl) {
      var p = entry[si], x = p[0], y = p[1];
      data.push([x, y]);

      xmin_r = Math.min(x, xmin_r);
      xmax_r = Math.max(x, xmax_r);
      ymin_r = Math.min(y, ymin_r);
      ymax_r = Math.max(y, ymax_r);

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
    width_r: xmax_r - xmin_r, height_r: ymax_r - ymin_r,
    xmin_r: xmin_r, xmax_r: xmax_r, ymin_r: ymin_r, ymax_r: ymax_r,
    data: dst
  };
}
