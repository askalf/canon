// Claude Code skills — the skills-marketplace surface, first class. A skill is a
// directory (SKILL.md + files) that Claude Code loads BY NAME from, most-specific
// scope first:
//   <project>/.claude/skills/<name>/   (project scope)
//   ~/.claude/skills/<name>/           (user scope)
// canon pins each one like any skill dir; `canon hook claude` gates the Skill
// tool call itself (PreToolUse), so a drifted or poisoned skill is blocked at the
// moment it's invoked — not only at CI time.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// CANON_CLAUDE_HOME overrides where `~/.claude` lives (tests; unusual installs).
const userClaudeDir = () => path.join(process.env.CANON_CLAUDE_HOME || os.homedir(), '.claude');

/** The skill roots visible from projectDir, project scope first — on a name
 *  collision Claude Code runs the more specific scope, so canon must resolve
 *  (and gate) the same directory that will actually run. */
export function claudeSkillRoots({ projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd() } = {}) {
  const roots = [
    { scope: 'project', dir: path.join(projectDir, '.claude', 'skills') },
    { scope: 'user', dir: path.join(userClaudeDir(), 'skills') },
  ];
  return roots.filter((r) => { try { return fs.statSync(r.dir).isDirectory(); } catch { return false; } });
}

const hasSkillMd = (dir) => { try { return fs.statSync(path.join(dir, 'SKILL.md')).isFile(); } catch { return false; } };

/** Every Claude Code skill visible from projectDir. → [{ name, dir, scope }]
 *  (a project skill shadows a user skill of the same name, like Claude Code itself) */
export function discoverClaudeSkills(opts = {}) {
  const seen = new Map();
  for (const { scope, dir } of claudeSkillRoots(opts)) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || seen.has(e.name)) continue;
      const skillDir = path.join(dir, e.name);
      if (hasSkillMd(skillDir)) seen.set(e.name, { name: e.name, dir: skillDir, scope });
    }
  }
  return [...seen.values()];
}

// A skill NAME, not a path: alphanumeric start (rejects dotdirs and `..`), then
// word / dot / dash. Separators and `:` (a `plugin:skill` invocation resolves
// inside the plugin's own tree, which canon doesn't index) → unresolvable; the
// hook's policy decides what that means (strict blocks it).
const SKILL_NAME = /^[A-Za-z0-9][\w.-]*$/;

/** The directory that will run when Claude Code invokes skill `name`, or null. */
export function resolveClaudeSkill(name, opts = {}) {
  const bare = String(name || '');
  if (!SKILL_NAME.test(bare)) return null;
  for (const { dir } of claudeSkillRoots(opts)) {
    const skillDir = path.join(dir, bare);
    if (hasSkillMd(skillDir)) return skillDir;
  }
  return null;
}
