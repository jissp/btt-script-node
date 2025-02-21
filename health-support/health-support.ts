import { injectable } from 'tsyringe';
import { BaseSupport } from '../modules/common/base-support';
import { uSleep } from '../modules/utils';
import { BttKeyCode } from '../modules/btt-client';

enum SupportMode {
    None = 'none',
    Health = 'health',
    Curse = 'curse',
}

@injectable()
export class HealthSupport extends BaseSupport {
    protected readonly scriptName = 'health-support';

    private mode: SupportMode = SupportMode.Health;
    private curseModeStartTimestamp: number = 0;

    constructor() {
        super();
    }

    protected async handle(): Promise<void> {
        await this.terminateIfNotRunning();

        const oldMode = this.mode;
        this.mode = (await this.scriptVariable('mode')) as SupportMode;

        const isChanged = oldMode !== this.mode;

        await this.handleMode(this.mode, isChanged);

        await uSleep(50);
    }

    protected async initialized(): Promise<void> {
        await this.switchMode(SupportMode.Health);
        this.localStorage.variable<boolean>('is-invincible', (await this.scriptNumberVariable('is-invincible')) === 1);
        this.localStorage.variable<number>('defensive', Number(await this.scriptVariable('defensive')));
        this.localStorage.variable<number>('white-tiger', Number(await this.scriptVariable('white-tiger')));

        // 메인 루프와 별개로 동작하는 백그라운드 루프 실행
        this.backgroundLoop();
    }

    private async backgroundLoop() {
        do {
            await this.terminateIfNotRunning();

            // 버프 체크
            await this.trySelfBuff();

            await uSleep(1000);
        } while(await this.isRunning());
    }

    private async handleMode(mode: SupportMode, isChanged: boolean) {
        if (isChanged) {
            await this.bttService.sendKey(BttKeyCode.ESC, 80);
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
        if (await this.isDie()) {
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

        if (this.isAbleToDefensive()) {
            await uSleep(500);
            await this.runDefensiveIfTabTab();
        }

        const isModeratelyEmptyMana = await this.isModeratelyEmptyMana();
        for (let healLoop = 0; healLoop < 5; healLoop++) {
            await this.terminateIfNotRunning();

            if (isModeratelyEmptyMana && healLoop === 0) {
                await this.bttService.sendKey(BttKeyCode.Number1, 100);
            } else if (this.isAbleToWhiteTigerHeal()) {
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

        if (await this.isDie()) {
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
        await this.scriptVariable('mode', mode);
    }

    private async tryResurrection(waitTimestamp = 500) {
        await this.bttService.sendKey(BttKeyCode.ESC, waitTimestamp);
        await this.bttService.sendKey(BttKeyCode.Number6, 80);
        await this.bttService.sendKey(BttKeyCode.Home, 80);
        await this.bttService.sendKey(BttKeyCode.Enter);
    }

    private async tryManaRecovery(limitCount = 5) {
        let tryCount = 0;
        do {
            await this.terminateIfNotRunning();

            if ((await this.isDie()) || ++tryCount > limitCount) {
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

    private isAbleToWhiteTigerHeal() {
        const currentMana = this.localStorage.variable<number>('current-mana') ?? 0;
        if (currentMana === 0) {
            return false;
        }

        const coolTime = (Math.round(currentMana / 1000) + 10) * 100;

        return this.isAbleToCoolTime('white-tiger', coolTime);
    }

    private async runWhiteTigerHealing() {
        await this.bttService.sendKey(BttKeyCode.Number3);

        const varName = 'white-tiger';
        this.localStorage.variable(varName, new Date().getTime());
        await this.scriptVariable(varName, this.localStorage.variable<number>(varName)?.toString());
    }
}
