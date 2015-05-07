'use strict';

var typescript = require('gulp-typescript');

module.exports = function (config) {
    require('./karma.conf')(config);

    var tsProject = typescript.createProject({
        sortOutput: true
    });

    config.set({
        files: [
            'typescript/typings/*.ts',
            'typescript/*.ts'
        ],

        vinylStreams: function (src, dest) {
            src('typescript/**/*.ts')
                .pipe(typescript(tsProject))
                .pipe(dest());
        }
    });
};
