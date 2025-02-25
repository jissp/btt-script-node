import 'reflect-metadata';
import { container } from 'tsyringe';
import { HealthSupport } from '../../../health-support/health-support';
import { BttKeyCode, BttService } from '../../btt-client';
import { uSleep } from '../../utils';
import { ManaRecoveryItems } from '../common.interface';
import { ocrByClipboard, screenCapture } from '../externals';

async function main() {
    console.log('wait 3 seconds');
    await uSleep(3000);

    console.log('start');
    container.register<string>('ScriptName', { useValue: 'TEST' });

    const scriptor = container.resolve<HealthSupport>(HealthSupport);
    await scriptor.init();

    /* ****************************************************
     *
     **************************************************** */
    console.log(`beforeLastGameLog: ${Date.now()}`);

    const bttService = container.resolve(BttService);

    while (true) {
        // 1074 640
        // 1437 764

        const before = Date.now();

        await screenCapture({
            rect: await bttService.getActiveWindowRect(),
        });
        // const text = await ocrByClipboard({
        //     x: 0,
        //     y: 0,
        //     width: 1437,
        //     height: 764,
        // });
        const after = Date.now();

        console.log(after - before);

        await uSleep(3000);
    }


    console.log('Health Support is done');
}

// 프로그램 시작
main().catch(error => {
    console.error('An error occurred during the migration process:', error);
});
