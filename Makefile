.PHONY: all ugraph.js

all: ugraph.min.js

node_modules:
	npm install

bower_components:
	node_modules/.bin/bower install

ugraph.js: node_modules bower_components
	node_modules/.bin/smash src/ugraph.js > $@

ugraph.min.js: ugraph.js
	bin/uglify $< > $@
