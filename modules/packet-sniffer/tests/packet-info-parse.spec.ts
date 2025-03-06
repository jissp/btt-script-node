import 'reflect-metadata';
import { container } from 'tsyringe';
import { PacketConsumer } from '../packet-consumer';
import { PacketParser } from '../packet-parser';

describe('character-status-update', () => {
    const reg = /\d{2}:\d{2}:\d{2}\.\d* IP \d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}.\d{4,5} > \d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}.\d{4,5}: Flags \[[A-z]*\.\],(?: seq \d*:\d*,)? ack \d*, win \d*, options \[(?:nop|TS|,)* val \d* ecr \d*\], length (\d*)/;
    const packetWatcher = container.resolve(PacketConsumer);
    const packetParser = container.resolve(PacketParser);

    it('22:24:30.293696 IP 52.196.191.50.32800 > 192.168.0.78.60309: Flags [.], ack 112517, win 442, options [nop,nop,TS val 1876732830 ecr 162361985], length 0', async () => {
        const result = '22:24:30.293696 IP 52.196.191.50.32800 > 192.168.0.78.60309: Flags [.], ack 112517, win 442, options [nop,nop,TS val 1876732830 ecr 162361985], length 0'.match(reg);

        expect(result?.[1]).toBe(0);
    });

    it('22:24:30.293697 IP 52.196.191.50.32800 > 192.168.0.78.60309: Flags [P.], seq 822048:822114, ack 112517, win 442, options [nop,nop,TS val 1876732831 ecr 162361985], length 66', async () => {
        const result = '22:24:30.293697 IP 52.196.191.50.32800 > 192.168.0.78.60309: Flags [P.], seq 822048:822114, ack 112517, win 442, options [nop,nop,TS val 1876732831 ecr 162361985], length 66'.match(reg);

        expect(result?.[1]).toBe(66);
    });
});