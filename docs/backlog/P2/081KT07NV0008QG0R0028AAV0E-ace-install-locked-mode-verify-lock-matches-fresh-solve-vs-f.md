---
id: 081KT07NV0008QG0R0028AAV0E
priority: P2
status: closed
title: Ace `ace install --locked` — verify the lock matches a fresh solve (cargo --locked vs --frozen distinction; deferred from slice 5.3)
effort: S
ask: operator 2026-06-01
created: 2026-06-01
last_updated: 2026-06-01
depends_on:
  - 081KR2E4K0008QG0R002YE3MMD
composes_with: []
tags: [ace, package-manager, lockfile, frozen, locked, ci, deferred-enhancement, slice-5.3]
---

## What this row proposes

Slice 5.3 ships **one** flag, `--frozen`: read the lock, skip solving, install exactly the
locked graph from the locked urls/hashes (registry-independent replay). Cargo distinguishes
two modes: `--locked` (solve normally but **fail if the lock would change** — i.e. assert
the committed lock is already up to date) and `--frozen` (`--locked` + `--offline`). This
row tracks adding the **`--locked` assert-up-to-date** mode: run a fresh solve, then refuse
if the resulting graph differs from `./ace.lock` (instead of replaying the lock blind).

## Why deferred (operator 2026-06-01)

`--frozen` (registry-independent replay) is the stronger reproducibility guarantee and the
one slice 5.3 needs first. `--locked` (solve-then-compare) is a CI convenience that catches
"someone forgot to commit the updated lock"; it can land once `--frozen` is proven. One
flag this slice. Operator: *"everything we skipped lets slice off for further enhancements."*

## Scope sketch

- `ace install --locked`: normal solve + resolve, then `buildLockfile(...)` and compare
  (canonical-JSON equality) against the on-disk lock; mismatch → hard refusal naming the
  drift. On match, install proceeds (lock unchanged).
- Clarify the `--locked` vs `--frozen` semantics in the usage text + SKILL.md.

## Composes with

- Slice 5.3 spec: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice5.3-lockfile-design.md`
- 081KR2E4K0008QG0R002YE3MMD (Ace DLC package manager CLI)

## Resolution — shipped by #6416 (slice 5.4)

`ace install --locked` landed in slice 5.4: a fresh solve + `buildLockfile`, then
`lockfilesEqual` (canonical-JSON equality) against the on-disk `./ace.lock`; drift →
hard refusal installing **nothing** (`run ace update`). Mutually exclusive with
`--frozen` (parse-time error). `--locked` on a leaf compares the leaf lock the same
way. Usage text + SKILL.md document the `--locked` vs `--frozen` distinction. Closed.
