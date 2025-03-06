import 'reflect-metadata';
import { container } from 'tsyringe';
import { PacketConsumer } from '../packet-consumer';
import { PacketParser } from '../packet-parser';
import { ParsedPacket } from '../parsers';

describe('character-status-update', () => {
    const packetWatcher = container.resolve(PacketConsumer);
    const packetParser = container.resolve(PacketParser);

    it('', async () => {
        packetWatcher.process(async (packet: ParsedPacket) => {
            console.log(packet);
        });
    });
});