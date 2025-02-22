import { inject, injectable } from 'tsyringe';
import { BaseSupport, Latency } from '../modules/common';
import { uSleep } from '../modules/utils';
import { BttKeyCode } from '../modules/btt-client';
import { Timer } from '../modules/timer';

enum SupportMode {
    None = 'none',
    Health = 'health',
    Curse = 'curse',
}

@injectable()
export class HealthSupport extends BaseSupport {
    private mode: SupportMode = SupportMode.Health;
    private curseModeStartTimestamp: number = 0;

    private whiteTigerTimer: Timer;
    private manaInjectionTimer: Timer;

    constructor(@inject('ScriptName') protected readonly scriptName: string) {
        super();

        this.whiteTigerTimer = this.timerFactory.create('white-tiger', 0);
        this.manaInjectionTimer = this.timerFactory.create('mana-injection', 300000);
    }

    protected async handle(): Promise<void> {
        await this.terminateIfNotRunning();

        const oldMode = this.mode;
        this.mode = (await this.bttStorage.scriptVariable('mode')) as SupportMode;

        const isChanged = oldMode !== this.mode;

        await this.handleMode(this.mode, isChanged);

        await uSleep(50);
    }

    protected async initialized(): Promise<void> {
        await this.switchMode(SupportMode.Health);
        this.localStorage.variable<boolean>(
            'is-invincible',
            (await this.bttStorage.scriptNumberVariable('is-invincible')) === 1,
        );

        //
        await this.whiteTigerTimer.init();
        const currentCharacterMana = await this.bttStorage.scriptNumberVariable('current-mana');
        if (currentCharacterMana) {
            this.whiteTigerTimer.setExpiresIn((Math.round(currentCharacterMana / 1000) + 10) * 100);
        }

        // 메인 루프와 별개로 동작하는 백그라운드 루프 실행
        this.backgroundLoop();
    }

    private async backgroundLoop() {
        do {
            await this.terminateIfNotRunning();

            // 버프 체크
            await this.trySelfBuff();

            await uSleep(1000);
        } while (await this.isRunning());
    }

    private async handleMode(mode: SupportMode, isChanged: boolean) {
        if (isChanged) {
            await this.bttService.sendKey(BttKeyCode.ESC, Latency.KeyCode);
        }

        switch (mode) {
            case SupportMode.Health:
                if (isChanged) {
                    await uSleep(100);
                    await this.runTabTab();
                    await uSleep(100);
                }

                await this.runHealthMode();
                break;
            case SupportMode.Curse:
                if (isChanged) {
                    this.curseModeStartTimestamp = new Date().getTime();
                }
                await this.runCurseMode();
                break;
            default:
                await uSleep(500);
        }
    }

    private async runHealthMode() {
        if (await this.isZeroHealth()) {
            const isTargetSelecting = await this.isTargetSelecting();

            await this.tryResurrection();

            if (isTargetSelecting) {
                await this.switchMode(SupportMode.None);

                return;
            }

            await uSleep(100);
            await this.runTabTab();
            await uSleep(100);
        }

        if (await this.isEmptyMana()) {
            if (!(await this.tryManaRecovery())) {
                return false;
            }
        }

        if (this.defensiveTimer.isExpired()) {
            await uSleep(500);
            await this.runDefensiveIfTabTab();
        }

        const isModeratelyEmptyMana = await this.isModeratelyEmptyMana();
        for (let healLoop = 0; healLoop < 5; healLoop++) {
            await this.terminateIfNotRunning();

            if (isModeratelyEmptyMana && healLoop === 0) {
                await this.bttService.sendKey(BttKeyCode.Number1, 100);
            } else if (!isModeratelyEmptyMana && this.whiteTigerTimer.isExpired()) {
                await this.runWhiteTigerHealing();
            } else {
                await this.bttService.sendKey(BttKeyCode.Number2, 180);
            }
        }
    }

    private async runCurseMode() {
        const currentTimestamp = new Date().getTime();
        if (currentTimestamp - this.curseModeStartTimestamp > 5000) {
            await this.switchMode(SupportMode.Health);
            return;
        }

        if (await this.isZeroHealth()) {
            await this.tryResurrection(100);

            await uSleep(100);
        }

        for (let curseCount = 0; curseCount < 3; curseCount++) {
            await this.terminateIfNotRunning();

            await this.runCurse(true);
            await uSleep(40);
        }
    }

    private async switchMode(mode: SupportMode) {
        await this.bttStorage.scriptVariable('mode', mode);
    }

    private async tryResurrection(waitTimestamp = 500) {
        await this.bttService.sendKey(BttKeyCode.ESC, waitTimestamp);

        await this.castSpellOnTarget(BttKeyCode.Number6, {
            isNextTarget: true,
            nextTargetKeyCode: BttKeyCode.Home,
        });
    }

    private async tryManaRecovery(limitCount = 5) {
        let tryCount = 0;
        do {
            await this.terminateIfNotRunning();

            if ((await this.isZeroHealth()) || ++tryCount > limitCount) {
                return false;
            }

            await this.bttService.sendKey(BttKeyCode.Number1, 100);
        } while (await this.isEmptyMana());

        return true;
    }

    private async trySelfBuff() {
        const isInvincible = this.localStorage.variable<boolean>('is-invincible');
        if (!isInvincible) {
            return;
        }

        const buffInfo = await this.getBuffInfo();

        const isNeedInvincible = buffInfo.indexOf('금강불체') === -1;
        if (isNeedInvincible) {
            for (let i = 0; i < 2; i++) {
                await this.bttService.sendKey(BttKeyCode.Number0, 100);
            }
        }
    }

    private async runWhiteTigerHealing() {
        await this.bttService.sendKey(BttKeyCode.Number3);

        await this.whiteTigerTimer.set();
    }
}
