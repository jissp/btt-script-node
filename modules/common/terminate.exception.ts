export class TerminateException extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TerminateException';
    }
}