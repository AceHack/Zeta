---
name: Cross-reference audit scripts — memory-level + repo-level Python one-liners for dead .md pointers
description: Two reusable Python audit scripts that flag dead `.md` cross-references. Memory-level audit runs on `~/.claude/projects/.../memory/` and uses the `(user|feedback|project|reference)_*.md` naming convention (reduced 29 dead pointers to 3 intentional self-guards on 2026-04-22 run). Repo-level audit runs on `docs/` and filters auto-memory naming + `YYYY-MM-DD` / `-NN-` templates + `memory/` path prefix + bare-name matches; current repo baseline 2026-04-22 is 151 dead pointers across 52 doc files, with the bulk concentrated in `docs/BACKLOG.md` (43) and `docs/ROUND-HISTORY.md` (16). NOT a one-shot fix target — the majority of BACKLOG hits are in-flight restructure placeholders (per ADR `2026-04-22-backlog-per-row-file-restructure.md`); re-run post-restructure for real signal. Safe to run every 5-10 rounds as speculative hygiene.
type: reference
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Cross-reference audit scripts

Two Python scripts for flagging dead `.md` cross-references,
paired with the interpretation rules that make each useful.

## Why these exist

A prior wake created forward-references to planned memory
files that never landed. Over time, filename renames and
moved docs also accumulated dead pointers. Both flavours
look the same to a reader — a backticked `.md` filename
that points to nothing — and both degrade cold-start cost
for future wakes. These scripts find them cheaply.

## Memory-level audit

**Surface:** `/Users/acehack/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/**/*.md`

**Target pattern:** bare filenames matching
`(user|feedback|project|reference)_*.md`.

**Resolution:** exact filename match against the memory
directory.

```bash
cd /Users/acehack/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory && python3 <<'EOF'
import re, pathlib
root = pathlib.Path('.')
existing = {p.name for p in root.glob('*.md') if p.name != 'MEMORY.md'} | {'MEMORY.md'}
pat = re.compile(r'\b((?:user|feedback|project|reference)_[a-zA-Z0-9_.-]+?\.md)\b')
broken = {}
for p in root.glob('*.md'):
    text = p.read_text(errors='replace')
    dead = sorted(r for r in set(pat.findall(text)) if r not in existing)
    if dead:
        broken[p.name] = dead
total = sum(len(v) for v in broken.values())
print(f"{len(broken)} files, {total} dead pointers")
for src, dead in sorted(broken.items()):
    print(f"--- {src}")
    for d in dead:
        print(f"  {d}")
EOF
```

**2026-04-22 baseline:** 29 dead pointers across 16 files.
After Batch A (confident prefix renames) + Batch B
(orphan-neutralization): 3 intentional self-guards remain.

**Fix shapes (in order of preference):**

1. **Prefix rename.** `feedback_X.md` actually exists as
   `user_X.md` or `project_X.md` — fix in place.
2. **Orphan-neutralization.** Planned memory never landed.
   Strip the `.md` filename and replace with plain-text
   topic descriptor, e.g. "(topic, no dedicated memory
   file)". This removes the parseable pattern while
   preserving the semantic cross-link.
3. **Intentional self-guard.** Line explicitly conditions
   on `(if present)` / `(if it exists)` — leave as-is;
   the file is modelling its own discipline.

## Repo-level audit

**Surface:** `docs/**/*.md` (repo working copy).

**Target pattern:** backticked ``` `X.md` ``` paths; filter
out auto-memory naming, `YYYY-MM-DD` placeholders, and
`-NN-` template segments.

```bash
cd <repo-root> && python3 <<'EOF'
import os, re, pathlib
repo = pathlib.Path('.').resolve()
existing = {str(p.resolve().relative_to(repo))
            for p in repo.rglob('*')
            if p.is_file() and '/.git/' not in str(p)}
bare = {}
for rel in existing:
    bare.setdefault(os.path.basename(rel), []).append(rel)
pat = re.compile(r'`([a-zA-Z0-9_./\-]+?\.md)`')
MEM = re.compile(r'^(user|feedback|project|reference)_')
def excluded(r):
    if 'YYYY' in r or '-NN-' in r or '-NN.' in r or '/NN-' in r: return True
    if r.startswith(('http', 'memory/')) or r == 'MEMORY.md': return True
    bn = os.path.basename(r)
    return bn == r and MEM.match(bn) is not None
broken = {}
for p in (repo / 'docs').rglob('*.md'):
    text = p.read_text(errors='replace')
    dead = []
    for r in set(pat.findall(text)):
        if excluded(r): continue
        if r in existing or r.lstrip('./') in existing: continue
        try:
            if str((p.parent / r).resolve().relative_to(repo)) in existing: continue
        except (ValueError, OSError): pass
        bn = os.path.basename(r)
        if bn == r and bn in bare: continue
        dead.append(r)
    if dead: broken[str(p.relative_to(repo))] = sorted(set(dead))
total = sum(len(v) for v in broken.values())
print(f"{len(broken)} files, {total} dead pointers")
for p, dead in sorted(broken.items(), key=lambda kv: -len(kv[1]))[:20]:
    print(f"--- {p}  ({len(dead)})")
    for d in dead[:10]: print(f"  {d}")
EOF
```

**2026-04-22 baseline:** 151 dead pointers across 52 doc
files. Top concentrations:

- `docs/BACKLOG.md` — 43 (majority are in-flight
  restructure placeholders per ADR
  `2026-04-22-backlog-per-row-file-restructure.md`; not
  truly orphaned, just not yet landed)
- `docs/ROUND-HISTORY.md` — 16 (historical round entries
  pointing at files that moved/renamed; historical
  narrative, edit-caution applies)
- `docs/AGENT-GITHUB-SURFACES.md` — 7 (future history
  files: `hygiene-history/discussions-history.md`,
  `pages-history.md`, etc. — not yet created)
- `docs/FACTORY-HYGIENE.md` — 5 (similar pattern)

**Interpretation rules:**

- **In-flight restructure placeholders** — a dead pointer
  citing a file that an ADR names as a planned outcome is
  NOT a bug. Don't fix by rewriting the pointer; fix by
  landing the restructure.
- **Historical-narrative dead pointers** —
  `docs/ROUND-HISTORY.md` entries intentionally preserve
  the state of the round they describe. Edit with caution
  per GOVERNANCE §2 (historical narrative).
- **Genuine orphan** — the pointer names a file that was
  never planned, never landed, and has no ADR behind it.
  This is the real signal. Fix via prefix rename or
  orphan-neutralization (same two shapes as the memory-
  level audit).

## When to run

- **Every 5-10 rounds** as speculative hygiene (fits the
  `skill-tune-up` cadence, same cadence class as
  persona-notebook prune).
- **After any large restructure** (BACKLOG-per-row,
  round-history rollover, skill-directory reshuffle) —
  these are when dead pointers appear in clusters.
- **Before a skill-library scan** — the ranker uses
  cross-references; dead ones degrade signal.

## When NOT to bulk-fix

- **In auto mode without explicit commit-ask.** The
  memory-level audit edits local-only Claude state and
  is safe to apply directly. The repo-level audit edits
  shared-history files and requires Aaron's ask before
  a fix pass is committed.
- **During an in-flight restructure.** Running mid-
  restructure produces false positives that cost more
  to triage than to skip.

## Cross-references

- `reference_skill_vocabulary_usage_scan_2026_04_22.md`
  — parallel precedent for a "scan script encoded as a
  reference memory" pattern; the two together demonstrate
  that cheap Python one-liners make good reference
  memories when they're reusable and interpretable.
- The kernel-domain vocabulary work
  (`feedback_kernel_vocabulary_propagation_is_belief_propagation_infer_net_memetic_mimetic.md`)
  creates new kernel terms whose adoption the skill-
  library scan measures; dead-pointer audit is the
  structural analogue at the doc-surface layer.
- The verify-before-deferring rule (CLAUDE.md §ground-
  rules + `feedback_verify_target_exists_before_deferring.md`)
  is the *preventive* discipline; this audit is the
  *detective* counterpart for dead pointers that slip
  through.

## What this memory does NOT do

- It does **not** commit anyone to a repo-level fix pass.
  The 151 dead repo pointers are documented for triage,
  not queued for action.
- It does **not** replace the existing hygiene-history
  cadence — it supplements with a specific tool.
- It does **not** supersede the human sign-off required
  for repo-level edits under the only-commit-when-asked
  rule (CLAUDE.md).
