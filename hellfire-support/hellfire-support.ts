import { inject, injectable } from 'tsyringe';
import { BaseScript, GameContext, Latency, ScriptContext } from '../common';
import { sleep } from '../common/utils';
import { Timer } from '../modules/timer';
import { BttKeyCode } from '../modules/btt-client';
import {
    HELLFIRE_SUPPORT_THRESHOLDS,
    HELLFIRE_SUPPORT_TIMINGS,
    HELLFIRE_SUPPORT_WAITS,
} from './hellfire-support.constants';

enum SupportMode {
    HellFire = 'hellfire',
    HellFireWithoutParalysis = 'hellfire-without-paralysis',
    Paralysis = 'paralysis',
    None = 'none',
}

@injectable()
export class HellfireSupport extends BaseScript {
    private mode: SupportMode = SupportMode.HellFire;

    private hellFireTimer: Timer;
    private defensiveTimer: Timer;
    private paralysisModeTimer: Timer;

    constructor(@inject(ScriptContext) scriptContext: ScriptContext, @inject(GameContext) gameContext: GameContext) {
        super(scriptContext, gameContext);

        this.defensiveTimer = this.scriptContext.timerFactory.create('defensive', 185000);
        this.hellFireTimer = this.scriptContext.timerFactory.create(
            'hellfire',
            HELLFIRE_SUPPORT_TIMINGS.HELLFIRE_COOLDOWN,
        );
        this.paralysisModeTimer = this.scriptContext.timerFactory.create(
            'paralysis-mode',
            HELLFIRE_SUPPORT_TIMINGS.PARALYSIS_MODE_DURATION,
        );
    }

    public async initialized(): Promise<void> {
        await this.scriptContext.scriptHelper.switchMode(SupportMode.None);

        await this.hellFireTimer.init();
        await this.defensiveTimer.init();

        do {
            await this.scriptContext.scriptHelper.terminateIfNotRunning();

            if (await this.scriptContext.scriptHelper.isActiveApp()) {
                await this.gameContext.system.openStatusBox();
            }

            await sleep(100);
        } while (!this.gameContext.character.isSetSelfObjectId());

        // 아이템창부터 키고 시작하기
        await this.gameContext.system.openItemBox();
    }

    public async handle(): Promise<void> {
        const oldMode = this.mode;
        this.mode = await this.scriptContext.scriptHelper.getMode<SupportMode>();

        const isChanged = oldMode !== this.mode;
        if (isChanged) {
            await this.gameContext.system.closeTargetBox();
        }

        switch (this.mode) {
            case SupportMode.HellFire:
                await this.runHellFireMode(true);
                break;
            case SupportMode.HellFireWithoutParalysis:
                await this.runHellFireMode(false);
                break;
            case SupportMode.Paralysis:
                if (isChanged) {
                    await this.paralysisModeTimer.set();
                }
                await this.runParalysisMode();
                break;
        }

        await sleep(HELLFIRE_SUPPORT_WAITS.GENERAL);
    }

    public async handleForBackground() {
        this.gameContext.item.updateItemList();
    }

    private async runHellFireMode(isCastParalysis: boolean) {
        // 죽은 경우 스크립트 멈춤
        if (this.gameContext.character.isDead()) {
            await this.scriptContext.scriptHelper.switchMode(SupportMode.None);
            return false;
        }

        // 마나가 없다면 회복 하기 (여기에서 체크하는 이유는 렉 때문에 헬파이어 사용 후 회복을 못할 수 있기 때문)
        if (this.gameContext.character.isManaBelow(HELLFIRE_SUPPORT_THRESHOLDS.MANA_LOW)) {
            // 공력증강 후 피 회복
            await this.tryRecoveryMana(HELLFIRE_SUPPORT_THRESHOLDS.MANA_RECOVERY_MAX_TRIES);

            await this.tryRecoveryHealth();

            await this.tryCastDefensive();
        }

        if (isCastParalysis && !this.hellFireTimer.isExpired()) {
            await this.runParalysisMode();
            return;
        }

        // 만약 다른 Object (몬스터, 캐릭터)의 움직임이 감지된 경우 마비부터 돌린다. 투명 도적 등이 감지될 때가 있음.
        if (this.gameContext.system.isDetectOtherObjectMoving()) {
            return this.runParalysisMode();
        }

        await this.handleCharacterHitIfNeeded();

        const isSearchedMonster = await this.searchMonster(true);
        if (!isSearchedMonster) {
            return;
        }

        console.log('몬스터 감지');

        // 마법 시전 Tick에 걸릴 수 있기 때문에 일정 시간 대기한 다음 공격한다.
        await sleep(HELLFIRE_SUPPORT_WAITS.BEFORE_ATTACK);

        // 헬파이어 날리기 전에 공격받고 있는지 체크
        await this.handleCharacterHitIfNeeded();

        // 몬스터를 찾았다면 저주 + 헬파이어 사용
        await this.castCurseAndHellfire();
        await sleep(HELLFIRE_SUPPORT_WAITS.AFTER_SPELL);
    }

    /**
     * 보호/무장 시전 시도
     * @private
     */
    private async tryCastDefensive() {
        if (this.defensiveTimer.isExpired()) {
            await sleep(Latency.KeyCode);

            await this.gameContext.spell.castDefensiveSpell(true);
        }
    }

    /**
     * 피격 감지 시 처리 (회복 및 방어)
     */
    private async handleCharacterHitIfNeeded(): Promise<void> {
        if (!this.gameContext.character.isDetectCharacterHit()) {
            return;
        }

        this.gameContext.character.resetDetectCharacterHitCount();

        // 체력이 일정 수치 미만인 경우 회복 후 보호/무장 시도
        if (this.gameContext.character.isHealthBelow(HELLFIRE_SUPPORT_THRESHOLDS.HEALTH_DAMAGE)) {
            await this.tryRecoveryHealth();

            await this.tryCastDefensive();
        }

        // 내 캐릭 상하좌우에 있는 몹에게 마비를 건다.
        await this.trySafetyParalysis();

        await sleep(HELLFIRE_SUPPORT_WAITS.GENERAL);
    }

    /**
     * 주변 적에게 마비/절망을 시전하는 모드
     * @private
     */
    private async runParalysisMode() {
        console.log('주변 적에게 마비/절망을 시전합니다.');
        for (let paralysisCount = 0; paralysisCount < 5; paralysisCount++) {
            // 중간에 모드가 변경된 경우 중지
            if (await this.scriptContext.scriptHelper.isMode(SupportMode.None)) {
                return;
            }

            // 중간에 죽었을 경우 모드를 제거한다. (아무런 동작을 하지 않기 위함)
            if (this.gameContext.character.isDead()) {
                await this.scriptContext.scriptHelper.switchMode(SupportMode.None);
                return;
            }

            // 마비 모드 타이머가 만료되면 다시 자동 헬파이어 모드로 변경한다.
            if (this.mode === SupportMode.Paralysis && this.paralysisModeTimer.isExpired()) {
                await this.scriptContext.scriptHelper.switchMode(SupportMode.HellFire);
                return;
            }

            // 피격이 감지되면 회복 시도 후 주변 적에게 마비를 건다.
            await this.handleCharacterHitIfNeeded();

            await this.scriptContext.scriptHelper.terminateIfNotRunning();

            // 마비, 절망 중 랜덤으로 시전한다. (둘 다 번갈아가면서 걸려야 몹이 이동하지 않고 묶어둘 수 있음)
            const spellKeyCode = Math.round(Math.random() * 2) % 2 === 0 ? BttKeyCode.Number6 : BttKeyCode.Number7;
            await this.gameContext.spell.cast(spellKeyCode, {
                isNextTarget: true,
            });

            await sleep(HELLFIRE_SUPPORT_WAITS.BEFORE_HELLFIRE_LOG_CHECK);
        }
    }

    /**
     * 캐릭터 주변의 적(상, 하, 좌, 우)에게 마비를 겁니다.
     * @private
     */
    private async trySafetyParalysis() {
        console.log('캐릭터 주변의 적에게 마비를 겁니다.');
        for (const arrowKeyCode of [
            BttKeyCode.ArrowUp,
            BttKeyCode.ArrowDown,
            BttKeyCode.ArrowLeft,
            BttKeyCode.ArrowRight,
        ]) {
            await this.runDefensiveParalysisByKeyCode(arrowKeyCode);
            await sleep(HELLFIRE_SUPPORT_WAITS.DEFENSIVE_PARALYSIS);
        }
    }

    /**
     * @param limitCount
     * @private
     */
    private async tryRecoveryMana(limitCount = HELLFIRE_SUPPORT_THRESHOLDS.MANA_RECOVERY_MAX_TRIES) {
        let tryCount = 0;
        do {
            const isExceededLimit = ++tryCount > limitCount;
            const isDie = this.gameContext.character.isDead();

            if (isExceededLimit || isDie) {
                return false;
            }

            // 통신 과정이 필요하기 때문에 따로 분리
            const isModeNone = await this.scriptContext.scriptHelper.isMode(SupportMode.None);
            if (isModeNone) {
                return false;
            }

            // 마나가 없다면 마나 회복 아이템(동동주 등) 사용
            if (this.gameContext.character.isEmptyMana()) {
                const isRecoveryReady = await this.ensureManaRecoveryItemReady();
                if (!isRecoveryReady) {
                    return false;
                }

                await this.gameContext.item.useItemSlot(BttKeyCode.a);
                await sleep(HELLFIRE_SUPPORT_WAITS.AFTER_ITEM_USE);
            }

            await this.scriptContext.scriptHelper.terminateIfNotRunning();

            // 공력증강 시전
            await this.gameContext.spell.castManaRecovery();
        } while (this.gameContext.character.isManaBelow(HELLFIRE_SUPPORT_THRESHOLDS.MANA_LOW));

        return true;
    }

    /**
     * 마나 회복 아이템이 준비되어 있는지 확인 및 준비
     * 필요시 A 슬롯으로 이동
     */
    private async ensureManaRecoveryItemReady(): Promise<boolean> {
        const manaRecoveryItems = this.gameContext.item.getManaRecoveryItemList();
        if (!manaRecoveryItems.length) {
            return false;
        }

        // 마나 회복 아이템이 a 슬롯에 있는지 확인한다.
        const isManaRecoveryItemInSlotA = await this.gameContext.item.isManaRecoveryItemBySlotA(manaRecoveryItems);
        if (isManaRecoveryItemInSlotA) {
            return true;
        }

        // a 슬롯에 없다면 아이템 슬롯 변경 시도
        const { slot } = this.gameContext.item.extractItemSlotAndName(manaRecoveryItems[0]);
        if (!slot) {
            return false;
        }
        await this.gameContext.item.changeItemSlot(slot, BttKeyCode.a);

        // 아이템 슬롯을 변경한 경우, 아이템 목록을 업데이트 한다. (여기서 갱신을 해주지 않으면 지연 때문에 아이템을 슬롯을 무한으로 변경해버리는 현상이 있음)
        await sleep(HELLFIRE_SUPPORT_WAITS.ITEM_CHANGE);
        await this.gameContext.item.updateItemList();

        return true;
    }

    /**
     * @private
     */
    private async castCurseAndHellfire() {
        console.log('몬스터를 공격합니다.');
        await this.scriptContext.scriptHelper.terminateIfNotRunning();

        await this.gameContext.spell.castCurse();

        await sleep(HELLFIRE_SUPPORT_WAITS.BEFORE_HELLFIRE_LOG_CHECK); // 스크린샷 캡처 하기 전 게임 화면 갱신을 위해 잠깐 대기

        // 잘못된 대상을 공격하는 경우가 있어서 헬파이어 사용하기 전에 다시 체크
        const log = await this.gameContext.system.getLastGameLog();
        if (log.includes('마법을 쓸 수')) {
            return;
        }

        await this.scriptContext.scriptHelper.terminateIfNotRunning();
        await this.gameContext.spell.castHellfire();

        // 헬파이어 쿨타임 시작
        await this.hellFireTimer.set();
    }

    /**
     * @private
     */
    private async tryRecoveryHealth() {
        console.log('HP 회복을 시도합니다.');
        do {
            await this.scriptContext.scriptHelper.terminateIfNotRunning();
            if (
                this.gameContext.character.isDead() ||
                (await this.scriptContext.scriptHelper.isMode(SupportMode.None))
            ) {
                break;
            }

            await this.gameContext.spell.castHeal(true);
            await sleep(HELLFIRE_SUPPORT_WAITS.BEFORE_HELLFIRE_LOG_CHECK);
        } while (this.gameContext.character.isHealthBelow(HELLFIRE_SUPPORT_THRESHOLDS.HEALTH_DAMAGE));
    }

    /**
     * @param arrowKeyCode
     * @private
     */
    private async runDefensiveParalysisByKeyCode(arrowKeyCode: BttKeyCode) {
        await this.scriptContext.bttService.sendKeys({
            keyCodes: [BttKeyCode.Number6, BttKeyCode.Home, arrowKeyCode, BttKeyCode.Enter],
        });
    }
}
