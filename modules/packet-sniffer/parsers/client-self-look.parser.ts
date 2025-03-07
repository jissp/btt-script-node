import { ClientSelfLook, IPacketParser, ParsedPacket } from './parser.interface';
import { PacketPattern, PacketType } from '../packet-sniffer.interface';
import { castEncoding } from '../domains';

export class ClientSelfLookParser implements IPacketParser {
    private readonly delimiter = '98ac25cfffffffff0098ac25cf01000000810100';

    parse(packet: string): ParsedPacket<ClientSelfLook> {
        const [, packet2] = packet.split(PacketPattern.ClientSelfLook);

        const selfObjectId = this.extractObjectId(packet2);

        return {
            type: PacketType.ClientSelfLook,
            data: {
                objectId: selfObjectId,
            },
        };
    }

    private extractObjectId(packet: string): string {
        const hexByObjectId = castEncoding('ObjectId', 'ascii', 'hex');
        const startedIndex = packet.indexOf(hexByObjectId) + hexByObjectId.length;
        return packet.slice(startedIndex, startedIndex + 8);
    }
}
