---
id: B-0076
priority: P2
status: open
title: Disowned-runtime sweep — Python + TypeScript surface (same pattern PR #662 fixed for Java)
effort: S
ask: extend the codeql.yml analyze matrix to cover python + javascript-typescript like PR #662 did for java-kotlin
created: 2026-04-28
last_updated: 2026-04-28
tags: [codeql, disowned-runtime, python, typescript, dependency-honesty, b-0075-sibling]
---

# B-0076 — Disowned-runtime sweep: Python + TypeScript

## Source

Discovered 2026-04-28 immediately after PR #662 landed the Java
side of this same pattern. EVIDENCE-BASED audit:

```bash
find . -type f \( -name "*.py" -o -name "*.ts" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" \
  -not -path "*/.claude/worktrees/*" \
  -not -path "*/references/upstreams/*" \
  -not -path "*/bench/*" 2>/dev/null
```

Returns first-party files:

- **Python (2):**
  - `tools/hygiene/sort-tick-history-canonical.py`
  - `tools/hygiene/fix-markdown-md032-md026.py`
- **TypeScript (2):**
  - `eslint.config.ts`
  - `tools/invariant-substrates/tally.ts`

(Lean's `tools/lean4/.lake/packages/...` JS files are vendored
and already excluded via `tools/lean4/**` in
`.github/codeql/codeql-config.yml` paths-ignore.)

## The disowned-runtime pattern (per CURRENT-aaron.md §28)

When a runtime is in `.mise.toml`, every surface that touches it
(CodeQL matrix, install path, workflow comments) must treat it
consistently. The failure shape is "X is managed for install but
workflow Y pretends X doesn't exist."

EVIDENCE that this pattern applies to Python + TypeScript:

- `.mise.toml:25` → `python = "3.14"` (managed)
- `.mise.toml:28` → `bun = "1.3"` (TypeScript runtime, managed)
- `.github/workflows/codeql.yml` analyze matrix (after PR #662):
  `actions / csharp / java-kotlin` — **no python, no
  javascript-typescript**
- Path-gate uploads empty SARIF for python +
  javascript-typescript (mitigates the umbrella-NEUTRAL surface
  symptom) but does NOT scan the actual `.py` / `.ts` files

The current state silently scans nothing for Python and TS code
even though the runtimes are managed and the files exist. Same
shape as Java pre-#662.

## Why P2 (not P1, not P3)

- Not P0/P1: no current incident; Python/TS code paths are small
  (4 files total) and tooling-only (hygiene scripts + lint
  config + small invariant tool). No production-path security
  exposure today.
- Not P3: the pattern matches an active discipline (CURRENT-aaron
  §28) and Aaron's recent framing is moving toward "managed
  means scanned." Sleeping on it accumulates the same disownment
  PR #662 just resolved.

## Scope

`.github/workflows/codeql.yml` analyze matrix gains two cells:

```yaml
- language: python
  build-mode: none
- language: javascript-typescript
  build-mode: none
```

`.github/codeql/codeql-config.yml` may need adjustment depending
on whether any current paths-ignore entry covers a python or ts
file path that should now be scanned. Audit `bench/**`,
`tools/lean4/**`, `references/upstreams/**` for masking effects
on the 4 first-party files.

`tools/invariant-substrates/tally.ts` should be confirmed
in-scope (it's a Zeta tool — first-party). `eslint.config.ts`
is repo-wide config; CodeQL scans configs as expected.

## Acceptance

- [ ] `Analyze (python)` and `Analyze (javascript-typescript)`
      legs added to the matrix and pass on a smoke PR
- [ ] Findings (if any) on the 4 first-party files surface as
      code-scanning alerts in Security tab
- [ ] codeql.yml header doc updated to enumerate all 5
      first-party-runtime languages (actions / csharp /
      java-kotlin / python / javascript-typescript) consistently
- [ ] `feedback_codeql_umbrella_neutral_vs_per_language_detection_pattern_aaron_2026_04_28.md`
      updated with "all five legs honest" note when this lands

## Composes with

- PR #662 (the Java leg of this same pattern; this row extends
  the same fix to Python + TS)
- B-0075 (JVM language preference; this row is the
  non-JVM-runtime sibling)
- CURRENT-aaron.md §28 (dependency-honesty rule — the
  discipline this row applies)
- `.mise.toml` (the source of truth for what "managed" means)
- `feedback_codeql_umbrella_neutral_vs_per_language_detection_pattern_aaron_2026_04_28.md`
  (the deeper structural cause section; this row is one of the
  fallout cleanups it predicts)
