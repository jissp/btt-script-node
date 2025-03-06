import { ChangedObjectHpBar, IPacketParser, ParsedPacket } from './parser.interface';
import { PacketPattern, PacketType } from '../packet-sniffer.interface';
import { toLittleEndianHex } from '../domains/to-little-endian-hex';

/**
 *
 * 544f5a2025000000a44601000025000000  98ac25cfffffffff0098ac25cf01000000810100 802f00000000 [length[2byte]] 000000 [ObjectId[4byte]] 00 02361a00 00 02f87500 00
 */
export class ChangedObjectHpBarValueParser implements IPacketParser {
    private delimiter = '98ac25cfffffffff0098ac25cf01000000810100';

    parse(packet: string): ParsedPacket<ChangedObjectHpBar> {
        const [, packet2] = packet.split(PacketPattern.ChangedObjectHpBarValue);
        const packet3 = packet2.slice(this.delimiter.length, packet2.length);

        const objectId = this.extractObjectId(packet3);
        const currentHpBar = this.extractHpBarValue(packet3);
        const maxHpBar = this.extractHpBarMaxValue(packet3);

        return {
            type: PacketType.ChangedObjectHpBarValue,
            data: {
                objectId,
                currentHpBar,
                maxHpBar,
            },
        };
    }

    private extractObjectId(packet: string): string {
        return packet.slice(38, 46);
    }

    private extractHpBarValue(packet: string): number {
        return parseInt(toLittleEndianHex(packet.slice(48, 56)), 16);
    }

    private extractHpBarMaxValue(packet: string): number {
        return parseInt(toLittleEndianHex(packet.slice(58, 66)), 16);
    }
}
