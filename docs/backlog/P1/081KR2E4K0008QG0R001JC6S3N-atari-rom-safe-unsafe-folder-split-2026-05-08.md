---
id: 081KR2E4K0008QG0R001JC6S3N
priority: P1
status: closed
title: "Atari 2600 ROM safe/unsafe folder split for license compliance"
created: 2026-05-08
last_updated: 2026-05-29
closed: 2026-05-29
parent: 081KQ8P5D0008QG0R001590WJ3
depends_on: [081KR2E4K0008QG0R001QZDAMQ]
classification: buildable-now
decomposition: atomic
type: friction-reducer
---

# 081KR2E4K0008QG0R001JC6S3N — ROM safe/unsafe split

After canonical naming, split ROMs into:

- safe/ (homebrew, public domain, explicitly licensed)
- unsafe/ (commercial, gitignored)

## Acceptance criteria

- safe/ folder not gitignored, checked in
- unsafe/ folder gitignored
- README documents which ROMs are safe to distribute

## Resolution (2026-05-29)

Closing as **PURE DRIFT** (class #1) per the `backlog-item-start-gate.md`
step-0 substrate-drift discriminator. The dependency 081KR2E4K0008QG0R001QZDAMQ closed
2026-05-16; this row's `classification` was never updated off the stale
`blocked-on-081KR2E4K0008QG0R001QZDAMQ`. All 3 acceptance items verifiably shipped:

| Acceptance | Status |
|---|---|
| safe/ folder not gitignored, checked in | shipped — `roms-safe/README.md` + `roms-safe/atari/2600/README.md` tracked; the gitignore at `roms/.gitignore` governs only `roms/`, so `roms-safe/` is checked in by default |
| unsafe/ folder gitignored | shipped — `roms/` stays gitignored via the existing depth-limited rule (`*` + `!*/` + sentinel re-includes); only README sentinels tracked |
| README documents which ROMs are safe to distribute | shipped — `roms-safe/README.md` explains the split; `roms-safe/atari/2600/README.md` carries a per-ROM table (canonical name, author, license class, citation) for 7 homebrew titles |

Provenance:

- All artifacts shipped via PR [#5874](https://github.com/Lucent-Financial-Group/Zeta/pull/5874)
  (`feat(roms): Add tooling for safe/unsafe ROM split (081KR2E4K0008QG0R001JC6S3N)`),
  merged 2026-05-29T10:08:47Z at `75802ccb528ad57b61b0c9f87c191b773d2f08b8`.
- Tooling beyond the 3 acceptance items also landed in the same PR:
  `tools/roms/split-by-license.ts` (+ `.test.ts`, allowlist-driven,
  report-only by default with `--apply`) and
  `tools/roms/manifests/atari-2600-allowlist` (one canonical filename per
  line, per-ROM license citation in comments).
- `split-by-license.ts` header comment self-identifies: "Part of 081KR2E4K0008QG0R001JC6S3N."

Implementation-PR (#5874) shipped the code but left this row `status: open`
— the implementation-doesn't-close-the-row drift pattern that the step-0
discriminator catches. Mirrors sibling 081KR2E4K0008QG0R001QZDAMQ's pure-drift close (closed
2026-05-16). Verification: existence-check of all 4 artifacts on `origin/main`,
a `git merge-base --is-ancestor` check confirming #5874's merge commit reachable,
and a per-acceptance-criterion read of the tracked READMEs and `roms/.gitignore`.
