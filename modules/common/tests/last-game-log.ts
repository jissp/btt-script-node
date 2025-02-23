import 'reflect-metadata';
import { container } from 'tsyringe';
import { HealthSupport } from '../../../health-support/health-support';
import { BttKeyCode } from '../../btt-client';
import { uSleep } from '../../utils';
import { ManaRecoveryItems } from '../common.interface';

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

    while (true) {
        const lastGameLog = await scriptor.getLastGameLog();
        console.log(lastGameLog);

        await uSleep(3000);
    }


    console.log('Health Support is done');
}

// 프로그램 시작
main().catch(error => {
    console.error('An error occurred during the migration process:', error);
});
