import { WindowRect } from '../../common.interface';

const { execFile } = require('child_process');

export async function screenCapture({
    rect,
    isOnlyClipboard = true,
}: {
    rect: WindowRect;
    isOnlyClipboard?: boolean;
}): Promise<string> {
    return new Promise((resolve, reject) => {
        const rectOptions = [rect.x, rect.y, rect.width, rect.height];

        execFile(
            `screencapture`,
            ["-x", "-r", "-c", "-t", "png", "-R", rectOptions.join(","), "/tmp/baram.png"],
            {
                env: {
                    PATH: '/usr/bin:/usr/sbin:/bin:/sbin',
                },
            },
            (error: Error, stdout: string, stderr: string) => {
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
            },
        );
    });
}
