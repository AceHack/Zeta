---
id: 081M26EV2K8087G0R001Z1FG08
type: task
state: backlog
priority: P2
slug: codeql-cli-is-a-pinned-first-class-dependency-with-a-one-com
title: "codeql cli is a pinned first-class dependency with a one-command local reproduce wrapper"
created: 2026-09-10T20:06:12.840Z
depends_on: []
composes_with: []
---

# codeql cli is a pinned first-class dependency with a one-command local reproduce wrapper

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M26EV2K8087G0R001Z1FG08-*.md` glob. -->

## Why

Maintainer, 2026-09-10: *"codeql is something we should also install with our
install.sh and our github package manager."*

The measurement behind it: a PR spent **six round-trips** failing on CodeQL alerts,
each round a guess at what the analyser would accept, because CI was the only feedback
loop. The CLI reproduces the same alerts in about fifteen seconds. A CodeQL CLI was
already sitting at `~/.zeta/codeql-cli` on the maintainer's machine — downloaded ad hoc
by an agent, pinned by nothing, present on one host. That is the exact state this repo's
dependency discipline exists to prevent.

## What landed

1. **`from-zip`** — a new install mechanism: pinned per-platform release ZIP → extracted
   directory (+ optional PATH shim). `from-url` can download one file to one path and
   never unpack, which `tools/setup/manifests/windows` had already recorded as a blocker
   for the YubiHSM2 SDK. Every row carries a mandatory digest, a mandatory `opt-in=`, and
   a `tier=`; a re-run is decided by a `<dest>/.zeta-from-zip.json` receipt, so a moved
   pin reaches the machine and a hand-placed tree is re-installed rather than adopted.
2. **Four digest-pinned CodeQL v2.27.0 rows** (osx64 / linux64 / linux-arm64 / win64),
   each digest cross-checked against three independent publications of the release.
3. **`run-codeql.ts`** — the wrapper. `bun src/Core.TypeScript/formal-verification/run-codeql.ts <paths>`
   builds a database scoped to those paths and runs the same suite CI runs, printing
   `rule  file:line  message`. Exit 0 / 1 / 2 keeps "found nothing" apart from "never ran".
4. **A both-ways falsifier** over the committed fixtures: the unguarded pair reports
   `js/file-access-to-http`, the guarded pair is silent, and two real SARIF documents are
   committed as text golden vectors so tier 1 runs with no CLI present.

## Deliberately NOT in scope

- CodeQL is **not** a required CI check and no ruleset or branch protection is touched.
- No `paths-ignore`, no dismissal, no rule disabled.
- **No model-pack path.** Measured in #17253: data extensions (`barrierModel`, `sinkModel`)
  do not affect what a BUILT-IN query reports, through any delivery route. The wrapper's
  value is REPRODUCTION, not customisation.

