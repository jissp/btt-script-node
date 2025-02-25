import 'reflect-metadata';
import { container } from 'tsyringe';
import { HealthSupport } from '../../../health-support/health-support';
import { BttKeyCode, BttService } from '../../btt-client';
import { uSleep } from '../../utils';
import { GameRect, ManaRecoveryItems } from '../common.interface';
import { ocrByClipboard } from '../externals';

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

    const activeWindowRect = await bttService.getActiveWindowRect();
    while (true) {
        // 1074 640
        // 1437 764

        const before = Date.now();

        await bttService.captureToClipboard(activeWindowRect);
        await uSleep(50);
        const text = await ocrByClipboard(GameRect.GameLastLog);
        const after = Date.now();

        console.log(after - before);
        console.log(text);

        await uSleep(3000);
    }


    console.log('Health Support is done');
}

// 프로그램 시작
main().catch(error => {
    console.error('An error occurred during the migration process:', error);
});
