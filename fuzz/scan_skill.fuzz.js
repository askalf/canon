// Fuzz the poison scanner — the function canon runs over a loaded skill / MCP
// manifest to catch injection & exfil hidden in a tool's name, description, or
// schema, and in an MCP server's launch command. Fail-safe contract: it must
// NEVER throw on a malformed skill object (null, a primitive, scanTargets that
// isn't an array, a hostile launch command) and must always return a well-formed
// { verdict, findings, advisories } — a scanner that crashes on a crafted skill
// is itself a bypass (the scan is skipped, so the poison is never surfaced).
import { scanSkill } from '../src/scan.mjs';

export function fuzz(data) {
  const s = data.toString('utf8');
  const parts = s.split('\n');
  const skills = [
    null, undefined, 42, 'x', [], {},
    { scanTargets: s },                                  // non-array scanTargets
    { scanTargets: [null, 42, 'x', undefined] },         // junk targets
    { kind: 'skill', scanTargets: [{ name: parts[0], description: s }] },
    { kind: 'file', scanTargets: [{ name: s.slice(0, 16), description: s }] },
    { kind: 'mcp', name: parts[0], scanTargets: [{ name: s, inputSchema: { x: s } }],
      launch: { command: s, args: parts, env: { [s.slice(0, 4)]: s } } },
    { launch: { command: null, args: 'not-an-array', env: s } },
  ];
  for (const skill of skills) {
    const r = scanSkill(skill);
    if (!r || (r.verdict !== 'clean' && r.verdict !== 'flagged')) {
      throw new Error(`scanSkill returned an invalid verdict: ${JSON.stringify(r && r.verdict)}`);
    }
    if (!Array.isArray(r.findings) || !Array.isArray(r.advisories)) {
      throw new Error('scanSkill returned non-array findings/advisories');
    }
    // verdict and findings must agree — `flagged` iff there is at least one finding.
    if ((r.findings.length > 0) !== (r.verdict === 'flagged')) {
      throw new Error(`scanSkill verdict/findings disagree: ${r.verdict} with ${r.findings.length} findings`);
    }
  }
}
