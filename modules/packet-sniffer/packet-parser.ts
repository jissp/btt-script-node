import { injectable } from 'tsyringe';
import { PacketPattern, PacketType } from './packet-sniffer.interface';
import {
    ChangedObjectHpBarValueParser,
    ChangedObjectMoveParser,
    ClientSelfLookParser,
    IPacketParser,
    ParsedPacket,
    UpdatedCharacterStatusParser,
    UpdatedPartialCharacterStatusParser,
} from './parsers';

@injectable()
export class PacketParser {
    private parsers: Partial<Record<PacketType, IPacketParser>> = {};

    constructor() {
        this.parsers[PacketType.UpdatedCharacterStatus] = new UpdatedCharacterStatusParser();
        this.parsers[PacketType.UpdatedPartialCharacterStatus] = new UpdatedPartialCharacterStatusParser();
        this.parsers[PacketType.ChangedObjectHpBarValue] = new ChangedObjectHpBarValueParser();
        this.parsers[PacketType.ClientSelfLook] = new ClientSelfLookParser();
        this.parsers[PacketType.ChangedObjectMove] = new ChangedObjectMoveParser();
    }

    public parse(packet: string): ParsedPacket | null {
        try {
            const packetType = this.extractPacketPattern(packet);

            return this.parsers[packetType]?.parse(packet) ?? null;
        } catch (error) {
            return null;
        }
    }

    private extractPacketPattern(packet: string): PacketType {
        for (const [type, pattern] of Object.entries(PacketPattern) as [keyof typeof PacketPattern, string][]) {
            if (packet.includes(pattern)) {
                return type;
            }
        }

        throw new Error('Unknown packet type');
    }
}
