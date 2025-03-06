import { injectable } from 'tsyringe';
import { IPacketParser, ParsedPacket, UpdatedCharacterStatusParser } from './parsers';
import { PacketPattern, PacketType } from './packet-sniffer.interface';
import { UpdatedPartialCharacterStatusParser } from './parsers/updated-partial-character-status.parser';
import { ChangedObjectHpBarValueParser } from './parsers/changed-object-hp-bar-value.parser';
import { ClientSelfLookParser } from './parsers/client-self-look.parser';
import { ChangedObjectMoveParser } from './parsers/changed-object-move.parser';

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
        const packetType = this.extractPacketPattern(packet);
        if (!packetType) {
            return null;
        }

        return this.parsers[packetType]?.parse(packet) ?? null;
    }

    private extractPacketPattern(packet: string): PacketType | null {
        for (const [type, pattern] of Object.entries(PacketPattern) as [keyof typeof PacketPattern, string][]) {
            if (packet.includes(pattern)) {
                return type;
            }
        }

        return null;
    }
}
