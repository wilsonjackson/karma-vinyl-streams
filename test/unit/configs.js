'use strict';

var through = require('through2');
var File = require('vinyl');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');

var configs = {
    appendToSubdirJs: function (src, dest) {
        src('subdir/*.js')
            .pipe(through.obj(function (file, enc, done) {
                file.contents = new Buffer(file.contents.toString() + ' appended');
                this.push(file);
                done();
            }))
            .pipe(dest());
    },
    appendToJsAndHtml: function (src, dest) {
        src(['*.js', '*.html'])
            .pipe(through.obj(function (file, enc, done) {
                file.contents = new Buffer(file.contents.toString() + ' appended');
                this.push(file);
                done();
            }))
            .pipe(dest());
    },
    appendToModified: function (src, dest) {
        configs.appendToModified.count = 0;
        src.modified()
            .pipe(through.obj(function (file, enc, done) {
                configs.appendToModified.count++;
                file.contents = new Buffer(file.contents.toString() + ' appended');
                this.push(file);
                done();
            }))
            .pipe(dest());
    },
    countAndAppend: function (src, dest) {
        configs.countAndAppend.count = 0;
        src()
            .pipe(through.obj(function (file, enc, done) {
                configs.countAndAppend.count++;
                file.contents = new Buffer(file.contents.toString() + ' appended');
                this.push(file);
                done();
            }))
            .pipe(dest());
    },
    replaceOddFiles: function (src, dest) {
        var count = 0;
        src()
            .pipe(through.obj(function (file, enc, done) {
                count++;
                if (count % 2 === 1) {
                    file = new File({
                        path: '/base/replaced-file-' + count + '.js',
                        contents: new Buffer('content ' + count)
                    });
                }
                this.push(file);
                done();
            }, function (done) {
                count++;
                this.push(new File({
                    path: '/base/new-file-' + count + '.js',
                    contents: new Buffer('added')
                }));
                done();
            }))
            .pipe(dest());
    },
    omitAllAfterFirst: function (src, dest) {
        var pushed = false;
        src()
            .pipe(through.obj(function (file, enc, done) {
                if (!pushed) {
                    this.push(file);
                    pushed = true;
                }
                done();
            }))
            .pipe(dest());
    },
    overlappingPatterns: function (src, dest) {
        // rename all .js files to .notjs
        src('**/*.js')
            .pipe(through.obj(function (file, enc, done) {
                file.path = file.path.replace('.js', '.notjs');
                this.push(file);
                done();
            }))
            .pipe(dest());
        // attempt to stream files ending in .js should operate on nothing (they've been renamed)
        src('**/*.js')
            .pipe(through.obj(function (file, enc, done) {
                file.contents = new Buffer(file.contents.toString() + ' error');
                this.push(file);
                done();
            }))
            .pipe(dest());
        src('subdir/*')
            .pipe(through.obj(function (file, enc, done) {
                file.contents = new Buffer(file.contents.toString() + ' appended');
                this.push(file);
                done();
            }))
            .pipe(dest());
    },
    externalStream: function (stream) {
        return function (src, dest) {
            src(stream)
                .pipe(source('/base/external.html'))
                .pipe(buffer())
                .pipe(dest());
        };
    },
    errorInStream: function (src, dest) {
        src()
            .pipe(through.obj(function () {
                throw new Error('Watch out for snakes!');
            }))
            .pipe(dest());
    }
};

module.exports = configs;
