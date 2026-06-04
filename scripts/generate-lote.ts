/**
 * Generates a signed LoTE (List of Trusted Entities) JWT for the EAA Provider.
 *
 * Upload catalog/trust-list.jwt to a public HTTPS URL and paste that URL into
 * the Sandbox Registrar "Trust List URL (JWT)" field.
 * Paste catalog/trust-list-public-key.jwk.json into "Trust List Public Key JWK".
 *
 * Usage:
 *   pnpm generate-lote
 *
 * Prerequisites:
 *   - rp-signing.key          EC P-256 private key (PEM, traditional or PKCS#8)
 *   - access-certificate.crt  signed by Sandbox CA (PEM)
 */

import { createLoTE, trustedEntity, service, signLoTE, addTrustedEntity } from '@owf/eudi-lote';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const ROOT = path.resolve('.');

// Convert DER ECDSA signature → raw R||S (32+32 bytes) for ES256 JWS
function derToJws(der: Buffer): string {
  let offset = 2;
  if (der[1] === 0x81) offset = 3;
  offset++; // 0x02 tag for r
  const rLen = der[offset++];
  const r = der.subarray(offset, offset + rLen); offset += rLen;
  offset++; // 0x02 tag for s
  const sLen = der[offset++];
  const s = der.subarray(offset, offset + sLen);

  const out = Buffer.alloc(64);
  // r and s may have a leading 0x00 padding byte — copy from the right
  r.copy(out, Math.max(0, 32 - r.length));
  s.copy(out, Math.max(32, 64 - s.length));
  return out.toString('base64url');
}

async function main() {
  // ── 1. Load key + certificate ──────────────────────────────────────────────
  const keyPem  = fs.readFileSync(path.join(ROOT, 'rp-signing.key'), 'utf8');
  const certPem = fs.readFileSync(path.join(ROOT, 'access-certificate.crt'), 'utf8');

  const cert = new crypto.X509Certificate(certPem);
  const publicKeyJwk = cert.publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
  const nodePrivateKey = crypto.createPrivateKey(keyPem);

  // kid = x509_hash: + base64url(sha256(DER cert)) — same as client_id
  const certHash = crypto.createHash('sha256').update(cert.raw).digest('base64url');
  const kid = `x509_hash:${certHash}`;

  // base64 DER (no PEM headers) for addCertificate()
  const certBase64 = cert.raw.toString('base64');

  const baseUrl = process.env.PUBLIC_BASE_URL ?? 'https://your-server.example.com';

  console.log('\n=== LOTE GENERATION ===\n');
  console.log(`kid:         ${kid}`);
  console.log(`cert subject: ${cert.subject}`);
  console.log(`cert valid:   ${cert.validFrom} → ${cert.validTo}\n`);

  // ── 2. Build the service (= your EAA issuance service) ────────────────────
  // type and status must be URLs per ETSI TS 119 602
  const issuerService = service()
    .name('Infrastructure Access EAA Issuance', 'en')
    .type(`${baseUrl}/lote/service-type/eaa-issuer`)
    .status(`${baseUrl}/lote/status/granted`)
    .addPublicKey({ ...publicKeyJwk, kid, use: 'sig', alg: 'ES256' } as any)
    .addCertificate(certBase64)
    .addEndpoint(
      `${baseUrl}/lote/service-type/eaa-issuer`,
      `${baseUrl}/issuer`,
    )
    .build();

  // ── 3. Build the entity ────────────────────────────────────────────────────
  const issuerEntity = trustedEntity()
    .name('EUDI Infrastructure Access Management', 'en')
    .email('jan@hecker.nrw')
    .website(baseUrl)
    .addService(issuerService)
    .build();

  // ── 4. Create the LoTE document ────────────────────────────────────────────
  let lote = createLoTE({
    SchemeOperatorName: [{ lang: 'en', value: 'EUDI Infrastructure Access Management' }],
    SchemeOperatorAddress: {
      SchemeOperatorPostalAddress: [
        { lang: 'en', StreetAddress: '', Locality: '', PostalCode: '', Country: 'DE' },
      ],
      SchemeOperatorElectronicAddress: [
        { lang: 'en', uriValue: 'mailto:jan@hecker.nrw' },
      ],
    },
    SchemeName: [{ lang: 'en', value: 'Infrastructure Access EAA Trust List' }],
    SchemeTerritory: 'DE',
  });

  lote = addTrustedEntity(lote, issuerEntity);

  // ── 5. Sign ────────────────────────────────────────────────────────────────
  const { jws } = await signLoTE({
    lote,
    keyId: kid,
    algorithm: 'ES256',
    certificates: [certPem],
    signer: async (data: Uint8Array | string) => {
      const buf = typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);
      const derSig = crypto.sign('SHA256', buf, nodePrivateKey);
      return derToJws(derSig);
    },
  });

  // ── 6. Write output ────────────────────────────────────────────────────────
  fs.mkdirSync(path.join(ROOT, 'catalog'), { recursive: true });

  const jwtPath = path.join(ROOT, 'catalog', 'trust-list.jwt');
  fs.writeFileSync(jwtPath, jws, 'utf8');

  const jwkPath = path.join(ROOT, 'catalog', 'trust-list-public-key.jwk.json');
  fs.writeFileSync(jwkPath, JSON.stringify({ ...publicKeyJwk, kid, use: 'sig', alg: 'ES256' }, null, 2), 'utf8');

  console.log('✅  catalog/trust-list.jwt              → paste URL into "Trust List URL (JWT)"');
  console.log('✅  catalog/trust-list-public-key.jwk.json → paste contents into "Trust List Public Key JWK"\n');
  console.log('Next steps:');
  console.log('  1. Host catalog/trust-list.jwt at a stable public HTTPS URL');
  console.log('  2. Paste that URL into the Registrar');
  console.log('  3. Paste the JWK into the Registrar');
}

main().catch((e) => { console.error(e); process.exit(1); });
