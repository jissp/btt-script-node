import * as _ from 'lodash';
import { PacketParser, ParsedPacket } from './parser.interface';
import { PacketPattern } from '../packet-consumer.interface';

export class CharacterStatusPartialUpdateParser implements PacketParser {
    parse(packet: string): ParsedPacket {
        const [, packet2] = packet.split(PacketPattern.체력마력자동회복);
        const packet3 = packet2.slice('1700000002dbb61f00'.length, packet2.length);

        const data = packet3
            .split('0400')
            .filter(Boolean)
            .map(e => `0400${e}`)
            .map(d => {
                const length = parseInt(d.slice(4, 6), 16);

                return d.slice(12, 12 + length * 2);
            });

        return {
            type: PacketPattern.체력마력자동회복,
            data: Object.fromEntries(
                _.chunk(
                    data.map(hex => Buffer.from(hex, 'hex').toString('ascii')),
                    2,
                ),
            ),
        };
    }
}
