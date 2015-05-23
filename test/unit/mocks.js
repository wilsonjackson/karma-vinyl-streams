'use strict';

var q = require('q');

function createEmitter() {
    var listeners = {};
    return {
        on: function (event, listener) {
            (listeners[event] || (listeners[event] = [])).push(listener);
        },
        emit: function (event, data) {
            (listeners[event] || []).forEach(function (listener) {
                listener(data);
            });
        }
    };
}

function createFileList() {
    return {
        addedFiles: [],
        changedFiles: [],
        removedFiles: [],
        addFile: function (file) {
            this.addedFiles.push(file);
        },
        changeFile: function (file) {
            this.changedFiles.push(file);
        },
        removeFile: function (file) {
            this.removedFiles.push(file);
        }
    };
}

var loggerEnabled = false;

//noinspection JSUnusedGlobalSymbols
var logger = {
    messages: [],
    enable: function (enabled) {
        loggerEnabled = enabled === undefined ? true : enabled;
    },
    create: function () {
        return {
            info: log('info'),
            debug: log('info'),
            warn: log('warn'),
            error: log('error')
        };
    }
};

function log(level) {
    return function () {
        logger.messages.push(Array.prototype.slice.call(arguments));
        if (loggerEnabled) {
            console[level].apply(console, arguments);
        }
    };
}

function createPipeline() {
    var deferred = q.defer();
    var pipeline = function (files, added, changed) {
        pipeline.files = files;
        pipeline.added = added;
        pipeline.changed = changed;
        return deferred.promise;
    };
    pipeline.flush = function (processedFiles) {
        deferred.resolve(processedFiles);
    };
    return pipeline;
}

function createFile(path, content) {
    return {
        path: path,
        content: content
    };
}

module.exports = {
    logger: logger,
    createEmitter: createEmitter,
    createFileList: createFileList,
    createPipeline: createPipeline,
    createFile: createFile
};
