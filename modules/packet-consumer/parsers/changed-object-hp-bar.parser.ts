import { PacketParser, ParsedPacket } from './parser.interface';
import { PacketPattern } from '../packet-consumer.interface';
import { toLittleEndianHex } from '../domains/to-little-endian-hex';

/**
 *
 * 544f5a2025000000a44601000025000000  98ac25cfffffffff0098ac25cf01000000810100 802f00000000 [length[2byte]] 000000 [ObjectId[4byte]] 00 02361a00 00 02f87500 00
 */
export class ChangedObjectHpBarParser implements PacketParser {
    parse(packet: string): ParsedPacket {
        const [, packet2] = packet.split(PacketPattern.체력바);
        const packet3 = packet2.slice('98ac25cfffffffff0098ac25cf01000000810100'.length, packet2.length);

        const objectId = packet3.slice(38, 46);
        const currentHpBar = parseInt(toLittleEndianHex(packet3.slice(48, 56)), 16);
        const maxHpBar = parseInt(toLittleEndianHex(packet3.slice(58, 66)), 16);

        return {
            type: PacketPattern.체력바,
            data: {
                objectId,
                currentHpBar,
                maxHpBar,
            },
        };
    }
}
