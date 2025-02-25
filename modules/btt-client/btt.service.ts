import { inject, injectable } from 'tsyringe';
import { uSleep } from '../utils';
import { WindowRect } from '../common';
import { BttClient } from './btt.client';
import { BttKeyCode, ImageSearchOn, ImageSearchRegion } from './btt.interface';
import { BttStorage } from '../storage';

@injectable()
export class BttService {
    constructor(
        @inject(BttStorage) private readonly bttStorage: BttStorage,
        @inject(BttClient) private readonly client: BttClient,
    ) {}

    public async getActiveWindowRect(): Promise<WindowRect> {
        const x = await this.bttStorage.numberVariable('focused_window_x');
        const y = await this.bttStorage.numberVariable('focused_window_y');
        const width = await this.bttStorage.numberVariable('focused_window_width');
        const height = await this.bttStorage.numberVariable('focused_window_height');

        return {
            x,
            y,
            width,
            height,
        };
    }

    public async sendKey(keyCode: BttKeyCode, afterWaitMilliSeconds?: number) {
        await this.client.triggerAction({
            BTTIsPureAction: 1,
            BTTShortcutToSend: keyCode,
        });

        if (afterWaitMilliSeconds) {
            await uSleep(afterWaitMilliSeconds);
        }
    }

    public async imageSearch({
        imageWithBase64,
        threshold,
        searchOn,
        searchRegion,
        interval,
    }: {
        imageWithBase64: string;
        threshold: number;
        searchOn: ImageSearchOn;
        searchRegion: ImageSearchRegion;
        interval: number;
    }) {
        const defaultConfig = {
            BTTFindImageSearchOn: 5, // 0: 모든 화면, 5: 집중된 창
            BTTFindImageSearchRegion: 0, // 0: All, 1: Top Left, 3: Bottom Left, 4: Bottom Right, 5: Top Half, 6: Bottom Half,
            BTTFindImageTreshold: 0.95000002384185791,
            BTTFindImageUseDifferentDarkModeImage: false,
            BTTFindImageSquareSize: 80,
            BTTFindImageUseColor: true,
            BTTActionWaitForConditionsTimeout: 1,
            BTTFindImageSaveToVariable: true,
            BTTFindImageBTTMouseMoveDragType: 0,
            BTTFindImageContinueActionExecution: false,
            BTTFindImageMoveMouseTo: 0,
            BTTFindImageBTTMouseMoveDuration: 0,
            BTTActionWaitForConditionsInterval: 0.10000001192092896,
        };

        const config = Object.assign({}, defaultConfig, {
            BTTFindImageSearchOn: searchOn || defaultConfig.BTTFindImageSearchOn,
            BTTFindImageSearchRegion: searchRegion || defaultConfig.BTTFindImageSearchRegion,
            BTTFindImageTreshold: threshold || defaultConfig.BTTFindImageTreshold,
            BTTActionWaitForConditionsInterval: interval || defaultConfig.BTTActionWaitForConditionsInterval,
        });

        await this.client.triggerAction({
            BTTPredefinedActionType: 405,
            BTTPredefinedActionName: '화면에 이미지가 보일 경우 (조건)',
            BTTFindPositionOfImageImage: imageWithBase64,
            BTTGenericActionConfig2: JSON.stringify(config),
        });

        return this.isSearchedImage();
    }

    async isSearchedImage() {
        return Boolean(await this.bttStorage.numberVariable('image_location_found'));
    }

    public async getSearchedImagePositionX() {
        // TODO
        // return this.variableByNumber('image_location_x');
    }

    public async getSearchedImagePositionY() {
        // TODO
        // return this.variableByNumber('image_location_y');
    }

    public async mouseLeftClick() {
        return this.client.triggerAction({
            BTTPredefinedActionType: 3,
            BTTPredefinedActionName: '왼쪽 클릭 (At Current Mouse Position)',
        });
    }

    public async mouseMoveToXY(x: number, y: number) {
        return this.client.triggerAction({
            BTTPredefinedActionType: 153,
            BTTPredefinedActionName: '마우스 위치로 이동',
            BTTAdditionalActionData: {
                BTTMouseMoveAnchor: 0,
                BTTMouseMoveWithoutPressedModifierKeys: false,
                BTTMouseMoveUnitX: 0,
                BTTMouseMoveDuration: 0,
                BTTMouseMoveUnitY: 0,
                BTTMouseMoveX: x,
                BTTMouseMoveY: -y,
                BTTMouseMoveContinueDrag: false,
            },
        });
    }

    async startKeyboardInputBlock() {
        return this.client.triggerAction({
            BTTActionCategory: 0,
            BTTIsPureAction: 1,
            BTTPredefinedActionType: 429,
            BTTPredefinedActionName: '키보드 입력 차단 시작',
            BTTEnabled2: 1,
        });
    }

    async stopKeyboardInputBlock() {
        return this.client.triggerAction({
            BTTActionCategory: 0,
            BTTIsPureAction: 1,
            BTTPredefinedActionType: 430,
            BTTPredefinedActionName: '키보드 입력 차단 중단',
            BTTEnabled2: 1,
        });
    }

    async wrapKeyboardInputBlock(callback: () => Promise<void>) {
        await this.startKeyboardInputBlock();
        await uSleep(25);
        await callback();
        await uSleep(25);
        return this.stopKeyboardInputBlock();
    }

    /* *************************
     * Extract Text
     ************************* */
    async captureToPath(rect: WindowRect, path: string) {
        return this.client.triggerAction({
            BTTActionCategory: 0,
            BTTIsPureAction: 1,
            BTTPredefinedActionType: 169,
            BTTPredefinedActionName: '스크린샷 캡처 (구성 가능)',
            BTTScreenshotOptions: `-R;;${rect.x},${rect.y},${rect.width},${rect.height};;-x;;-r;;-t;;png;;${path};;`,
            BTTScreenshotDateFormat: 'yyyy-MM-dd HH.mm.ss',
            BTTEnabled2: 1,
        });
    }

    async captureToClipboard(rect: WindowRect) {
        return this.client.triggerAction({
            BTTActionCategory: 0,
            BTTIsPureAction: 1,
            BTTPredefinedActionType: 169,
            BTTPredefinedActionName: '스크린샷 캡처 (구성 가능)',
            BTTScreenshotOptions: `-R;;${rect.x},${rect.y},${rect.width},${rect.height};;-x;;-r;;-c;;-t;;png;;;;`,
            BTTScreenshotDateFormat: 'yyyy-MM-dd HH.mm.ss',
            BTTEnabled2: 1,
        });
    }

    async waitForClipboardChange(waitMilliSeconds: number = 3000) {
        return this.client.triggerAction({
            BTTActionCategory: 0,
            BTTIsPureAction: 1,
            BTTPredefinedActionType: 499,
            BTTPredefinedActionName: 'Pause Until Clipboard Changes  or  Wait For Change Of Clipboard Contents',
            BTTAdditionalActionData: JSON.stringify({
                BTTActionWaitForClipboardTimeout: waitMilliSeconds / 1000,
            }),
            BTTEnabled2: 0,
        });
    }

    async extractTextFromClipboard(): Promise<string> {
        return this.client.triggerAction<string>({
            BTTIsPureAction: 1,
            BTTPredefinedActionType: 498,
            BTTAdditionalActionData: JSON.stringify({
                BTTOCRSourceType: 0,
                BTTOCRCopyToClipboard: 0,
                BTTOCRAutoDetectLanguage: true,
                // "BTTOCRLanguages": "ko-KR",
                // "BTTOCRCustomWords": "customwords",
                BTTOCRJoinFoundStringsWithCharacter: '\\n',
                BTTOCRJoinBasedOnScreenCoordinates: false,
            }),
            BTTEnabled2: 1,
        });
    }

    async extractTextFromPath(path: string): Promise<string> {
        return this.client.triggerAction<string>({
            BTTActionCategory: 0,
            BTTIsPureAction: 1,
            BTTPredefinedActionType: 498,
            BTTAdditionalActionData: JSON.stringify({
                BTTOCRJoinBasedOnScreenCoordinates: 0,
                BTTOCRFileAtPath: path,
                BTTOCRSourceType: 1,
                BTTOCRAutoDetectLanguage: true,
                BTTOCRJoinFoundStringsWithCharacter: '\\n',
            }),
            BTTEnabled2: 1,
        });
    }

    /**
     * 클립보드에서 텍스트를 추출합니다. 실시간이 필요한 경우 넉넉한 지연 시간을 주어야 합니다.
     * 그렇지 않으면 이전 데이터를 기반으로 추출되는 경우가 종종 발생합니다.
     * @param rect
     * @param waitMilliSeconds
     */
    async captureWithExtractTextFromClipboard(rect: WindowRect, waitMilliSeconds: number = 100): Promise<string> {
        await this.captureToClipboard(rect);
        await this.waitForClipboardChange(1000);
        await uSleep(waitMilliSeconds);
        return this.extractTextFromClipboard();
    }

    /**
     * 파일에서 텍스트를 추출합니다. 실시간이 필요한 경우 넉넉한 지연 시간을 주어야 합니다.
     * 그렇지 않으면 이전 데이터를 기반으로 추출되는 경우가 종종 발생합니다.
     * @param rect
     * @param path
     * @param waitMilliSeconds
     */
    async captureWithExtractTextFromPath({
        rect,
        path,
        waitMilliSeconds = 100,
    }: {
        rect: WindowRect;
        path: string;
        waitMilliSeconds?: number;
    }): Promise<string> {
        await this.captureToPath(rect, path);
        await uSleep(waitMilliSeconds);
        return this.extractTextFromPath(path);
    }
}
