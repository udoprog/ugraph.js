.PHONY: all ugraph.smashed.js

all: ugraph.min.js

ugraph.smashed.js:
	node_modules/.bin/smash src/ugraph.js > $@

ugraph.min.js: ugraph.smashed.js
	bin/uglify $< > $@
