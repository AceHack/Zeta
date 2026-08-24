---
id: 081M0QJWD89087G0R001FSQJP5
type: task
state: backlog
priority: P2
slug: src-core-python-has-no-tool-ruff-config-so-the-lint-rule-set
title: "src/Core.Python has no [tool.ruff] config, so the lint rule set drifts with the tool — ruff 0.16.4 turns 0 findings into 65"
created: 2026-08-23T15:12:32.521Z
depends_on: []
composes_with: []
---

# src/Core.Python has no [tool.ruff] config, so the lint rule set drifts with the tool — ruff 0.16.4 turns 0 findings into 65

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QJWD89087G0R001FSQJP5-*.md` glob. -->

## Measured (2026-08-23, against `main` at 7372aa25)

`src/Core.Python/pyproject.toml` declares `[project]`, `[tool.hatch.build.targets.wheel]`,
`[build-system]` and `[dependency-groups]`. It declares **no `[tool.ruff]`**. So `ruff check`
runs with whatever ruff's built-in default rule set is on the day it runs.

Ran against this tree, same files, same invocation:

| ruff | result |
| --- | --- |
| `0.15.17` (the pin) | `All checks passed!` |
| `0.16.4` (latest)   | **`Found 65 errors.`** |

Sample of what 0.16 turns on by default: `I001` (import block un-sorted), `RUF022`
(`__all__` not sorted), `PLC0105` (`TypeVar` name does not reflect its variance — it asks
for `A` -> `A_contra`, `B` -> `B_co`).

## Why this is a defect and not just "we are behind"

A pinned tool with an unpinned RULE SET is the lint equivalent of an unpinned dependency.
The version number in `.mise.toml` looks like it makes the behaviour reproducible and does
not: the pin freezes the binary, and the binary's defaults are what actually decide what
passes. Any patch-looking bump can therefore move the tree from clean to 65 findings, which
is exactly what happened, and nothing about the version delta signals it.

This also composes with a second finding from the same sweep: **nothing runs ruff in CI.**
`grep -rln "ruff\|mypy\|golangci-lint" .github/workflows/` returns one file and it is the
WSL install test. So the 65 findings would not redden the gate — they would just be there,
locally, for whoever ran the tool, which is how a policy change becomes invisible. Same
class as `081M05E39F7087G0R002F00H6Q` (a check provisioned everywhere and wired to nothing).

## What it will take (sizing)

**Small-to-medium, and the order matters.**

1. **Declare `[tool.ruff]` explicitly** — `target-version`, and an explicit `lint.select`
   rather than the implicit default. This is the actual fix; after it, a ruff bump is a
   bump.
2. **Then** bump ruff and fix whatever the declared rule set reports. 44 of the 65 are
   `--fix`-able; the residue is `PLC0105`, which is a **TypeVar rename across
   `src/Core.Python`** — and that is a byte-lock oracle, so the four-oracle vectors must be
   re-verified in the same change. Do not `--fix --unsafe-fixes` an oracle and assume.
3. Decide, separately, whether ruff should gate at all. Pinning a linter that never runs is
   a cost with no falsifier attached.

## Held, deliberately

The ruff bump was in hand during the 2026-08-23 currency sweep and was **reverted** rather
than shipped, with the measurement recorded beside the pin in `.mise.toml`. `uv`, `mypy`
and `golangci-lint` moved in that sweep because each measured diagnostic-identical at both
versions; ruff did not, so it was held. A bump that lands unverified is the same shape as a
check that did not run.

## Composes with

- `081M0Q9Y66W087G0R003115PN3` — the mise toolchain currency umbrella (this is the ruff row).
- `081M05E39F7087G0R002F00H6Q` — a check that is provisioned but unwired.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — an unmetered tool is not "real" by default.
