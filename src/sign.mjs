// Ed25519 attestation. `--sign` stamps a pinned entry with a signature over its
// content hash. WHO signed it is identified by the public key embedded in the
// signature; WHETHER you accept that signer is a separate decision — the trust set
// (see trust.mjs). Your machine's own key (in ~/.canon) is implicitly trusted, so a
// local `--sign` round-trips with no extra step; a publisher you trust signs with
// THEIR key and you add it once via `canon trust add`.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Resolved at call time (not import) so CANON_HOME can be set per-test/per-run.
const keyFile = () => path.join(process.env.CANON_HOME || os.homedir(), '.canon', 'signing-key.json');

// PEM bytes can differ only by line endings (CRLF on Windows, a trailing newline
// from a file read) yet be the same key — normalize before hashing/verifying so a
// key's identity is stable across platforms.
const normPem = (p) => String(p).replace(/\r\n/g, '\n').trim();

/** A stable short fingerprint for a public key — how the trust set addresses it. */
export function keyId(publicKey) {
  if (!publicKey) return '';
  return crypto.createHash('sha256').update(normPem(publicKey)).digest('hex').slice(0, 16);
}

/** The local key if it already exists, else null — never generates one (so a
 *  read-only path like `verify` building its trust set can't create key material). */
export function loadKey() {
  try { return JSON.parse(fs.readFileSync(keyFile(), 'utf8')); } catch { return null; }
}

export function ensureKey() {
  const existing = loadKey();
  if (existing) return existing;
  const file = keyFile();
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ publicKey, privateKey }), { mode: 0o600 });
  return { publicKey, privateKey };
}

/** Sign a content hash → { alg, pub, val }. Signs with the local key by default;
 *  pass a { publicKey, privateKey } to sign as a specific publisher. */
export function signHash(hash, key) {
  const { publicKey, privateKey } = key || ensureKey();
  const val = crypto.sign(null, Buffer.from(hash), privateKey).toString('base64');
  return { alg: 'ed25519', pub: publicKey, val };
}

/** Cryptographically verify a signature object against a hash, using the public key
 *  embedded in the signature. This proves the bytes were signed by whoever holds
 *  that key — NOT that you trust that key. Trust (key ∈ your trust set) is a
 *  separate gate, in trust.mjs, so a valid signature from an unknown key still
 *  surfaces as `untrusted` rather than silently passing. */
export function verifyHashSig(hash, sig) {
  if (!sig || sig.alg !== 'ed25519' || !sig.val || !sig.pub) return false;
  try { return crypto.verify(null, Buffer.from(hash), normPem(sig.pub), Buffer.from(sig.val, 'base64')); }
  catch { return false; }
}
