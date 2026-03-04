import { inject, injectable } from 'tsyringe';
import { TerminateException } from './exceptions';
import { WindowRect } from './common.interface';
import { BttService } from '../modules/btt-client';
import { BttStorage } from '../modules/storage';

@injectable()
export class ScriptHelper {
    private readonly scriptStartedTimestamp: number = 0;

    private _activeWindowRect?: WindowRect;
    private get activeWindowRect(): WindowRect {
        return this._activeWindowRect!;
    }

    constructor(
        @inject(BttService) private readonly bttService: BttService,
        @inject(BttStorage) private readonly bttStorage: BttStorage,
        @inject('ScriptName') private readonly scriptName: string,
    ) {
        this.scriptStartedTimestamp = new Date().getTime();
    }

    public async init() {
        // 이 두개를 여기서 처리하는게 맞나... 싶긴 하지만... 🤔
        await this.setCurrentScriptName(this.scriptName);
        await this.setStartedTimestamp(this.scriptStartedTimestamp);

        this._activeWindowRect = await this.bttService.getActiveWindowRect();
    }

    /**
     * 현재 실행 중인 스크립트 이름을 저장합니다.
     */
    public async setCurrentScriptName(scriptName: string): Promise<void> {
        await this.bttStorage.stringVariable('current-auto-script-name', scriptName);
    }

    /**
     * 현재 실행 중인 스크립트 이름을 조회합니다.
     */
    public async getCurrentScriptName(): Promise<string> {
        return await this.bttStorage.stringVariable('current-auto-script-name');
    }

    /**
     * 스크립트가 시작된 시간을 저장합니다.
     */
    public async setStartedTimestamp(timestamp: number): Promise<void> {
        // 숫자가 높으면 과학적 표기법으로 변경되버려서 스트링으로 저장
        await this.bttStorage.scriptVariable('started-timestamp', timestamp.toString());
    }

    /**
     * 스크립트가 시작된 시간을 조회합니다.
     */
    public async getStartedTimestamp(): Promise<number> {
        const value = await this.bttStorage.scriptVariable('started-timestamp');
        return Number(value);
    }

    /**
     * 특정 앱이 현재 활성화되어 있는지 확인합니다.
     */
    public async isActiveApp(): Promise<boolean> {
        const activeAppName = await this.bttStorage.stringVariable('active_app_name');

        return activeAppName === 'MapleStory Worlds';
    }

    /**
     * 스크립트가 현재 실행 중인지 확인합니다.
     */
    public async isRunning(): Promise<boolean> {
        const isCurrentScript = await this.isCurrentScript(this.scriptName);
        if (!isCurrentScript) {
            return false;
        }

        return this.isMatchedStartedTimestamp(this.scriptStartedTimestamp);
    }

    /**
     * 스크립트가 실행 중이지 않으면 TerminateException을 발생시킵니다.
     * 주기적으로 체크하는 이유는 스크립트 동작 중 BTT를 통해
     */
    public async terminateIfNotRunning(): Promise<void> {
        const isRunning = await this.isRunning();
        if (!isRunning) {
            throw new TerminateException('Main loop terminated');
        }
    }

    /**
     * 현재 실행 중인 스크립트가 특정 이름인지 확인합니다.
     * 다른 스크립트로 전환되었을 때 감지하는 데 사용됩니다.
     */
    public async isCurrentScript(scriptName: string): Promise<boolean> {
        const currentScriptName = await this.getCurrentScriptName();

        return currentScriptName === scriptName;
    }

    /**
     * 스크립트 시작 시간이 저장된 것과 동일한지 확인합니다.
     * 같은 인스턴스에서 계속 실행 중인지 확인하는 데 사용됩니다.
     */
    public async isMatchedStartedTimestamp(timestamp: number): Promise<boolean> {
        const storedTimestamp = await this.getStartedTimestamp();

        return storedTimestamp === timestamp;
    }

    /**
     * @return WindowRect
     */
    public getActiveWindowRect() {
        return this.activeWindowRect;
    }

    /**
     * 스크립트 모드를 전환합니다.
     */
    public async switchMode<T extends string>(mode: T): Promise<void> {
        await this.bttStorage.scriptVariable('mode', mode);
    }

    /**
     * 스크립트 모드를 전환합니다.
     */
    public async getMode<T>(): Promise<T> {
        return this.bttStorage.scriptVariable('mode') as Promise<T>;
    }

    /**
     * @param mode
     */
    public async isMode<T>(mode: T): Promise<boolean> {
        const bttMode = (await this.bttStorage.scriptVariable('mode')) as T;

        return bttMode === mode;
    }
}
