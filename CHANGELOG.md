# Changelog

All notable changes to **@askalf/canon** are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/), and this project
adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-06-19

### Added
- **Publisher trust** — `canon verify` now checks every signed entry against a
  **trust set**, so a signature attests *who* vetted a skill, not just *that* its
  bytes are unchanged. A cryptographically valid signature from a key you don't
  trust fails closed as `untrusted` (exit 1) instead of silently passing.
  - `canon key` — print this machine's public key + id to publish.
  - `canon trust add <pubkey> --name <who> [--repo]` / `canon trust list` /
    `canon trust remove <id>` — manage trusted publisher keys.
  - Trust resolves from three unioned sources: your own machine's key (implicit,
    so a local `--sign` round-trips), a user-global `~/.canon/trust.json`, and a
    repo-committed **`canon.trust`** — commit it and CI / a teammate's checkout
    verifies the publisher's signature with no extra setup.
  - `verify({ trustPath })` plus `keyId` / `loadTrust` / `trustKey` / `untrustKey`
    / `listTrust` are exported from the library.
- Stays deterministic and offline — no transparency log, no network.

## [0.1.0] - 2026-06-16

First public release — own your agent skills: the supply-chain gate for AI agents.

### Added
- **Scan** — inspect skills and MCP servers for poisoned descriptions and
  injection before they run (reuses `@askalf/warden`'s `scanMcpTools`).
- **Pin + verify** — `canon.lock` records a content hash for every approved
  skill / MCP server; `canon verify` fails (non-zero exit, CI-ready) on any
  drift from the locked state.
- **Sign** — optional Ed25519 signing/verification of the lockfile so an
  approved set can't be swapped underneath you.
- **Runtime gate** — `canon-mcp` proxies an MCP server and drops tools that
  aren't vetted/pinned; `canon guard` classifies each tool as
  vetted / drifted / unvetted / unpinned / poisoned.

[0.1.0]: https://github.com/askalf/canon/releases/tag/v0.1.0
