import 'reflect-metadata';
import { container } from 'tsyringe';
import { HealthSupport } from '../../../health-support/health-support';
import { BttService } from '../../btt-client';
import { uSleep } from '../../utils';
import { ocrByClipboard, screenCapture } from '../externals';
import { GameRect } from '../common.interface';

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
    const activeWindowRect = await bttService.getActiveWindowRect();

    do {
        await screenCapture({
            rect: activeWindowRect,
        });

        const text = await ocrByClipboard(GameRect.BuffBox, false);

        const buffs = text.trim().split('\n');
        const buffMap = buffs.map(scriptor.extractBuffNameAndSeconds);

        console.log(Object.fromEntries(buffMap));

        await uSleep(500);
    } while (true);
}

// 프로그램 시작
main().catch(error => {
    console.error('An error occurred during the migration process:', error);
});
