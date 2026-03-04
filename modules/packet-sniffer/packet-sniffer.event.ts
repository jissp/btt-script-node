export enum PacketSnifferEvent {
    // 캐릭터 상태 업데이트
    CharacterStatusFull = 'packet:character-status:full',
    CharacterStatusPartial = 'packet:character-status:partial',

    // HP 바 변경 (피격 감지)
    HpBarChanged = 'packet:hp-bar:changed',

    // 자신의 모습 (objectId 설정)
    SelfLook = 'packet:self-look',

    // 객체 이동 감지
    ObjectMoved = 'packet:object:moved',
}
