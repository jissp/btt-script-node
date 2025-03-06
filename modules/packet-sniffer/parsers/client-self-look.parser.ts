import { ClientSelfLook, IPacketParser, ParsedPacket } from './parser.interface';
import { PacketPattern, PacketType } from '../packet-sniffer.interface';

export class ClientSelfLookParser implements IPacketParser {
    private readonly delimiter = '98ac25cfffffffff0098ac25cf01000000810100';

    parse(packet: string): ParsedPacket<ClientSelfLook> {
        const [, packet2] = packet.split(PacketPattern.P_ClientSelfLook);
        const packet3 = packet2.slice(this.delimiter.length, packet2.length);

        const selfObjectId = this.extractObjectId(packet3);

        return {
            type: PacketType.P_ClientSelfLook,
            data: {
                objectId: selfObjectId,
            },
        };
    }

    private extractObjectId(packet: string): string {
        const hexByObjectId = Buffer.from('ObjectId', 'ascii').toString('hex');
        const startedIndex = packet.indexOf(hexByObjectId) + hexByObjectId.length;
        return packet.slice(startedIndex, startedIndex + 8);
    }
}
