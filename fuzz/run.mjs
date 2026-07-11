// `npm run fuzz` — run every Jazzer.js target in ./fuzz for a short burst.
// Continuous fuzzing is done in CI by ClusterFuzzLite (.github/workflows/
// cflite.yml); this is the fast local repro loop. Override the per-target
// budget with FUZZ_SECONDS (default 30).
import { spawnSync } from 'node:child_process';
import { readdirSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const targets = readdirSync(dir).filter((f) => f.endsWith('.fuzz.js')).sort();
const secs = process.env.FUZZ_SECONDS || '30';
// Run Jazzer's JS CLI directly under `node` — no .cmd wrapper, no shell, so a
// space in the repo path can't break the invocation.
const jazzerCli = createRequire(import.meta.url).resolve('@jazzer.js/core/dist/cli.js');
// The trust-boundary targets are pure (no lock/keychain writes), but isolate
// CANON_HOME + disable the keychain defensively so a target that later touches
// the lock or signing can never read or write the operator's real ~/.canon.
const env = {
  ...process.env,
  CANON_HOME: mkdtempSync(path.join(os.tmpdir(), 'truecopy-fuzz-')),
  CANON_NO_KEYCHAIN: '1',
};

for (const t of targets) {
  console.log(`\n=== fuzzing ${t} (${secs}s) ===`);
  const r = spawnSync(process.execPath, [jazzerCli, `fuzz/${t.replace(/\.js$/, '')}`, '--sync', '--', `-max_total_time=${secs}`],
    { stdio: 'inherit', env });
  if (r.status !== 0) process.exit(r.status || 1);
}
