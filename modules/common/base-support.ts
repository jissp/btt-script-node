import { container } from 'tsyringe';
import { WindowRect } from './common.interface';
import { LocalStorage } from '../local-storage';
import { BaramUtil } from '../baram_util';
import { BttKeyCode, BttService, ImageSearchOn, ImageSearchRegion } from '../btt-client';
import { TerminateException } from './terminate.exception';
import { SearchImageBase64Type } from '../baram_util/interface';

export abstract class BaseSupport {
    protected readonly bttService: BttService;
    protected readonly baramUtil: BaramUtil;
    protected readonly localStorage: LocalStorage;

    protected abstract readonly scriptName: string;
    private readonly scriptStartedTimestamp: number;
    private _activeWindowRect?: WindowRect;

    protected constructor() {
        this.bttService = container.resolve(BttService);
        this.baramUtil = container.resolve(BaramUtil);
        this.localStorage = container.resolve(LocalStorage);

        this.scriptStartedTimestamp = new Date().getTime();
    }

    public async init() {
        await this.bttService.stringVariable('current-auto-script-name', this.scriptName);
        // 숫자가 높으면 과학적 표기법으로 변경되버려서 스트링으로 저장함.
        await this.scriptVariable('started-timestamp', this.scriptStartedTimestamp.toString());
        this._activeWindowRect = await this.bttService.getActiveWindowRect();

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

                await this.scriptVariable('last-error', error as string);
            }
        } while (await this.isActiveApp());
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
        const appName = await this.bttService.stringVariable('active_app_name');

        return appName === 'MapleStory Worlds';
    }

    public async isRunning() {
        const currentAutoScriptName = await this.bttService.stringVariable('current-auto-script-name');
        if (currentAutoScriptName !== this.scriptName) {
            return false;
        }

        const startedTimestamp = Number(await this.scriptVariable('started-timestamp'));

        return startedTimestamp === this.scriptStartedTimestamp;
    }

    public async terminateIfNotRunning() {
        if (!(await this.isRunning())) {
            throw new TerminateException('Main loop terminated');
        }
    }

    public async scriptVariable(name: string, value?: string) {
        return this.bttService.stringVariable(`${this.scriptName}-${name}`, value);
    }

    public async scriptNumberVariable(name: string, value?: number) {
        return this.bttService.numberVariable(`${this.scriptName}-${name}`, value);
    }

    // Game 관련
    async isDie(): Promise<boolean> {
        return this.bttService.imageSearch({
            imageWithBase64: this.isMinimumMode ? SearchImageBase64Type.ZeroHp : SearchImageBase64Type.ZeroHp,
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

        return message.indexOf('마력이 부족합니다.') !== -1;
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
            await this.bttService.sendKey(BttKeyCode.Tab, 200);

            return this.bttService.sendKey(BttKeyCode.Tab);
        });
    }

    async selfHealing() {
        await this.bttService.sendKey(BttKeyCode.Number2, 80);
        await this.bttService.sendKey(BttKeyCode.Home, 80);
        await this.bttService.sendKey(BttKeyCode.Enter, 80);
    }

    async checkMonsterTarget(isNext: boolean) {
        await this.bttService.sendKey(BttKeyCode.Number6, 80);
        if (isNext) {
            await this.bttService.sendKey(BttKeyCode['ArrowUp'], 80);
        }
        await this.bttService.sendKey(BttKeyCode['Enter'], 150);

        const lastGameLog = await this.getLastGameLog();

        return !['마법 보호!!!', '걸리지 않습니다'].some(keyword => lastGameLog.indexOf(keyword) !== -1);
    }

    protected isAbleToCoolTime(key: string, coolTime: number) {
        const currentTimestamp = new Date().getTime();
        const latestTimestamp = this.localStorage.variable<number>(key) ?? 0;

        return currentTimestamp - latestTimestamp >= coolTime;
    }

    protected isAbleToDefensive() {
        return this.isAbleToCoolTime('defensive', 185000);
    }

    async runDefensive(isSelf: boolean) {
        await this.bttService.sendKey(BttKeyCode.Number8, 80);
        if (isSelf) {
            await this.bttService.sendKey(BttKeyCode['Home'], 80);
        }
        await this.bttService.sendKey(BttKeyCode['Enter'], 80);
        await this.bttService.sendKey(BttKeyCode.Number9, 80);
        if (isSelf) {
            await this.bttService.sendKey(BttKeyCode['Home'], 80);
        }
        await this.bttService.sendKey(BttKeyCode['Enter']);

        const varName = 'defensive';
        this.localStorage.variable<number>(varName, new Date().getTime());
        await this.scriptVariable(varName, this.localStorage.variable(varName).toString());
    }

    async runDefensiveIfTabTab() {
        await this.bttService.sendKey(BttKeyCode.Number8, 80);
        await this.bttService.sendKey(BttKeyCode.Number9, 80);

        const varName = 'defensive';
        this.localStorage.variable<number>(varName, new Date().getTime());
        await this.scriptVariable(varName, this.localStorage.variable(varName).toString());
    }

    async runCurse(isNext?: boolean) {
        await this.bttService.sendKey(BttKeyCode.Number4, 80);
        if (isNext) {
            await this.bttService.sendKey(BttKeyCode.ArrowUp, 80);
        }
        await this.bttService.sendKey(BttKeyCode['Enter']);
    }

    async useManaRecoveryItem() {
        await this.bttService.sendKey(BttKeyCode['u'], 80);
        await this.bttService.sendKey(BttKeyCode['a']);
    }

    calcLastGameLogRect(): WindowRect {
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
        return this.bttService.captureWithExtractText(this.calcLastGameLogRect(), 80);
    }

    calcBuffInfoRect() {
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
        return this.bttService.captureWithExtractText(this.calcBuffInfoRect());
    }

    private calcItemRect(): WindowRect {
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

    async getItemBoxInfo() {
        return this.bttService.captureWithExtractText(this.calcItemRect(), 80);
    }

    extractItemShortCutAndName(itemRowText: string) {
        return itemRowText.match(/([A-z0951])[\s]?[:;][\s]?([\w\W]+)/) ?? [];
    }

    async isManaRecoveryItemShortCutToA() {
        const itemRows = this.localStorage.variable<string[]>('item-rows') ?? [];
        if (itemRows.length === 0) {
            return false;
        }
        
        const firstItem = itemRows[0];
        const [, shortCut, itemName] = this.extractItemShortCutAndName(firstItem);

        return shortCut === 'a' && ['동동주', '막걸리'].filter(name => itemName.indexOf(name) !== -1).length > 0;
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
        await this.bttService.sendKey(BttKeyCode[shortCutA], 80);
        await this.bttService.sendKey(BttKeyCode[','], 80);
        await this.bttService.sendKey(BttKeyCode[shortCutB], 80);
        await this.bttService.sendKey(BttKeyCode['Enter']);
    }

    calcCharacterCoordRect() {
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
        return this.bttService.captureWithExtractText(this.calcCharacterCoordRect());
    }

    extractCharacterXY(characterInfo: string) {
        const characterInfoRows = characterInfo.split('\n');

        return characterInfoRows
            .slice(characterInfoRows.length - 2, characterInfoRows.length)
            .map(coord => Number(coord.replace(' ', '')));
    }

    calcLastChatMessage(): WindowRect {
        return {
            x: this.activeWindowRect.x + 239,
            y: this.activeWindowRect.y + 908,
            width: 800,
            height: 27,
        };
    }

    async getLastChatMessage() {
        return this.bttService.captureWithExtractText(this.calcLastChatMessage());
    }
}
