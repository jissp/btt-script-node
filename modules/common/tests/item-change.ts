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
    const itemRows = await scriptor.getItemBoxInfo(true);
    // if (itemRows.length === 0 || itemRows.filter(row => row.indexOf('막걸리') !== -1).length === 0) {
    //
    // }

    console.log(itemRows);

    if (!(await scriptor.isManaRecoveryItemShortCutToA(itemRows))) {
        const manaRecoveryItems = itemRows.filter(row => ManaRecoveryItems.some(item => row.includes(item)));

        const [, shortCut, itemName] = scriptor.extractItemShortCutAndName(manaRecoveryItems[0]);
        await scriptor.changeItemAToB(shortCut as keyof typeof BttKeyCode, 'a');
    }

    console.log('Health Support is done');
}

// 프로그램 시작
main().catch(error => {
    console.error('An error occurred during the migration process:', error);
});
