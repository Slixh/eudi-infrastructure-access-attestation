import { generateKeyPair, exportJWK, importJWK } from 'jose';

// did:key encoding for Ed25519
// Multicodec prefix 0xed01 + raw 32-byte public key → base58btc → "z" prefix
async function jwkToDidKey(publicJwk: Record<string, unknown>): Promise<string> {
  const raw = Buffer.from(publicJwk.x as string, 'base64url');
  const multicodecPrefix = Buffer.from([0xed, 0x01]);
  const multicodecKey = Buffer.concat([multicodecPrefix, raw]);
  const { default: bs58 } = await import('bs58');
  const encoded = bs58.encode(multicodecKey);
  return `did:key:z${encoded}`;
}

async function main() {
  const { privateKey, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });

  const privateJwk = await exportJWK(privateKey);
  const publicJwk  = await exportJWK(publicKey);

  const did = await jwkToDidKey(publicJwk as Record<string, unknown>);
  // kid conventionally points to the key inside the DID document
  const kid = `${did}#${did.split(':')[2]}`;

  console.log('\n=== ISSUER KEYPAIR ===\n');
  console.log('Add these to your .env file:\n');
  console.log(`ISSUER_DID="${did}"`);
  console.log(`ISSUER_KID="${kid}"`);
  console.log(`ISSUER_PRIVATE_KEY_JWK='${JSON.stringify({ ...privateJwk, kid })}'`);
  console.log(`ISSUER_PUBLIC_KEY_JWK='${JSON.stringify({ ...publicJwk, kid })}'`);
  console.log('\n=== VERIFICATION ===\n');

  // Round-trip check: re-import and sign a test payload
  const reimported = await importJWK({ ...privateJwk, alg: 'EdDSA' });
  const { SignJWT, jwtVerify } = await import('jose');
  const token = await new SignJWT({ test: true })
    .setProtectedHeader({ alg: 'EdDSA', kid })
    .setIssuedAt()
    .sign(reimported);

  const pubKey = await importJWK({ ...publicJwk, alg: 'EdDSA' });
  await jwtVerify(token, pubKey);
  console.log('Sign + verify round-trip: OK');
  console.log(`DID: ${did}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
