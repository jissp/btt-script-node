export function toLittleEndianHex(hex: string) {
    return hex.match(/../g)?.reverse().join('') ?? '';
}
