import { inject, injectable } from 'tsyringe';
import { GameRect, ManaRecoveryItems } from '../common.interface';
import { BttKeyCode, BttService } from '../../btt-client';
import { Nullable } from '../types';
import { ocrByClipboard, screenCapture } from '../externals';
import { ScriptHelper } from '../script.helper';
import { LocalStorage } from '../../storage';
import { Timer, TimerFactory } from '../../timer';

@injectable()
export class GameItemHelper {
    private itemCheckerTimer: Timer;

    constructor(
        @inject(ScriptHelper) private readonly scriptHelper: ScriptHelper,
        @inject(LocalStorage) private readonly localStorage: LocalStorage,
        @inject(BttService) private readonly bttService: BttService,
        @inject(TimerFactory) private readonly timerFactory: TimerFactory,
    ) {
        this.itemCheckerTimer = this.timerFactory.create('item-box-checker-timer', 500);
    }

    /**
     *
     * @param itemRowText
     */
    public extractItemSlotAndName(itemRowText: string): { slot: Nullable<BttKeyCode>; name: string } {
        const [, slot, name] = itemRowText.match(/([A-z0951])[\s]?[:;][\s]?([\w\W]+)/) ?? [];

        return {
            slot: slot in BttKeyCode ? (slot as BttKeyCode) : null,
            name,
        };
    }

    /**
     *
     * @param itemRows
     */
    public async isManaRecoveryItemBySlotA(itemRows: string[]): Promise<boolean> {
        if (itemRows.length === 0) {
            return false;
        }

        const { slot, name } = this.extractItemSlotAndName(itemRows[0]);
        const filteredManaRecoveryItemSlots = ManaRecoveryItems.filter(manaRecoveryName =>
            manaRecoveryName.includes(name),
        );

        return slot === BttKeyCode.a && filteredManaRecoveryItemSlots.length > 0;
    }

    /**
     * 아이템 Slot을 변경합니다.
     * @param beforeSlot
     * @param afterSlot
     */
    public async changeItemSlot(beforeSlot: BttKeyCode, afterSlot: BttKeyCode): Promise<void> {
        if (beforeSlot === afterSlot) {
            return;
        }

        // 오 인식으로 소문자 o가 숫자 0으로 인식될 수 있음. 이 경우 알파벳 o로 처리
        if (beforeSlot === BttKeyCode.Number0) {
            beforeSlot = BttKeyCode.o;
        }

        await this.bttService.sendKey(BttKeyCode.c, 500); // C
        await this.bttService.sendKeys({
            keyCodes: [beforeSlot, BttKeyCode[','], afterSlot, BttKeyCode.Enter],
        });
    }

    /**
     * 아이템을 사용합니다.
     */
    public async useItemSlot(slot: BttKeyCode): Promise<void> {
        await this.bttService.sendKeys({ keyCodes: [BttKeyCode.u, slot] });
    }

    /**
     * 아이템 목록을 업데이트합니다.
     */
    public async updateItemList() {
        return this.itemCheckerTimer.acquireLock(async () => {
            await screenCapture({
                rect: this.scriptHelper.getActiveWindowRect(),
            });

            const itemText = await ocrByClipboard(GameRect.ItemBox);
            const items = itemText.split('\n');

            this.localStorage.variable('item-rows', items);
        });
    }

    /**
     * 모든 아이템 목록을 응답합니다.
     */
    public getItemList() {
        return this.localStorage.variable<string[]>('item-rows') ?? [];
    }

    /**
     * 마나 회복 아이템 목록을 응답합니다.
     */
    public getManaRecoveryItemList() {
        const itemRows = this.getItemList();

        return itemRows.filter(row => ManaRecoveryItems.some(item => row.includes(item)));
    }
}
