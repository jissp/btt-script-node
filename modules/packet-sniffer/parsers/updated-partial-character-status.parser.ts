import * as _ from 'lodash';
import { CharacterStatusPartialUpdate, IPacketParser, ParsedPacket } from './parser.interface';
import { PacketPattern, PacketType } from '../packet-sniffer.interface';

export class UpdatedPartialCharacterStatusParser implements IPacketParser {
    parse(packet: string): ParsedPacket<CharacterStatusPartialUpdate> {
        const [, packet2] = packet.split(PacketPattern.UpdatedPartialCharacterStatus);

        const delimiter = '1700000002dbb61f00';
        const packet3 = packet2.slice(delimiter.length, packet2.length);

        const data = packet3
            .replace(/0400[a-f0-9]{2}000000/g, match => '\n' + match.toString())
            .split('\n')
            .filter(Boolean)
            .map(d => {
                const length = parseInt(d.slice(4, 6), 16);

                return d.slice(12, 12 + length * 2);
            });

        return {
            type: PacketType.UpdatedPartialCharacterStatus,
            data: Object.fromEntries(
                _.chunk(
                    data.map(hex => Buffer.from(hex, 'hex').toString('ascii')),
                    2,
                ),
            ),
        };
    }
}
