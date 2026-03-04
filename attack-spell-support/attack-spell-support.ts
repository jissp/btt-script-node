import { inject, injectable } from 'tsyringe';
import { BaseScript, GameContext, ScriptContext } from '../common';
import { BttKeyCode } from '../modules/btt-client';
import { sleep } from '../common/utils';
import { Timer } from '../modules/timer';

@injectable()
export class AttackSpellSupport extends BaseScript {
    private defensiveTimer: Timer;

    constructor(@inject(ScriptContext) scriptContext: ScriptContext, @inject(GameContext) gameContext: GameContext) {
        super(scriptContext, gameContext);

        this.defensiveTimer = this.scriptContext.timerFactory.create('defensive', 185000);
    }

    public async initialized(): Promise<void> {}

    public async handle(): Promise<void> {
        await this.gameContext.system.closeTargetBox();
        await sleep(200);

        if (this.defensiveTimer.isExpired()) {
            await this.gameContext.spell.castDefensiveSpell(true);
            await this.defensiveTimer.set();
        }

        if (this.gameContext.character.isManaBelow(20)) {
            await this.tryManaRecovery();
        }

        // 몬스터 타겟팅
        await this.scriptContext.bttService.wrapKeyboardInputBlock(async () => {
            await this.scriptContext.bttService.sendKeys({
                keyCodes: [BttKeyCode.Tab, BttKeyCode.ArrowUp, BttKeyCode.Tab],
            });
        });

        if (!(await this.searchMonster(true))) {
            return;
        }

        let isTargetSelecting = false;
        do {
            await this.scriptContext.bttService.sendKeys({
                keyCodes: [BttKeyCode.Number3, BttKeyCode.Number1, BttKeyCode.Number1],
            });

            isTargetSelecting = await this.gameContext.system.isTargetSelecting();
        } while (isTargetSelecting);
    }

    // 오버라이딩
    async searchMonster(isNext: boolean) {
        await this.scriptContext.bttService.sendKey(BttKeyCode.Number2);

        await sleep(80); // 스크린샷 캡처 하기 전 게임 화면 갱신을 위해 잠깐 대기

        const lastGameLog = await this.gameContext.system.getLastGameLog();

        return ['걸리지 않습니다'].some(keyword => lastGameLog.includes(keyword));
    }

    private async tryManaRecovery(limitCount = 5) {
        let tryCount = 0;
        do {
            await this.scriptContext.scriptHelper.terminateIfNotRunning();

            if (++tryCount > limitCount || this.gameContext.character.isDead()) {
                return false;
            }

            await this.scriptContext.bttService.sendKey(BttKeyCode.Number1, 100);
        } while (this.gameContext.character.isManaBelow(20));

        return true;
    }
}
