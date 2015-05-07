/// <reference path="dependency.ts" />

interface Window {
    main: Function
}

window.main = function (): string {
    return 'main and ' + dependency.name();
}
