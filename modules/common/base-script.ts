import * as path from 'node:path';
import { container } from 'tsyringe';
import { EventEmitter } from 'events';
import { uSleep } from '../utils';
import { GameRect, Latency, ManaRecoveryItems, SearchImageBase64Type, WindowRect } from './common.interface';
import { NotSupportedBackgroundHandleException, TerminateException } from './exceptions';
import { LocalStorage } from '../local-storage';
import { ocrByClipboard, screenCapture } from './externals';
import { BttKeyCode, BttService, ImageSearchRegion } from '../btt-client';
import { BttStorage } from '../storage';
import { Timer, TimerFactory } from '../timer';
import { PacketParser, PacketSniffer, PacketSnifferEvent, PacketType, ParsedPacket } from '../packet-sniffer';
import { Character } from '../character';

export abstract class BaseScript {
    protected readonly character: Character;

    protected readonly executePath: string;
    protected readonly storagePath: string;
    protected readonly bttService: BttService;
    protected readonly localStorage: LocalStorage;
    protected readonly bttStorage: BttStorage;
    protected readonly packetParser: PacketParser;
    protected readonly timerFactory: TimerFactory;
    protected readonly packetSniffer: PacketSniffer;
    protected readonly eventEmitter: EventEmitter;

    protected abstract readonly scriptName: string;
    private readonly scriptStartedTimestamp: number;
    private _activeWindowRect?: WindowRect;

    protected defensiveTimer: Timer;

    protected excludePacketPatterns: PacketType[] = [];
    protected latestDetectedOtherObjectMoveTimestamp: number = 0;
    protected detectedDecrementHpBarValue: number = 0;

    protected constructor(character: Character) {
        this.character = character;
        this.executePath = path.resolve('.');
        this.storagePath = `/tmp`;
        this.localStorage = container.resolve(LocalStorage);
        this.bttStorage = container.resolve(BttStorage);
        this.bttService = container.resolve(BttService);
        this.timerFactory = container.resolve(TimerFactory);
        this.packetParser = container.resolve(PacketParser);
        this.packetSniffer = container.resolve(PacketSniffer);
        this.eventEmitter = container.resolve(EventEmitter);

        this.scriptStartedTimestamp = new Date().getTime();

        this.defensiveTimer = this.timerFactory.create('defensive', 185000);
    }

    public async init() {
        await this.bttStorage.stringVariable('current-auto-script-name', this.scriptName);
        // 숫자가 높으면 과학적 표기법으로 변경되버려서 스트링으로 저장함.
        await this.bttStorage.scriptVariable('started-timestamp', this.scriptStartedTimestamp.toString());
        this._activeWindowRect = await this.bttService.getActiveWindowRect();

        await this.defensiveTimer.init();

        this.eventEmitter.on(PacketSnifferEvent.ReceiveParsedPacket, (packet: ParsedPacket) =>
            this.callbackForPacket(packet),
        );
        this.packetSniffer.run();
        await this.initialized();
    }

    protected async initialized() {}

    public async run(): Promise<void> {
        await Promise.all([this.runLoop(this.callbackForMain), this.runLoop(this.callbackForBackground)]);
    }

    private async runLoop(callback: () => Promise<void>) {
        do {
            await this.terminateIfNotRunning();

            if (await this.isActiveApp()) {
                await callback.call(this);
            }

            await uSleep(50);
        } while (await this.isRunning());
    }

    private async callbackForMain() {
        try {
            await this.handle.call(this);
        } catch (error) {
            if (error instanceof TerminateException) {
                throw error;
            }

            await this.bttStorage.scriptVariable('last-error', error as string);
        }
    }

    private async callbackForPacket(packet: ParsedPacket) {
        await this.terminateIfNotRunning();

        const { type, data } = packet;

        if (this.excludePacketPatterns.includes(packet.type)) {
            return;
        }

        switch (type) {
            case PacketType.UpdatedCharacterStatus:
            case PacketType.UpdatedPartialCharacterStatus:
                try {
                    const packetDataKeys = Object.keys(data);

                    if (packetDataKeys.includes('h')) {
                        this.character.updateHealth(Number(data.h));
                    }

                    if (packetDataKeys.includes('m')) {
                        this.character.updateMana(Number(data.m));
                    }

                    if (packetDataKeys.includes('mm')) {
                        this.character.updateMaxMana(Number(data.mm));
                    }
                } catch (error) {}
                break;
            case PacketType.ChangedObjectHpBarValue:
                if (data) {
                    if (this.character.getSelfObjectId() === data.objectId) {
                        const currentHpBar = this.character.getHpBarValue();
                        this.character.setHpBarValue(data.currentHpBar);

                        if (currentHpBar >= data.currentHpBar && data.currentHpBar != data.maxHpBar) {
                            this.detectedDecrementHpBarValue++;

                            if (this.detectedDecrementHpBarValue > 1) {
                                console.log('캐릭터 피격 감지');
                            }
                        } else {
                            this.detectedDecrementHpBarValue = 0;
                        }
                    }
                }
                break;
            case PacketType.ClientSelfLook:
                if (data) {
                    this.character.setSelfObjectId(data.objectId);
                }
                break;
            case PacketType.ChangedObjectMove:
                if (data) {
                    if (this.character.getSelfObjectId() !== data.objectId) {
                        console.log(`오브젝트(${data.objectId}) 움직임 감지`);
                        this.latestDetectedOtherObjectMoveTimestamp = Date.now();
                    }
                }
                break;
            default:
                break;
        }
    }

    private async callbackForBackground(): Promise<void> {
        try {
            await this.handleForBackground.call(this);
        } catch (error) {
            if (error instanceof NotSupportedBackgroundHandleException || error instanceof TerminateException) {
                return;
            }

            await this.bttStorage.scriptVariable('last-background-error', error as string);
        }
    }

    protected abstract handle(): Promise<void>;

    protected async handleForBackground(): Promise<void> {
        throw new NotSupportedBackgroundHandleException();
    }

    public get isMinimumMode() {
        if (this.activeWindowRect) {
            return this.activeWindowRect.width <= 800;
        }

        return false;
    }

    protected get activeWindowRect() {
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

    isHealthBelowByValue(value: number): boolean {
        return this.character.getHealth() <= value;
    }

    isEmptyHealth(): boolean {
        return this.isHealthBelowByValue(0);
    }

    isManaBelow(percent: number) {
        const mana = this.character.getMana();
        const maxMana = this.character.getMaxMana();

        const currentPercent = (mana / maxMana) * 100;

        return currentPercent < percent;
    }

    isEmptyMana() {
        return this.character.getMana() < 30;
    }

    async isEmptyManaFromLog() {
        const message = await this.getLastGameLog();

        return message.includes('마력이 부족합니다.');
    }

    async isTargetSelecting() {
        return this.bttService.imageSearch({
            imageWithBase64: SearchImageBase64Type.TargetSelectingFromChatBox,
            threshold: 0.9,
            searchRegion: ImageSearchRegion.BottomLeft,
        });
    }

    public async runTabTab() {
        await this.bttService.wrapKeyboardInputBlock(async () => {
            await this.bttService.sendKey(BttKeyCode.Tab, Latency.Tab);
            return this.bttService.sendKey(BttKeyCode.Tab);
        });
    }

    async selfHealing(isTargetChangeToSelf = true) {
        await this.castSpellOnTarget(BttKeyCode.Number2, {
            isNextTarget: isTargetChangeToSelf,
            nextTargetKeyCode: BttKeyCode.Home,
        });
    }

    async searchMonster(isNextTarget: boolean) {
        await this.castSpellOnTarget(BttKeyCode.Number6, {
            isNextTarget: isNextTarget,
            nextTargetKeyCode: BttKeyCode.ArrowUp,
        });

        await uSleep(120); // 스크린샷 캡처 하기 전 게임 화면 갱신을 위해 잠깐 대기

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
        await this.bttService.sendKeys({ keyCodes: [BttKeyCode.Number8, BttKeyCode.Number9] });

        await this.defensiveTimer.set();
    }

    async runCurse(isNextTarget?: boolean) {
        await this.castSpellOnTarget(BttKeyCode.Number4, {
            isNextTarget,
            nextTargetKeyCode: BttKeyCode.ArrowUp,
        });
    }

    async useManaRecoveryItem() {
        await this.bttService.sendKeys({ keyCodes: [BttKeyCode.u, BttKeyCode.a] });
    }

    async getLastGameLog() {
        await screenCapture({
            rect: this.activeWindowRect,
        });
        return await ocrByClipboard(GameRect.GameLastLog);
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
        await this.bttService.sendKeys({
            keyCodes: [BttKeyCode[shortCutA], BttKeyCode[','], BttKeyCode[shortCutB], BttKeyCode.Enter],
        });
    }

    public async castSpellOnTarget(
        keyCode: BttKeyCode,
        options?: {
            isNextTarget?: boolean;
            nextTargetKeyCode?: BttKeyCode;
        },
    ) {
        await this.terminateIfNotRunning();

        if (options?.isNextTarget) {
            return this.bttService.sendKeys({
                keyCodes: [keyCode, options.nextTargetKeyCode ?? BttKeyCode.ArrowUp, BttKeyCode.Enter],
            });
        }

        return this.bttService.sendKeys({ keyCodes: [keyCode, BttKeyCode.Enter] });
    }

    public extractBuffNameAndSeconds(str: string): [string, number] | [] {
        const matches = str.match(/([가-힣]+).?([0-9]+)초/);
        if (!matches) {
            return [];
        }

        return [matches[1], Number(matches[2])];
    }
}
