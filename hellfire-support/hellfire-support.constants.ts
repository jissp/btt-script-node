/**
 * Hellfire-Support 스크립트의 모든 상수를 중앙화
 * 매직 넘버를 의미있는 상수로 변환하여 유지보수 용이성 향상
 */

export const HELLFIRE_SUPPORT_TIMINGS = {
    HELLFIRE_COOLDOWN: 9000, // 헬파이어 재사용 시간 (ms)
    MANA_CHECK_INTERVAL: 2000, // 마나 체크 간격 (ms)
    PARALYSIS_MODE_DURATION: 5000, // 마비 모드 지속시간 (ms)
    ITEM_CHECKER_INTERVAL: 500, // 아이템창 갱신 간격 (ms)
} as const;

export const HELLFIRE_SUPPORT_THRESHOLDS = {
    MANA_LOW: 20, // 마나 부족 판정 (%)
    HEALTH_DAMAGE: 10000, // 피격 판정 체력 감소량
    MANA_RECOVERY_MAX_TRIES: 99, // 마나 회복 최대 시도 횟수
} as const;

export const HELLFIRE_SUPPORT_WAITS = {
    BEFORE_ATTACK: 500, // 마법 시전 대기 (ms)
    BEFORE_HELLFIRE_LOG_CHECK: 200, // 로그 체크 전 대기 (ms)
    AFTER_CURSE: 200, // 저주 후 대기 (ms)
    AFTER_SPELL: 1000, // 스펠 후 대기 (ms)
    AFTER_ITEM_USE: 250, // 아이템 사용 후 대기 (ms)
    DEFENSIVE_PARALYSIS: 60, // 방어 마비 간격 (ms)
    ITEM_CHANGE: 100, // 아이템 변경 후 대기 (ms)
    GENERAL: 100, // 일반 대기 (ms)
} as const;
