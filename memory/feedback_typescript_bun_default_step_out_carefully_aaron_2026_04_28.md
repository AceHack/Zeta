---
name: TypeScript/Bun is the default; step out on TypeScript carefully (Aaron 2026-04-28)
description: Aaron 2026-04-28T19:56Z framing — TypeScript+Bun is the factory's default scripting/tooling language; Python is the carve-out for AI/ML where it's a better fit. Stepping out on TypeScript needs a justified reason (AI/ML primary library availability is the canonical one). Applies to all NEW tooling and to PORT-CANDIDATES on existing Python tooling that has no AI/ML reason to be Python.
type: feedback
---

# TypeScript/Bun is the default — step out carefully

## The rule (Aaron verbatim 2026-04-28T19:56Z)

> *"sort-tick-history-canonical.py eventually we are going to use the
> typescript like ../scratch unless this is AL/ML AND is a better fit
> for python? typescript/bun being our default, we need to decide when
> to step out on typescript carefully."*

## What this codifies

**Default tooling language:** TypeScript on Bun
(`bun@1.3.13` per `package.json`).

**Step-out threshold:** explicit justification — usually
**AI/ML primary library availability** (the canonical reason
for Python: numpy, scipy, scikit-learn, transformers,
ml-frameworks-with-no-bun-equivalent).

**Sibling-repo precedent:** `../scratch` (sibling to Zeta)
runs the same TypeScript+Bun substrate (bun.lock at root,
declarative + docker subdirs). The factory's tooling default
is consistent across sibling repos, not just within Zeta.

## Why

- **Substrate consistency.** Tooling spread across two languages
  doubles the install cost (Python + Bun toolchains), doubles the
  test surface, doubles the dependency-update burden, and forces
  contributors to context-switch.
- **Bun is fast enough for tooling.** Bun startup + execution is
  competitive with Python for the kind of work tooling does
  (markdown manipulation, git invocation, JSON munging, file
  walks). The historic Python advantage (faster prototyping, more
  scripting batteries) has eroded as Bun's stdlib + ecosystem
  matured.
- **AI/ML is the legitimate carve-out.** numpy / pandas / pytorch
  / transformers / scikit-learn are not optional in ML work and
  have no Bun-native equivalents. For ML scripts, Python remains
  correct.

## When to STEP OUT on TypeScript (i.e. write Python or other)

Bar is high. Justify with one of:

1. **AI/ML library is load-bearing** — the script computes against
   `numpy` / `pandas` / `torch` / `transformers` / similar, and a
   pure-TypeScript implementation would re-implement the library.
2. **Existing Python skeleton with deep dependency** — the work is
   a small extension of an existing Python tool that would cost
   more to port than to extend.
3. **One-shot research script that won't outlive the round** —
   ephemeral scratch work where language choice doesn't compound.
4. **Native dependency that's Python-only** — e.g. a vendored CLI
   that ships Python bindings only.

If none of those apply: write TypeScript on Bun.

## When NOT to step out (i.e. default to TypeScript even though
Python feels easier)

- "It's a quick script" — quick scripts compound. Today's
  one-shot is tomorrow's `tools/hygiene/`.
- "I know Python better" — agent fluency is not the criterion;
  factory consistency is.
- "Bash is shorter" — bash is fine for ≤10-line shell glue
  (Otto-235 4-shell discipline still applies); past that,
  TypeScript.
- "Markdown manipulation feels Python-y" — it isn't. Bun has
  excellent string handling + fast file IO; the
  `tools/invariant-substrates/tally.ts` pattern shows the shape.

## Concrete port candidates (existing Python tooling)

Audit `tools/**/*.py` for non-AI/ML scripts that should be
TypeScript:

- `tools/hygiene/sort-tick-history-canonical.py` — markdown
  table sort + dedupe; no AI/ML reason; **B-0086 port candidate**.
- `tools/hygiene/fix-markdown-md032-md026.py` — markdown
  formatting fixes; no AI/ML reason; **also a port candidate**.
- (Audit other `tools/**/*.py` per future review.)

Port doesn't have to be immediate; the discipline is "when these
need substantive changes, port them rather than extending
Python."

## Composes with

- `package.json` — `tally:substrates` script + `bun@1.3.13` pin
  + existing TypeScript tooling pattern at
  `tools/invariant-substrates/tally.ts`.
- `memory/feedback_aaron_visibility_constraint_no_changes_he_cant_see_2026_04_28.md`
  — same tier of substrate-discipline (defaults Aaron sets that
  agents respect without re-litigating each occurrence).
- `memory/feedback_orthogonal_axes_factory_hygiene.md` — language
  choice IS a factory-hygiene axis; pick the default + design
  rules around it.
- `memory/feedback_bash_compatibility_target_four_shells_macos_32_ubuntu_git_bash_wsl_otto_235_2026_04_24.md`
  — adjacent bash discipline (4-shell target for shell scripts);
  TypeScript discipline applies above the shell-glue layer.

## What this is NOT

- **NOT a directive to port everything immediately.** Port when
  changes are substantive; otherwise leave existing Python alone
  until natural rewrite cadence.
- **NOT a ban on Python.** AI/ML legitimately uses Python; the
  carve-out is the carve-out.
- **NOT a TypeScript-vs-everything-else fight.** F# is the
  language for Zeta proper (the library); TypeScript is the
  language for tooling around it. Two-tier choice, not a
  monoculture push.

## Pickup notes for future-Otto

When asked to write a new script:

1. **Default to TypeScript on Bun.** Place under `tools/...`
   with a `package.json` script entry.
2. **If AI/ML library is needed**: Python with a clear
   justification comment at the top of the file naming the
   library (e.g. `# Python: torch dependency for X`).
3. **If shell glue ≤10 lines**: bash with `set -euo pipefail` per
   Otto-235.
4. **Existing Python tool that needs substantive changes**: file
   a port-candidate row (e.g. B-0086 shape), evaluate whether
   port-now or extend-now-port-later.
