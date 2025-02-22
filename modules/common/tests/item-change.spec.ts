import 'reflect-metadata';
import { container, inject } from 'tsyringe';
import { BaseSupport } from '../base-support';
import { BttKeyCode } from '../../btt-client';
import { uSleep } from '../../utils';

class TestScriptor extends BaseSupport {
    constructor(@inject('ScriptName') protected readonly scriptName: string) {
        super();
    }

    protected async handle(): Promise<void> {}
}


describe('', () => {
    container.register<string>('ScriptName', { useValue: 'TEST' });

    let testScriptor: BaseSupport;

    beforeAll(async () => {
        testScriptor = container.resolve<TestScriptor>(TestScriptor);
        await testScriptor.init();

        console.log('wait 3 seconds');
        await uSleep(3000);
    });

    it('아이템 인식 테스트', async () => {
        const itemRows = await testScriptor.getItemBoxInfo(true);

        // 동동주가 없다면 종료
        if (itemRows.length === 0 || itemRows.filter(row => row.indexOf('막걸리') !== -1).length === 0) {
            return false;
        }

        if (!(await testScriptor.isManaRecoveryItemShortCutToA(itemRows))) {
            const [, shortCut, itemName] = testScriptor.extractItemShortCutAndName(itemRows[0]);
            await testScriptor.changeItemAToB(shortCut as keyof typeof BttKeyCode, 'a');
        }
    });
});
