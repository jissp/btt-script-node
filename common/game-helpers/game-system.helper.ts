import { inject, injectable } from 'tsyringe';
import { BttKeyCode, BttService, ImageSearchRegion } from '../../modules/btt-client';
import { GameRect, Latency, SearchImageBase64Type } from '../common.interface';
import { ocrByClipboard, screenCapture } from '../externals';
import { ScriptHelper } from '../script.helper';
import { OnEvent } from '../decorators';
import { ChangedObjectMove, PacketSnifferEvent, ParsedPacket } from '../../modules/packet-sniffer';
import { GameCharacterHelper } from './game-character.helper';
import { Timer, TimerFactory } from '../../modules/timer';

@injectable()
export class GameSystemHelper {
    private readonly detectObjectMovedTimer: Timer;

    constructor(
        @inject(GameCharacterHelper) private readonly gameCharacterHelper: GameCharacterHelper,
        @inject(BttService)
        private readonly bttService: BttService,
        @inject(ScriptHelper) private readonly scriptHelper: ScriptHelper,
        @inject(TimerFactory) timerFactory: TimerFactory,
    ) {
        this.detectObjectMovedTimer = timerFactory.create('detect-object-move', 1000);
    }

    /**
     * 게임 상태창 열기
     */
    public async openStatusBox() {
        await this.bttService.sendKey(BttKeyCode.s, Latency.KeyCode);
    }

    /**
     * 게임 아이템창 열기
     */
    public async openItemBox() {
        await this.bttService.sendKey(BttKeyCode.i, Latency.KeyCode);
    }

    /**
     * 탭 고정 사용
     */
    public async runTabFix() {
        await this.bttService.wrapKeyboardInputBlock(async () => {
            return this.bttService.sendKey(BttKeyCode.Tab, Latency.Tab);
        });
    }

    /**
     * 탭 해제
     */
    public async closeTargetBox() {
        return this.bttService.sendKey(BttKeyCode.ESC);
    }

    /**
     * 게임 로그 마지막 로그를 OCR으로 읽어옴
     */
    public async getLastGameLog(): Promise<string> {
        await screenCapture({
            rect: this.scriptHelper.getActiveWindowRect(),
        });

        return ocrByClipboard(GameRect.GameLastLog);
    }

    /**
     * 대상 선택 상태인지 확인
     */
    public async isTargetSelecting(): Promise<boolean> {
        return this.bttService.imageSearch({
            imageWithBase64: SearchImageBase64Type.TargetSelectingFromChatBox,
            threshold: 0.9,
            searchRegion: ImageSearchRegion.BottomLeft,
        });
    }

    /**
     * 객체 이동 감지
     */
    @OnEvent(PacketSnifferEvent.ObjectMoved)
    private async onObjectMovedPacket(packet: ParsedPacket<ChangedObjectMove>) {
        const { data } = packet;
        const { objectId } = data;

        // 자신의 객체가 움직이면 무시
        if (this.gameCharacterHelper.isSelfObjectId(objectId)) {
            return;
        }

        console.log(`오브젝트(${objectId}) 움직임 감지`);
        await this.detectObjectMovedTimer.set({ isSync: false });
    }

    /**
     * 최근에 움직임이 감지된 적이 있는지 확인합니다.
     * @private
     */
    public isDetectOtherObjectMoving() {
        return !this.detectObjectMovedTimer.isExpired();
    }
}
