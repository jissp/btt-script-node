import { inject, injectable } from 'tsyringe';
import { BaseScript } from '../modules/common';
import { BttKeyCode } from '../modules/btt-client';
import { uSleep } from '../modules/utils';
import { Character, CharacterFactory } from '../modules/character';
import { Wntnftk } from '../modules/base-character-spell';

@injectable()
export class AttackSpellSupport extends BaseScript {
    protected readonly character: Character<Wntnftk>;

    constructor(
        @inject('ScriptName') protected readonly scriptName: string,
        @inject(CharacterFactory) characterFactory: CharacterFactory,
    ) {
        const character = characterFactory.create<Wntnftk>(Wntnftk);

        super(character);

        this.character = character;
    }

    protected async initialized(): Promise<void> {}

    protected async handle(): Promise<void> {
        await this.character.spell.closeTargetBox();
        await uSleep(200);

        if (this.defensiveTimer.isExpired()) {
            await this.runDefensive(true);
            await this.defensiveTimer.set();
        }

        if (this.isManaBelow(20)) {
            await this.tryManaRecovery();
        }

        // 몬스터 타겟팅
        await this.bttService.wrapKeyboardInputBlock(async () => {
            await this.bttService.sendKeys({ keyCodes: [BttKeyCode.Tab, BttKeyCode.ArrowUp, BttKeyCode.Tab] });
        });

        if (!(await this.searchMonster(true))) {
            return;
        }

        do {
            await this.bttService.sendKeys({ keyCodes: [BttKeyCode.Number3, BttKeyCode.Number1, BttKeyCode.Number1] });
        } while (!(await this.isTargetSelecting()));
    }

    // 오버라이딩
    async searchMonster(isNext: boolean) {
        await this.bttService.sendKey(BttKeyCode.Number2);

        await uSleep(80); // 스크린샷 캡처 하기 전 게임 화면 갱신을 위해 잠깐 대기

        const lastGameLog = await this.getLastGameLog();

        return ['걸리지 않습니다'].some(keyword => lastGameLog.includes(keyword));
    }

    private async tryManaRecovery(limitCount = 5) {
        let tryCount = 0;
        do {
            await this.terminateIfNotRunning();

            if (++tryCount > limitCount || this.isEmptyHealth()) {
                return false;
            }

            await this.bttService.sendKey(BttKeyCode.Number1, 100);
        } while (this.isManaBelow(20));

        return true;
    }
}
