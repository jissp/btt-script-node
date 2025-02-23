import { container } from 'tsyringe';
import { Latency, ManaRecoveryItems, SearchImageBase64Type, WindowRect } from './common.interface';
import { LocalStorage } from '../local-storage';
import { BttKeyCode, BttService, ImageSearchOn, ImageSearchRegion } from '../btt-client';
import { TerminateException } from './terminate.exception';
import { BttStorage } from '../storage';
import { Timer, TimerFactory } from '../timer';
import { uSleep } from '../utils';
import * as path from 'node:path';
import { ocr } from './externals';

export abstract class BaseSupport {
    protected readonly executePath: string;
    protected readonly storagePath: string;
    protected readonly bttService: BttService;
    protected readonly localStorage: LocalStorage;
    protected readonly bttStorage: BttStorage;
    protected readonly timerFactory: TimerFactory;

    protected abstract readonly scriptName: string;
    private readonly scriptStartedTimestamp: number;
    private _activeWindowRect?: WindowRect;

    protected defensiveTimer: Timer;

    protected constructor() {
        this.executePath = path.resolve('.');
        this.storagePath = `/tmp`;
        this.localStorage = container.resolve(LocalStorage);
        this.bttStorage = container.resolve(BttStorage);
        this.bttService = container.resolve(BttService);
        this.timerFactory = container.resolve(TimerFactory);

        this.scriptStartedTimestamp = new Date().getTime();

        this.defensiveTimer = this.timerFactory.create('defensive', 185000);
    }

    public async init() {
        await this.bttStorage.stringVariable('current-auto-script-name', this.scriptName);
        // 숫자가 높으면 과학적 표기법으로 변경되버려서 스트링으로 저장함.
        await this.bttStorage.scriptVariable('started-timestamp', this.scriptStartedTimestamp.toString());
        this._activeWindowRect = await this.bttService.getActiveWindowRect();

        await this.defensiveTimer.init();

        await this.initialized();
    }

    protected async initialized() {}

    public async run(): Promise<void> {
        do {
            try {
                await this.handle();
            } catch (error) {
                if (error instanceof TerminateException) {
                    throw error;
                }

                await this.bttStorage.scriptVariable('last-error', error as string);
            }
        } while (await this.isRunning());
    }

    protected abstract handle(): Promise<void>;

    public get isMinimumMode() {
        if (this.activeWindowRect) {
            return this.activeWindowRect.width <= 800;
        }

        return false;
    }

    private get activeWindowRect() {
        return this._activeWindowRect!;
    }

    public async isActiveApp() {
        const appName = await this.bttStorage.stringVariable('active_app_name');

        return appName === 'MapleStory Worlds';
    }

    public async isRunning() {
        const currentAutoScriptName = await this.bttStorage.stringVariable('current-auto-script-name');
        if (currentAutoScriptName !== this.scriptName) {
            return false;
        }

        const startedTimestamp = Number(await this.bttStorage.scriptVariable('started-timestamp'));

        return startedTimestamp === this.scriptStartedTimestamp;
    }

    public async terminateIfNotRunning() {
        if (!(await this.isRunning())) {
            throw new TerminateException('Main loop terminated');
        }
    }

    // Game 관련
    async isZeroHealth(): Promise<boolean> {
        return this.bttService.imageSearch({
            imageWithBase64: this.isMinimumMode ? SearchImageBase64Type.ZeroHp : SearchImageBase64Type.ZeroHp,
            threshold: 0.95,
            searchOn: ImageSearchOn.FocusedWindow,
            searchRegion: ImageSearchRegion.BottomRight,
            interval: 0.1,
        });
    }

    async isEmptyHealth(): Promise<boolean> {
        return this.bttService.imageSearch({
            imageWithBase64: SearchImageBase64Type.EmptyHp,
            threshold: 0.95,
            searchOn: ImageSearchOn.FocusedWindow,
            searchRegion: ImageSearchRegion.BottomRight,
            interval: 0.1,
        });
    }

    async isModeratelyEmptyMana() {
        return this.bttService.imageSearch({
            imageWithBase64: this.isMinimumMode
                ? SearchImageBase64Type.ModeratelyEmptyMp
                : SearchImageBase64Type.ModeratelyEmptyMp,
            threshold: 0.95,
            searchOn: ImageSearchOn.FocusedWindow,
            searchRegion: ImageSearchRegion.BottomRight,
            interval: 0.1,
        });
    }

    async isEmptyMana() {
        return this.bttService.imageSearch({
            imageWithBase64: SearchImageBase64Type.EmptyMp,
            threshold: 0.95,
            searchOn: ImageSearchOn.FocusedWindow,
            searchRegion: ImageSearchRegion.BottomRight,
            interval: 0.1,
        });
    }

    async isEmptyManaFromLog() {
        const message = await this.getLastGameLog();

        return message.includes('마력이 부족합니다.');
    }

    async isZeroMana() {
        return this.bttService.imageSearch({
            imageWithBase64: this.isMinimumMode ? SearchImageBase64Type.ZeroMpMinimum : SearchImageBase64Type.ZeroMp,
            threshold: 0.95,
            searchOn: ImageSearchOn.FocusedWindow,
            searchRegion: ImageSearchRegion.BottomRight,
            interval: 0.1,
        });
    }

    async isTargetSelecting() {
        return this.bttService.imageSearch({
            imageWithBase64: SearchImageBase64Type.TargetSelectingFromChatBox,
            threshold: 0.9,
            searchOn: ImageSearchOn.FocusedWindow,
            searchRegion: ImageSearchRegion.BottomLeft,
            interval: 0.1,
        });
    }

    public async runTabTab() {
        await this.bttService.wrapKeyboardInputBlock(async () => {
            await this.bttService.sendKey(BttKeyCode.Tab, Latency.Tab);
            return this.bttService.sendKey(BttKeyCode.Tab);
        });
    }

    async selfHealing() {
        await this.castSpellOnTarget(BttKeyCode.Number2, {
            isNextTarget: true,
            nextTargetKeyCode: BttKeyCode.Home,
        });
    }

    async checkMonsterTarget(isNext: boolean) {
        await this.castSpellOnTarget(BttKeyCode.Number6, {
            isNextTarget: isNext,
            nextTargetKeyCode: BttKeyCode.ArrowUp,
        });

        await uSleep(80); // 스크린샷 캡처 하기 전 게임 화면 갱신을 위해 잠깐 대기

        const lastGameLog = await this.getLastGameLog();

        return !['마법 보호!!!', '걸리지 않습니다'].some(keyword => lastGameLog.includes(keyword));
    }

    async runDefensive(isSelf: boolean) {
        await this.castSpellOnTarget(BttKeyCode.Number8, {
            isNextTarget: isSelf,
            nextTargetKeyCode: BttKeyCode.Home,
        });
        await uSleep(80);
        await this.castSpellOnTarget(BttKeyCode.Number9, {
            isNextTarget: isSelf,
            nextTargetKeyCode: BttKeyCode.Home,
        });

        await this.defensiveTimer.set();
    }

    async runDefensiveIfTabTab() {
        await this.bttService.sendKey(BttKeyCode.Number8, Latency.KeyCode);
        await this.bttService.sendKey(BttKeyCode.Number9);

        await this.defensiveTimer.set();
    }

    async runCurse(isNext?: boolean) {
        await this.castSpellOnTarget(BttKeyCode.Number4, {
            isNextTarget: isNext,
            nextTargetKeyCode: BttKeyCode.ArrowUp,
        });
    }

    async useManaRecoveryItem() {
        await this.bttService.sendKey(BttKeyCode['u'], Latency.KeyCode);
        await this.bttService.sendKey(BttKeyCode['a']);
    }

    public calcLastGameLogRect(): WindowRect {
        if (this.isMinimumMode) {
            const hpX = this.activeWindowRect.width - 243;
            const hpY = this.activeWindowRect.height - 213;

            return {
                x: this.activeWindowRect.x + hpX,
                y: this.activeWindowRect.y + hpY,
                width: 100,
                height: 11,
            };
        } else {
            const hpX = this.activeWindowRect.width - 600;
            const hpY = this.activeWindowRect.height - 250;

            return {
                x: this.activeWindowRect.x + hpX,
                y: this.activeWindowRect.y + hpY,
                width: 250,
                height: 24,
            };
        }
    }

    async getLastGameLog() {
        const tempImagePath = `${this.storagePath}/last-game-log.png`;
        await this.bttService.captureToPath(this.calcLastGameLogRect(), tempImagePath);
        await uSleep(150);

        return await ocr(tempImagePath);
    }

    public calcBuffInfoRect() {
        const hpX = this.activeWindowRect.width - 580;
        const hpY = this.activeWindowRect.height - 555;

        return {
            x: this.activeWindowRect.x + hpX,
            y: this.activeWindowRect.y + hpY,
            width: 230,
            height: 120,
        };
    }

    async getBuffInfo() {
        return this.bttService.captureWithExtractTextFromClipboard(this.calcBuffInfoRect());
    }

    public calcItemRect(): WindowRect {
        if (this.isMinimumMode) {
            // 미구현
            const hpX = this.activeWindowRect.width - 225;
            const hpY = this.activeWindowRect.height - 452;

            return {
                x: this.activeWindowRect.x + hpX,
                y: this.activeWindowRect.y + hpY,
                width: 100,
                height: 160,
            };
        } else {
            const hpX = this.activeWindowRect.width - 525;
            const hpY = 149;

            return {
                x: this.activeWindowRect.x + hpX,
                y: this.activeWindowRect.y + hpY,
                width: 226,
                height: 393,
            };
        }
    }

    async getItemBoxInfo(isSplit: true): Promise<string[]>;
    async getItemBoxInfo(isSplit: false): Promise<string>;
    async getItemBoxInfo(isSplit: boolean) {
        const itemText = await this.bttService.captureWithExtractTextFromClipboard(this.calcItemRect());

        if (isSplit) {
            return itemText.split('\n');
        }

        return itemText;
    }

    async getItemBoxFromPath() {
        const itemText = await this.bttService.captureWithExtractTextFromPath({
            rect: this.calcItemRect(),
            path: `${this.storagePath}/item-box.png`,
            waitMilliSeconds: 500,
        });

        return itemText.split('\n');
    }

    extractItemShortCutAndName(itemRowText: string) {
        return itemRowText.match(/([A-z0951])[\s]?[:;][\s]?([\w\W]+)/) ?? [];
    }

    async isManaRecoveryItemShortCutToA(itemRows: string[]) {
        if (itemRows.length === 0) {
            return false;
        }

        const [, shortCut, itemName] = this.extractItemShortCutAndName(itemRows[0]);

        return shortCut === 'a' && ManaRecoveryItems.filter(name => itemName.includes(name)).length > 0;
    }

    async changeItemAToB(shortCutA: keyof typeof BttKeyCode, shortCutB: keyof typeof BttKeyCode) {
        // 같은 자리로 변경하는 경우 무시
        if (shortCutA === shortCutB) {
            return;
        }

        // 오 인식으로 숫자 0이 전달되면 알파벳 o로 변경
        if (shortCutA === 'Number0') {
            shortCutA = 'o';
        }

        await this.bttService.sendKey(BttKeyCode.c, 500); // C
        await this.bttService.sendKey(BttKeyCode[shortCutA], Latency.KeyCode);
        await this.bttService.sendKey(BttKeyCode[','], Latency.KeyCode);
        await this.bttService.sendKey(BttKeyCode[shortCutB], Latency.KeyCode);
        await this.bttService.sendKey(BttKeyCode.Enter);
    }

    public calcCharacterCoordRect() {
        const hpX = this.activeWindowRect.width - 502;
        const hpY = this.activeWindowRect.height - 56;

        return {
            x: this.activeWindowRect.x + hpX,
            y: this.activeWindowRect.y + hpY,
            width: 264,
            height: 24,
        };
    }

    async getCharacterCoord() {
        return this.bttService.captureWithExtractTextFromClipboard(this.calcCharacterCoordRect());
    }

    extractCharacterXY(characterInfo: string) {
        const characterInfoRows = characterInfo.split('\n');

        return characterInfoRows
            .slice(characterInfoRows.length - 2, characterInfoRows.length)
            .map(coord => Number(coord.replace(' ', '')));
    }

    public calcLastChatMessage(): WindowRect {
        return {
            x: this.activeWindowRect.x + 239,
            y: this.activeWindowRect.y + 908,
            width: 800,
            height: 27,
        };
    }

    async getLastChatMessage() {
        return this.bttService.captureWithExtractTextFromClipboard(this.calcLastChatMessage());
    }

    public async castSpellOnTarget(
        keyCode: BttKeyCode,
        options?: {
            isNextTarget?: boolean;
            nextTargetKeyCode?: BttKeyCode;
        },
    ) {
        await this.terminateIfNotRunning();

        await this.bttService.sendKey(keyCode, Latency.KeyCode);
        if (options?.isNextTarget) {
            await this.bttService.sendKey(options?.nextTargetKeyCode ?? BttKeyCode.ArrowUp, Latency.KeyCode);
        }
        await this.bttService.sendKey(BttKeyCode.Enter);
    }
}
