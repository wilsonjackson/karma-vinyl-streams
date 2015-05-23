/*jshint -W030 */

'use strict';

var fs = require('fs');
var path = require('path');

var chai = require('chai');
var expect = chai.expect;
var q = require('q');

var mocks = require('./mocks');
var configs = require('./configs');
var createFile = mocks.createFile;
var plugin = require('../../lib')['framework:vinyl-streams'][1];
var pipelineFactory = require('../../lib/pipeline');

chai.Assertion.addMethod('pipelineResult', function (files) {
    var obj = this._obj;

    expect(obj.served).to.have.length(files.length);
    expect(obj.included).to.have.length(files.length);

    files.forEach(function (file, i) {
        expect(obj).to.have.deep.property('served[' + i + '].path', file.path);
        expect(obj).to.have.deep.property('served[' + i + '].content', file.content);
        expect(obj).to.have.deep.property('included[' + i + '].path', file.path);
        expect(obj).to.have.deep.property('included[' + i + '].content', file.content);
    });
});

describe('karma-vinyl-streams', function () {
    beforeEach(function () {
        mocks.logger.messages = [];
    });

    afterEach(function () {
        mocks.logger.enable(false);
    });

    describe('plugin', function () {
        var emitter;
        var fileList;

        beforeEach(function () {
            emitter = mocks.createEmitter();
            fileList = mocks.createFileList();
        });

        it('should intercept the file list passed to file_list_modified listeners', function (done) {
            var files = null;
            emitter.on('file_list_modified', function (promise) {
                promise.then(function (value) {
                    files = value;
                });
            });

            var mockPipeline = mocks.createPipeline();
            plugin(mocks.logger, emitter, fileList, mockPipeline);
            emitter.emit('file_list_modified', q.when([{path: '/old/file'}]));

            setTimeout(function () { // wait for promise
                expect(files).to.be.null;
                expect(mockPipeline.files).to.eql([{path: '/old/file'}]);

                // Simulate some plugin doing something
                mockPipeline.flush([{path: '/new/file'}]);

                setTimeout(function () { // wait for promise
                    expect(files).to.eql([{path: '/new/file'}]);
                    done();
                });
            });
        });

        it('should pass through other events', function () {
            var eventData = null;
            emitter.on('arbitrary', function (data) {
                eventData = data;
            });

            plugin(mocks.logger, emitter, fileList, mocks.createPipeline());
            emitter.emit('arbitrary', 'data');

            expect(eventData).to.equal('data');
        });

        it('should send added and modified file paths to the pipeline', function (done) {
            var pipeline = mocks.createPipeline();
            plugin(mocks.logger, emitter, fileList, pipeline);

            fileList.addFile('/added/file');
            fileList.addFile('/removed/file');
            fileList.changeFile('/changed/file');
            fileList.changeFile('/removed/file');
            fileList.removeFile('/removed/file');

            emitter.emit('file_list_modified', q.when([{path: '/old/file'}]));

            setTimeout(function () { // wait for promise
                expect(pipeline.added).to.eql(['/added/file']);
                expect(pipeline.changed).to.eql(['/changed/file']);
                done();
            });
        });
    });

    describe('pipeline', function () {
        var basePath = '/base';

        it('should pass files through a pipeline of vinyl streams', function (done) {
            var file = createFile('/base/sample.js', 'contents');
            var files = {served: [file], included: [file]};

            var pipeline = pipelineFactory(basePath, mocks.logger, configs.countAndAppend);
            pipeline(files, [], []).then(function (processedFiles) {
                expect(configs.countAndAppend.count).to.equal(1);
                expect(processedFiles).to.have.pipelineResult([
                    {path: '/base/sample.js', content: 'contents appended'}
                ]);
                done();
            }).catch(done);
        });

        it('should handle extra files in output file array', function (done) {
            var file1 = createFile('/base/file1.js', 'file1');
            var file2 = createFile('/base/file2.js', 'file2');
            var file3 = createFile('/base/file3.js', 'file3');
            var files = {served: [file1, file2, file3], included: [file1, file2, file3]};

            var pipeline = pipelineFactory(basePath, mocks.logger, configs.replaceOddFiles);
            pipeline(files, [], []).then(function (processedFiles) {
                expect(processedFiles).to.have.pipelineResult([
                    {path: '/base/replaced-file-1.js', content: 'content 1'},
                    {path: '/base/file2.js', content: 'file2'},
                    {path: '/base/replaced-file-3.js', content: 'content 3'},
                    {path: '/base/new-file-4.js', content: 'added'}
                ]);
                done();
            }).catch(done);
        });

        it('should handle missing files in output file array', function (done) {
            var file1 = createFile('/base/file1.js', 'file1');
            var file2 = createFile('/base/file2.js', 'file2');
            var file3 = createFile('/base/file3.js', 'file3');
            var files = {served: [file1, file2, file3], included: [file1, file2, file3]};

            var pipeline = pipelineFactory(basePath, mocks.logger, configs.omitAllAfterFirst);
            pipeline(files, [], []).then(function (processedFiles) {
                expect(processedFiles).to.have.pipelineResult([
                    {path: '/base/file1.js', content: 'file1'}
                ]);
                done();
            }).catch(done);
        });

        it('should filter processed files by a path pattern', function (done) {
            var file1 = createFile('/base/file1.js', 'file1');
            var file2 = createFile('/base/subdir/file2.js', 'file2');
            var file3 = createFile('/base/subdir/file3.html', 'file3');
            var file4 = createFile('/base/subdir/file4.js', 'file4');
            var files = {served: [file1, file2, file3, file4], included: [file1, file2, file3, file4]};

            var pipeline = pipelineFactory(basePath, mocks.logger, configs.appendToSubdirJs);
            pipeline(files, [], []).then(function (processedFiles) {
                expect(processedFiles).to.have.pipelineResult([
                    {path: '/base/file1.js', content: 'file1'},
                    {path: '/base/subdir/file2.js', content: 'file2 appended'},
                    {path: '/base/subdir/file3.html', content: 'file3'},
                    {path: '/base/subdir/file4.js', content: 'file4 appended'}
                ]);
                done();
            }).catch(done);
        });

        it('should filter processed files by multiple path patterns', function (done) {
            var file1 = createFile('/base/file1.js', 'file1');
            var file2 = createFile('/base/file2.css', 'file2');
            var file3 = createFile('/base/file3.html', 'file3');
            var file4 = createFile('/base/file4.js', 'file4');
            var files = {served: [file1, file2, file3, file4], included: [file1, file2, file3, file4]};

            var pipeline = pipelineFactory(basePath, mocks.logger, configs.appendToJsAndHtml);
            pipeline(files, [], []).then(function (processedFiles) {
                expect(processedFiles).to.have.pipelineResult([
                    {path: '/base/file1.js', content: 'file1 appended'},
                    {path: '/base/file2.css', content: 'file2'},
                    {path: '/base/file3.html', content: 'file3 appended'},
                    {path: '/base/file4.js', content: 'file4 appended'}
                ]);
                done();
            }).catch(done);
        });

        it('should process an existing vinyl stream and add its contents to Karma', function (done) {
            var file1 = createFile('/base/file1.js', 'file1');
            var files = {served: [file1], included: [file1]};

            var stream = fs.createReadStream(path.join(__dirname, 'external.html'));
            var pipeline = pipelineFactory(basePath, mocks.logger, configs.externalStream(stream));
            pipeline(files, [], []).then(function (processedFiles) {
                expect(processedFiles).to.have.pipelineResult([
                    {path: '/base/file1.js', content: 'file1'},
                    {path: '/base/external.html', content: 'external file\n'}
                ]);
                done();
            }).catch(done);
        });

        it('should count all files as modified on the first invocation', function (done) {
            var file1 = createFile('/base/file1.js', 'file1');
            var file2 = createFile('/base/subdir/file2.js', 'file2');
            var file3 = createFile('/base/file3.html', 'file3');
            var files = {served: [file1, file2, file3], included: [file1, file2, file3]};

            var pipeline = pipelineFactory(basePath, mocks.logger, configs.appendToModified);
            pipeline(files, [], []).then(function (processedFiles) {
                //expect(configs.appendToModified.count).to.equal(3);
                expect(processedFiles).to.have.pipelineResult([
                    {path: '/base/file1.js', content: 'file1 appended'},
                    {path: '/base/subdir/file2.js', content: 'file2 appended'},
                    {path: '/base/file3.html', content: 'file3 appended'}
                ]);
                done();
            }).catch(done);
        });

        it('should allow only modified files to be processed', function (done) {
            var file1 = createFile('/base/file1.js', 'file1');
            var file2 = createFile('/base/subdir/file2.js', 'file2');
            var file3 = createFile('/base/file3.html', 'file3');
            var files = {served: [file1, file2, file3], included: [file1, file2, file3]};

            var pipeline = pipelineFactory(basePath, mocks.logger, configs.appendToModified);
            // First (initial) invocation with no files
            pipeline({served: [], included: []}, [], []).then(function () {
                pipeline(files, [file1.path], [file3.path]).then(function (processedFiles) {
                    expect(configs.appendToModified.count).to.equal(2);
                    expect(processedFiles).to.have.pipelineResult([
                        {path: '/base/file1.js', content: 'file1 appended'},
                        {path: '/base/subdir/file2.js', content: 'file2'},
                        {path: '/base/file3.html', content: 'file3 appended'}
                    ]);
                    done();
                }).catch(done);
            }).catch(done);
        });

        it('should apply multiple pipelines sequentially', function (done) {
            var file1 = createFile('/base/file1.js', 'file1');
            var file2 = createFile('/base/subdir/file2.js', 'file2');
            var file3 = createFile('/base/subdir/file3.html', 'file3');
            var files = {served: [file1, file2, file3], included: [file1, file2, file3]};

            var pipeline = pipelineFactory(basePath, mocks.logger, configs.overlappingPatterns);
            pipeline(files, [], []).then(function (processedFiles) {
                expect(processedFiles).to.have.pipelineResult([
                    {path: '/base/file1.notjs', content: 'file1'},
                    {path: '/base/subdir/file2.notjs', content: 'file2 appended'},
                    {path: '/base/subdir/file3.html', content: 'file3 appended'}
                ]);
                done();
            }).catch(done);
        });

        it('should handle errors in the config function gracefully', function (done) {
            var file = createFile('/base/file1.js', 'file1');
            var files = {served: [file], included: [file]};

            var pipeline = pipelineFactory(basePath, mocks.logger, function () {
                throw new Error('Watch out for snakes!');
            });
            pipeline(files, [], []).then(function (processedFiles) {
                expect(mocks.logger.messages[0].join(' ')).to.contain('Watch out for snakes!');
                expect(processedFiles).to.have.pipelineResult([
                    {path: '/base/file1.js', content: 'file1'}
                ]);
                done();
            }).catch(done);
        });

        it('should handle errors in a pipeline gracefully', function (done) {
            var file = createFile('/base/file1.js', 'file1');
            var files = {served: [file], included: [file]};

            var pipeline = pipelineFactory(basePath, mocks.logger, configs.errorInStream);
            pipeline(files, [], []).then(function (processedFiles) {
                expect(mocks.logger.messages[0].join(' ')).to.contain('Watch out for snakes!');
                expect(processedFiles).to.have.pipelineResult([
                    {path: '/base/file1.js', content: 'file1'}
                ]);
                done();
            }).catch(done);
        });

        it('should preserve pathname transformations between streams', function (done) {
            var file1 = createFile('/base/file1.js', 'file1');
            var file2 = createFile('/base/file2.html', 'file2');
            // First and second run use separate objects so only file object references are shared (to mimic Karma)
            var firstRunFiles = {served: [file1, file2], included: [file1, file2]};
            var secondRunFiles = {served: [file1, file2], included: [file1, file2]};

            var pipeline = pipelineFactory(basePath, mocks.logger, configs.renameModifiedJsFiles);
            // Initial run will rename js (all files are counted as modified)
            pipeline(firstRunFiles, [], []).then(function (processedFiles) {
                // Second run will not pass the js file through the stream, as it's not modified
               pipeline(secondRunFiles, [], ['/base/file2.html']).then(function () {
                   expect(processedFiles).to.have.pipelineResult([
                       {path: '/base/file1.notjs', content: 'file1'},
                       {path: '/base/file2.html', content: 'file2'}
                   ]);
                   done();
               }).catch(done);
            }).catch(done);
        });

        it('should not taint Karma\'s file cache used for future invocations', function (done) {
            var file1 = createFile('/base/file1.js', 'file1');
            var file2 = createFile('/base/file2.html', 'file2');
            var files = {served: [file1, file2], included: [file1, file2]};

            var pipeline = pipelineFactory(basePath, mocks.logger, configs.renameModifiedJsFiles);
            pipeline(files, [], []).then(function () {
                expect(files).to.have.pipelineResult([
                    {path: '/base/file1.js', content: 'file1'},
                    {path: '/base/file2.html', content: 'file2'}
                ]);
                done();
            }).catch(done);
        });
    });
});
