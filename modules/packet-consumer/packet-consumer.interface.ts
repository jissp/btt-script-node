export enum PacketPattern {
    '캐릭터상태업데이트' = '000098ac25cfffffffff0098ac25cf01000000fc0000800200000000',
    '체력마력자동회복' = '000098ac25cfffffffff0098ac25cf01000000fc0000800100000000',
    '체력바' = '544f5a2025000000',
    'P_ServerSpellUse' = '00000098ac25cfffffffff0098ac25cf0100000081010080120000000038000000160010000000',
    '비영사천문' = '00000098ac25cfffffffff0098ac25cf01000000810100801200000000720',
    'chatMessageUID' = '636861744d65737361676555494404',
    'MeramItemSlotUpdated' = '4d6572616d4974656d536c6f74557064617465640b',
    'P_ClientSelfLook' = '505f436c69656e7453656c664c6f6f6b',
}

export enum UnknownPattern {
    '/m /m' = '09000000ffffffff0009000000079caf6dffffffff',
    'Unknown1' = '544f5a200d000000ffffffff000d00000',
    // 일정시간마다 뜸 / AR881$8
    'Unknown2' = '544f5a2011000000',
    'UIMeramLogo' = '55494d6572616d4c6f676f',
    'sendUserName' = '73656e64557365724e616d65',
    'MeramClockService' = '4d6572616d436c6f636b53657276696365',
    'MeramUIHelpTooltipService' = '4d6572616d554948656c70546f6f6c74697053657276696365',
    'EntryUIMeramIngameMenu' = '55494d6572616d496e67616d654d656e75',
    'HeartBeatUnknown1' = '0000002000000098ac25cfffffffff0098ac25cf010000008101008031000000000a00000002f7842800020e000000',
    'HeartBeatUnknown2' = '1100000024b88d67ffffffff0024b88d670100000',
    'HeartBeatUnknown3' = '2ea499ddffffffff002ea499dd010000000011000000',
    'HeartBeatUnknown4' = '6ed0024bffffffff006ed0024b010000000011000000',
    'HeartBeatUnknown5' = 'e5162c9fffffffff00e5162c9f',
    'HeartBeatUnknown6' = '544f5a203d000000',
    'HeartBeatMap' = '0000003d000000be37ba3bffffffff00be37ba3b0011000000',
    'UIMeramFieldMapComponent' = '55494d6572616d4669656c644d6170436f6d706f6e656e74',
    CharacterAttack = '544f5a201b000000',
    CharacterMoveOrDirection = '544f5a202a000000',
    CharacterDirection = '544f5a2020000000',
}

export const excludePatterns = [
    // MeramMapUserEnter
    '544f5a203c000000ffffffff',
    // MeramPlayerPartSpriteRenderer
    '544f5a2048000000ffffffff',
    // MeramClientChannelChanged
    '544f5a2044000000ffffffff',
    'add0800000000',
    '00000000000000000000000000000000003c000000',
    '000001000000',
    UnknownPattern['/m /m'],
    UnknownPattern.Unknown1,
    PacketPattern.캐릭터상태업데이트,
    PacketPattern.체력마력자동회복,
    PacketPattern.chatMessageUID,
    UnknownPattern.MeramClockService,
    UnknownPattern.MeramUIHelpTooltipService,
    UnknownPattern.HeartBeatUnknown1,
    UnknownPattern.HeartBeatUnknown2,
    UnknownPattern.HeartBeatUnknown3,
    UnknownPattern.HeartBeatUnknown4,
    UnknownPattern.HeartBeatUnknown5,
    UnknownPattern.HeartBeatUnknown6,
    UnknownPattern.HeartBeatMap,
    UnknownPattern.UIMeramFieldMapComponent,
    // 추후 몬스터 / 사람 나타났을 대 등 사용해야할 수 있음
    UnknownPattern.CharacterMoveOrDirection,
    UnknownPattern.CharacterDirection,
];

// export enum PacketType {
//     '캐릭터상태업데이트' = '544f5a2010010000',
//     '체력자연회복' = '544f5a2010010000',
//     '마나자연회복' = '544f5a2010010000',
//
//     '공격' = '544f5a2012000000ffffffff',
//     '감정표현' = '544f5a2020000000b0050100002000000098ac25cfffffffff',
//     '귓속말' = '544f5a2040000000ffffffff',
//     '피격' = '544f5a201b000000a70a0100001b00000098ac25cfffffffff',
//     'UNKNOWN_1' = '544f5a203d000000292a0000003d000000be37ba3bffffffff',
//     'UNKNOWN_2' = '544f5a204a01000010cc0000004a010000b8392086ffffffff',
//     '방향전환' = '544f5a201b000000ffffffff',
//     '맵변경' = '544f5a201b00000019060100001b00000098ac25cfffffffff',
//     '비영사천문' = '544f5a2088000000ffffffff',
//     MeramMapUserEnter = '544f5a203c000000ffffffff',
//     MeramPlayerPartSpriteRenderer = '544f5a2048000000ffffffff',
//     MeramClientChannelChanged = '544f5a2044000000ffffffff',
//     'MeramUserInteractionPolicy' = '544f5a203400000096040100003400000098ac25cfffffffff',
//     'P_ClientSelfLook' = '544f5a20a80200000e05010000a802000098ac25cfffffffff',
//     'UIAdminContentEventControl' = '544f5a2045000000ffffffff',
//     'MeramSpell' = '544f5a2035000000ffffffff003500000003755b66ffffffff0003755b660100000000140000004d4f44436f6465426c6f636b526573456e747279000a0000004d6572616d5370656c6c956cc87f',
//     'MeramNetSpawnInfoObjectId' = '544f5a20bc020000a308010000bc02000098ac25cfffffffff',
//     'MeramUIItemSlotSelected' = '544f5a2042000000ffffffff',
//     'P_ServerUseCommand' = '544f5a2058000000ffffffff',
//     'P_ServerUserList' = '544f5a0098ac25cf010000007c0200800300000000e2e50000160010000000505f536572766572557365724c69737406',
// }
//
// export const excludePackets = [
//
// ];
// export const excludeAnalysisPackets = Object.values(PacketType);