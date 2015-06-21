import "calculate";

ugraph.calculate.normal = ugraph_calculate_normal;

function ugraph_calculate_normal(source, cb) {
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
