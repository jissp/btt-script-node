import { PacketPattern } from '../packet-consumer.interface';

export interface PacketParser<T = any> {
    parse(packet: string): ParsedPacket<T>;
}

export type ParsedPacket<T = any> = {
    type: PacketPattern;
    data: T;
};
