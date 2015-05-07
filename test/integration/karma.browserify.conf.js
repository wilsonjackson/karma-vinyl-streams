'use strict';

var path = require('path');
var os = require('os');
var fs = require('fs');
var hat = require('hat');
var browserify = require('browserify');
var watchify = require('watchify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');

module.exports = function (config) {
    require('./karma.conf')(config);

    var tmpFile = path.join(os.tmpdir(), hat() + '.watchify');
    var b = watchify(browserify({
        entries: [path.join(__dirname, 'browserify/main.js')],
        cache: {},
        packageCache: {}
    }));

    function bundle() {
        b.bundle().pipe(fs.createWriteStream(tmpFile));
    }

    b.on('update', function () {
        bundle();
    });

    process.on('exit', function () {
        fs.unlinkSync(tmpFile);
    });

    bundle();

    config.set({
        files: [
            {pattern: tmpFile, served: false, included: false, watched: true},
            'browserify/main-spec.js'
        ],

        vinylStreams: function (src, dest) {
            src(b.bundle())
                .pipe(source('bundle.js'))
                .pipe(buffer())
                .pipe(dest());
        }
    });
};
