var dependency = require('./dependency');

window.main = function () {
    return 'main and ' + dependency();
};
