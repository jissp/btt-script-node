import { inject, injectable } from 'tsyringe';
import { BaseScript, GameContext, ScriptContext } from '../common';
import { sleep } from '../common/utils';
import { Timer } from '../modules/timer';
import { BttKeyCode } from '../modules/btt-client';

enum SupportMode {
    None = 'none',
    Health = 'health',
    Curse = 'curse',
}

@injectable()
export class HealthSupport extends BaseScript {
    private mode: SupportMode = SupportMode.Health;

    private defensiveTimer: Timer;
    private whiteTigerTimer: Timer;
    private manaInjectionTimer: Timer;
    private curseModeOffTimer: Timer;

    constructor(@inject(ScriptContext) scriptContext: ScriptContext, @inject(GameContext) gameContext: GameContext) {
        super(scriptContext, gameContext);

        this.defensiveTimer = this.scriptContext.timerFactory.create('defensive', 185000);
        this.whiteTigerTimer = this.scriptContext.timerFactory.create('white-tiger', 0);
        this.manaInjectionTimer = this.scriptContext.timerFactory.create('mana-injection', 300000);
        this.curseModeOffTimer = this.scriptContext.timerFactory.create('curse-mode-off', 5000);
    }

    public async initialized(): Promise<void> {
        await this.scriptContext.scriptHelper.switchMode(SupportMode.Health);
        this.scriptContext.localStorage.variable<boolean>(
            'is-invincible',
            await this.scriptContext.bttStorage.isScriptVariable('is-invincible'),
        );

        await this.initTimer();
    }

    private async initTimer() {
        await this.manaInjectionTimer.init();
        await this.whiteTigerTimer.init(async () => {
            const currentCharacterMana =
                (await this.scriptContext.bttStorage.scriptNumberVariable('current-mana')) || 0;
            if (currentCharacterMana) {
                this.whiteTigerTimer.setExpiresIn((Math.round(currentCharacterMana / 1000) + 10) * 100);
            }
        });
    }

    public async handle(): Promise<void> {
        const oldMode = this.mode;
        this.mode = (await this.scriptContext.bttStorage.scriptVariable('mode')) as SupportMode;

        const isChangedMode = oldMode !== this.mode;
        if (isChangedMode) {
            // 만약 Mode가 변경되었다면 탭 고정을 푼다.
            await this.gameContext.system.closeTargetBox();
        }

        await this.trySelfBuff();

        switch (this.mode) {
            case SupportMode.Health:
                if (isChangedMode) {
                    await sleep(100);
                    await this.gameContext.system.runTabFix();
                    await sleep(100);
                }

                await this.handleHealthMode();
                break;
            case SupportMode.Curse:
                if (isChangedMode) {
                    await this.curseModeOffTimer.set();
                }
                await this.handleCurseMode();
                break;
            default:
                await sleep(500);
        }
    }

    public async handleForBackground() {
        // 이미지 화면 캡처
        await this.gameContext.buff.updateBuffList();
    }

    /**
     * 회복 모드
     * 1. 상대방에게 지속적으로 회복 마법을 시전 (백호의 희원 포함)
     * 2. 마나 회복 시도
     * 3. 금강불체 시도
     * 4. 주기적으로 보호 / 무장 시전
     * 5. 주기적으로 공력주입 시전
     * @private
     */
    private async handleHealthMode() {
        /*
         * 만약 내가 죽은 경우 나 자신을 부활시킨다음 다음 행동을 이어간다.
         * 탭 고정 상태에서 죽은 경우 스크립트가 돌아가고 있다는 것으로 가정하고 계속 진행하고,
         * 탭 고정이 되어있지 않은 상황이라면 부활만 하고 스크립트를 중지시킨다.
         */
        if (this.gameContext.character.isDead()) {
            const isTargetSelecting = await this.gameContext.system.isTargetSelecting();

            await this.trySelfResurrection();

            if (isTargetSelecting) {
                return this.scriptContext.scriptHelper.switchMode(SupportMode.None);
            }

            await sleep(100);
            await this.gameContext.system.runTabFix();
            await sleep(100);
        }

        // 만약 마나가 일정 비율 이하로 내려간 경우 마나 회복을 시도한다.
        if (this.gameContext.character.isManaBelow(20)) {
            if (this.gameContext.character.isEmptyMana()) {
                await this.gameContext.item.useItemSlot(BttKeyCode.a);
                await sleep(200);
            }

            const isManaRecovery = await this.tryManaRecovery();
            if (!isManaRecovery) {
                // 마나 회복에 실패한 경우 다음 행동을 취하지 않는다.
                return false;
            }
        }

        await this.tryCastDefensiveSpells();

        const isModeratelyEmptyMana = this.gameContext.character.isManaBelow(50);
        for (let healLoop = 0; healLoop < 5; healLoop++) {
            await this.scriptContext.scriptHelper.terminateIfNotRunning();

            if (isModeratelyEmptyMana && healLoop === 0) {
                await this.gameContext.spell.castManaRecovery();
                continue;
            }

            if (!isModeratelyEmptyMana && this.whiteTigerTimer.isExpired()) {
                await this.gameContext.spell.castWhiteTigerHealing();
                await this.whiteTigerTimer.set();
            } else {
                await this.gameContext.spell.castHeal(false);
            }

            await sleep(185);
        }

        await this.tryManaInject();
    }

    /**
     * 저주 모드
     * 일정 시간동안 주변 적에게 저주를 겁니다.
     * @private
     */
    private async handleCurseMode() {
        if (this.curseModeOffTimer.isExpired()) {
            await this.scriptContext.scriptHelper.switchMode(SupportMode.Health);
            return;
        }

        if (this.gameContext.character.isDead()) {
            await this.trySelfResurrection(100);

            await sleep(100);
        }

        for (let curseCount = 0; curseCount < 3; curseCount++) {
            await this.scriptContext.scriptHelper.terminateIfNotRunning();

            await this.gameContext.spell.castCurse();
            await sleep(40);
        }
    }

    /**
     * 무장 / 보호 타이머가 만료된 경우, 상대방에게 무장 / 보호 스킬을 사용한다.
     * 나는 어짜피 계속 죽었다 살아났다 하니 굳이 쓸 필요 없음. 죽고 부활하면 인식풀리는걸로 활용
     * @private
     */
    private async tryCastDefensiveSpells() {
        if (!this.defensiveTimer.isExpired()) {
            return;
        }

        await sleep(500);
        await this.gameContext.spell.castDefensiveSpell(false);
        await this.defensiveTimer.set();
    }

    /**
     * @param waitTimestamp
     * @private
     */
    private async trySelfResurrection(waitTimestamp = 500) {
        await this.scriptContext.scriptHelper.terminateIfNotRunning();

        await this.gameContext.system.closeTargetBox();
        await sleep(waitTimestamp);

        return this.gameContext.spell.castResurrection(true);
    }

    /**
     * @param limitCount
     * @private
     */
    private async tryManaRecovery(limitCount = 5) {
        let tryCount = 0;
        do {
            await this.scriptContext.scriptHelper.terminateIfNotRunning();

            if (++tryCount > limitCount || this.gameContext.character.isDead()) {
                return false;
            }

            await this.gameContext.spell.castManaRecovery();
        } while (this.gameContext.character.isManaBelow(20));

        return true;
    }

    /**
     * @private
     */
    private async trySelfBuff() {
        const isInvincible = this.scriptContext.localStorage.variable<boolean>('is-invincible');
        if (!isInvincible) {
            return;
        }

        const buffTime = this.gameContext.buff.getBuffTime('금강불체');
        if (buffTime) {
            return;
        }

        // 금강불체가 꺼져있다면 2번동안 재시도한다. (마법은 초당 5번까지 사용가능한데, 회복마법 시전을 위해 2번만 시도)
        for (let i = 0; i < 2; i++) {
            await this.gameContext.spell.castInvincible();
        }
    }

    /**
     * 대상에게 공력주입 시도
     * 금강불체가 5초 이상 남아있을 경우에만 시전한다. (마나가 없는 상태로 죽는 것 방지)
     * @private
     */
    private async tryManaInject() {
        if (!this.manaInjectionTimer.isExpired()) {
            return;
        }

        const buffTime = this.gameContext.buff.getBuffTime('금강불체');
        if (!buffTime || buffTime < 5) {
            return;
        }

        await this.gameContext.spell.castManaInject();
        await this.manaInjectionTimer.set();
    }
}
