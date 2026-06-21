---
id: 081KR2E4K0008QG0R001QZDAMQ
priority: P1
status: closed
title: "Atari 2600 ROM canonical naming via TOSEC/No-Intro hash lookup"
created: 2026-05-08
last_updated: 2026-05-16
closed: 2026-05-16
parent: 081KQ8P5D0008QG0R001590WJ3
depends_on: []
classification: buildable-now
decomposition: atomic
type: friction-reducer
---

# 081KR2E4K0008QG0R001QZDAMQ — ROM canonical naming

Hash each ROM file, look up in TOSEC/No-Intro DAT files,
rename to canonical form. TS script at tools/roms/.

## Pre-start checklist

- [x] Prior-art search: checked `tools/roms/` (empty), grepped for
  TOSEC/No-Intro/canonicalize across repo (no existing TS tooling),
  read parent 081KQ8P5D0008QG0R001590WJ3 algorithm section and tooling design.
- [x] Dependency walk: parent 081KQ8P5D0008QG0R001590WJ3 (decomposed umbrella),
  sibling 081KR2E4K0008QG0R001JC6S3N (depends on this item), no other deps.
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

This is the **10th pure-drift close** of the session-resume sequence (081KR2E4K0008QG0R001QZDAMQ follows 081KRHWGX0008QG0R002DPG02X, 081KRMEXM0008QG0R000X1PPGC, 081KRMEXM0008QG0R000HHAG77, 081KRHWGX0008QG0R0029WA0HQ, 081KQGDBJ0008QG0R003H0G5YQ, 081KRMEXM0008QG0R000T0A28T, 081KR50HA0008QG0R001Q071YY, 081KR7JY10008QG0R0018VG28R, 081KR50HA0008QG0R00257PHRR).
