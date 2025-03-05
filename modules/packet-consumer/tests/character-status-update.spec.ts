import 'reflect-metadata';
import { container } from 'tsyringe';
import { PacketParser } from '../packet-parser';

describe('character-status-update', () => {
    let parser: PacketParser;
    beforeAll(async () => {
        parser = container.resolve(PacketParser);
    });

    it('', async () => {
        const packet =
            '544f5a200901000002540000000901000098ac25cfffffffff0098ac25cf01000000fc0000800200000000f300000002c12a2e00090e00000004000100000069040003000000313435040001000000680400050000003131303330040001000000670400060000003238353632320400010000006d040001000000300400010000006c040002000000393904000100000074040001000000330400020000006e';

        const result = parser.parse(packet)!;

        expect(result.data['m']).toBeDefined();
    });
});
