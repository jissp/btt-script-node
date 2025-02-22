import { inject, injectable } from 'tsyringe';
import { BaseSupport } from '../modules/common/base-support';
import { uSleep } from '../modules/utils';
import { BttKeyCode } from '../modules/btt-client';
import { Timer } from '../modules/timer';
import { ManaRecoveryItems } from '../modules/common/common.interface';

enum SupportMode {
    HellFire = 'hellfire',
    // HellFireWithoutFreeze = 'hellfire-without-freeze',
    Freeze = 'freeze',
}

@injectable()
export class HellfireSupport extends BaseSupport {
    private mode: SupportMode = SupportMode.HellFire;
    private freezeModeStartTimestamp: number = 0;

    private hellFireTimer: Timer;

    constructor(@inject('ScriptName') protected readonly scriptName: string) {
        super();

        this.hellFireTimer = this.timerFactory.create('hellfire', 9000);
    }

    protected async handle(): Promise<void> {
        await this.terminateIfNotRunning();

        const oldMode = this.mode;
        this.mode = (await this.bttStorage.scriptVariable('mode')) as SupportMode;

        const isChanged = oldMode !== this.mode;
        if (isChanged) {
            await this.bttService.sendKey(BttKeyCode.ESC, 80);
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
                    this.freezeModeStartTimestamp = new Date().getTime();
                }
                await this.runFreezeMode();
                break;
            default:
                await uSleep(500);
        }

        await uSleep(50);
    }

    protected async initialized(): Promise<void> {
        await this.switchMode(SupportMode.HellFire);

        await this.hellFireTimer.init();

        // 메인 루프와 별개로 동작하는 백그라운드 루프 실행
        // this.backgroundLoop();
    }

    // private async backgroundLoop() {
    //     do {
    //         await this.terminateIfNotRunning();
    //
    //         // 막걸리 체크
    //         const itemText = await this.getItemBoxInfo();
    //         this.localStorage.variable('item-rows', itemText.split('\n'));
    //
    //         await uSleep(3000);
    //     } while (await this.isRunning());
    // }

    private async runHellFireMode(isFreeze: boolean) {
        // 마나가 없다면 회복 하기
        if (await this.isEmptyMana()) {
            await this.tryManaRecovery(99);

            // 공력증강 후 피 회복
            await this.trySelfHelling();
        }


        if (!this.hellFireTimer.isExpired()) {
            await this.runFreezeMode();

            return false;
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
        await this.runCurseAndHellfire(true);
        await uSleep(200);

        return true;
    }

    private async runFreezeMode() {
        for (let freezeCount = 0; freezeCount < 5; freezeCount++) {
            const currentTime = new Date().getTime();
            if (this.mode === SupportMode.Freeze && currentTime - this.freezeModeStartTimestamp > 5000) {
                await this.switchMode(SupportMode.HellFire);
                return;
            }

            // 마비 도중 체력이 부족한 경우 공격받는 중일 수 있음.
            if (await this.isEmptyHealth()) {
                await this.trySelfHelling();
                await this.trySafetyFreeze();
            }

            if (Math.round(Math.random() * 10) % 2 === 0) {
                await this.runTargetBlind(true);
            } else {
                await this.runTargetFreeze(true);
            }

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
                const itemRows = await this.getItemBoxInfo(true);
                this.localStorage.variable<string[]>('item-rows', itemRows);

                const manaRecoveryItems = itemRows.filter(row => ManaRecoveryItems.some(item => row.includes(item)));

                // 마나회복용 아이템이 없다면 종료
                if (manaRecoveryItems.length === 0) {
                    return false;
                }

                if (!(await this.isManaRecoveryItemShortCutToA(manaRecoveryItems))) {
                    const [, shortCut, itemName] = this.extractItemShortCutAndName(manaRecoveryItems[0]);
                    await this.changeItemAToB(shortCut as keyof typeof BttKeyCode, 'a');
                }

                await this.useManaRecoveryItem();
                await uSleep(80);
            }

            await this.terminateIfNotRunning();

            await this.bttService.sendKey(BttKeyCode.Number1, 50);
        } while (await this.isEmptyMana());

        return true;
    }

    private async runTargetFreeze(isNext: boolean) {
        await this.terminateIfNotRunning();

        await this.bttService.sendKey(BttKeyCode.Number6, 80);
        if (isNext) {
            await this.bttService.sendKey(BttKeyCode.ArrowUp, 80);
        }
        await this.bttService.sendKey(BttKeyCode.Enter);
    }

    private async runTargetBlind(isNext: boolean) {
        await this.terminateIfNotRunning();

        await this.bttService.sendKey(BttKeyCode.Number7, 80);
        if (isNext) {
            await this.bttService.sendKey(BttKeyCode['ArrowUp'], 80);
        }
        await this.bttService.sendKey(BttKeyCode['Enter']);
    }

    private async runCurseAndHellfire(needTryDefensiveFreeze: boolean) {
        await this.terminateIfNotRunning();

        await this.runCurse();

        const log = await this.getLastGameLog();
        if (log.indexOf('마법을 쓸 수') !== -1) {
            return;
        }

        // 헬파이어 날리기 전에 공격받고 있는지 체크
        if (needTryDefensiveFreeze && await this.isEmptyHealth()) {
            await this.trySelfHelling();
            await this.trySafetyFreeze();
            await uSleep(100);
        }

        await this.terminateIfNotRunning();
        await this.runHellFire();
    }

    private async runHellFire() {
        await this.bttService.sendKey(BttKeyCode.Number3, 80);
        await this.bttService.sendKey(BttKeyCode.Enter);

        await this.hellFireTimer.set();
    }

    private async trySelfHelling() {
        do {
            await this.selfHealing();
            await uSleep(50);

            if (this.defensiveTimer.isExpired()) {
                await this.runDefensive(true);
            }
        } while (await this.isEmptyHealth());
    }

    private async runDefensiveFreezeByKeyCode(arrowKeyCode: BttKeyCode) {
        await this.bttService.sendKey(BttKeyCode.Number6, 60);
        await this.bttService.sendKey(BttKeyCode.Home, 60);
        await this.bttService.sendKey(arrowKeyCode, 60);
        await this.bttService.sendKey(BttKeyCode.Enter, 70);
    }
}
