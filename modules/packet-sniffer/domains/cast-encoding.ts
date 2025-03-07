export function castEncoding(value: string, from: BufferEncoding, to: BufferEncoding) {
    return Buffer.from(value, from).toString(to);
}
