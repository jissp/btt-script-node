import { inject, injectable } from 'tsyringe';
import { BaseScript } from '../modules/common';
import { BttKeyCode } from '../modules/btt-client';
import { uSleep } from '../modules/utils';

@injectable()
export class AttackSpellSupport extends BaseScript {
    constructor(@inject('ScriptName') protected readonly scriptName: string) {
        super();
    }

    protected async initialized(): Promise<void> {}

    protected async handle(): Promise<void> {
        await this.bttService.sendKey(BttKeyCode.ESC, 200);

        if (this.defensiveTimer.isExpired()) {
            await this.runDefensive(true);
            await this.defensiveTimer.set();
        }

        // 몬스터 타겟팅
        await this.bttService.wrapKeyboardInputBlock(async () => {
            await this.bttService.sendKeys(BttKeyCode.Tab, BttKeyCode.ArrowUp, BttKeyCode.Tab);
        });

        if (!(await this.checkMonsterTarget(true))) {
            return;
        }

        do {
            await this.bttService.sendKeys(BttKeyCode.Number3, BttKeyCode.Number1, BttKeyCode.Number1);
        } while (!(await this.isTargetSelecting()));
    }

    // 오버라이딩
    async checkMonsterTarget(isNext: boolean) {
        await this.bttService.sendKey(BttKeyCode.Number2);

        await uSleep(80); // 스크린샷 캡처 하기 전 게임 화면 갱신을 위해 잠깐 대기

        const lastGameLog = await this.getLastGameLog();

        return ['걸리지 않습니다'].some(keyword => lastGameLog.includes(keyword));
    }
}
