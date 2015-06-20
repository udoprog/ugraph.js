# ugraph - A simple canvas rendering library for AngularJS

This is intended to be a very simple canvas graphing library for AngularJS.

Rendering against canvases has proven to offer much better performance when
dealing with a large number of time series compared to SVG's, and this matters
when running dashboarding systems with hundreds of time series, and thousands
of points visible at a single time.

# Usage

This library provides the `ugraph` directive, which takes the following
options.

#### `ugraph`

`default`: Is expected to be a list of time series of the format
`{data: [...]}`, where each datapoint is an array containing the two elements;
`x`, and `y` value.

#### `ugraph-stacked`

If set to `true`, indicates that the time series should be stacked.

#### `ugraph-highlight`

If set to `true`, indicates that highlighting is enabled.

#### `ugraph-xval`

If set to anything but `null`, will attempt to find the given numeric value,
and highlight it in the series unless a hover highlight is already active for
the given graph.

#### `ugraph-highlighted`

A callback function that exposes the `$highlight` variable, which will be a
highlight entry for the currently highlighted `x`, regardless of cause.

See the *highlight structure* section for the structure of this variable.

#### `ugraph-hover-highlighted`

A callback function that exposes the `$highlight` variable, which will be a
highlight entry for the currently highlighted `x` value caused by a user
hovering the graph.

See the *highlight structure* section for the structure of this variable.

## highlight structure

The structure of a highlight object is.

```json
{"x": 10, "data": [{"entry": {}, "value": 42, "stackValue": 122}]}
```

The list of `data` contains the `y` value of all series that are matched in
the given highlight.

# Development

Prepare your environment for development.

```sh
$ npm install
```

See and run examples found in the next section using.

```sh
$ google-chrome example/<name>.html
```

# Examples

* [example/ugraph.html](example/ugraph.html)
