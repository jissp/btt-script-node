export class NotSupportedBackgroundHandleException extends Error {
    constructor() {
        super('Not supported background handle');
        this.name = 'NotSupportedBackgroundHandleException';
    }
}