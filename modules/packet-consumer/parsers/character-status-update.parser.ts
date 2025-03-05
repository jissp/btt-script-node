import { PacketParser, ParsedPacket } from './parser.interface';
import { PacketPattern } from '../packet-consumer.interface';
import * as fs from 'node:fs';

export class CharacterStatusUpdateParser implements PacketParser {
    parse(packet: string): ParsedPacket {
        const [, packet2] = packet.split(PacketPattern.캐릭터상태업데이트);
        const packet3 = packet2.slice(packet2.indexOf('00090e000000') + '00090e000000'.length, packet2.length);

        const _data = packet3
            .replace(/0400(1[0-9a-f]|(0[1-9a-f]))0000/g, match => '\n' + match.toString())
            .split('\n')
            .filter(s => s.match(/0400(1[0-9a-f]|(0[1-9a-f]))0000/));

        const data = _data
            .map(d => {
                const length = parseInt(d.slice(4, 6), 16);

                return d.slice(12, 12 + length * 2);
            })
            .map(hex => Buffer.from(hex, 'hex').toString('ascii'));

        const result = ['m', 'g', 'h', 'mh', 'mm'].reduce(
            (previousValue, currentValue) => {
                const indexOf = data.indexOf(currentValue);
                if (indexOf !== -1 && !Number.isNaN(Number(data[indexOf + 1]))) {
                    previousValue[currentValue] = Number(data[indexOf + 1]);
                }

                return previousValue;
            },
            {} as Record<string, number>,
        );

        fs.appendFile(
            'CharacterStatusUpdateParser.txt',
            `---------------\n${packet}\n${JSON.stringify(result)}\n`,
            err => {},
        );
        // if (Number.isNaN(Number(result.h)) || Number.isNaN(Number(result.m))) {
        //     console.log(packet);
        // }

        return {
            type: PacketPattern.캐릭터상태업데이트,
            data: result,
        };
    }
}
