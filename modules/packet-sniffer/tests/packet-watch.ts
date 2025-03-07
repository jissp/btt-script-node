import 'reflect-metadata';
import { container } from 'tsyringe';
import { PacketSniffer } from '../packet-sniffer';
import { PacketParser } from '../packet-parser';
import { ParsedPacket } from '../parsers';
import { EventEmitter } from 'events';
import { PacketSnifferEvent } from '../packet-sniffer.event';

container.registerInstance<EventEmitter>(EventEmitter, new EventEmitter());
const packetSniffer = container.resolve(PacketSniffer);
const packetParser = container.resolve(PacketParser);
const eventEmitter = container.resolve(EventEmitter);

packetSniffer.run();

eventEmitter.on(PacketSnifferEvent.ReceiveParsedPacket, (packet: ParsedPacket) => {
    console.log(packet);
});