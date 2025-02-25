import * as path from 'node:path';
import { WindowRect } from '../../common.interface';

const { execFile } = require('child_process');

export async function ocr(imagePath: string): Promise<string> {
    const swiftExecutable = path.resolve('./modules/common/externals/ocr/bin/ocr');

    return new Promise((resolve, reject) => {
        execFile(swiftExecutable, [imagePath], (error: Error, stdout: string, stderr: string) => {
            if (error) {
                reject(error.message);
                console.error(`오류 발생: ${error.message}`);
                return;
            }
            if (stderr) {
                reject(stderr);
                return;
            }

            resolve(stdout);
        });
    });
}

export async function ocrByClipboard(rect: WindowRect): Promise<string> {
    const swiftExecutable = path.resolve('./modules/common/externals/ocr/bin/ocr-clipboard-crop');

    return new Promise((resolve, reject) => {
        execFile(swiftExecutable, [rect.x * 2, rect.y * 2, rect.width * 2, rect.height * 2], (error: Error, stdout: string, stderr: string) => {
            if (error) {
                reject(error.message);
                console.error(`오류 발생: ${error.message}`);
                return;
            }
            if (stderr) {
                reject(stderr);
                return;
            }

            resolve(stdout);
        });
    });
}
