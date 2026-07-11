// Fuzz the MCP tool gate — the runtime enforcement that decides which of a live
// server's advertised tools are `vetted` against canon.lock. The fail-safe
// contract: it must NEVER throw on a hostile tools list (a non-array, null /
// primitive entries, tools named after prototype members like "__proto__" or
// "toString", duplicate names) or a hostile lock entry (parts:null, a poisoned
// twin). It must always return a well-formed { report, allowed:Set } whose every
// status is a known value — a throw is a broker crash, and a mis-count from a
// prototype-named tool is exactly the duplicate-twin bypass this code defends.
import { gateTools } from '../src/gate.mjs';

const STATUSES = new Set(['vetted', 'drifted', 'unvetted', 'unpinned', 'poisoned']);
const PROTO = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'];

const wellFormed = (r) => r && r.allowed instanceof Set && Array.isArray(r.report);

export function fuzz(data) {
  const s = data.toString('utf8');
  const parts = s.split('\n');
  const protoName = PROTO[s.length % PROTO.length];
  // A hostile tools array: real-ish tools, a prototype-named tool, a duplicate
  // name, and null / primitive junk entries the filter must drop.
  const tools = [
    { name: parts[0] ?? '', description: parts[1] ?? '' },
    { name: protoName, description: s },
    { name: parts[0] ?? '', description: 'twin' }, // duplicate of the first name
    null, 42, 'x', undefined, [],
    { name: parts[2], inputSchema: { [s.slice(0, 8)]: s } },
  ];
  // Hostile lock entries: none, a flagged accept with null parts, a prototype-keyed
  // null-proto parts map, and a normal-ish one.
  const entries = [
    null,
    { verdict: 'flagged', parts: null },
    { verdict: 'flagged', parts: Object.assign(Object.create(null), { [protoName]: s }) },
    { verdict: 'clean', parts: { [parts[0] ?? '']: s } },
  ];
  // The non-array / degenerate tool lists must yield an empty, well-formed gate.
  for (const bad of [undefined, null, 'not-an-array', 42, {}]) {
    if (!wellFormed(gateTools(bad, entries[1]))) {
      throw new Error('gateTools(non-array tools) returned a malformed shape');
    }
  }
  for (const entry of entries) {
    const r = gateTools(tools, entry);
    if (!wellFormed(r)) {
      throw new Error(`gateTools returned a malformed shape for entry ${JSON.stringify(entry)}`);
    }
    for (const row of r.report) {
      if (!STATUSES.has(row.status)) {
        throw new Error(`gateTools produced an unknown status: ${JSON.stringify(row.status)}`);
      }
    }
    // Everything the gate allows must be a content hash it actually reported.
    const reported = new Set(r.report.map((x) => x.hash));
    for (const h of r.allowed) {
      if (!reported.has(h)) throw new Error(`gateTools allowed a hash it never reported: ${JSON.stringify(h)}`);
    }
  }
}
