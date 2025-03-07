import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { inject, injectable } from 'tsyringe';
import { EventEmitter } from 'events';
import { uSleep } from '../utils';
import { excludePatterns, TcpHeader } from './packet-sniffer.interface';
import { PacketParser } from './packet-parser';
import { PacketSnifferEvent } from './packet-sniffer.event';
import { castEncoding } from './domains';
import { debugLog } from '../utils/debug-log';

@injectable()
export class PacketSniffer {
    private tcpdumpProcess?: ChildProcessWithoutNullStreams;
    private tcpdumpSendProcess?: ChildProcessWithoutNullStreams;

    private variableQueue: string[] = [];
    private variableQueueForSend: string[] = [];

    constructor(
        @inject(EventEmitter) private readonly eventEmitter: EventEmitter,
        @inject(PacketParser) private readonly parser: PacketParser,
    ) {}

    public async run() {
        // this.executeTcpDumpForSend();
        this.executeTcpDumpForRecv();

        // 비동기로 데이터를 처리하기 위해 await 없이 호출
        this.consumeVariableQueue();
        // this.consumeVariableQueueForSend();
        this.bindProcessTerminationForProcessKill();
    }

    private executeTcpDumpForSend() {
        this.tcpdumpSendProcess = spawn('sudo', [
            'sudo',
            'tcpdump',
            '-i',
            'en0',
            '-x',
            '-l',
            '-n',
            'dst',
            'port',
            '32800',
            'and',
            'tcp[tcpflags] & (tcp-syn|tcp-fin|tcp-rst) = 0 and tcp[tcpflags] & tcp-push != 0',
        ]);

        this.tcpdumpSendProcess.stdout.on('data', packet => {
            this.variableQueueForSend.push(castEncoding(packet, 'hex', 'ascii'));
        });
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

    private bindProcessTerminationForProcessKill() {
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

    private async consumeVariableQueue() {
        let lastSequenceNumber = 0;
        let lastCustomFragment = '';
        const bucket: string[] = [];

        while (true) {
            try {
                const capturedData = this.variableQueue.shift();
                const capturedDataLines = capturedData?.split('\n');
                if (!capturedDataLines?.length) {
                    await uSleep(20);
                    continue;
                }

                debugLog('capturedData', capturedData);

                const separatedLines = this.splitCaptureDataFromLines(capturedDataLines);
                for (const [address, dataFragment] of separatedLines) {
                    if (this.isFirstAddress(address) && bucket.length) {
                        // 첫 시작이라면 지금까지 쌓여있던 패킷을 처리한다.
                        const packet = this.reAssemblyPacketFromBucket(bucket);

                        // 패킷의 시퀀스 번호를 추출한다.
                        const tcpHeader = this.extractTcpHeader(packet);
                        debugLog('tcpHeader', tcpHeader);
                        if (tcpHeader) {
                            if (tcpHeader.sequenceNumber < lastSequenceNumber) {
                                bucket.length = 0;
                                continue;
                            }

                            lastSequenceNumber = tcpHeader.sequenceNumber;
                        }

                        // 패킷에서 데이터 부분만 추출
                        const customFragments = this.splitPacketData(
                            lastCustomFragment + packet.slice(52, packet.length),
                        );

                        debugLog('customFragments', customFragments);

                        // fragment의 마지막을 구분할 수가 없음... 그래서 일단 보내고(어짜피 파싱이 안되면 버려질것), 다음 패킷 때 조합해서 또 보낸다.
                        lastCustomFragment = customFragments[customFragments.length - 1];
                        await this.parseAndSendFragments(customFragments);

                        bucket.length = 0;
                    }

                    bucket.push(dataFragment);
                }
            } catch (error) {
                console.log(error);
            }
        }
    }

    private async consumeVariableQueueForSend() {
        let lastSequenceNumber = 0;
        let lastCustomFragment = '';
        const bucket: string[] = [];

        while (true) {
            try {
                const capturedData = this.variableQueueForSend.shift();
                const capturedDataLines = capturedData?.split('\n');
                if (!capturedDataLines?.length) {
                    await uSleep(20);
                    continue;
                }

                debugLog('capturedData', capturedData);

                const separatedLines = this.splitCaptureDataFromLines(capturedDataLines);
                for (const [address, dataFragment] of separatedLines) {
                    if (this.isFirstAddress(address) && bucket.length) {
                        // 첫 시작이라면 지금까지 쌓여있던 패킷을 처리한다.
                        const packet = this.reAssemblyPacketFromBucket(bucket);

                        console.log('--------------------');
                        // console.log(packet);
                        // 패킷의 시퀀스 번호를 추출한다.
                        const tcpHeader = this.extractTcpHeader(packet);
                        debugLog('tcpHeader', tcpHeader);
                        if (tcpHeader) {
                            if (tcpHeader.sequenceNumber < lastSequenceNumber) {
                                bucket.length = 0;
                                continue;
                            }

                            lastSequenceNumber = tcpHeader.sequenceNumber;
                        }

                        // 패킷에서 데이터 부분만 추출
                        const customFragments = this.splitPacketData(
                            lastCustomFragment + packet.slice(52, packet.length),
                        );

                        for (const fragment of customFragments) {
                            if (
                                [
                                    // Move
                                    // '4d6f7665',
                                    // YYYY HeartBeat1
                                    '544f5a200d000000ffffffff000d000000',
                                    // HeartBeat2 Unknown
                                    '544f5a2009000000ffffffff00090000008e0b8baaffffffff008e0b8baa01000000',
                                    '544f5a2005000000ffffffff00050000002f253f99ffffffff002f253f99',
                                    // P_ServerSpellUse
                                    '505f5365727665725370656c6c557365',
                                    // 캐릭터 움직임
                                    // '544f5a201b000000ffffffff',
                                    // '544f5a2024000000ffffffff',
                                    // SelfLook
                                    '544f5a2012000000ffffffff001200000098ac25cfffffffff0098ac25cf01000000810100801600000001',
                                    // 귓속말
                                    '544f5a202b000000ffffffff002b00000098ac25cfffffffff0098ac25cf01000000810100800e0000000015000000040003000000313233040006000000eb9da0eba5b40a534f61c4c880180800d30d00000101080a6ae20be7481c99a6'
                                ].some(excludePatterns => fragment.includes(excludePatterns))
                            ) {
                                continue;
                            }

                            // if(fragment.includes('505f5365727665725370656c6c557365')){
                            console.log(fragment);
                            // }
                            debugLog('customFragments', customFragments);
                        }

                        // fragment의 마지막을 구분할 수가 없음... 그래서 일단 보내고(어짜피 파싱이 안되면 버려질것), 다음 패킷 때 조합해서 또 보낸다.
                        lastCustomFragment = customFragments[customFragments.length - 1];
                        await this.parseAndSendFragments(customFragments);

                        bucket.length = 0;
                    }

                    bucket.push(dataFragment);
                }
            } catch (error) {
                console.log(error);
            }
        }
    }

    private async parseAndSendFragments(customFragments: string[]) {
        for (const fragment of customFragments) {
            // 불필요한 패킷은 제외한다.
            if (excludePatterns.some(pattern => fragment.includes(pattern))) {
                continue;
            }

            debugLog('fragment', fragment);

            const parsedPacket = this.parser.parse(fragment);
            if (parsedPacket) {
                this.eventEmitter.emit(PacketSnifferEvent.ReceiveParsedPacket, parsedPacket);
            }
        }
    }

    private isFirstAddress(address: string) {
        return address.includes('0x0000');
    }

    private splitCaptureDataFromLines(capturedDataLines: string[]) {
        return capturedDataLines
            .filter(dumpLine => dumpLine.includes('0x'))
            .map(line => line.replace(/ /g, '').trim().split(':'));
    }

    private reAssemblyPacketFromBucket(packetStorages: string[]) {
        return packetStorages.join('');
    }

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
