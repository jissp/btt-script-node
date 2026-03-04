import { inject, injectable } from 'tsyringe';
import { Latency } from '../common.interface';
import { sleep } from '../../utils';
import { BttKeyCode, BttService } from '../../btt-client';

export type SpellKeyCodes =
    | BttKeyCode.Number0
    | BttKeyCode.Number1
    | BttKeyCode.Number2
    | BttKeyCode.Number3
    | BttKeyCode.Number4
    | BttKeyCode.Number5
    | BttKeyCode.Number6
    | BttKeyCode.Number7
    | BttKeyCode.Number8
    | BttKeyCode.Number9;

export type TargetChangeKeyCodes =
    | BttKeyCode.ArrowUp
    | BttKeyCode.ArrowDown
    | BttKeyCode.ArrowLeft
    | BttKeyCode.ArrowRight
    | BttKeyCode.Home;

export type SpellCastOptions = {
    isNextTarget?: boolean;
    nextTargetKeyCode?: TargetChangeKeyCodes;
};

@injectable()
export class GameSpellHelper {
    constructor(@inject(BttService) private readonly bttService: BttService) {}

    public async cast(keyCode: SpellKeyCodes, options?: SpellCastOptions) {
        if (options?.isNextTarget) {
            return this.bttService.sendKeys({
                keyCodes: [keyCode, options.nextTargetKeyCode ?? BttKeyCode.ArrowUp, BttKeyCode.Enter],
            });
        }

        return this.bttService.sendKeys({ keyCodes: [keyCode, BttKeyCode.Enter] });
    }

    public async castNoTargeting(keyCode: SpellKeyCodes) {
        return this.bttService.sendKey(keyCode);
    }

    /**
     * 공력증강 시전
     */
    public async castManaRecovery() {
        return this.castNoTargeting(BttKeyCode.Number1);
    }

    /**
     * 회복마법 시전
     * @param isSelf
     */
    public async castHeal(isSelf: boolean) {
        if (isSelf) {
            return this.cast(BttKeyCode.Number2, {
                isNextTarget: true,
                nextTargetKeyCode: BttKeyCode.Home,
            });
        }

        return this.cast(BttKeyCode.Number2);
    }

    /**
     * 백호의 희원 시전
     */
    public async castWhiteTigerHealing() {
        return this.cast(BttKeyCode.Number3);
    }

    /**
     * 저주 / 혼마술 시전
     * @param options
     */
    public async castCurse(options?: SpellCastOptions) {
        if (options?.isNextTarget) {
            return this.cast(BttKeyCode.Number4, options);
        }

        return this.cast(BttKeyCode.Number4);
    }

    /**
     * 보호 / 무장 시전
     * @param isSelf
     */
    public async castDefensiveSpell(isSelf: boolean) {
        if (isSelf) {
            await this.cast(BttKeyCode.Number8, {
                isNextTarget: true,
                nextTargetKeyCode: BttKeyCode.Home,
            });

            await sleep(Latency.KeyCode);

            return this.cast(BttKeyCode.Number9, {
                isNextTarget: true,
                nextTargetKeyCode: BttKeyCode.Home,
            });
        }

        await this.cast(BttKeyCode.Number8);

        return this.cast(BttKeyCode.Number9);
    }

    /**
     * 금강불체 시전
     */
    public async castInvincible() {
        return this.castNoTargeting(BttKeyCode.Number0);
    }

    /**
     * 공력주입 시전
     */
    public async castManaInject() {
        return this.cast(BttKeyCode.Number5);
    }

    /**
     * 부활 시전
     */
    public async castResurrection(isSelf: boolean) {
        if (isSelf) {
            return this.cast(BttKeyCode.Number6, {
                isNextTarget: true,
                nextTargetKeyCode: BttKeyCode.Home,
            });
        }

        return this.cast(BttKeyCode.Number6);
    }

    /**
     * 헬파이어 시전
     */
    public async castHellfire() {
        return this.cast(BttKeyCode.Number3);
    }
}
