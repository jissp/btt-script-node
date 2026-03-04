import * as path from 'node:path';
import { BttKeyCode } from '../modules/btt-client';
import { PacketType } from '../modules/packet-sniffer';
import { sleep } from './utils';
import { ScriptContext } from './script-context';
import { NotSupportedBackgroundHandleException, TerminateException } from './exceptions';
import { registerEventHandlers } from './decorators';
import { GameContext } from './game-context';

export abstract class BaseScript {
    protected readonly executePath: string;
    protected readonly storagePath: string;

    readonly excludePacketPatterns: PacketType[] = [];

    protected constructor(
        protected readonly scriptContext: ScriptContext,
        protected readonly gameContext: GameContext,
    ) {
        this.executePath = path.resolve('.');
        this.storagePath = `/tmp`;
    }

    /**
     * 스크립트를 초기화합니다.
     * 상태 설정, 패킷 리스너 등록, initialized() 호출을 담당합니다.
     */
    public async init() {
        // @OnEvent 데코레이터 핸들러 등록
        registerEventHandlers(this, this.scriptContext.eventEmitter);

        // 패킷 스니퍼 시작
        await this.scriptContext.packetSniffer.run();

        // 스크립트별 초기화 로직 실행
        await this.initialized?.();
    }

    protected async initialized() {}

    /**
     * 메인 루프에서 실행될 핵심 로직입니다.
     * 50ms 간격으로 반복 실행되며, 게임 윈도우가 활성화되어 있을 때만 동작합니다.
     */
    public abstract handle(): Promise<void>;

    /**
     * 백그라운드 루프에서 실행될 로직입니다.
     * 메인 루프와 병렬로 50ms 간격으로 실행됩니다.
     * 구현은 선택사항입니다.
     */
    protected async handleForBackground(): Promise<void> {
        throw new NotSupportedBackgroundHandleException();
    }

    /**
     * 스크립트의 메인 및 백그라운드 루프를 병렬 실행합니다.
     */
    public async run(): Promise<void> {
        await Promise.all([
            this.runLoop(() => this.callbackForMain()),
            this.runLoop(() => this.callbackForBackground()),
        ]);
    }

    /**
     * 메인/백그라운드 루프를 실행합니다.
     */
    private async runLoop(callback: () => Promise<void>): Promise<void> {
        do {
            const isActiveApp = await this.scriptContext.scriptHelper.isActiveApp();
            if (isActiveApp) {
                await callback();
            }

            await sleep(50);
        } while (await this.scriptContext.scriptHelper.isRunning());
    }

    /**
     * 메인 루프 콜백입니다.
     */
    private async callbackForMain(): Promise<void> {
        try {
            await this.handle();
        } catch (error) {
            if (error instanceof TerminateException) {
                throw error;
            }

            await this.scriptContext.bttStorage.scriptVariable('last-error', error as string);
        }
    }

    /**
     * 백그라운드 루프 콜백입니다.
     */
    private async callbackForBackground(): Promise<void> {
        try {
            await this.handleForBackground();
        } catch (error) {
            if (error instanceof NotSupportedBackgroundHandleException || error instanceof TerminateException) {
                return;
            }

            await this.scriptContext.bttStorage.scriptVariable('last-background-error', error as string);
        }
    }

    /**
     * 몬스터를 검색합니다.
     */
    async searchMonster(isNextTarget: boolean): Promise<boolean> {
        await this.gameContext.spell.cast(BttKeyCode.Number6, {
            isNextTarget,
            nextTargetKeyCode: BttKeyCode.ArrowUp,
        });

        await sleep(120); // 스크린샷 캡처 하기 전 게임 화면 갱신을 위해 잠깐 대기

        const lastGameLog = await this.gameContext.system.getLastGameLog();

        return !['마법 보호!!!', '걸리지 않습니다'].some(keyword => lastGameLog.includes(keyword));
    }
}
