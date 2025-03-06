import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { inject, injectable } from 'tsyringe';
import { EventEmitter } from 'events';
import { uSleep } from '../utils';
import { excludePatterns } from './packet-sniffer.interface';
import { PacketParser } from './packet-parser';
import { PacketSnifferEvent } from './packet-sniffer.event';

@injectable()
export class PacketSniffer {
    private tcpdumpProcess?: ChildProcessWithoutNullStreams;

    private variableQueue: string[] = [];

    constructor(
        @inject(EventEmitter) private readonly eventEmitter: EventEmitter,
        @inject(PacketParser) private readonly parser: PacketParser,
    ) {}

    public async run() {
        this.runTcpDump();

        // 비동기로 데이터를 처리하기 위해 await 없이 호출
        this.consumeVariableQueue();
    }

    private runTcpDump() {
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

        this.tcpdumpProcess.stdout.on('data', packet => this.processTcpDumpPacket.call(this, packet));
        this.bindProcessTerminationForProcessKill();
    }

    private bindProcessTerminationForProcessKill() {
        // Node.js가 종료될 때 tcpdump 종료시킨다.
        process.on('SIGINT', () => {
            this.tcpdumpProcess?.kill();
            process.exit();
        });

        process.on('exit', () => {
            this.tcpdumpProcess?.kill();
        });
    }

    private processTcpDumpPacket(packet: string) {
        this.variableQueue.push(Buffer.from(packet, 'hex').toString('ascii'));
    }

    private async consumeVariableQueue() {
        let lastCustomFragment = '';
        const bucket: string[] = [];

        while (true) {
            try {
                const capturedData = this.variableQueue.shift();
                const capturedDataLines = capturedData?.split('\n');
                if (!capturedDataLines?.length) {
                    continue;
                }

                const separatedLines = this.splitCaptureDataFromLines(capturedDataLines);
                for (const [address, dataFragment] of separatedLines) {
                    if (this.isFirstAddress(address)) {
                        // 첫 시작이라면 지금까지 쌓여있던 패킷을 처리한다.
                        if (bucket.length) {
                            const packet = this.reAssemblyPacketFromBucket(bucket);

                            // 패킷에서 데이터 부분만 추출
                            const customFragments = this.splitPacketData(
                                lastCustomFragment + packet.slice(52, packet.length),
                            );

                            // fragment의 마지막을 구분할 수가 없음... 그래서 일단 보내고(어짜피 파싱이 안되면 버려질것), 다음 패킷 때 조합해서 또 보낸다.
                            lastCustomFragment = customFragments[customFragments.length - 1];
                            await this.parseAndSendFragments(customFragments);

                            bucket.length = 0;
                        }
                    }

                    bucket.push(dataFragment);
                }
            } catch (error) {
                console.log(error);
            } finally {
                await uSleep(50);
            }
        }
    }

    private async parseAndSendFragments(customFragments: string[]) {
        for (const fragment of customFragments) {
            if (excludePatterns.some(pattern => fragment.includes(pattern))) {
                continue;
            }

            const parsedPacket = this.parser.parse(fragment);
            if (!parsedPacket) {
                continue;
            }

            this.eventEmitter.emit(PacketSnifferEvent.ReceiveParsedPacket, parsedPacket);
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
}
