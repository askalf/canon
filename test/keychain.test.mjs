// The private signing key lives in the OS keychain, not plaintext in
// signing-key.json. Uses CANON_KEYCHAIN_FAKE (a stand-in file) so the test is
// deterministic and never touches the real OS keychain.
import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureKey, loadKey, signHash, verifyHashSig, keyId } from '../src/sign.mjs';

// Fresh, isolated CANON_HOME + fake keychain (under that home) per test.
function isolate(prefix = 'canon-kc-') {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  process.env.CANON_HOME = home;
  delete process.env.CANON_NO_KEYCHAIN;
  process.env.CANON_KEYCHAIN_FAKE = path.join(home, 'fake-keychain.json');
  return home;
}
const onDisk = (home) => JSON.parse(fs.readFileSync(path.join(home, '.canon', 'signing-key.json'), 'utf8'));
const genKey = () => crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

test('private key is stored in the keychain, never in signing-key.json', () => {
  const home = isolate();
  const key = ensureKey();
  assert.ok(key.publicKey && key.privateKey, 'returns a full keypair');

  const file = onDisk(home);
  assert.ok(file.publicKey, 'public key is written to the file');
  assert.strictEqual(file.privateKey, undefined, 'PRIVATE key is NOT in the file');
  assert.ok(fs.existsSync(process.env.CANON_KEYCHAIN_FAKE), 'keychain holds the private key');

  const loaded = loadKey();
  assert.strictEqual(loaded.privateKey, key.privateKey, 'loadKey reconstructs the private key from the keychain');
  const sig = signHash('a1b2c3');
  assert.strictEqual(verifyHashSig('a1b2c3', sig), true, 'signs + verifies end to end');
});

test('a legacy plaintext key is migrated into the keychain, identity preserved', () => {
  const home = isolate('canon-kc-mig-');
  const { publicKey, privateKey } = genKey();
  const id = keyId(publicKey);
  fs.mkdirSync(path.join(home, '.canon'), { recursive: true });
  // pre-keychain install: { publicKey, privateKey } sitting plaintext in the file
  fs.writeFileSync(path.join(home, '.canon', 'signing-key.json'), JSON.stringify({ publicKey, privateKey }), { mode: 0o600 });

  const migrated = ensureKey(); // first sign after upgrade → migrates
  assert.strictEqual(migrated.publicKey, publicKey, 'same public key');
  assert.strictEqual(keyId(migrated.publicKey), id, 'identity (keyId) unchanged — no new key generated');
  assert.strictEqual(migrated.privateKey, privateKey, 'same private key, now served from the keychain');
  assert.strictEqual(onDisk(home).privateKey, undefined, 'private key stripped from the file');

  const sig = signHash('ffee', migrated);
  assert.strictEqual(verifyHashSig('ffee', sig), true, 'migrated key still signs');
});

test('CANON_NO_KEYCHAIN falls back to a 0600 plaintext file', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-nokc-'));
  process.env.CANON_HOME = home;
  delete process.env.CANON_KEYCHAIN_FAKE;
  process.env.CANON_NO_KEYCHAIN = '1';
  try {
    const key = ensureKey();
    assert.ok(key.publicKey && key.privateKey);
    const file = onDisk(home);
    assert.ok(file.publicKey && file.privateKey, 'both keys in the file when no keychain is available');
    const sig = signHash('00ff');
    assert.strictEqual(verifyHashSig('00ff', sig), true);
  } finally {
    delete process.env.CANON_NO_KEYCHAIN;
  }
});
