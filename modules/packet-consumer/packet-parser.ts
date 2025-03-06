import { injectable } from 'tsyringe';
import { CharacterStatusUpdateParser, ParsedPacket } from './parsers';
import { CharacterStatusPartialUpdateParser } from './parsers/character-status-partial-update.parser';
import { PacketPattern, PacketType } from './packet-consumer.interface';
import { ChangedObjectHpBarParser } from './parsers/changed-object-hp-bar.parser';
import { ClientSelfLookParser } from './parsers/client-self-look.parser';
import { ChangedObjectMoveParser } from './parsers/changed-object-move.parser';

@injectable()
export class PacketParser {
    private readonly characterStatusPartialUpdateParser: CharacterStatusPartialUpdateParser;
    private readonly characterStatusUpdateParser: CharacterStatusUpdateParser;
    private readonly characterMonsterAttackParser: ChangedObjectHpBarParser;
    private readonly clientSelfLookParser: ClientSelfLookParser;
    private readonly changedObjectMoveParser: ChangedObjectMoveParser;

    constructor() {
        this.characterStatusPartialUpdateParser = new CharacterStatusPartialUpdateParser();
        this.characterStatusUpdateParser = new CharacterStatusUpdateParser();
        this.characterMonsterAttackParser = new ChangedObjectHpBarParser();
        this.clientSelfLookParser = new ClientSelfLookParser();
        this.changedObjectMoveParser = new ChangedObjectMoveParser();
    }

    public parse(packet: string): ParsedPacket | null {
        switch (this.extractPacketPattern(packet)) {
            case PacketType.캐릭터상태업데이트:
                return this.characterStatusUpdateParser.parse(packet);
            case PacketType.체력마력자동회복:
                return this.characterStatusPartialUpdateParser.parse(packet);
            case PacketType.체력바:
                return this.characterMonsterAttackParser.parse(packet);
            case PacketType.P_ClientSelfLook:
                return this.clientSelfLookParser.parse(packet);
            case PacketType.ObjectMove:
                return this.changedObjectMoveParser.parse(packet);
            default:
                return null;
        }
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
