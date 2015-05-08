# karma-vinyl-streams [![Build Status](https://travis-ci.org/wilsonjackson/karma-vinyl-streams.svg?branch=master)](https://travis-ci.org/wilsonjackson/karma-vinyl-streams)

> Use gulp plugins instead of Karma preprocessors

## Install

```
npm install --save-dev karma-vinyl-streams
```

## Example config

```js
var gulpPlugin1 = require('gulp-plugin1');
var gulpPlugin2 = require('gulp-plugin2');

module.exports = function (config) {
    config.set({
        frameworks: ['jasmine', 'vinyl-streams'],

        files: [
            'src/*.js'
        ],

        browsers: ['PhantomJS'],

        vinylStreams: function (src, dest) {
            src('**/*.js')
                .pipe(gulpPlugin1())
                .pipe(gulpPlugin2())
                .pipe(dest());
        }
    });
};
```

## The `vinylStreams` config function API

Your config function is called with a `src` function and a `dest` function each time Karma's file list
is modified. They work a lot like `gulp.src` and `gulp.dest`, only instead of reading from and writing
to disk, they provide access to and modify Karma's file list.

**`src([pattern])`**

Create a stream of Karma files, optionally matching `pattern`. If `pattern` is omitted, it
defaults to `**/*`. The `pattern` is resolved against Karma's `basePath`.

**`src([readableStream])`**

Sneak some files Karma doesn't know about into Karma. Useful if, say, you wanted to use Browserify or
something. It's your responsibility to ensure the stream contains Vinyl file objects before it's piped
to `dest`.

**`src.modified([pattern])`**

Create a stream of Karma files that have been modified (changed or added) since the last run.
Same pattern rules apply as with `src`.

**`dest()`**

Commit a stream's contents back to Karma's file list. This **must** be called once for each `src`, or
you'll be in big, big trouble.

## Differences from gulp

Each pipeline (the chain of pipes between `src` and `dest` calls) is executed serially. That is,
unlike gulp, which will kick off each stream immediately when you ask for it and run them concurrently,
`karma-vinyl-streams` will pause each stream until previous ones have finished executing.

Also, `src` will not load arbitrary files from the filesystem; they must be specified in Karma's
`files` config. Or you can pipe in your own stream of files to `src`.

## Recipes

### browserify

See the [browserify integration test](test/integration/karma.browserify.conf.js) for an example config.

### TypeScript

See the [TypeScript integration test](test/integration/karma.typescript.conf.js) for an example config.

### Sourcemaps with `karma-source-map-support` and `gulp-sourcemaps`

'Cause not having real line numbers is a drag.

Note that this doesn't work in PhantomJS, sadly. See [phantomjs/12289](https://github.com/ariya/phantomjs/issues/12289).

```js
var sourcemaps = require('gulp-sourcemaps');

module.exports = function (config) {
    config.set({
        frameworks: ['jasmine', 'vinyl-streams', 'source-map-support'],

        browsers: ['Chrome'],

        vinylStreams: function (src, dest) {
            src()
                .pipe(sourcemaps.init())
                .pipe(/* plugins with sourcemap support */)
                .pipe(sourcemaps.write({sourceRoot: __dirname}))
                .pipe(dest());
        }
    });
};
```
