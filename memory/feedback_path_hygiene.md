---
name: Path hygiene in documentation
description: Absolute filesystem paths and paths outside the repo root are documentation smells; documentation-agent flags and rewrites them
type: feedback
originSessionId: 2ac0e518-3eeb-45c2-a5dc-da0e168fe9c4
---
Documentation should never embed absolute filesystem paths
or paths outside the repo root. These are doc smells:

1. **Absolute filesystem paths** — `/Users/<name>/...`,
   `/home/<name>/...`, `C:\Users\...`, any path tied to a
   specific machine. Doesn't travel to other contributors;
   leaks home-directory and username; rots when the
   maintainer's layout changes.
2. **Paths outside the repo root** — sibling project
   directories, external toolchain install locations,
   scratch directories. The repo can't validate these exist;
   CI can't check them; they drift.

**Rewrite rules:**
- **Repo-relative** when possible: `docs/FOO.md`,
  `src/Zeta.Core/`, `.claude/skills/...`.
- **`$HOME`-relative** when the thing genuinely lives under
  a user home but isn't tied to a specific username:
  `~/.claude/...`.
- **Named concept** when the path is a reference for the
  reader but doesn't need to be machine-pastable: "the
  shared agent memory folder" with a single canonical
  reference in GOVERNANCE.md §18 rather than the full path
  repeated across every doc.
- **URL + archived snapshot** for stable external references
  (papers, upstream docs).

**Exception — the shared agent memory folder.** It is
canonically at `memory/`
outside the repo root by Claude Code convention. AGENTS.md
§18 is the single canonical reference; other docs say "the
shared agent memory folder" and link to §18 rather than
restating the absolute path.

**Why:** Aaron round-25, 2026-04-18: "we should update the
documentation agent to look for paths that are absolute on
the filesystem or outside the repo root these are
documentation smells."

**How to apply:**
- Documentation-agent SKILL.md lists these as smell items 7
  and 8 in the "What he looks for" section.
- On every doc sweep, the documentation-agent greps for
  `/Users/`, `/home/`, `C:\`, `../../../`, and raw absolute
  paths; flags each hit and proposes the rewrite.
- New docs reviewed before landing should pass the path-
  hygiene check.
- When an agent genuinely needs to record an absolute path
  in a doc, ask: does the reader need a pastable path, or
  just the concept? The latter is almost always what they
  need.
