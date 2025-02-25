import { inject, injectable } from 'tsyringe';
import { BaseScript, Latency, ManaRecoveryItems, ocr } from '../modules/common';
import { uSleep } from '../modules/utils';
import { Timer } from '../modules/timer';
import { BttKeyCode } from '../modules/btt-client';

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

    constructor(@inject('ScriptName') protected readonly scriptName: string) {
        super();

        this.hellFireTimer = this.timerFactory.create('hellfire', 9000);
        this.loopCheckManaTimer = this.timerFactory.create('check-mana', 2000);
        this.freezeModeTimer = this.timerFactory.create('freeze-mode', 5000);
        this.itemCheckerTimer = this.timerFactory.create('item-box-checker-timer', 3000);
    }

    protected async initialized(): Promise<void> {
        await this.switchMode(SupportMode.HellFire);

        await this.hellFireTimer.init();

        // 마나가 없다면 회복 하기
        if (await this.isEmptyMana()) {
            await this.tryManaRecovery(99);

            // 공력증강 후 피 회복
            await this.trySelfHelling();
        }
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
        // this.tryRefreshItemList();
    }

    private async runHellFireMode(isFreeze: boolean) {
        // 마나가 없다면 회복 하기 (여기에서 체크하는 이유는 렉 때문에 헬파이어 사용 후 회복을 못할 수 있기 때문)
        if (this.loopCheckManaTimer.isExpired() && (await this.isEmptyMana())) {
            await this.tryManaRecovery(99);

            // 공력증강 후 피 회복
            await this.trySelfHelling();
        }

        if (!this.hellFireTimer.isExpired()) {
            await this.runFreezeMode();

            return false;
        }

        // 몬스터 찾기 전 체력이 부족한 경우 공격받는 중일 수 있음.
        if (await this.isEmptyHealth()) {
            await this.trySelfHelling();
            await this.trySafetyFreeze();
            await uSleep(100);
        }

        if (!(await this.checkMonsterTarget(true))) {
            return false;
        }

        await uSleep(600);

        // 헬파이어 날리기 전에 공격받고 있는지 체크
        if (await this.isEmptyHealth()) {
            await this.trySelfHelling();
            await this.trySafetyFreeze();
            await uSleep(100);
        }

        // 몬스터를 찾았다면 저주 + 헬파이어 사용
        await this.runCurseAndHellfire();
        await uSleep(200);

        return true;
    }

    private async runFreezeMode() {
        for (let freezeCount = 0; freezeCount < 5; freezeCount++) {
            if (this.mode === SupportMode.None) {
                return;
            }

            if (this.mode === SupportMode.Freeze && this.freezeModeTimer.isExpired()) {
                await this.switchMode(SupportMode.HellFire);
                return;
            }

            // 마비 도중 체력이 부족한 경우 공격받는 중일 수 있음.
            if (await this.isEmptyHealth()) {
                await this.trySelfHelling();
                await this.trySafetyFreeze();
            }

            const spellKeyCode = Math.round(Math.random() * 10) % 2 === 0 ? BttKeyCode.Number6 : BttKeyCode.Number7;
            await this.castSpellOnTarget(spellKeyCode, {
                isNextTarget: true,
            });

            await uSleep(100);
        }
    }

    private async trySafetyFreeze() {
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

    private async tryManaRecovery(limitCount = 9) {
        let tryCount = 0;
        do {
            if (++tryCount > limitCount) {
                return false;
            }

            if (await this.isZeroMana()) {
                const itemRows = this.localStorage.variable<string[]>('item-rows') ?? [];

                const manaRecoveryItems = itemRows.filter(row => ManaRecoveryItems.some(item => row.includes(item)));

                // 마나회복용 아이템이 없다면 종료
                if (manaRecoveryItems.length === 0) {
                    return false;
                }

                if (!(await this.isManaRecoveryItemShortCutToA(manaRecoveryItems))) {
                    const [, shortCut, itemName] = this.extractItemShortCutAndName(manaRecoveryItems[0]);
                    await this.changeItemAToB(shortCut as keyof typeof BttKeyCode, 'a');

                    // 아이템을 변경했으면 아이템 목록을 갱신
                    await this.refreshItemList();
                }

                await this.useManaRecoveryItem();
                await uSleep(80);
            }

            await this.terminateIfNotRunning();

            await this.bttService.sendKey(BttKeyCode.Number1, Latency.KeyCode);
        } while (await this.isEmptyMana());

        await this.loopCheckManaTimer.set();
        return true;
    }

    private async runCurseAndHellfire() {
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

    private async trySelfHelling() {
        let healingCount = 0;
        do {
            await this.terminateIfNotRunning();

            await this.selfHealing();
            await uSleep(70);
            if (healingCount++ % 5 === 0 && (await this.isZeroHealth())) {
                break;
            }
        } while (await this.isEmptyHealth());

        if (this.defensiveTimer.isExpired()) {
            await uSleep(50);
            await this.runDefensive(true);
        }
    }

    private async runDefensiveFreezeByKeyCode(arrowKeyCode: BttKeyCode) {
        await this.bttService.sendKey(BttKeyCode.Number6, Latency.KeyCode);
        await this.bttService.sendKey(BttKeyCode.Home, Latency.KeyCode);
        await this.bttService.sendKey(arrowKeyCode, Latency.KeyCode);
        await this.bttService.sendKey(BttKeyCode.Enter);
    }

    private async tryRefreshItemList() {
        return this.itemCheckerTimer.acquireLock(async () => {
            return this.refreshItemList(50);
        });
    }

    private async refreshItemList(captureAfterWaitMilliSeconds = 250) {
        const tempImagePath = `${this.storagePath}/item-box.png`;
        await this.bttService.captureToPath(this.calcItemRect(), tempImagePath);
        await uSleep(captureAfterWaitMilliSeconds);

        const itemText = await ocr(tempImagePath);
        const items = itemText.split('\n');

        this.localStorage.variable('item-rows', items);
    }
}
