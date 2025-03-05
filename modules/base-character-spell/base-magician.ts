import { BttKeyCode, BttService } from '../btt-client';
import { BaseCharacterSpell } from './base-character-spell';
import { uSleep } from '../utils';
import { Latency } from '../common';
import { SpellCastOptions } from './character-spell.interface';

export class BaseMagician extends BaseCharacterSpell {
    protected constructor(protected readonly bttService: BttService) {
        super(bttService);
    }

    public async init() {
        await super.init();
    }

    public async castManaRecovery() {
        return this.castNoTargeting(BttKeyCode.Number1);
    }

    public async castHeal(isSelf: boolean) {
        if (isSelf) {
            await this.cast(BttKeyCode.Number2, {
                isTargetChange: true,
                targetChangeKeyCode: BttKeyCode.Home,
            });
        }

        await this.cast(BttKeyCode.Number2);
    }

    public async castCurse(options?: SpellCastOptions) {
        if (options?.isTargetChange) {
            await this.cast(BttKeyCode.Number4, options);
        }

        await this.cast(BttKeyCode.Number4);
    }

    public async castDefensiveSpell(isSelf: boolean) {
        if (isSelf) {
            await this.cast(BttKeyCode.Number8, {
                isTargetChange: true,
                targetChangeKeyCode: BttKeyCode.Home,
            });

            await uSleep(Latency.KeyCode);

            await this.cast(BttKeyCode.Number9, {
                isTargetChange: true,
                targetChangeKeyCode: BttKeyCode.Home,
            });
        }

        await this.cast(BttKeyCode.Number8);

        return this.cast(BttKeyCode.Number9);
    }
}
