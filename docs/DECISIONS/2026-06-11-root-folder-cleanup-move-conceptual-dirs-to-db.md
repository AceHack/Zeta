---
date: 2026-06-11
status: proposed
proposer: Alexa (Kiro)
reviewers-requested: [Max, Aaron, Otto, Lior]
---

# ADR: Root Folder Cleanup — Move Conceptual Directories to `db/`

## Context

The repo root currently has ~90+ entries. A fresh contributor (or Max
spinning up his 24/7 host-loop per 081KRQ1AB0008QG0R0014PKF49) sees a wall of folders
with no obvious hierarchy. The signal-to-noise ratio at root is low.

Today we moved the 26 single-letter dirs (a-z) and 24 Greek alphabet
dirs (alpha-omega) into `db/` (PR #7789, merged). That was the
obvious first batch. This ADR proposes moving the remaining
conceptual/unclear single-word directories that don't carry code,
config, or standard OSS meaning.

## Decision

Move the following directories from repo root into `db/`:

### Batch 1 — clearly conceptual/data (no code, no config)

```
bounds  chutes  drop  escalator  futures  gene  gray  grey
ground  hats  hi  hy  ladders  ledgers  lens  morals
particles  rooms  routing  same  saves  sets  shapes  sims
spawn  triggers  uncertainty  unicode  universal  updates  vocab
```

(31 directories)

### Batch 2 — organizational/infra that could live elsewhere

```
boards       → db/boards       (project boards / kanban data)
art          → db/art          (visual assets)
workitems    → db/workitems    (task tracking data)
products     → db/products     (product specs)
meta         → db/meta         (metadata)
```

(5 directories)

### Batch 3 — infrastructure consolidation (optional, separate PR)

```
cluster      → infra/cluster
full-ai-cluster → infra/full-ai-cluster
dns          → infra/dns
network      → infra/network
```

(4 directories — these are infrastructure, `infra/` is a better home)

### Leave at root (already correct)

```
# Standard OSS / build
AGENTS.md  CLAUDE.md  CODEX.md  CURSOR.md  GEMINI.md  KIRO.md
GOVERNANCE.md  CODE_OF_CONDUCT.md  CONTRIBUTING.md  LICENSE
README.md  SECURITY.md  SUPPORT.md
Directory.Build.props  Directory.Packages.props  global.json  Zeta.sln
bun.lock  bunfig.toml  package.json  tsconfig.json
eslint.config.ts  cspell.json  flake.nix  stryker-config.json
robots.txt  sitemap.xml  index.html

# Core project directories
db/  docs/  infra/  memory/  openspec/  references/  src/  tests/  tools/

# Arguable but established
bus/  clis/  demo/  experiments/  gen/  hooks/  hygiene/
inventory/  maintainers/  models/  registry/  roms/  roms-safe/
samples/  skills/
```

## Rationale

1. **Newcomer friendliness.** Max, Addison, or any fresh contributor
   running `ls` at root should immediately see: source code (`src/`),
   docs (`docs/`), tools (`tools/`), data (`db/`), infrastructure
   (`infra/`). Not 90 opaque single-word folders.

2. **Host-loop clarity.** Max's 24/7 site (081KRQ1AB0008QG0R0014PKF49) clones this repo.
   A clean root means his launchd/cron scripts don't need to navigate
   a cluttered namespace to find what matters.

3. **The `db/` convention is already established.** We moved 50 folders
   there today. The pattern is: if it's data/content that the system
   operates ON (not code that the system IS), it goes in `db/`.

4. **Git handles renames cleanly.** `git mv` preserves history. No
   data loss. Fully reversible via revert.

5. **No code changes required.** These directories contain README.md
   files and data — no imports, no build paths, no CI references to
   update.

## Consequences

- Root folder drops from ~90 entries to ~50 (batch 1+2) or ~46 (all batches)
- `db/` becomes the canonical home for all data/content directories
- `infra/` becomes the canonical home for infrastructure definitions
- Any scripts referencing moved paths need updating (grep for affected paths before merge)

## How to review

Max — if you're reading this at your 24/7 site: does this make your
host-loop setup cleaner? Would you move anything differently? The
"leave at root" list includes everything your launchd scripts touch.

The three verbosity levels from 081KSE6WT0008QG0R003AJYMD3 apply here:

- **5yo version:** "We're putting all the messy folders into one neat drawer labeled `db`"
- **Addison/Max version:** This ADR (what you're reading)
- **Aaron+Max debugging version:** `git log --follow db/<folder>` still works after the move

## Implementation

Single PR, one `git mv` per directory, same pattern as PR #7789.
