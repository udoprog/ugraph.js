import "calculate";
import "../core/min";
import "../core/max";

var ugraph_calculate_normal = ugraph.calculate.normal = ugraph_calculate_default(Infinity, -Infinity, Infinity, -Infinity);
var ugraph_calculate_zerobased = ugraph.calculate.zerobased = ugraph_calculate_default(Infinity, -Infinity, 0, -Infinity);

function ugraph_calculate_default(x0, x1, y0, y1) {
  function calculate(source, cb) {
    var i = -1, l = source.length;

    var xmin = x0, xmax = x1;
    var ymin = y0, ymax = y1;

    var dst = [];

    while (++i < l) {
      var entry = source[i].data;
      var si = -1, sl = entry.length;

      while (++si < sl) {
        var p = entry[si], x = p[0], y = p[1];

        if (!cb(entry, x, y, null))
          continue;

        xmin = ugraph_min(x, xmin);
        xmax = ugraph_max(x, xmax);
        ymin = ugraph_min(y, ymin);
        ymax = ugraph_max(y, ymax);
      }

      dst.push({data: entry});
    }

    return {
      width: xmax - xmin, height: ymax - ymin,
      xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax,
      data: dst
    };
  }

  return calculate;
}
