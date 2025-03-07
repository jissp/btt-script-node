import * as process from 'node:process';

export function debugLog(...message: any[]) {
    if (process.env['NODE_ENV'] === 'debug') {
        console.log(...message);
    }
}
