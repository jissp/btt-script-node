import { inject, injectable } from 'tsyringe';
import Redis from 'ioredis';
import { uSleep } from '../utils';
import { PacketParser } from './packet-parser';
import { ParsedPacket } from './parsers';

@injectable()
export class PacketConsumer {
    private packetQueueKey = 'packet_data';
    private client: Redis;
    private isRunning: boolean = false;

    constructor(@inject(PacketParser) private readonly parser: PacketParser) {
        this.client = new Redis({
            host: 'localhost',
            port: 16379,
        });

        this.isRunning = true;
    }

    public async process(callback: (packet: ParsedPacket) => Promise<void>) {
        // 초기화 하고 시작
        await this.client.del(this.packetQueueKey);

        let lastCustomFragment = '';
        const bucket: string[] = [];
        while (this.isRunning) {
            try {
                const capturedData = await this.client.lpop(this.packetQueueKey);
                if (!capturedData) {
                    continue;
                }

                const capturedDataLines = capturedData.split('\n');
                if (capturedDataLines.length === 0) {
                    continue;
                }

                const capturedDataInfos = this.transformToDataInfoList(capturedDataLines);

                for (const [address, dataFragment] of capturedDataInfos) {
                    if (this.isFirstAddress(address)) {
                        // 첫 시작이라면 지금까지 쌓여있던 패킷을 처리한다.
                        if (bucket.length) {
                            const packet = this.reAssemblyDataFromBucket(bucket);

                            // 데이터 추출
                            const customFragments = this.splitPacketData(
                                lastCustomFragment + packet.slice(52, packet.length),
                            );

                            // 이 이유는... fragment의 마지막을 구분할 수가 없음...
                            // 그래서 일단 보내고(어짜피 파싱이 안되면 버려질것), 다음 패킷 때 조합해서 또 보낸다.
                            lastCustomFragment = customFragments[customFragments.length - 1];

                            //
                            await this.parseAndSendFragments(customFragments, callback);

                            bucket.length = 0;
                        }
                    }

                    bucket.push(dataFragment);
                }
            } catch (error) {
                this.client.disconnect();
                return;
            } finally {
                await uSleep(20);
            }
        }
    }

    public terminate() {
        this.isRunning = false;
    }

    private async parseAndSendFragments(customFragments: string[], callback: (packet: ParsedPacket) => Promise<void>) {
        for (const fragment of customFragments) {
            const parsedPacket = this.parser.parse(fragment);
            if (!parsedPacket) {
                continue;
            }

            await callback(parsedPacket);
        }
    }

    private isFirstAddress(address: string) {
        return address.includes('0x0000');
    }

    private transformToDataInfoList(capturedDataLines: string[]) {
        return capturedDataLines
            .filter(dumpLine => dumpLine.includes('0x'))
            .map(line => line.replace(/ /g, '').trim().split(':'));
    }

    private reAssemblyDataFromBucket(packetStorages: string[]) {
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
