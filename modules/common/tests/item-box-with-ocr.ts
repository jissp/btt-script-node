import 'reflect-metadata';
import { container } from 'tsyringe';
import { HealthSupport } from '../../../health-support/health-support';
import { BttService } from '../../btt-client';
import { uSleep } from '../../utils';
import { GameRect } from '../common.interface';
import { ocrByClipboard, screenCapture } from '../externals';

async function main() {
    console.log('wait 3 seconds');
    await uSleep(3000);

    console.log('start');
    container.register<string>('ScriptName', { useValue: 'TEST' });

    const scriptor = container.resolve<HealthSupport>(HealthSupport);
    await scriptor.init();

    const bttService = container.resolve(BttService);

    /* ****************************************************
     *
     **************************************************** */
    console.log(`beforeLastGameLog: ${Date.now()}`);

    const activeWindowRect = await bttService.getActiveWindowRect();
    while (true) {
        await screenCapture({
            rect: activeWindowRect,
        });
        await uSleep(50);
        const text = await ocrByClipboard(GameRect.ItemBox, true);
        console.log(text);

        await uSleep(3000);
    }

    console.log('Health Support is done');
}

// 프로그램 시작
main().catch(error => {
    console.error('An error occurred during the migration process:', error);
});
