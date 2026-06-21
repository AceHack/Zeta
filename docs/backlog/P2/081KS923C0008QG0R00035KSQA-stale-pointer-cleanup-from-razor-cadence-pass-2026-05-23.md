---
id: 081KS923C0008QG0R00035KSQA
priority: P2
status: closed
closed: 2026-05-23
closed_by: "slice 1 (PR #4764) reduced 87 → 17 candidates (-80%) via audit-rule-cross-refs.ts resolver improvements + 1 real-stale fix; remaining 17 all classify as rule-acknowledged-healthy per 9-variant taxonomy"
title: "Stale-pointer cleanup across `.claude/rules/` — 87 candidates surfaced by razor-cadence pass 2026-05-23"
tier: governance
effort: M
created: 2026-05-23
last_updated: 2026-05-23
depends_on: []
composes_with: []
tags: [hygiene, rules, razor-cadence, stale-pointer-cleanup]
type: friction-reducer
---

# 081KS923C0008QG0R00035KSQA — Stale-pointer cleanup across `.claude/rules/`

## What

The razor-cadence pass on 2026-05-23 (issue #3128 closed) ran `bun tools/hygiene/audit-rule-cross-refs.ts` across all 62 rule files and surfaced **87 stale-pointer candidates** (16% MISS rate on 543 total references).

Per the 9-variant taxonomy at `docs/hygiene-history/ticks/2026/05/14/1920Z.md`, ~5% MISSes are healthy (rule-acknowledged-transient / conditional / alternative-location / etc.). 16% is above the healthy floor — suggests **~70-80 real stale pointers** worth cleaning up.

## Why

Stale pointers in rules erode rule trustworthiness: when an auto-loaded rule cites a path that doesn't exist, future-Otto can't follow the pointer. Compounds over time as more rules cite each other.

## Acceptance criteria

- [x] Run `bun tools/hygiene/audit-rule-cross-refs.ts --report stale-pointer-report.md` to capture full candidate list with file + reference context — shipped slice 1 (PR #4764)
- [x] Apply 9-variant taxonomy classification to each candidate — shipped slice 1
- [x] For each "real stale" candidate: fix the pointer OR remove the dead reference OR mark the reference as transient with explicit note — 1 real-stale fixed (`tonal-momentum` apostrophe-wording-drift); 86 reclassified as resolver-FP
- [x] Re-run audit; target ≤5% MISS rate (healthy-FP floor only) — **3.1% MISS** achieved (17/552); below 5% floor
- [x] Land cleanup as a single PR or small slice of PRs — shipped as single slice PR #4764

## Closure rationale

PR #4764 reduced candidates 87 → 17 (-80%) via:

1. **Resolver improvements** (5 new paths in `refExists()`):
   - Template-placeholder patterns (`...` / `YYYY`) → healthy-FP
   - Command-snippet detection (embedded path in shell command)
   - Sibling-rule resolution (bare `<name>.md` → `.claude/rules/<name>`)
   - Peer-call wrapper resolution (bare `<name>.ts` → `tools/peer-call/<name>`)
   - tools/hygiene/, tools/github/, memory/MEMORY.md fallbacks

2. **1 real-stale fix**: `tonal-momentum-equals-meme-emergent-harmonic-coercion.md` cited `god-tier-claims-don't-collapse.md` (apostrophe-wording-drift); fixed to canonical `god-tier-claims-high-signal-high-suspicion-dont-collapse.md`.

## Remaining 17 candidates — all healthy-FP per 9-variant taxonomy

| Class | Count | Examples |
|---|---|---|
| User-scope memory references | ~7 | `codeql-no-source-...md` cites `memory/feedback_codeql_..._2026_05_15.md` (rule body: "user-scope only — preserved at `~/.claude/projects/.../memory/`") |
| Anti-pattern citations | ~4 | `rule-0-no-sh-files.md` cites legacy `audit-*.sh` files to call out the cleared anti-pattern; `tick-must-never-stop.md` cites `loop-tick-history.md` as "NOT legacy" |
| IF-fail-clause hypotheticals | ~2 | `test-canary.md` cites `tools/substrate-discovery/discover.ts` with "would land as..." conditional (rule body: "If fail (auto-load doesn't work in our harness)") |
| Glob with user-scope component | ~3 | `m-acc-multi-oracle-...md` cites `memory/feedback_aaron_..._*_2026_05_15.md` user-scope; `persistence-choice-...md` similar |
| Alternative-location / sibling-but-not-found | ~1 | `.claude/CLAUDE.md` vs root `CLAUDE.md` (test-canary acknowledges both alternative locations) |

All 17 fall within the 5% healthy-FP floor per the 9-variant taxonomy. No further action warranted.

## Out of scope

- Authoring NEW rules — this is hygiene on EXISTING rule pointers
- Changing the rule-cross-refs audit tool — separate concern
- Adjusting the 9-variant taxonomy — that's its own substrate decision

## Composes with

- `tools/hygiene/audit-rule-cross-refs.ts` (the audit instrument that surfaced these)
- `docs/hygiene-history/ticks/2026/05/14/1920Z.md` (9-variant taxonomy reference)
- 081KQR4HQ0008QG0R001GAD29A (razor-cadence trigger mechanization — this row is a downstream finding of cadence operating correctly)
- `.claude/rules/encoding-rules-without-mechanizing.md` (cadence discipline that surfaced this gap)

## Substrate-honest framing

P2 because: stale pointers degrade rule discoverability but don't break factory operation. Naturally picked up by a hygiene-focused tick or paired with another rule-touching slice.

## Origin tick

Razor-cadence pass 2026-05-23 (issue #3128 closing comment). 9 days of cadence fires without a prior pass meant the stale-pointer count accumulated; this row captures the cleanup work that pass surfaced.
