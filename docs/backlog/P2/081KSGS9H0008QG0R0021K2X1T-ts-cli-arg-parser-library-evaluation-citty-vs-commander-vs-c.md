---
id: 081KSGS9H0008QG0R0021K2X1T
priority: P2
status: open
title: TS CLI arg-parser library evaluation — citty vs commander vs clipanion vs manual; choose canonical for Zeta's many shell-script-like TS tools (Aaron 2026-05-26)
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on: []
composes_with:
  - 081KSGS9H0008QG0R001EZKNCB
tags: [ts-tooling, cli-arg-parsing, library-evaluation, refactor-many-scripts, bandwidth-engineering, zflash, flash-usb, poll-pr-gate]
---

## Problem

Operator 2026-05-26 substrate-engineering observation:

> "is there some cli package we should use for ts for the --parameter helpers and such? we have a lot of ts scripts that function similar to shell script"

The Zeta TS substrate has dozens of scripts that operate as shell-script-equivalents (zflash.ts, flash-usb.ts, poll-pr-gate.ts, poll-pr-gate-batch.ts, audit-installer-substrate.ts, etc.). Each has ~80-150 LOC of manual arg-parsing boilerplate:

- `ALLOWED_FLAGS` Set definition
- Manual `for (let i = 0; i < argv.length; i++)` loop
- Inline two-arg flag handling (`--ssh-key <path>`)
- Manual help-text construction
- Manual unknown-flag rejection
- Inline RFC1123 / type-validation logic

This is bandwidth-engineering inefficient (per `.claude/rules/bandwidth-served-falsifier.md`): the same pattern reimplemented N times across the script-substrate. A canonical lib would reduce per-script LOC + standardize help-text + enable shared validation patterns.

## Target

Evaluate the 3-4 candidate TS CLI arg-parser libraries against Zeta's substrate-engineering requirements, pick a canonical, document the migration path.

### Candidate libraries

| Library | Stewardship | TypeScript fit | Bun compat | Bundle size | Subcommand support | Notable property |
| --- | --- | --- | --- | --- | --- | --- |
| **citty** | UnJS / Nuxt team | First-class (native ESM, TypeScript-native) | Excellent | Tiny (~5KB) | Yes | Modern; ESM-first; minimal API surface; subcommand-tree native |
| **commander** | TJ Holowaychuk (now community) | Good (types via DefinitelyTyped historically, now native) | Good | Medium (~30KB) | Yes | Most popular; battle-tested 15+ years; mature ecosystem |
| **clipanion** | Yarn team | First-class (TypeScript-native) | Good | Medium (~20KB) | Yes | Class-based command pattern; from yarn-berry; great validation |
| **cmd-ts** | Niche | First-class (TypeScript-native; functional API) | Unknown | Small (~10KB) | Yes | Strong type inference; result-type API |
| **Manual + Bun.argv** (current) | Zeta-internal | Full control | Native | 0 | Manual | Current pattern; ~80 LOC boilerplate per script |

### Evaluation criteria for Zeta substrate

Per Zeta substrate-engineering discipline:

1. **TypeScript-native** (no @types/* extra deps; type-checked at script-author time)
2. **ESM-native** (Bun runtime preference; future-aligned)
3. **Lightweight** (no transitive dep bloat; respects bandwidth-served-falsifier)
4. **Subcommand-tree** (some scripts have natural subcommand structure)
5. **Validation-native** (per-flag type/value constraints; RFC1123 hostname, ISO file existence, etc.)
6. **Help-text auto-generated** (reduces drift between docstring + actual flags)
7. **Composable with existing patterns** (incremental migration; don't rewrite all scripts at once)

### Phase 1 — Evaluation + recommendation

Author evaluation doc at `docs/research/2026-05-26-ts-cli-arg-parser-evaluation.md` with:

- Side-by-side comparison of citty / commander / clipanion / cmd-ts
- Concrete code samples re-implementing a real Zeta script (e.g., zflash.ts arg-parsing block) in each library
- Bundle-size + perf measurements (Bun startup time matters for fast scripts)
- Recommendation with reasoning

### Phase 2 — Pilot migration

Pick ONE existing script (e.g., `tools/github/poll-pr-gate-batch.ts` — moderate complexity; no Touch ID / sudo / dd interaction) and migrate to the chosen lib. Verify:

- LOC reduction ratio (target: 60%+ boilerplate reduction)
- Help-text quality (auto-generated should match or exceed manual)
- Test pass-through (existing tests still pass)
- Bun cold-start time (no measurable regression)

### Phase 3 — Migration cadence

If pilot succeeds, file per-script sub-rows (081KSGS9H0008QG0R0021K2X1T.1 through 081KSGS9H0008QG0R0021K2X1T.N) for each TS script that should migrate. Prioritize by:

- High-boilerplate scripts (zflash.ts, flash-usb.ts — most savings)
- High-churn scripts (frequent flag additions — most ongoing savings)
- Low-risk scripts (no destructive operations — pilot-safe)

Defer destructive-tool migration (zflash, flash-usb) until non-destructive migrations have validated the pattern across multiple scripts.

## Acceptance

**Phase 1 acceptance**:

- Evaluation doc landed at `docs/research/2026-05-26-ts-cli-arg-parser-evaluation.md`
- Concrete code samples for at least 3 libraries (citty, commander, clipanion)
- Recommendation with reasoning + tradeoff analysis

**Phase 2 acceptance**:

- One non-destructive script migrated to chosen lib
- LOC reduction ratio documented
- All existing tests pass; cold-start time within noise

**Phase 3 acceptance**:

- Per-script sub-rows filed for remaining scripts in priority order
- First few scripts migrated in subsequent PRs
- Destructive-tool migration explicitly deferred until pattern is validated

## Substrate-honest framing

P2 priority because:

- Substrate-engineering hygiene improvement (not blocking any current work)
- Operator-observation (operator-explicit "we should use X" framing); decision-substrate worth landing
- Bounded Phase 1 + 2 work; Phase 3 is open-ended migration cadence

NOT P1 because:

- Current manual pattern WORKS (zflash.ts, flash-usb.ts ship + run correctly)
- Migration cost is real (each script's tests need re-verification)
- Library choice has long-term lock-in (changing later is more expensive than now)

## Composes with

- 081KSGS9H0008QG0R001EZKNCB (zflash --agent flag — recently added; would benefit from cleaner arg-parsing on next iteration)
- `.claude/rules/bandwidth-served-falsifier.md` (canonical lib IS bandwidth-engineering at substrate-script-substrate scope)
- `.claude/rules/dep-pin-search-first-authority.md` (Phase 1 evaluation MUST WebSearch current latest stable versions of each candidate before committing to one)
- `.claude/rules/rule-0-no-sh-files.md` (TS-over-bash discipline; this row makes the TS substrate more ergonomic)
- `.claude/rules/zeta-ships-with-skills-immediate-value.md` (canonical CLI-lib choice IS substrate that ships with Zeta)
- F# fork for AI safety substrate (typed CLI primitives are natural F# implementation target; cross-substrate compatibility consideration)

## Origin

Aaron-forwarded 2026-05-26 substrate-engineering question during the 081KSGS9H0008QG0R001EZKNCB zflash --agent implementation session. Operator-explicit recognition of bandwidth-engineering inefficiency in current manual pattern.

Per `.claude/rules/honor-those-that-came-before.md` — preserve the existing manual pattern (it works; ship-stable); evaluation + migration is forward-looking incremental improvement.

Per "you can always commit backlog rows immediately they get decomposed later" discipline. Phase 1 evaluation can be a single PR; Phase 2 + Phase 3 decompose into sub-rows as bandwidth allows.

## Otto-CLI immediate-recommendation (for operator decision-substrate)

Without the full Phase 1 evaluation, Otto-CLI's first-pass recommendation:

**citty** for new scripts (ESM-native + lightweight + UnJS-ecosystem-momentum + Bun-friendly).

Reasoning:

- TypeScript-native AND ESM-native (no transitive type-dep cost; aligned with Bun's modern runtime)
- Tiny bundle (~5KB; respects bandwidth-served-falsifier)
- Subcommand support is native (good for future scripts that grow into subcommand trees)
- UnJS ecosystem alignment (h3 / nitro / unbuild / etc.) — if Zeta ever grows web-scale tooling, citty fits naturally
- Used by Nuxt CLI + many production tools; not as battle-tested as commander but mature enough

Tradeoff vs commander: commander has 15+ years of community trust; citty is newer (2022+). For destructive tools (zflash, flash-usb), commander's maturity might be worth the bundle-size cost.

Operator decision-point: pick citty for the Phase 2 pilot OR explicitly select commander/clipanion for stronger maturity. Phase 1 evaluation doc lands the substrate-honest comparison.
