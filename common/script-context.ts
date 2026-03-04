import { inject, injectable } from 'tsyringe';
import { EventEmitter } from 'events';
import { BttStorage, LocalStorage } from '../modules/storage';
import { BttService } from '../modules/btt-client';
import { TimerFactory } from '../modules/timer';
import { PacketSniffer } from '../modules/packet-sniffer';
import { ScriptHelper } from './script.helper';

/**
 * BaseScript에서 필요한 모든 의존성을 한 곳에서 관리합니다.
 * DI 컨테이너에서 한 번에 주입받아 생성자를 간결하게 유지합니다.
 */
@injectable()
export class ScriptContext {
    constructor(
        @inject(ScriptHelper) public readonly scriptHelper: ScriptHelper,
        @inject(LocalStorage) public readonly localStorage: LocalStorage,
        @inject(BttStorage) public readonly bttStorage: BttStorage,
        @inject(BttService) public readonly bttService: BttService,
        @inject(TimerFactory) public readonly timerFactory: TimerFactory,
        @inject(PacketSniffer) public readonly packetSniffer: PacketSniffer,
        @inject(EventEmitter) public readonly eventEmitter: EventEmitter,
    ) {}
}
