import { BttKeyCode, BttService } from '../btt-client';
import { SpellCastOptions, SpellKeyCodes } from './character-spell.interface';

export abstract class BaseCharacterSpell {
    protected constructor(protected readonly bttService: BttService) {}

    public async init() {}

    public async closeTargetBox() {
        return this.bttService.sendKey(BttKeyCode.ESC);
    }

    public async cast(keyCode: SpellKeyCodes, options?: SpellCastOptions) {
        if (options?.isTargetChange) {
            return this.bttService.sendKeys(
                {keyCodes: [keyCode, options.targetChangeKeyCode ?? BttKeyCode.ArrowUp, BttKeyCode.Enter]},

            );
        }

        return this.bttService.sendKeys({keyCodes: [keyCode, BttKeyCode.Enter]});
    }

    public async castNoTargeting(keyCode: SpellKeyCodes) {
        return this.bttService.sendKey(keyCode);
    }
}
