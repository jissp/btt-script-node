import { ChangedObjectMove, PacketParser, ParsedPacket } from './parser.interface';
import { PacketPattern, PacketType } from '../packet-consumer.interface';

export class ChangedObjectMoveParser implements PacketParser {
    parse(packet: string): ParsedPacket<ChangedObjectMove> {
        const [, packet2] = packet.split(PacketPattern.ObjectMove);

        const delimiter = '98ac25cfffffffff0098ac25cf01000000810100';
        const packet3 = packet2.slice(packet2.indexOf(delimiter) + delimiter.length, packet2.length);

        const objectId = this.extractObjectId(packet3);

        return {
            type: PacketType.ObjectMove,
            data: {
                objectId,
            },
        };
    }

    private extractObjectId(packet: string): string {
        return packet.slice(20, 28);
    }
}
