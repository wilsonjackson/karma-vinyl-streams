'use strict';

var stream = require('stream');
var util = require('util');
var path = require('path');
var crypto = require('crypto');
var _ = require('lodash');
var q = require('q');
var minimatch = require('minimatch');
var File = require('vinyl');

function pipelineFactory(basePath, logger, vinylStream) {
    var log = logger.create('framework.vinyl-streams');

    return function (files, added, changed) {
        var modifiedPaths = _.union(added, changed);
        var inputPaths = [];
        var srcStreams = [];
        var finished = q.defer();

        function flushNextStream() {
            var nextStream = srcStreams.shift();
            if (nextStream) {
                if (nextStream instanceof Src) {
                    var filtered = filterFiles(nextStream.pattern, nextStream.modified, files.served);
                    inputPaths = _.union(inputPaths, _.pluck(filtered, 'path'));
                    nextStream.start(filtered);
                }
                else {
                    nextStream.start();
                }
            }
            else {
                finished.resolve();
            }
        }

        function filterFiles(pattern, modified, files) {
            if (modified) {
                // Note: if a modified file has been renamed in a previous stream, it will not be
                // matched here. Also, if an unmodified file has been renamed to the same path as
                // a modified file, it will be matched.
                files = _.filter(files, function (file) {
                    return _.contains(modifiedPaths, file.path);
                });
            }

            var filtered = [];
            [].concat(pattern || ['**.*']).forEach(function (p) {
                p = path.resolve(basePath, p);
                filtered = _.union(filtered, _.filter(files, function (file) {
                    return minimatch(file.path, p);
                }));
            });

            return filtered.map(createVinylFile);
        }

        function src(patternOrStream) {
            var stream;
            if (undefined === patternOrStream || Array.isArray(patternOrStream) || typeof patternOrStream === 'string') {
                stream = new Src(patternOrStream, false);
            }
            else {
                // Assume we have a stream
                stream = new Proxy(patternOrStream);
            }
            srcStreams.push(stream);
            return stream;
        }

        src.modified = function (pattern) {
            var stream = new Src(pattern, true);
            srcStreams.push(stream);
            return stream;
        };

        function dest() {
            var stream = new Dest();

            stream.on('finish', function () {
                synchronizeFiles(files, inputPaths, stream.files);
                inputPaths = [];
                flushNextStream();
            });

            return stream;
        }

        // Instantiate user-defined plugin pipelines
        vinylStream(src, dest);

        // Kick off first stream
        flushNextStream();

        return finished.promise;
    };

    function synchronizeFiles(karmaFiles, inputPaths, outputFiles) {
        _.each(inputPaths, function (path) {
            var servedIdx = _.findIndex(karmaFiles.served, {path: path});
            var includedIdx = _.findIndex(karmaFiles.included, {path: path});
            var replacement = outputFiles.shift();

            if (replacement) {
                log.debug('replace ' + path + ' with ' + replacement.path);
                replacement = createKarmaFile(replacement);
                karmaFiles.served[servedIdx] = replacement;
                if (includedIdx > -1) {
                    karmaFiles.included[includedIdx] = replacement;
                }
            }
            else {
                log.debug('remove ' + path);
                karmaFiles.served.splice(servedIdx, 1);
                if (includedIdx > -1) {
                    karmaFiles.included.splice(servedIdx, 1);
                }
            }
        });

        _.each(outputFiles, function (file) {
            log.debug('append ' + file.path);
            file = createKarmaFile(file);
            karmaFiles.served.push(file);
            karmaFiles.included.push(file);
        });
    }

    function createVinylFile(karmaFile) {
        return new File({
            cwd: basePath,
            base: basePath,
            path: karmaFile.path,
            contents: karmaFile.content ? new Buffer(karmaFile.content) : null,
            karmaProps: {
                mtime: karmaFile.mtime
            }
        });
    }

    function createKarmaFile(vinylFile) {
        var content = vinylFile.contents.toString();
        return {
            path: vinylFile.path,
            originalPath: vinylFile.path,
            contentPath: null,
            mtime: vinylFile.karmaProps ? vinylFile.karmaProps.mtime : new Date(),
            isUrl: false,
            content: content,
            sha: sha1(content)
        };
    }
}

pipelineFactory.$inject = ['config.basePath', 'logger', 'config.vinylStreams'];

function sha1(data) {
    var hash = crypto.createHash('sha1');
    hash.update(data);
    return hash.digest('hex');
}

util.inherits(Src, stream.Readable);

function Src(pattern, modified) {
    stream.Readable.call(this, {objectMode: true});
    this.pattern = pattern;
    this.modified = modified;
}

//noinspection JSUnusedGlobalSymbols
Src.prototype._read = function () {};

Src.prototype.start = function (files) {
    var self = this;
    files.forEach(function (file) {
        self.push(file);
    });
    this.push(null);
};

util.inherits(Proxy, stream.PassThrough);

function Proxy(src) {
    stream.PassThrough.call(this, {objectMode: true});
    this.stream = src;
}

Proxy.prototype.start = function () {
    this.stream.pipe(this);
};

util.inherits(Dest, stream.Writable);

function Dest() {
    stream.Writable.call(this, {objectMode: true});
    this.files = [];
}

//noinspection JSUnusedGlobalSymbols
Dest.prototype._write = function (chunk, enc, cb) {
    this.files.push(chunk);
    cb();
};

module.exports = pipelineFactory;
