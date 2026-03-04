import * as path from 'node:path';

const { execFile } = require('child_process');

export async function ocr(imagePath: string): Promise<string> {
    const swiftExecutable = path.resolve('./modules/common/externals/template-match/bin/ocr');

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
