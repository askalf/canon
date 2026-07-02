#!/usr/bin/env node
// canon CLI — vet, pin, and verify agent skills & MCP servers.
// Exit code is a CI gate: 0 = all clean, 1 = anything flagged / drifted / poisoned.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { scan, pin, verify, diff, readLock, ensureKey, keyId, trustKey, untrustKey, listTrust, loadSkill, skillHash, scanSkill } from './index.mjs';
import { discoverClaudeSkills, resolveClaudeSkill } from './claude.mjs';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const pre = sep >= 0 ? argv.slice(0, sep) : argv;
const post = sep >= 0 ? argv.slice(sep + 1) : []; // wrapped command, for `canon guard -- <cmd>`
const cmd = pre[0];
const opt = (name, def) => {
  const i = pre.indexOf(name);
  if (i >= 0) { const nx = pre[i + 1]; return nx !== undefined && !nx.startsWith('--') ? nx : true; } // `--name value` or bare `--name`
  const eq = pre.find((x) => x.startsWith(name + '='));
  return eq ? eq.slice(name.length + 1) : def;
};
const VALUE_FLAGS = new Set(['--lock', '--name', '--trust']); // consume the next token as a value
const sources = (() => {
  const out = [];
  for (let i = 1; i < pre.length; i++) {
    const a = pre[i];
    if (a.startsWith('--')) { if (VALUE_FLAGS.has(a) && pre[i + 1] && !pre[i + 1].startsWith('--')) i++; continue; }
    out.push(a);
  }
  return out;
})();
const lockPath = opt('--lock', 'canon.lock');
const optTrust = () => { const t = opt('--trust', undefined); return typeof t === 'string' ? t : undefined; };

// `--claude` expands to every Claude Code skill visible from here (.claude/skills,
// project + user scope). Project-relative paths go into the lock with forward
// slashes so a committed canon.lock verifies on any OS / in CI.
const claudeSources = () => discoverClaudeSkills().map(({ dir }) => {
  const rel = path.relative(process.cwd(), dir);
  return (rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel : dir).replace(/\\/g, '/');
});
const allSources = () => (opt('--claude', false) ? [...sources, ...claudeSources()] : sources);

const tty = process.stdout.isTTY;
const C = { red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', dim: '\x1b[2m', bold: '\x1b[1m', rst: '\x1b[0m' };
const c = (col, s) => (tty ? col + s + C.rst : s);
const out = (s = '') => process.stdout.write(s + '\n');
const mark = { ok: c(C.grn, '✓'), clean: c(C.grn, '✓'), flagged: c(C.red, '☠'), poisoned: c(C.red, '☠'), drifted: c(C.yel, '⚠'), missing: c(C.yel, '?'), unsigned: c(C.red, '⚠'), untrusted: c(C.red, '⚠'), unpinned: c(C.dim, '·') };
const findingLine = (f) => `      ${c(C.red, '☠')} ${f.tool}: ${f.flags.join('; ')}`;

function usage() {
  out(`${c(C.bold, 'canon')} — own your agent skills · vet · sign · pin · verify

  canon scan <source...>            poison-scan a skill / MCP manifest / directory
  canon add  <source...> [--sign]   vet + pin into ${lockPath} (refuses poisoned unless --force)
  canon scan --claude               poison-scan every Claude Code skill (.claude/skills, project + user)
  canon add  --claude [--sign]      vet + pin them all
  canon verify [--lock <file>] [--trust <file>]   re-check every pinned skill for drift / poisoning
  canon diff <source> [--name <n>]  show what changed since it was pinned
  canon list                        show the pinned set
  canon guard [--lock <file>] -- <cmd...>   verify the lock, then run <cmd> only if it's clean

  canon key                         print this machine's public key + id (share it to be trusted)
  canon trust add <pubkey> --name <who> [--repo]   trust a publisher's key (--repo → commit it to canon.trust)
  canon trust list                  show the trusted signing keys
  canon trust remove <id>           stop trusting a key

  canon hook claude [--strict]      Claude Code PreToolUse hook: block a pinned skill that
                                    drifted or turned poisonous at the moment it's invoked
                                    (--strict: only pinned skills may run at all)

  canon-mcp [--lock] [--name] [--strict] -- <mcp-server cmd...>
                                    enforce the lock on a LIVE MCP server: only vetted,
                                    unmodified, unpoisoned tools reach the client

  Exit 1 on any flagged / drifted / poisoned result — drop it in CI.`);
}

function runScan() {
  const list = allSources();
  if (!list.length) return (usage(), 2);
  let bad = 0;
  for (const s of list) {
    try {
      const r = scan(s);
      out(`${mark[r.verdict]} ${c(C.bold, r.skill.name)} ${c(C.dim, `(${r.skill.kind})`)}  ${r.verdict}`);
      r.findings.forEach((f) => out(findingLine(f)));
      if (r.verdict !== 'clean') bad++;
    } catch (e) { out(`${c(C.red, '✗')} ${s}: ${e.message}`); bad++; }
  }
  return bad ? 1 : 0;
}

function runAdd() {
  const list = allSources();
  if (!list.length) return (usage(), 2);
  const sign = opt('--sign', false), force = opt('--force', false);
  let bad = 0;
  for (const s of list) {
    try {
      const r = pin(s, { lockPath, sign: !!sign, force: !!force, name: opt('--name', undefined) });
      if (r.ok) out(`${mark.ok} pinned ${c(C.bold, r.name)} ${c(C.dim, r.hash.slice(0, 12))}${r.signed ? c(C.dim, ' · signed') : ''}`);
      else { out(`${mark.flagged} refused ${c(C.bold, s)} — poisoned (use --force to override):`); r.findings.forEach((f) => out(findingLine(f))); bad++; }
    } catch (e) { out(`${c(C.red, '✗')} ${s}: ${e.message}`); bad++; }
  }
  return bad ? 1 : 0;
}

function runVerify() {
  const { ok, results, error } = verify({ lockPath, trustPath: optTrust() });
  if (error) { out(c(C.red, `⛔ ${error}`)); return 1; }
  if (!results.length) { out(c(C.dim, `no pinned skills in ${lockPath}`)); return 0; }
  for (const r of results) {
    const sig = r.signer ? c(C.dim, ` · signed by ${r.signer}`) : (r.signed ? c(C.dim, ' · signed') : '');
    out(`${mark[r.status] || '?'} ${c(C.bold, r.name)}  ${r.status}${sig}`);
    if (r.status === 'drifted') out(c(C.dim, `      ${summary(r)}`));
    if (r.status === 'untrusted') out(c(C.dim, `      key ${r.keyId} not trusted — canon trust add <pubkey> --name <publisher>`));
    if (r.status === 'poisoned') r.findings.forEach((f) => out(findingLine(f)));
  }
  out(ok ? c(C.grn, `\nall ${results.length} pinned skills verified`) : c(C.red, `\n${results.filter((r) => r.status !== 'ok').length}/${results.length} FAILED — review above`));
  return ok ? 0 : 1;
}

function runDiff() {
  if (!sources.length) return (usage(), 2);
  const r = diff(sources[0], { lockPath, name: opt('--name', undefined) });
  out(`${mark[r.status] || '?'} ${c(C.bold, r.name)}  ${r.status}`);
  if (r.status === 'drifted') {
    out(c(C.dim, `      was ${r.was.slice(0, 12)} → now ${r.now.slice(0, 12)}`));
    out(`      ${summary(r)}`);
  }
  return r.status === 'drifted' || r.status === 'unpinned' ? 1 : 0;
}

function summary(r) {
  const bits = [];
  if (r.added?.length) bits.push(c(C.grn, `+${r.added.join(' +')}`));
  if (r.changed?.length) bits.push(c(C.yel, `~${r.changed.join(' ~')}`));
  if (r.removed?.length) bits.push(c(C.red, `-${r.removed.join(' -')}`));
  return bits.join('  ') || c(C.dim, '(content changed)');
}

function runList() {
  const lock = readLock(lockPath);
  const names = Object.keys(lock.skills);
  if (!names.length) { out(c(C.dim, `no pinned skills in ${lockPath}`)); return 0; }
  for (const n of names) {
    const e = lock.skills[n];
    out(`${c(C.grn, '●')} ${c(C.bold, n)} ${c(C.dim, `${e.kind} · ${e.hash.slice(0, 12)} · ${e.scannedAt.slice(0, 10)}${e.sig ? ' · signed' : ''}`)}`);
  }
  return 0;
}

function runGuard() {
  if (!post.length) { out('usage: canon guard [--lock <file>] -- <command...>'); return 2; }
  const { ok, results, error } = verify({ lockPath, trustPath: optTrust() });
  if (error) { out(`${c(C.red, '⛔ canon: refusing to launch —')} ${error}`); return 1; }
  if (!ok) {
    const bad = results.filter((r) => r.status !== 'ok');
    out(`${c(C.red, '⛔ canon: refusing to launch —')} ${bad.length} of ${results.length} skill(s) failed:`);
    bad.forEach((r) => out(`   ${mark[r.status] || '?'} ${c(C.bold, r.name)}: ${r.status}`));
    return 1;
  }
  out(c(C.dim, `canon: ${results.length} pinned skill(s) verified — launching`));
  const res = spawnSync(post[0], post.slice(1), { stdio: 'inherit' });
  return res.status ?? (res.error ? 127 : 0);
}

function runKey() {
  const { publicKey } = ensureKey();
  const id = keyId(publicKey);
  if (opt('--json', false)) { out(JSON.stringify({ id, publicKey: publicKey.trim() })); return 0; }
  out(`${c(C.bold, 'key id')}  ${id}`);
  out(publicKey.trim());
  out(c(C.dim, `\nShare this key; whoever trusts you runs:  canon trust add <this-key-file> --name <you>`));
  return 0;
}

function readKeyArg(arg) {
  // accept a PEM file, or a JSON key file / `canon key --json` output ({ publicKey })
  const raw = fs.readFileSync(arg, 'utf8');
  if (raw.trim().startsWith('{')) { try { return JSON.parse(raw).publicKey; } catch {} }
  return raw;
}

function runTrust() {
  const action = sources[0] || 'list';
  if (action === 'list') {
    const keys = listTrust({ trustPath: optTrust() });
    if (!keys.length) { out(c(C.dim, 'no trusted keys')); return 0; }
    for (const k of keys) out(`${c(C.grn, '●')} ${c(C.bold, k.name)} ${c(C.dim, k.id)}`);
    return 0;
  }
  if (action === 'add') {
    if (!sources[1]) { out('usage: canon trust add <publicKeyFile> --name <label> [--repo]'); return 2; }
    let pub;
    try { pub = readKeyArg(sources[1]); } catch (e) { out(`${c(C.red, '✗')} ${e.message}`); return 1; }
    try {
      const repo = !!opt('--repo', false);
      const r = trustKey(pub, opt('--name', undefined), { repo });
      out(`${mark.ok} trusted ${c(C.bold, r.name)} ${c(C.dim, r.id)}${repo ? c(C.dim, ' · canon.trust') : ''}`);
      return 0;
    } catch (e) { out(`${c(C.red, '✗')} ${e.message}`); return 1; }
  }
  if (action === 'remove' || action === 'rm') {
    if (!sources[1]) { out('usage: canon trust remove <keyId>'); return 2; }
    const n = untrustKey(sources[1]);
    out(n ? `${mark.ok} removed ${n} key(s)` : c(C.dim, 'no matching key'));
    return 0;
  }
  out(`canon trust: unknown action '${action}' (add | list | remove)`);
  return 2;
}

// `canon hook claude` — a Claude Code PreToolUse hook (matcher: Skill). Reads the
// hook payload from stdin, resolves the SAME skill directory Claude Code is about
// to run, and re-checks it against the lock right then. Exit 2 blocks the call
// (Claude Code feeds stderr back to the model); exit 0 lets it through.
//
// Policy — default protects the PINNED set; --strict turns the lock into a whitelist:
//                        default   --strict
//   pinned + unchanged     allow     allow
//   pinned + drifted       BLOCK     BLOCK
//   pinned + poisoned      BLOCK     BLOCK
//   pinned, dir missing    BLOCK     BLOCK     (can't verify what will run → fail closed)
//   not pinned             allow     BLOCK     (adoption-friendly vs lockdown)
//   no lock / hook error   allow     BLOCK     (a crashed gate must not be a bypass in strict)
function runHookClaude() {
  const strict = !!opt('--strict', false);
  const deny = (msg) => { process.stderr.write(`canon: ${msg}\n`); return 2; };
  try {
    let payload = {};
    try { payload = JSON.parse(fs.readFileSync(0, 'utf8')); } catch {}
    if ((payload.tool_name || '') !== 'Skill') return 0; // mis-wired matcher — never break other tools
    const name = payload.tool_input && payload.tool_input.skill;
    if (!name) return 0;

    // lock: explicit --lock > <project>/canon.lock > ./canon.lock (hooks run in the project dir)
    const projectDir = process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd();
    const explicit = opt('--lock', undefined);
    const candidates = typeof explicit === 'string' ? [explicit] : [path.join(projectDir, 'canon.lock'), 'canon.lock'];
    const lp = candidates.find((p) => fs.existsSync(p));
    if (!lp) return strict ? deny(`no canon.lock — pin your skills first: canon add --claude`) : 0;

    let lock;
    try { lock = readLock(lp, { mustExist: true }); }
    catch (e) { return deny(`refusing skill '${name}' — ${e.message}`); } // corrupt lock fails CLOSED, both modes
    const entry = lock.skills[name];
    if (!entry) return strict ? deny(`skill '${name}' is not pinned in ${lp} — vet it first: canon add .claude/skills/${name}`) : 0;

    const dir = resolveClaudeSkill(name, { projectDir });
    if (!dir) return deny(`skill '${name}' is pinned but not found under .claude/skills — can't verify what will run`);
    const skill = loadSkill(dir);
    if (skillHash(skill) !== entry.hash) return deny(`skill '${name}' DRIFTED since it was pinned — review with: canon diff ${dir.replace(/\\/g, '/')}`);
    const s = scanSkill(skill);
    if (s.verdict === 'flagged') return deny(`skill '${name}' is POISONED: ${s.findings.map((f) => `${f.tool}: ${f.flags.join('; ')}`).join(' · ')}`);
    return 0;
  } catch (e) {
    return strict ? deny(`hook error — ${e && e.message || e}`) : 0;
  }
}

function runHook() {
  if ((sources[0] || '') !== 'claude') { out('usage: canon hook claude [--lock <file>] [--strict]   (Claude Code PreToolUse, matcher: Skill)'); return 2; }
  return runHookClaude();
}

const table = { scan: runScan, add: runAdd, verify: runVerify, diff: runDiff, list: runList, guard: runGuard, key: runKey, trust: runTrust, hook: runHook };
if (!cmd || cmd === '-h' || cmd === '--help' || !table[cmd]) { usage(); process.exit(cmd && cmd !== '-h' && cmd !== '--help' ? 2 : 0); }
try { process.exit(table[cmd]()); }
catch (e) { process.stderr.write(`canon: ${e && e.message || e}\n`); process.exit(1); }
