/**
 * Signs a JWT signing input with rp-signing.key (ES256) and adds x5c to the header.
 *
 * Usage:
 *   1. Copy the "Signing Input (header.payload)" from the Registrar
 *   2. Paste it into signing-input.txt in the project root
 *   3. Run: pnpm sign-payload
 *   4. Copy the output JWT into "Schema Metadata JWT" and click Publish
 *
 * Prerequisites:
 *   - rp-signing.key          (EC P-256 private key, PEM)
 *   - access-certificate.crt  (signed by Sandbox CA, PEM)
 *   - signing-input.txt       (header.payload from the Registrar Build Payload step)
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

function derToJws(der: Buffer): string {
  // DER: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
  let i = 0;
  if (der[i++] !== 0x30) throw new Error('Not a DER SEQUENCE');
  // Handle short and long-form length encoding
  if (der[i] & 0x80) i += (der[i] & 0x7f) + 1; else i++;
  // R integer
  if (der[i++] !== 0x02) throw new Error('Expected INTEGER tag for R');
  const rLen = der[i++];
  let r = der.subarray(i, i + rLen); i += rLen;
  // S integer
  if (der[i++] !== 0x02) throw new Error('Expected INTEGER tag for S');
  const sLen = der[i++];
  let s = der.subarray(i, i + sLen);

  // DER integers may have a leading 0x00 to indicate positive sign — strip it
  while (r.length > 32 && r[0] === 0x00) r = r.subarray(1);
  while (s.length > 32 && s[0] === 0x00) s = s.subarray(1);

  if (r.length > 32 || s.length > 32) throw new Error(`Unexpected R/S length: ${r.length}/${s.length}`);

  // Left-pad each component to exactly 32 bytes
  const out = Buffer.alloc(64);
  r.copy(out, 32 - r.length);
  s.copy(out, 64 - s.length);
  return out.toString('base64url');
}

// Read signing input from file to avoid shell argument encoding issues
const inputPath = path.resolve('signing-input.txt');
if (!fs.existsSync(inputPath)) {
  console.error('Error: signing-input.txt not found in project root.');
  console.error('Paste the "Signing Input (header.payload)" from the Registrar into that file.');
  process.exit(1);
}

const signingInput = fs.readFileSync(inputPath, 'utf8').trim();
if (!signingInput.includes('.')) {
  console.error('Error: signing-input.txt does not look like a JWT (no "." found).');
  process.exit(1);
}

const keyPem  = fs.readFileSync(path.resolve('certs/rp-signing.key'), 'utf8');
const certPem = fs.readFileSync(path.resolve('certs/access-certificate.crt'), 'utf8');

// Keep only the payload part — rebuild the header with x5c
const dotIndex = signingInput.indexOf('.');
const origHeaderB64 = signingInput.slice(0, dotIndex);
const payloadB64    = signingInput.slice(dotIndex + 1);

const origHeader = JSON.parse(Buffer.from(origHeaderB64, 'base64url').toString('utf8'));

// x5c: base64-encoded DER (no PEM headers, no line breaks)
const cert = new crypto.X509Certificate(certPem);
const x5c  = cert.raw.toString('base64');

const newHeader = {
  alg: 'ES256',
  typ: origHeader.typ ?? 'attestation-schema+jwt',
  x5c: [x5c],
};

const newHeaderB64   = Buffer.from(JSON.stringify(newHeader)).toString('base64url');
const newSigningInput = `${newHeaderB64}.${payloadB64}`;

const privateKey = crypto.createPrivateKey(keyPem);
const derSig     = crypto.sign('SHA256', Buffer.from(newSigningInput), privateKey);
const signature  = derToJws(derSig);

const jwt = `${newSigningInput}.${signature}`;

// Self-verify before outputting
const pubKey = crypto.createPublicKey(certPem);
const [h, p, sig] = jwt.split('.');
const isValid = crypto.verify(
  'SHA256',
  Buffer.from(`${h}.${p}`),
  pubKey,
  Buffer.concat([
    Buffer.from(sig.slice(0, 43), 'base64url'),   // R (32 bytes as base64url ≈ 43 chars)
    Buffer.from(sig.slice(43), 'base64url'),        // S
  ]),
);
// Use raw DER verify instead — simpler
const rawSig   = Buffer.from(signature, 'base64url');
const verified = crypto.verify('SHA256', Buffer.from(newSigningInput), pubKey,
  (() => {
    // Re-encode R||S back to DER for verify()
    const r = rawSig.subarray(0, 32);
    const s = rawSig.subarray(32);
    const rb = r[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), r]) : r;
    const sb = s[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), s]) : s;
    const seq = Buffer.concat([
      Buffer.from([0x02]), Buffer.from([rb.length]), rb,
      Buffer.from([0x02]), Buffer.from([sb.length]), sb,
    ]);
    return Buffer.concat([Buffer.from([0x30, seq.length]), seq]);
  })(),
);

if (!verified) {
  console.error('❌  Self-verification failed — the signature is invalid. Check your key/cert pair.');
  process.exit(1);
}

console.log('\n✅  Signature verified locally.\n');
console.log('=== SIGNED JWT — paste into "Schema Metadata JWT" ===\n');
console.log(jwt);
console.log('\n');

// Also write to file for easy copy
const outPath = path.resolve('signed-schema-metadata.jwt');
fs.writeFileSync(outPath, jwt, 'utf8');
console.log(`(Also saved to signed-schema-metadata.jwt)\n`);
