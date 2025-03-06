import { PacketType } from '../packet-sniffer.interface';

export interface IPacketParser<T = any> {
    parse(packet: string): ParsedPacket<T>;
}

export interface ParsedPacket<T = any> {
    type: PacketType;
    data: T;
}

export type RecordObjectId = {
    objectId: string;
};

export type ChangedObjectHpBar = RecordObjectId & {
    hpBarValue: number;
    maxHpBarValue: number;
};

export type ChangedObjectMove = RecordObjectId;
export type ClientSelfLook = RecordObjectId;

export type CharacterStatusUpdate = Record<'m' | 'g' | 'h' | 'mh' | 'mm', number>;
export type CharacterStatusPartialUpdate = Pick<CharacterStatusUpdate, 'h' | 'm'>;
