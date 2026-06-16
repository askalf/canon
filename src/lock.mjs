// canon.lock — the pinned, vetted set. One entry per trusted skill: where it came
// from, the content hash you trusted, the scan verdict at pin time, and (optional)
// a signature. `verify` re-derives the hash and flags any drift from this file.
import fs from 'node:fs';

export const DEFAULT_LOCK = 'canon.lock';

export function readLock(p = DEFAULT_LOCK) {
  try {
    const l = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!l || typeof l !== 'object' || Array.isArray(l)) return { version: 1, skills: {} };
    // Guarantee `skills` is a plain object — a corrupt/hostile lock with
    // `skills: null` (or an array/string) would otherwise crash verify()'s
    // Object.entries and pin()'s index assignment.
    const skills = l.skills && typeof l.skills === 'object' && !Array.isArray(l.skills) ? l.skills : {};
    return { version: 1, ...l, skills };
  } catch {
    return { version: 1, skills: {} };
  }
}

export function writeLock(lock, p = DEFAULT_LOCK) {
  fs.writeFileSync(p, JSON.stringify(lock, null, 2) + '\n');
}
