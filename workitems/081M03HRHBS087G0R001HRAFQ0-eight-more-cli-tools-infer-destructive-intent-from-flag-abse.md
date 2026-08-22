---
id: 081M03HRHBS087G0R001HRAFQ0
type: bug
state: backlog
priority: P2
slug: eight-more-cli-tools-infer-destructive-intent-from-flag-abse
title: "Eight more CLI tools infer destructive intent from flag absence and do not fail closed on unknown args"
created: 2026-08-15T20:28:08.441Z
depends_on: []
composes_with: []
---

# Eight more CLI tools infer destructive intent from flag absence and do not fail closed on unknown args

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M03HRHBS087G0R001HRAFQ0-*.md` glob. -->

## The class

`rebuild-legacy-b-id-aliases.ts` derived its mode from flag **absence** —
`DRY_RUN = process.argv.includes("--dry-run")` — so `--help`, a flag it did not have,
meant *go*, and a ~1,700-file rewrite of the repo began (PR #10832; killed before any
file changed). That instance is fixed: dry-run is now the default, `--write` is the
opt-in, and an unrecognised argument exits 2 before any write.

A scan of `src/Core.TypeScript/**` for the same shape — a module-scope
`… = argv.includes("--dry-run")` guarding a destructive action — found **eight more**.
None is fixed here; changing them is not a drive-by, for the reason each row gives.

## The two properties, and which one applies where

1. **Fail closed on unknown args.** Applies to **all eight**. None has an unknown-arg
   branch, so every one of them treats a typo as consent.
2. **Destructive mode must be named, not inferred from absence.** Applies to the ones
   whose *purpose* is not writing. It deliberately does **not** apply to `run-tier0` or
   `mutation-runner`: writing is what a healer and a mutator are for, and they are
   invoked bare from cron on purpose. Flipping their default would break
   `agent-heartbeat.yml`, so for those two the ask is property 1 only.

## The eight

| tool | what a stray flag buys | both properties, or only (1)? |
|---|---|---|
| `src/Core.TypeScript/hygiene/healers/run-tier0.ts` | rewrites markdown across the repo, bounded by `--max-files` | **(1) only** — invoked bare by `agent-heartbeat.yml:124` by design |
| `src/Core.TypeScript/hygiene/mutation-runner.ts` | writes a mutant into a source file, restores at line 271 — a crash between leaves the mutant in tree | **(1) only** — invoked by `agent-heartbeat.yml:257` by design |
| `src/Core.TypeScript/migrations/b0266-review-policy-ruleset.ts` | creates/updates **GitHub rulesets** live and re-snapshots `expected.json` | both |
| `src/Core.TypeScript/migrations/b0267-safety-ruleset.ts` | same, and can **DELETE** the Default ruleset | both |
| `src/Core.TypeScript/migrations/b0267-branch-safety-ruleset.ts` | same class | both |
| `src/Core.TypeScript/ops/setup-dual-background-agents.ts` | writes launchd plists and calls `launchctl` on the operator's machine | both |
| `src/Core.TypeScript/zflash/flash-usb-windows.ts` | **flashes a USB device.** Has `--help`, but no unknown-arg rejection; needs a positional device + admin, which is the only thing standing between a typo and a wiped disk | both |
| `src/Core.TypeScript/observe/backfill-tick-shards.ts` | backfills tick shards (`main(argv)`, no direct `writeFileSync` — delegated; confirm the write path before fixing) | both, pending that confirmation |

Checked and **excluded** as not this defect:
`src/Core.TypeScript/forge-host/github/create-branch-safety-ruleset.ts` — absence of `--dry-run` reaches
`ERROR: live mode not implemented` and exits non-zero. Safe, though by accident of an
unimplemented feature rather than by a guard.

## Why a row and not a sweep

The three ruleset migrations mutate **branch protection** on a live repo; `zflash`
writes a block device. Each needs its own read of what a bare invocation currently
does for real callers before its default is flipped, and `run-tier0` /
`mutation-runner` are on the heartbeat's critical path. A single sweeping change here
would be exactly the un-metered blast radius the class is about.

## The mechanical check that already exists

`src/Core.TypeScript/hygiene/audit-workflow-cli-flags.ts` (from `081M005VXY6087G0R001T04ATY`) statically
refuses a workflow that passes a flag a tool rejects — but **only for tools whose
parser demonstrably rejects unknown flags**, detected by an `unknown arg` diagnostic in
the source. So every tool in the table above is currently *skipped* by that audit: the
absence of a guard also buys exemption from the lint that would police it. Fixing
property 1 enrols each tool in a check that already exists, which is most of the value.

A follow-on worth considering: a lint that fails when a module-scope
`argv.includes("--dry-run")` guards a write and no unknown-arg branch exists — i.e.
make the class fail rather than the instances.

## Anchors

- `081M005VXY6087G0R001T04ATY` — the sibling already fixed: a workflow passed `--batch`
  to a tool that rejects it, the exit code was pipe-masked, and the step reported
  success while doing nothing for six weeks.
- PR #10832 — where this instance was found, and whose author reported it against
  themselves.
- `.claude/rules/dv2-data-split-discipline-activated.md` §7 noninterference — a mode
  change is influence, and it must arrive through a declared channel rather than be
  inferred from what is missing.
