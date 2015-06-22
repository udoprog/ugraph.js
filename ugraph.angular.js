(function() {
  var m = angular.module('ugraph', []);

  var graph = ugraph.graph();

  m.directive('ugraph', function($parse, $window) {
    return {
      restrict: 'A',
      link: function($scope, $element, $attr) {
        var g = graph($element[0], $scope.$apply.bind($scope));

        if (!!$attr.ugraphOnHighlight) {
          var onHighlightFn = $parse($attr.ugraphOnHighlight);
          g.onHighlight(onHighlightFn.bind(onHighlightFn, $scope));
        }

        if (!!$attr.ugraphOnHoverHighlight) {
          var onHoverHighlightFn = $parse($attr.ugraphOnHoverHighlight);
          g.onHoverHighlight(onHoverHighlightFn.bind(onHoverHighlightFn, $scope));
        }

        if (!!$attr.ugraphOnRange) {
          var onRangeFn = $parse($attr.ugraphOnRange);
          g.onRange(onRangeFn.bind(onRangeFn, $scope));
        }

        if (!!$attr.ugraphOnDragRange) {
          var onDragRangeFn = $parse($attr.ugraphOnDragRange);
          g.onDragRange(onDragRangeFn.bind(onDragRangeFn, $scope));
        }

        if (!!$attr.ugraphOnFocus) {
          var onFocusFn = $parse($attr.ugraphOnFocus);
          g.onFocus(onFocusFn.bind(onFocusFn, $scope));
        }

        // watches

        if (!!$attr.ugraphAutoXval) {
          /* watch for updates on x value to change highlighting */
          $scope.$watch($attr.ugraphAutoXval, g.updateAutoXval.bind(g));
        }

        if (!!$attr.ugraphAutoRange) {
          /* watch for updates on x value to change highlighting */
          $scope.$watch($attr.ugraphAutoRange, g.updateAutoRange.bind(g));
        }

        if (!!$attr.ugraphAutoFocus) {
          /* watch for updates on x value to change highlighting */
          $scope.$watch($attr.ugraphAutoFocus, g.updateFocus.bind(g));
        }

        if (!!$attr.ugraphRenderer) {
          $scope.$watch($attr.ugraphRenderer, g.updateRenderer.bind(g));
        }

        if (!!$attr.ugraphHighlight) {
          $scope.$watch($attr.ugraphHighlight, g.updateHighlight.bind(g));
        }

        if (!!$attr.ugraphPadding) {
          $scope.$watch($attr.ugraphPadding, g.updatePadding.bind(g));
        }

        if (!!$attr.ugraphCadence) {
          $scope.$watch($attr.ugraphCadence, g.updateCadence.bind(g));
        }

        if (!!$attr.ugraphZeroBased) {
          $scope.$watch($attr.ugraphZeroBased, g.updateZeroBased.bind(g));
        }

        if (!!$attr.ugraph) {
          $scope.$watch($attr.ugraph, g.updateSource.bind(g));
        }

        var $w = angular.element($window);

        var mousedown = g.mousedown.bind(g);
        var mouseup = g.mouseup.bind(g);
        var mousemove = g.mousemove.bind(g);
        var mouseleave = g.mouseleave.bind(g);
        var resize = g.resize.bind(g);

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
        g.resize();
      }
    };
  });
})();
