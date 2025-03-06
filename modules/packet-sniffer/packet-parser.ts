import { injectable } from 'tsyringe';
import { CharacterStatusUpdateParser, IPacketParser, ParsedPacket } from './parsers';
import { PacketPattern, PacketType } from './packet-sniffer.interface';
import { CharacterStatusPartialUpdateParser } from './parsers/character-status-partial-update.parser';
import { ChangedObjectHpBarParser } from './parsers/changed-object-hp-bar.parser';
import { ClientSelfLookParser } from './parsers/client-self-look.parser';
import { ChangedObjectMoveParser } from './parsers/changed-object-move.parser';

@injectable()
export class PacketParser {
    private parsers: { [key in PacketType]?: IPacketParser } = {
        [PacketType.캐릭터상태업데이트]: new CharacterStatusUpdateParser(),
        [PacketType.체력마력자동회복]: new CharacterStatusPartialUpdateParser(),
        [PacketType.체력바]: new ChangedObjectHpBarParser(),
        [PacketType.P_ClientSelfLook]: new ClientSelfLookParser(),
        [PacketType.ObjectMove]: new ChangedObjectMoveParser(),
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
