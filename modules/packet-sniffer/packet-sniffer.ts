import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { inject, injectable } from 'tsyringe';
import { EventEmitter } from 'events';
import { debugLog, sleep } from '../../common/utils';
import { excludePatterns, PacketType, TcpHeader } from './packet-sniffer.interface';
import { PacketParser } from './packet-parser';
import { PacketSnifferEvent } from './packet-sniffer.event';
import { castEncoding } from './utils';

@injectable()
export class PacketSniffer {
    private tcpdumpProcess?: ChildProcessWithoutNullStreams;
    private tcpdumpSendProcess?: ChildProcessWithoutNullStreams;

    private variableQueue: string[] = [];

    private readonly bucket: string[] = [];
    private lastSequenceNumber = 0;
    private lastCustomFragment = '';

    constructor(
        @inject(EventEmitter) private readonly eventEmitter: EventEmitter,
        @inject(PacketParser) private readonly parser: PacketParser,
    ) {}

    public async run() {
        this.setupProcessCleanupHandlers();

        this.executeTcpDumpForRecv();

        // 비동기로 데이터를 처리하기 위해 await 없이 호출
        this.consumeVariableQueue();
    }

    private executeTcpDumpForRecv() {
        this.tcpdumpProcess = spawn('sudo', [
            'sudo',
            'tcpdump',
            '-i',
            'en0',
            '-l',
            '-s 0',
            '-x',
            '-n',
            'src port 32800',
        ]);

        this.tcpdumpProcess.stdout.on('data', packet => {
            this.variableQueue.push(castEncoding(packet, 'hex', 'ascii'));
        });
    }

    /**
     * Process 종료 이벤트를 bind한다.
     * @private
     */
    private setupProcessCleanupHandlers() {
        // Node.js가 종료될 때 tcpdump 종료시킨다.
        process.on('SIGINT', () => {
            this.tcpdumpProcess?.kill();
            this.tcpdumpSendProcess?.kill();
            process.exit();
        });

        process.on('exit', () => {
            this.tcpdumpProcess?.kill();
            this.tcpdumpSendProcess?.kill();
        });
    }

    /**
     * 수동 - Local 변수 Queue에서 데이터를 Consume 한다.
     * @private
     */
    private async consumeVariableQueue() {
        while (true) {
            try {
                const capturedData = this.variableQueue.shift();
                const capturedDataLines = capturedData?.split('\n');
                if (!capturedDataLines?.length) {
                    await sleep(20);
                    continue;
                }

                debugLog('capturedData', capturedData);

                await this.processAndEmitPacketFragments(capturedDataLines);
            } catch (error) {
                console.log(error);
            }
        }
    }

    /**
     * 패킷을 조합하고, 조합된 패킷을 파싱해서 Fragment 들을 이벤트로 전달합니다.
     * @param capturedDataLines
     * @private
     */
    private async processAndEmitPacketFragments(capturedDataLines: string[]) {
        const separatedLines = this.splitCaptureDataFromLines(capturedDataLines);
        for (const [address, dataFragment] of separatedLines) {
            if (this.isFirstAddress(address) && this.bucket.length) {
                // 첫 시작이라면 지금까지 쌓여있던 패킷을 처리한다.
                const packet = this.reAssemblyPacketFromBucket(this.bucket);

                // 패킷의 시퀀스 번호를 추출한다.
                const tcpHeader = this.extractTcpHeader(packet);
                debugLog('tcpHeader', tcpHeader);
                if (tcpHeader) {
                    if (tcpHeader.sequenceNumber < this.lastSequenceNumber) {
                        this.bucket.length = 0;
                        continue;
                    }

                    this.lastSequenceNumber = tcpHeader.sequenceNumber;
                }

                // 패킷에서 데이터 부분만 추출
                const customFragments = this.splitPacketData(this.lastCustomFragment + packet.slice(52, packet.length));

                debugLog('customFragments', customFragments);

                // fragment의 마지막을 구분할 수가 없음... 그래서 일단 보내고(어짜피 파싱이 안되면 버려질것), 다음 패킷 때 조합해서 또 보낸다.
                this.lastCustomFragment = customFragments[customFragments.length - 1];
                await this.parseAndSendFragments(customFragments);

                this.bucket.length = 0;
            }

            this.bucket.push(dataFragment);
        }
    }

    private async parseAndSendFragments(customFragments: string[]) {
        for (const fragment of customFragments) {
            // 불필요한 패킷은 제외한다.
            if (excludePatterns.some(pattern => fragment.includes(pattern))) {
                continue;
            }

            // 패킷 타입별 이벤트 발행
            const parsedPacket = this.parser.parse(fragment);
            if (parsedPacket) {
                this.emitPacketTypeEvent(parsedPacket);
            }
        }
    }

    /**
     * 패킷 타입별로 다른 이벤트를 발행합니다.
     */
    private emitPacketTypeEvent(parsedPacket: any): void {
        const { type } = parsedPacket;

        switch (type) {
            case PacketType.UpdatedCharacterStatus:
                this.eventEmitter.emit(PacketSnifferEvent.CharacterStatusFull, parsedPacket);
                break;

            case PacketType.UpdatedPartialCharacterStatus:
                this.eventEmitter.emit(PacketSnifferEvent.CharacterStatusPartial, parsedPacket);
                break;

            case PacketType.ChangedObjectHpBarValue:
                this.eventEmitter.emit(PacketSnifferEvent.HpBarChanged, parsedPacket);
                break;

            case PacketType.ClientSelfLook:
                this.eventEmitter.emit(PacketSnifferEvent.SelfLook, parsedPacket);
                break;

            case PacketType.ChangedObjectMove:
                this.eventEmitter.emit(PacketSnifferEvent.ObjectMoved, parsedPacket);
                break;
        }
    }

    /**
     * @param address
     * @private
     */
    private isFirstAddress(address: string) {
        return address.includes('0x0000');
    }

    /**
     * @param capturedDataLines
     * @private
     */
    private splitCaptureDataFromLines(capturedDataLines: string[]) {
        return capturedDataLines
            .filter(dumpLine => dumpLine.includes('0x'))
            .map(line => line.replace(/ /g, '').trim().split(':'));
    }

    /**
     * @param packetStorages
     * @private
     */
    private reAssemblyPacketFromBucket(packetStorages: string[]) {
        return packetStorages.join('');
    }

    /**
     * @param packet
     * @private
     */
    private splitPacketData(packet: string) {
        const delimiter = '544f5a20';
        const regex = new RegExp(delimiter, 'g');

        if (packet.includes(delimiter)) {
            return packet.replace(regex, `\n${delimiter}`).split('\n').filter(Boolean);
        }

        return [packet];
    }

    private extractTcpHeader(packet: string): TcpHeader | null {
        if (packet.slice(0, 3) !== '450') {
            return null;
        }

        const sourceIpHex = packet.slice(24, 32);
        const destinationIpHex = packet.slice(32, 40);
        const sourcePortHex = packet.slice(40, 44);
        const destinationPortHex = packet.slice(44, 48);
        const sequenceNumberHex = packet.slice(48, 56);

        return {
            sourceIp: sourceIpHex,
            destinationIp: destinationIpHex,
            sourcePort: parseInt(sourcePortHex, 16),
            destinationPort: parseInt(destinationPortHex, 16),
            acknowledgmentNumber: 0,
            checksum: 0,
            dataOffset: 0,
            flags: 0,
            reserved: 0,
            sequenceNumber: parseInt(sequenceNumberHex, 16),
            urgentPointer: 0,
            windowSize: 0,
        };
    }
}
