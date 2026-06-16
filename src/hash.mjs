// Content hashing + stable JSON, so a skill's identity is its bytes — not the
// order a tool happened to serialize its keys in.
import crypto from 'node:crypto';

export const sha256 = (s) =>
  crypto.createHash('sha256')
    .update(Buffer.isBuffer(s) ? s : typeof s === 'string' ? s : String(s ?? ''))
    .digest('hex');

/** Deterministic JSON: object keys sorted recursively (arrays keep order).
 *  Fail-safe on hostile input — a circular ref becomes "[circular]" and a BigInt
 *  is stringified, so hashing a malformed tool definition can't throw. */
export function canonicalJson(v) {
  const seen = new WeakSet();
  const sort = (x) => {
    if (Array.isArray(x)) return x.map(sort);
    if (x && typeof x === 'object') {
      if (seen.has(x)) return '[circular]';
      seen.add(x);
      return Object.fromEntries(Object.keys(x).sort().map((k) => [k, sort(x[k])]));
    }
    return typeof x === 'bigint' ? x.toString() : x;
  };
  return JSON.stringify(sort(v)) ?? '';
}
