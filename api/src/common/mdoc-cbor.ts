/**
 * Minimal standards-compliant CBOR encoder for ISO 18013-5 mDoc / COSE.
 *
 * cbor-x's top-level encode() wraps JS Maps in Tag(259), and its Encoder
 * class uses a structured-clone record format with Tag(57343) — both break
 * every ISO 18013-5 wallet parser.  This utility produces pure RFC 7049
 * CBOR with no extensions.
 *
 * Supported types:
 *   null / undefined → 0xf6
 *   boolean          → 0xf4 / 0xf5
 *   integer (int53)  → major 0 / 1
 *   string           → major 3 (UTF-8)
 *   Buffer / Uint8Array → major 2
 *   Array            → major 4
 *   Map<K,V>         → major 5 (K may be number or string)
 *   plain object {}  → major 5 (string keys)
 *   MdocTag          → major 6 (semantic tag)
 */

function encodeHead(major: number, value: number): Buffer {
  const m = major << 5;
  if (value <= 23)       return Buffer.from([m | value]);
  if (value <= 0xff)     return Buffer.from([m | 24, value]);
  if (value <= 0xffff)   { const b = Buffer.allocUnsafe(3); b[0] = m | 25; b.writeUInt16BE(value, 1); return b; }
  if (value <= 0xffffffff) { const b = Buffer.allocUnsafe(5); b[0] = m | 26; b.writeUInt32BE(value >>> 0, 1); return b; }
  throw new Error(`CBOR: value ${value} exceeds 32-bit unsigned range`);
}

/** Represents a CBOR tagged value (major type 6). */
export class MdocTag {
  constructor(public readonly value: unknown, public readonly tag: number) {}
}

export function mdocCborEncode(value: unknown): Buffer {
  // null / undefined
  if (value === null || value === undefined) return Buffer.from([0xf6]);

  // boolean
  if (typeof value === 'boolean') return Buffer.from([value ? 0xf5 : 0xf4]);

  // integer
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new Error(`CBOR: float values not supported (${value})`);
    if (value >= 0) return encodeHead(0, value);
    // negative: major 1, value = -1 - n
    return encodeHead(1, -1 - value);
  }

  // bigint
  if (typeof value === 'bigint') {
    if (value >= 0n) return encodeHead(0, Number(value));
    return encodeHead(1, Number(-1n - value));
  }

  // text string
  if (typeof value === 'string') {
    const bytes = Buffer.from(value, 'utf8');
    return Buffer.concat([encodeHead(3, bytes.length), bytes]);
  }

  // byte string (Buffer or Uint8Array)
  if (value instanceof Uint8Array) {
    const buf = Buffer.isBuffer(value) ? value : Buffer.from(value);
    return Buffer.concat([encodeHead(2, buf.length), buf]);
  }

  // semantic tag
  if (value instanceof MdocTag) {
    return Buffer.concat([encodeHead(6, value.tag), mdocCborEncode(value.value)]);
  }

  // array
  if (Array.isArray(value)) {
    const head  = encodeHead(4, value.length);
    const items = value.map(mdocCborEncode);
    return Buffer.concat([head, ...items]);
  }

  // Map<K,V> — keys may be integers or strings, no Tag(259) added
  if (value instanceof Map) {
    const head   = encodeHead(5, value.size);
    const parts: Buffer[] = [head];
    for (const [k, v] of value.entries()) {
      parts.push(mdocCborEncode(k), mdocCborEncode(v));
    }
    return Buffer.concat(parts);
  }

  // plain object — string keys
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined);
    const head   = encodeHead(5, entries.length);
    const parts: Buffer[] = [head];
    for (const [k, v] of entries) {
      parts.push(mdocCborEncode(k), mdocCborEncode(v));
    }
    return Buffer.concat(parts);
  }

  throw new Error(`CBOR: unsupported value type "${typeof value}"`);
}
