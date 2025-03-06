import 'reflect-metadata';
import { container } from 'tsyringe';
import { PacketConsumer } from '../packet-consumer';
import { PacketParser } from '../packet-parser';
import { ParsedPacket } from '../parsers';

const packetWatcher = container.resolve(PacketConsumer);
const packetParser = container.resolve(PacketParser);

packetWatcher.process(async (packet: ParsedPacket) => {
    console.log(packet);
});
