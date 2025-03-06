import { inject, injectable } from 'tsyringe';
import { BaseScript, GameRect, Latency, ocrByClipboard, screenCapture } from '../modules/common';
import { uSleep } from '../modules/utils';
import { Timer } from '../modules/timer';
import { BttKeyCode } from '../modules/btt-client';
import { Healer } from '../modules/base-character-spell';
import { CharacterFactory } from '../modules/character';

enum SupportMode {
    None = 'none',
    Health = 'health',
    Curse = 'curse',
}

@injectable()
export class HealthSupport extends BaseScript {
    private mode: SupportMode = SupportMode.Health;

    private whiteTigerTimer: Timer;
    private refreshWindowTimer: Timer;
    private buffCheckerTimer: Timer;
    private manaInjectionTimer: Timer;
    private curseModeOffTimer: Timer;

    constructor(
        @inject('ScriptName') protected readonly scriptName: string,
        @inject(CharacterFactory) characterFactory: CharacterFactory,
    ) {
        super(characterFactory.create<Healer>(Healer));

        this.whiteTigerTimer = this.timerFactory.create('white-tiger', 0);
        this.refreshWindowTimer = this.timerFactory.create('refresh-window', 200);
        this.buffCheckerTimer = this.timerFactory.create('check-buff', 100);
        this.manaInjectionTimer = this.timerFactory.create('mana-injection', 300000);
        this.curseModeOffTimer = this.timerFactory.create('curse-mode-off', 5000);
    }

    protected async initialized(): Promise<void> {
        await this.switchMode(SupportMode.Health);
        this.localStorage.variable<boolean>('is-invincible', await this.bttStorage.isScriptVariable('is-invincible'));

        await this.initTimer();
        //
    }

    private async initTimer() {
        await this.manaInjectionTimer.init();
        await this.whiteTigerTimer.init(async () => {
            const currentCharacterMana = (await this.bttStorage.scriptNumberVariable('current-mana')) || 0;
            if (currentCharacterMana) {
                this.whiteTigerTimer.setExpiresIn((Math.round(currentCharacterMana / 1000) + 10) * 100);
            }
        });
    }

    protected async handle(): Promise<void> {
        const oldMode = this.mode;
        this.mode = (await this.bttStorage.scriptVariable('mode')) as SupportMode;

        const isChanged = oldMode !== this.mode;
        if (isChanged) {
            await this.bttService.sendKey(BttKeyCode.ESC, Latency.KeyCode);
        }

        await this.trySelfBuff();

        switch (this.mode) {
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
                    await this.curseModeOffTimer.set();
                }
                await this.runCurseMode();
                break;
            default:
                await uSleep(500);
        }
    }

    protected async handleForBackground() {
        // 이미지 화면 캡처
        // if (this.refreshWindowTimer.isExpired()) {
        //     await screenCapture({
        //         rect: this.activeWindowRect,
        //     });
        //     await this.refreshWindowTimer.set();
        // }

        await this.tryRefreshBuffList();
    }

    private async runHealthMode() {
        if (this.isEmptyHealth()) {
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

        if (this.isManaBelow(20)) {
            if (this.isEmptyMana()) {
                await this.useManaRecoveryItem();
                await uSleep(200);
            }

            if (!(await this.tryManaRecovery())) {
                return false;
            }
        }

        if (this.defensiveTimer.isExpired()) {
            await uSleep(500);
            await this.runDefensiveIfTabTab();
        }

        const isModeratelyEmptyMana = this.isManaBelow(50);
        for (let healLoop = 0; healLoop < 5; healLoop++) {
            await this.terminateIfNotRunning();

            if (isModeratelyEmptyMana && healLoop === 0) {
                await this.bttService.sendKey(BttKeyCode.Number1, 100);
                continue;
            }

            if (!isModeratelyEmptyMana && this.whiteTigerTimer.isExpired()) {
                await this.runWhiteTigerHealing();
            } else {
                await this.bttService.sendKey(BttKeyCode.Number2);
            }

            await uSleep(185);
        }

        await this.tryManaInject();
    }

    private async runCurseMode() {
        if (this.curseModeOffTimer.isExpired()) {
            await this.switchMode(SupportMode.Health);
            return;
        }

        if (this.isEmptyHealth()) {
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

            if (++tryCount > limitCount || (this.isEmptyHealth())) {
                return false;
            }

            await this.bttService.sendKey(BttKeyCode.Number1, 100);
        } while (this.isManaBelow(20));

        return true;
    }

    private async trySelfBuff() {
        const isInvincible = this.localStorage.variable<boolean>('is-invincible');
        if (!isInvincible) {
            return;
        }

        const buffMap = this.localStorage.variable('buff-map') as Record<string, number>;

        if (!buffMap['금강불체']) {
            for (let i = 0; i < 2; i++) {
                await this.bttService.sendKey(BttKeyCode.Number0, 100);
            }
        }
    }

    private async tryRefreshBuffList() {
        return this.buffCheckerTimer.acquireLock(async () => {
            await screenCapture({
                rect: this.activeWindowRect,
            });
            const buffFullText = await ocrByClipboard(GameRect.BuffBox);
            const buffs = buffFullText.trim().split('\n').map(this.extractBuffNameAndSeconds);

            this.localStorage.variable('buff-map', Object.fromEntries(buffs));
            this.localStorage.variable('buffs', buffs);
        });
    }

    private async tryManaInject() {
        if (this.manaInjectionTimer.isExpired()) {
            const buffMap = this.localStorage.variable('buff-map') as Record<string, number>;

            if (!buffMap['금강불체'] || Number(buffMap['금강불체']) < 5) {
                return;
            }

            // 금강불체가 5초 이상 남아있을 경우 마나 주입
            await this.bttService.sendKeys({ keyCodes: [BttKeyCode.Number5, BttKeyCode.Enter] });
            await this.manaInjectionTimer.set();
        }
    }

    private async runWhiteTigerHealing() {
        await this.bttService.sendKey(BttKeyCode.Number3);

        await this.whiteTigerTimer.set();
    }
}
