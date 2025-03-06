import { injectable } from 'tsyringe';
import { UpdatedCharacterStatusParser, IPacketParser, ParsedPacket } from './parsers';
import { PacketPattern, PacketType } from './packet-sniffer.interface';
import { UpdatedPartialCharacterStatusParser } from './parsers/updated-partial-character-status.parser';
import { ChangedObjectHpBarValueParser } from './parsers/changed-object-hp-bar-value.parser';
import { ClientSelfLookParser } from './parsers/client-self-look.parser';
import { ChangedObjectMoveParser } from './parsers/changed-object-move.parser';

@injectable()
export class PacketParser {
    private parsers: { [key in PacketType]?: IPacketParser } = {
        [PacketType.UpdatedCharacterStatus]: new UpdatedCharacterStatusParser(),
        [PacketType.UpdatedPartialCharacterStatus]: new UpdatedPartialCharacterStatusParser(),
        [PacketType.ChangedObjectHpBarValue]: new ChangedObjectHpBarValueParser(),
        [PacketType.ClientSelfLook]: new ClientSelfLookParser(),
        [PacketType.ChangedObjectMove]: new ChangedObjectMoveParser(),
    };

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
