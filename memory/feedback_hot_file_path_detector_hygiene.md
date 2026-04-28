---
name: Hot-file-path detector is its own hygiene class — high-churn files are refactor signals
description: Aaron 2026-04-21 — hot git file paths need a periodic detector; high churn = merge-conflict hazard + refactor candidate. The detector is just `git log --name-only | sort | uniq -c | sort -rn`.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Files with unusually high git churn are **refactor signals**, not
just activity. When a file sits at the top of a commit-count
ranking and is also a frequent merge-conflict source, that's
structural pressure asking for a split / reshape (per-row files,
per-round files, extraction of a hot section, etc.).

**Why:** Aaron 2026-04-21, immediately after the PR #31 5-file
merge-tangle and my `docs/ROUND-HISTORY.md` 324→365 recovery:
*"hot file path detector probably needs refactor if we find hot
git file paths as we just noticed, another hygene"* and *"detecting
hot files i wonder if you can just use git history for that and see
what changes the most"*. Confirmed pattern: `docs/ROUND-HISTORY.md`
at 33 changes / 60 days is the #1 conflict-prone hot file;
`docs/BACKLOG.md` at 26 already has an in-flight split ADR for the
same reason.

**The detector (one command):**

```bash
git log --since="60 days ago" --name-only --pretty=format: \
  | grep -v '^$' | sort | uniq -c | sort -rn | head -25
```

Cheap, deterministic, zero dependencies, cadenced. No index needed;
git history *is* the index.

**Empirical ranking at time of landing (60-day window, 2026-04-21):**

1. `docs/ROUND-HISTORY.md` — 33 (merge-tangle source; per-round-file
   split candidate, same pattern as BACKLOG ADR).
2. `docs/BACKLOG.md` — 26 (ADR in-flight at
   `docs/DECISIONS/2026-04-22-backlog-per-row-file-restructure.md`).
3. `docs/VISION.md` — 14.
4. `docs/CURRENT-ROUND.md` — 13.
5. `docs/WINS.md` — 11.
6. `docs/DEBT.md` — 10.
7. `docs/security/THREAT-MODEL.md` — 8.
8. `.claude/skills/round-management/SKILL.md` — 8.

**How to apply:**

- **Cadence:** round-cadence (every round close) or every 5-10
  rounds — whichever catches drift before the next merge-tangle.
- **Decision output per hot path:** one of four — `refactor-split`
  (per-row, per-round, per-section), `consolidate-reduce` (merge
  with another doc to reduce churn across both), `accept-as-
  append-only` (some files should churn — ROUND-HISTORY may be
  legitimately append-only, so split into per-round files rather
  than trimming), or `observe` (threshold not yet reached).
- **Threshold heuristic (tentative):** >20 changes in 60d on a
  single monolithic doc = investigate; >30 = refactor candidate.
  Tune after 5-10 rounds of observation.
- **Pair with merge-tangle fingerprints.** A hot file is worse if
  it's also in a recent merge-conflict list (PR #31's 5-file
  fingerprint). Cross-reference against `docs/research/parallel-
  worktree-safety-2026-04-22.md` §9 incident log.
- **The hygiene is additive, not destructive.** Don't delete hot
  files; refactor them. Retaining history / semantics is non-
  negotiable (per preserve-original-and-every-transformation).

**Relation to existing hygiene rows:**

- Row #22 (symmetry-opportunities audit) is a sibling meta-audit —
  both sweep the repo for structural pressure and propose
  reshapes. This detector targets churn-pressure specifically.
- Row #23 (missing-hygiene-class gap-finder) predicted this class;
  this row is one of its first downstream products.
- Overlaps with but does not replace `docs/FACTORY-HYGIENE.md`
  rows that track per-doc health (notebook cap, etc.) — those are
  per-agent; this is per-doc.

**Scope:** `factory` — hygiene applies to factory docs first. Ships
to adopters via the command-line recipe (any repo can run the same
`git log` against its own tree); recommended template cadence.
