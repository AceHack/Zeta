---
id: B-0272
zetaid: 081KR2E4K0008QG0R001QZDAMQ
priority: P1
status: closed
title: "Atari 2600 ROM canonical naming via TOSEC/No-Intro hash lookup"
created: 2026-05-08
last_updated: 2026-05-16
closed: 2026-05-16
parent: B-0083
depends_on: []
classification: buildable-now
decomposition: atomic
type: friction-reducer
---

# B-0272 — ROM canonical naming

Hash each ROM file, look up in TOSEC/No-Intro DAT files,
rename to canonical form. TS script at tools/roms/.

## Pre-start checklist

- [x] Prior-art search: checked `tools/roms/` (empty), grepped for
  TOSEC/No-Intro/canonicalize across repo (no existing TS tooling),
  read parent B-0083 algorithm section and tooling design.
- [x] Dependency walk: parent B-0083 (decomposed umbrella),
  sibling B-0273 (depends on this item), no other deps.
- [x] Datfile format: Logiqx XML used by both TOSEC and No-Intro;
  `<rom name="..." sha1="..." />` is the match surface.

## Acceptance criteria

- Script at tools/roms/canonicalize.ts
- Renames ROMs to TOSEC canonical names
- Reports unmatched hashes

## Resolution (2026-05-16)

Closing as **PURE DRIFT** (class #1) per row-close gate triage (step-0 discriminator from PR #3757). All 3 acceptance items verifiably shipped:

| Acceptance | Status |
|---|---|
| Script at `tools/roms/canonicalize.ts` | shipped (8953 bytes) |
| Renames ROMs to TOSEC canonical names | shipped — `renameSync` import + match-and-rename loop; comment: "renames matched files to their canonical names" |
| Reports unmatched hashes | shipped — output schema includes `{ file, sha1, matched, canonicalName, renamed }` per the file header comment; unmatched-hash filter is the natural reporting surface |

Provenance:

- Initial impl + 3 follow-up fix PRs shipped 2026-05-09: PRs [#2166](https://github.com/Lucent-Financial-Group/Zeta/pull/2166), [#2168](https://github.com/Lucent-Financial-Group/Zeta/pull/2168), [#2172](https://github.com/Lucent-Financial-Group/Zeta/pull/2172)
- TOSEC + No-Intro both supported via Logiqx XML parser (`<rom name="..." sha1="..." />`)
- `--apply` flag distinguishes report-only from rename-applied modes

Row left open from 2026-05-09 to 2026-05-16 (7 days). Caught by `tools/hygiene/audit-backlog-status-drift.ts` (peer Otto-Desktop's PR #3758) flagging `tools/roms/canonicalize.ts` as drift candidate; per-acceptance-criterion verification confirmed pure-drift.

This is the **10th pure-drift close** of the session-resume sequence (B-0272 follows B-0506, B-0530, B-0535, B-0494, B-0159, B-0528, B-0045.1, B-0046.1, B-0049.1).
