import { injectable } from 'tsyringe';
import { CharacterStatusUpdateParser, ParsedPacket } from './parsers';
import { CharacterStatusPartialUpdateParser } from './parsers/character-status-partial-update.parser';
import { PacketPattern } from './packet-consumer.interface';
import { ChangedObjectHpBarParser } from './parsers/changed-object-hp-bar.parser';
import { ClientSelfLookParser } from './parsers/client-self-look.parser';

@injectable()
export class PacketParser {
    private readonly characterStatusPartialUpdateParser: CharacterStatusPartialUpdateParser;
    private readonly characterStatusUpdateParser: CharacterStatusUpdateParser;
    private readonly characterMonsterAttackParser: ChangedObjectHpBarParser;
    private readonly clientSelfLookParser: ClientSelfLookParser;

    constructor() {
        this.characterStatusPartialUpdateParser = new CharacterStatusPartialUpdateParser();
        this.characterStatusUpdateParser = new CharacterStatusUpdateParser();
        this.characterMonsterAttackParser = new ChangedObjectHpBarParser();
        this.clientSelfLookParser = new ClientSelfLookParser();
    }

    public parse(packet: string): ParsedPacket | null {
        switch (this.extractPacketPattern(packet)) {
            case PacketPattern.캐릭터상태업데이트:
                return this.characterStatusUpdateParser.parse(packet);
            case PacketPattern.체력마력자동회복:
                return this.characterStatusPartialUpdateParser.parse(packet);
            case PacketPattern.체력바:
                return this.characterMonsterAttackParser.parse(packet);
            case PacketPattern.P_ClientSelfLook:
                return this.clientSelfLookParser.parse(packet);
            default:
                return null;
        }
    }

    private extractPacketPattern(packet: string): PacketPattern | null {
        const packetPatterns = Object.values(PacketPattern);

        for (const packetPattern of packetPatterns) {
            if (packet.includes(packetPattern)) {
                return packetPattern as PacketPattern;
            }
        }

        return null;
    }
}
