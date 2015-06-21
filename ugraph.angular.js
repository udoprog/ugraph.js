(function() {
  var m = angular.module('ugraph', []);

  function UgraphCtrl($element, $scope) {
    ugraph.graph.call(this, $element[0], $scope.$apply.bind($scope));
  }

  UgraphCtrl.prototype = ugraph.graph.prototype;

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
