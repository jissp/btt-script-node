import { PacketParser, ParsedPacket } from './parser.interface';
import { PacketPattern } from '../packet-consumer.interface';

export class ChangedObjectMoveParser implements PacketParser {
    parse(packet: string): ParsedPacket {
        const [, packet2] = packet.split(PacketPattern.ObjectMove);
        const packet3 = packet2.slice(
            packet2.indexOf('98ac25cfffffffff0098ac25cf01000000810100') +
                '98ac25cfffffffff0098ac25cf01000000810100'.length,
            packet2.length,
        );

        const objectId = packet3.slice(20, 28);

        return {
            type: PacketPattern.ObjectMove,
            data: {
                objectId,
            },
        };
    }
}
