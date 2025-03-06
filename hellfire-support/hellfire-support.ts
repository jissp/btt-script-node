import { inject, injectable } from 'tsyringe';
import { BaseScript, GameRect, Latency, ManaRecoveryItems, ocrByClipboard, screenCapture } from '../modules/common';
import { uSleep } from '../modules/utils';
import { Timer } from '../modules/timer';
import { BttKeyCode } from '../modules/btt-client';
import { Wntnftk } from '../modules/base-character-spell';
import { CharacterFactory } from '../modules/character';
import { PacketType } from '../modules/packet-sniffer';

enum SupportMode {
    HellFire = 'hellfire',
    // HellFireWithoutFreeze = 'hellfire-without-freeze',
    Freeze = 'freeze',
    None = 'none',
}

@injectable()
export class HellfireSupport extends BaseScript {
    private mode: SupportMode = SupportMode.HellFire;

    private loopCheckManaTimer: Timer;
    private hellFireTimer: Timer;
    private freezeModeTimer: Timer;
    private itemCheckerTimer: Timer;

    protected excludePacketPatterns = [PacketType.체력마력자동회복];

    constructor(
        @inject('ScriptName') protected readonly scriptName: string,
        @inject(CharacterFactory) characterFactory: CharacterFactory,
    ) {
        super(characterFactory.create<Wntnftk>(Wntnftk));

        this.hellFireTimer = this.timerFactory.create('hellfire', 9000);
        this.loopCheckManaTimer = this.timerFactory.create('check-mana', 2000);
        this.freezeModeTimer = this.timerFactory.create('freeze-mode', 5000);
        this.itemCheckerTimer = this.timerFactory.create('item-box-checker-timer', 500);
    }

    protected async initialized(): Promise<void> {
        await this.switchMode(SupportMode.None);
        await this.hellFireTimer.init();

        do {
            await this.terminateIfNotRunning();

            if (await this.isActiveApp()) {
                await this.bttService.sendKey(BttKeyCode.s, Latency.KeyCode);
            }

            await uSleep(100);
        } while (!this.character.isSetSelfObjectId());

        // 아이템창부터 키고 시작하기
        await this.bttService.sendKey(BttKeyCode.i, Latency.KeyCode);
    }

    protected async handle(): Promise<void> {
        const oldMode = this.mode;
        this.mode = (await this.bttStorage.scriptVariable('mode')) as SupportMode;

        const isChanged = oldMode !== this.mode;
        if (isChanged) {
            await this.bttService.sendKey(BttKeyCode.ESC, Latency.KeyCode);
        }

        switch (this.mode) {
            case SupportMode.HellFire:
                await this.runHellFireMode(true);
                break;
            // case SupportMode.HellFireWithoutFreeze:
            //     await runHellFireMode(false);
            //     break;
            case SupportMode.Freeze:
                if (isChanged) {
                    await this.freezeModeTimer.set();
                }
                await this.runFreezeMode();
                break;
            default:
                await uSleep(500);
        }
    }

    protected async handleForBackground() {
        this.tryRefreshItemList();
    }

    private async runHellFireMode(isFreeze: boolean) {
        // 마나가 없다면 회복 하기 (여기에서 체크하는 이유는 렉 때문에 헬파이어 사용 후 회복을 못할 수 있기 때문)
        if (await this.isEmptyMana()) {
            await this.tryManaRecovery(99);

            // 공력증강 후 피 회복
            await this.trySelfHeal();
        }

        if ((isFreeze && !this.hellFireTimer.isExpired()) || this.isLatestDetectObjectMove()) {
            await this.runFreezeMode();

            return false;
        }

        // 몬스터 찾기 전 체력이 부족한 경우 공격받는 중일 수 있음.
        // if (this.isEmptyHealth()) {
        if (this.detectedDecrementHpBarValue > 1) {
            await this.trySelfHeal();
            await this.trySafetyFreeze();
            await uSleep(100);
            this.detectedDecrementHpBarValue = 0;
        }

        if (!(await this.checkMonsterTarget(true))) {
            return false;
        }

        console.log('몬스터 감지');

        await uSleep(600);

        // 헬파이어 날리기 전에 공격받고 있는지 체크
        if (this.isEmptyHealth()) {
            await this.trySelfHeal();
            await this.trySafetyFreeze();
            await uSleep(100);
        }

        // 몬스터를 찾았다면 저주 + 헬파이어 사용
        await this.runCurseAndHellfire();
        await uSleep(1000);

        return true;
    }

    private async runFreezeMode() {
        console.log('주변 적에게 마비/절망을 시전합니다.');
        for (let freezeCount = 0; freezeCount < 5; freezeCount++) {
            if (this.mode === SupportMode.None) {
                return;
            }

            if (this.mode === SupportMode.Freeze && this.freezeModeTimer.isExpired()) {
                await this.switchMode(SupportMode.HellFire);
                return;
            }

            // 마비 도중 체력이 부족한 경우 공격받는 중일 수 있음.
            if (this.detectedDecrementHpBarValue > 1) {
                await this.trySelfHeal();
                await this.trySafetyFreeze();
                this.detectedDecrementHpBarValue = 0;
            }

            const spellKeyCode = Math.round(Math.random() * 10) % 2 === 0 ? BttKeyCode.Number6 : BttKeyCode.Number7;
            await this.castSpellOnTarget(spellKeyCode, {
                isNextTarget: true,
            });

            await uSleep(200);
        }
    }

    private async trySafetyFreeze() {
        console.log('캐릭터 주변의 적에게 마비를 겁니다.');
        for (const arrowKeyCode of [
            BttKeyCode.ArrowUp,
            BttKeyCode.ArrowDown,
            BttKeyCode.ArrowLeft,
            BttKeyCode.ArrowRight,
        ]) {
            await this.runDefensiveFreezeByKeyCode(arrowKeyCode);
            await uSleep(60);
        }
    }

    private async switchMode(mode: SupportMode) {
        await this.bttStorage.scriptVariable('mode', mode);
    }

    private async isMode(mode: SupportMode, isReferenceByBtt?: boolean) {
        if (isReferenceByBtt) {
            const bttMode = (await this.bttStorage.scriptVariable('mode')) as SupportMode;
            return bttMode === mode;
        }

        return this.mode === mode;
    }

    private async tryManaRecovery(limitCount = 9) {
        let tryCount = 0;
        do {
            if (++tryCount > limitCount) {
                return false;
            }

            if (this.isZeroMana()) {
                const itemRows = this.localStorage.variable<string[]>('item-rows') ?? [];

                const manaRecoveryItems = itemRows.filter(row => ManaRecoveryItems.some(item => row.includes(item)));

                // 마나회복용 아이템이 없다면 종료
                if (manaRecoveryItems.length === 0) {
                    return false;
                }

                // 만약 a 위치에 술이 위치하지 않고 있다면 아이템 위치를 바꾼다.
                if (!(await this.isManaRecoveryItemShortCutToA(manaRecoveryItems))) {
                    // 아이템을 변경
                    const [, shortCut, itemName] = this.extractItemShortCutAndName(manaRecoveryItems[0]);
                    await this.changeItemAToB(shortCut as keyof typeof BttKeyCode, 'a');

                    // 화면 갱신을 위해 기다렸다가 갱신
                    await uSleep(100);

                    await this.refreshItemList();
                }

                await this.useManaRecoveryItem();
                await uSleep(200);
            }

            await this.terminateIfNotRunning();

            await this.bttService.sendKey(BttKeyCode.Number1, Latency.KeyCode);
        } while (this.isEmptyMana());

        await this.loopCheckManaTimer.set();
        return true;
    }

    private async runCurseAndHellfire() {
        console.log('몬스터를 공격합니다.');
        await this.terminateIfNotRunning();

        await this.runCurse();

        await uSleep(100); // 스크린샷 캡처 하기 전 게임 화면 갱신을 위해 잠깐 대기

        // 잘못된 대상을 공격하는 경우가 있어서 헬파이어 사용하기 전에 다시 체크
        const log = await this.getLastGameLog();
        if (log.includes('마법을 쓸 수')) {
            return;
        }

        await this.terminateIfNotRunning();
        await this.runHellFire();
    }

    private async runHellFire() {
        await this.castSpellOnTarget(BttKeyCode.Number3);

        await this.hellFireTimer.set();
    }

    private async trySelfHeal() {
        console.log('HP 회복을 시도합니다.');
        let healingCount = 0;
        do {
            await this.terminateIfNotRunning();
            if (this.mode === SupportMode.None) {
                break;
            }

            const isCheck = healingCount++ % 5 === 0;
            if (isCheck && this.isZeroHealth()) {
                break;
            }

            await this.selfHealing(isCheck);
            await uSleep(200);
        } while (this.isEmptyHealth());

        if (this.defensiveTimer.isExpired()) {
            await uSleep(Latency.KeyCode);
            await this.runDefensive(true);
        }
    }

    private async runDefensiveFreezeByKeyCode(arrowKeyCode: BttKeyCode) {
        await this.bttService.sendKeys({
            keyCodes: [BttKeyCode.Number6, BttKeyCode.Home, arrowKeyCode, BttKeyCode.Enter],
        });
    }

    private async tryRefreshItemList() {
        return this.itemCheckerTimer.acquireLock(async () => {
            return this.refreshItemList();
        });
    }

    private async refreshItemList() {
        await screenCapture({
            rect: this.activeWindowRect,
        });

        const itemText = await ocrByClipboard(GameRect.ItemBox);
        const items = itemText.split('\n');

        this.localStorage.variable('item-rows', items);
    }

    private isLatestDetectObjectMove() {
        const currentTimestamp = Date.now();

        return currentTimestamp - this.latestDetectedMoveTimestamp < 1000;
    }
}
