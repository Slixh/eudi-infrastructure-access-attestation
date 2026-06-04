import * as crypto from 'crypto';

/**
 * Convert a DER-encoded ECDSA signature to JWS compact format (R‖S, 64 bytes).
 *
 * Node's crypto.sign() returns a DER SEQUENCE containing two INTEGERs (r and s).
 * JWS ES256 expects the raw concatenation r‖s, each zero-padded to 32 bytes.
 */
export function derToJws(der: Buffer): string {
  let i = 0;
  if (der[i++] !== 0x30) throw new Error('Not a DER SEQUENCE');
  // Length may be short-form (1 byte) or long-form (multi-byte)
  if (der[i] & 0x80) i += (der[i] & 0x7f) + 1; else i++;
  if (der[i++] !== 0x02) throw new Error('Expected R INTEGER');
  const rLen = der[i++];
  let r = der.subarray(i, i + rLen); i += rLen;
  if (der[i++] !== 0x02) throw new Error('Expected S INTEGER');
  const sLen = der[i++];
  let s = der.subarray(i, i + sLen);
  // Strip leading zero-padding that DER adds to preserve sign bit
  while (r.length > 32 && r[0] === 0x00) r = r.subarray(1);
  while (s.length > 32 && s[0] === 0x00) s = s.subarray(1);
  const out = Buffer.alloc(64);
  r.copy(out, 32 - r.length);
  s.copy(out, 64 - s.length);
  return out.toString('base64url');
}

/**
 * Sign a JWT (ES256) using a PEM-encoded EC private key.
 * Returns a compact JWS string: base64url(header).base64url(payload).signature
 */
export function signCompact(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKeyPem: string,
): string {
  const h = Buffer.from(JSON.stringify(header)).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sigInput = `${h}.${p}`;
  const privKey = crypto.createPrivateKey(privateKeyPem);
  const derSig = crypto.sign('SHA256', Buffer.from(sigInput), privKey);
  return `${sigInput}.${derToJws(derSig)}`;
}
