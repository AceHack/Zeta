---
id: B-0086
priority: P2
status: open
title: Port tools/hygiene Python scripts to TypeScript/Bun (factory-default; AI/ML carve-out applies)
tier: factory-tooling
effort: M
ask: maintainer Aaron 2026-04-28T19:56Z (TypeScript/Bun-as-default substrate framing)
created: 2026-04-28
last_updated: 2026-04-28
composes_with:
  - B-0061
tags: [aaron-2026-04-28, typescript, bun, factory-default, language-discipline, port-candidate]
---

# B-0086 — Port `tools/hygiene/` Python scripts to TypeScript/Bun

## Source

Aaron 2026-04-28T19:56Z verbatim (during autonomous-loop tick
right after `sort-tick-history-canonical.py` was used to fix a
chronological-order lint failure on PR #684):

> *"sort-tick-history-canonical.py eventually we are going to use
> the typescript like ../scratch unless this is AL/ML AND is a
> better fit for python? typescript/bun being our default, we
> need to decide when to step out on typescript carefully."*

Substrate captured durably in
`memory/feedback_typescript_bun_default_step_out_carefully_aaron_2026_04_28.md`.

## Scope

Port the following non-AI/ML Python scripts under `tools/` to
TypeScript on Bun, following the existing pattern at
`tools/invariant-substrates/tally.ts` (script entry in root
`package.json` under `scripts:`):

- `tools/hygiene/sort-tick-history-canonical.py` — canonical
  chronological sort + dedupe of `docs/hygiene-history/loop-tick-history.md`.
  Pure markdown/string manipulation; trivial Bun port.
- `tools/hygiene/fix-markdown-md032-md026.py` — markdown
  formatting fixes (MD032 + MD026 rules). Pure string/regex
  manipulation; trivial Bun port.
- (Audit other `tools/**/*.py` per future review pass.)

## Deferred — port doesn't have to be immediate

Per Aaron's framing *"we need to decide when to step out on
typescript carefully"*, the discipline applies to:

1. **All NEW tooling**: default to TypeScript/Bun.
2. **Existing Python tooling**: port when changes are substantive;
   leave alone otherwise (rewrite churn isn't free).

This row tracks the **port-when-it-makes-sense** plan.
Triggering events that make it "make sense":

- Python script needs a substantive feature add (port instead of
  extend).
- Python toolchain breaks on a contributor's machine (port to
  remove the cross-toolchain dependency).
- Audit pass identifies enough small Python scripts that a
  bundle-port amortizes the work.

## Why P2 (not P0/P1)

- **Existing Python tools work** — no acute breakage; the
  discipline applies forward, not as emergency cleanup.
- **Lint hooks already enforce** — `tools/hygiene/sort-tick-history-canonical.py`
  is invoked from CI lint job; whether it's Python or TypeScript
  doesn't change correctness.
- **Heaviest tooling already TypeScript** — `tally.ts` (the
  invariant-substrate analyzer) is already TypeScript; the
  Python residue is small + scoped.

## Acceptance criteria

- [ ] `tools/hygiene/sort-tick-history-canonical.py` ported to
  `tools/hygiene/sort-tick-history-canonical.ts` (or similar)
  with `package.json` script entry.
- [ ] `tools/hygiene/fix-markdown-md032-md026.py` ported similarly.
- [ ] All callers (CI workflows, pre-commit hooks, manual usage
  in tick-history workflow) updated to invoke the TS version.
- [ ] Python originals deleted (the discipline is consistency,
  not parallel-implementations).
- [ ] One trial round of canonical-sort run via the TS port to
  verify equivalent output on `loop-tick-history.md`.

## Composes with

- `memory/feedback_typescript_bun_default_step_out_carefully_aaron_2026_04_28.md`
  — the substrate this row operationalizes.
- `tools/invariant-substrates/tally.ts` — the existing TypeScript
  pattern to mirror.
- `package.json` — root scripts entry point + `bun@1.3.13` pin.
- B-0061 (per-row backlog migration) — same shape of "incremental
  migration with discipline applied to NEW work + opportunistic
  port on existing".

## What this is NOT

- **NOT a port-all-Python directive.** AI/ML scripts (if any
  exist or are added later) keep Python per the carve-out.
- **NOT urgent factory-fitness work.** P2 reflects the
  do-when-substantive cadence, not "ship next round".
- **NOT a TypeScript-everywhere-in-Zeta directive.** F# is the
  language for the Zeta library proper; TypeScript is the
  language for tooling around it. Two-tier choice.

## Pickup notes for future-Otto

When picking this up:

1. Read the substrate memory first for the discipline framing.
2. Start with `sort-tick-history-canonical.py` (smaller surface,
   pure markdown manipulation, has a CI lint job that exercises
   it — easy to verify equivalence).
3. Mirror the `tally.ts` pattern for `package.json` scripts +
   tsconfig + bun-test setup.
4. Verify lint job continues passing on PR with the port.
5. Delete the Python original in the same PR (avoid parallel
   implementations).
