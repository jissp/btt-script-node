import { injectable } from 'tsyringe';
import { BaseSupport } from '../modules/common/base-support';
import { uSleep } from '../modules/utils';
import { BttKeyCode } from '../modules/btt-client';

enum SupportMode {
    HellFire = 'hellfire',
    // HellFireWithoutFreeze = 'hellfire-without-freeze',
    Freeze = 'freeze',
}

@injectable()
export class HellfireSupport extends BaseSupport {
    protected readonly scriptName = 'hellfire-support';

    private mode: SupportMode = SupportMode.HellFire;
    private freezeModeStartTimestamp: number = 0;

    constructor() {
        super();
    }

    protected async handle(): Promise<void> {
        await this.terminateIfNotRunning();

        const oldMode = this.mode;
        this.mode = (await this.scriptVariable('mode')) as SupportMode;

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
        this.localStorage.variable<boolean>('is-invincible', (await this.scriptNumberVariable('is-invincible')) === 1);

        // 메인 루프와 별개로 동작하는 백그라운드 루프 실행
        this.backgroundLoop();
    }

    private async backgroundLoop() {
        do {
            await this.terminateIfNotRunning();

            // 막걸리 체크
            const itemText = await this.getItemBoxInfo();
            this.localStorage.variable('item-rows', itemText.split('\n'));

            await uSleep(1000);
        } while (await this.isRunning());
    }

    private async runHellFireMode(isFreeze: boolean) {
        // 마나가 없다면 회복 하기
        if (await this.isEmptyMana()) {
            await this.tryManaRecovery(99);

            // 공력증강 후 피 회복
            for (let healCount = 0; healCount < 5; healCount++) {
                await this.selfHealing();
                await uSleep(100);
            }

            // 보무도 걸기
            if (this.isAbleToDefensive()) {
                await this.runDefensive(true);
            }
        }

        if (!this.isAbleToHellfire()) {
            await this.runFreezeMode();

            return false;
        }

        if (!(await this.checkMonsterTarget(true))) {
            return false;
        }

        await uSleep(600);

        // 몬스터를 찾았다면 저주 + 헬파이어 사용
        await this.runCurseAndHellfire();
        await uSleep(200);

        return true;
    }

    private async runFreezeMode() {
        for (let freezeCount = 0; freezeCount < 5; freezeCount++) {
            const currentTime = new Date().getTime();
            if (currentTime - this.freezeModeStartTimestamp > 5000) {
                await this.switchMode(SupportMode.HellFire);
                return;
            }

            if (Math.round(Math.random() * 10) % 2 === 0) {
                await this.runTargetBlind(true);
            } else {
                await this.runTargetFreeze(true);
            }

            await uSleep(100);
        }
    }

    private async switchMode(mode: SupportMode) {
        await this.scriptVariable('mode', mode);
    }

    private async tryManaRecovery(limitCount = 5) {
        let tryCount = 0;
        do {
            if (++tryCount > limitCount) {
                return false;
            }

            if (await this.isZeroMana()) {
                if (!(await this.isManaRecoveryItemShortCutToA())) {
                    // 동동주가 없다면 종료
                    const itemRows = this.localStorage.variable<string[]>('item-rows') ?? [];
                    if (itemRows.length === 0 || itemRows.filter(row => row.indexOf('막걸리') !== -1).length === 0) {
                        return false;
                    }

                    const [, shortCut, itemName] = this.extractItemShortCutAndName(itemRows[0]);
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

    private isAbleToHellfire() {
        return this.isAbleToCoolTime('hellfire', 185000);
    }

    private async runCurseAndHellfire() {
        await this.terminateIfNotRunning();

        await this.runCurse();

        const log = await this.getLastGameLog();
        if (log.indexOf('마법을 쓸 수') !== -1) {
            return;
        }

        await this.terminateIfNotRunning();
        await this.runHellFire();
    }

    private async runHellFire() {
        await this.bttService.sendKey(BttKeyCode.Number3, 80);
        await this.bttService.sendKey(BttKeyCode.Enter);

        const varName = 'hellfire';
        this.localStorage.variable(varName, new Date().getTime());
        await this.scriptVariable(varName, this.localStorage.variable<number>(varName)?.toString());
    }
}
