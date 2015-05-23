'use strict';

var _ = require('lodash');

function vinylStreamsFramework(logger, emitter, fileList, pipeline) {
    var log = logger.create('framework.vinyl-streams');

    var added = [];
    var changed = [];

    overrideEmitter();
    overrideFileList();

    function overrideEmitter() {
        var originalEmit = emitter.emit;
        emitter.emit = function (event, filesPromise) {
            // The file_list_modified event will tell us when to process
            if (event === 'file_list_modified') {
                log.debug('intercepted file_list_modified');
                originalEmit.call(emitter, event, filesPromise.then(processFileList));
            }
            else {
                originalEmit.apply(emitter, arguments);
            }
        };
    }

    function overrideFileList() {
        var originalAdd = fileList.addFile;
        fileList.addFile = function (path) {
            added.push(path);
            return originalAdd.apply(fileList, arguments);
        };

        var originalChange = fileList.changeFile;
        fileList.changeFile = function (path) {
            changed.push(path);
            return originalChange.apply(fileList, arguments);
        };

        var originalRemove = fileList.removeFile;
        fileList.removeFile = function (path) {
            _.pull(added, path);
            _.pull(changed, path);
            return originalRemove.apply(fileList, arguments);
        };
    }

    function processFileList(files) {
        return pipeline(files, added, changed)
            .then(function (processedFiles) {
                return processedFiles;
            });
    }
}

vinylStreamsFramework.$inject = ['logger', 'emitter', 'fileList', 'vinylStreamsPipeline'];

module.exports = {
    'framework:vinyl-streams': ['factory', vinylStreamsFramework],
    'vinylStreamsPipeline': ['factory', require('./pipeline')]
};
