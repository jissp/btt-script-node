import { CharacterStatusUpdate, IPacketParser, ParsedPacket } from './parser.interface';
import { PacketPattern, PacketType } from '../packet-sniffer.interface';

export class UpdatedCharacterStatusParser implements IPacketParser {
    private readonly statusKeys: (keyof CharacterStatusUpdate)[] = ['m', 'g', 'h', 'mh', 'mm'];
    private readonly delimiterPattern = '0400(1[0-9a-f]|(0[1-9a-f]))0000';
    private readonly delimiterGlobalRegex = new RegExp(this.delimiterPattern, 'g');
    private readonly delimiterRegex = new RegExp(this.delimiterPattern);

    parse(packet: string): ParsedPacket<CharacterStatusUpdate> {
        const [, packet2] = packet.split(PacketPattern.UpdatedCharacterStatus);

        const delimiter = '00090e000000';
        const packet3 = packet2.slice(packet2.indexOf(delimiter) + delimiter.length, packet2.length);

        const _data = packet3
            .replace(this.delimiterGlobalRegex, match => '\n' + match.toString())
            .split('\n')
            .filter(s => s.match(this.delimiterRegex));

        const data = _data
            .map(d => {
                const length = parseInt(d.slice(4, 6), 16);

                return d.slice(12, 12 + length * 2);
            })
            .map(hex => Buffer.from(hex, 'hex').toString('ascii'));

        const result = this.statusKeys.reduce((previousValue, currentValue) => {
            const indexOf = data.indexOf(currentValue);
            if (indexOf !== -1 && !Number.isNaN(Number(data[indexOf + 1]))) {
                previousValue[currentValue] = Number(data[indexOf + 1]);
            }

            return previousValue;
        }, {} as CharacterStatusUpdate);

        if (result['h'] && Number.isNaN(Number(result.h))) {
            console.log(packet);
        }

        if (result['m'] && Number.isNaN(Number(result.m))) {
            console.log(packet);
        }

        return {
            type: PacketType.UpdatedCharacterStatus,
            data: result,
        };
    }
}
