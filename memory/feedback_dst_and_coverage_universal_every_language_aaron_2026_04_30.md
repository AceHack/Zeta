---
name: dst_and_coverage_universal_every_language
description: Aaron 2026-04-30 — DST (Deterministic Simulation Testing) + code coverage are universal best practices across every language in Zeta, not just F#. SQLSharp is the named TypeScript/Bun reference.
type: feedback
---

DST and code coverage are universal Zeta best practices that apply
to **every language** the factory uses (F#, TypeScript on Bun,
future Python / .NET / Lean / etc.) — not just F#.

**Why:** Aaron 2026-04-30, immediately after slice 1 of the TS/Bun
migration merged: *"Make sure bun uses DST deterministic simulation
just like F# too that is a best practice"* + *"for every language"*

+ *"we will want code coverage all all that too i like ../SQLSharp

already has that too"*. The framing generalises Otto-272 (DST
everywhere), Otto-281 (DST-exempt is a deferred bug, not
containment), and Otto-273 (seed-lock policy) — those were
originally documented for F# / .NET test infrastructure; Aaron
made the universal-language scope explicit.

**How to apply:**

When adding any new code path in any language:

1. **DST-friendly construction** — separate non-deterministic
   inputs (clock, RNG, scheduler, network, filesystem-order)
   from logic. Tests substitute deterministic fakes. No real
   `Date.now()` / `Math.random()` / wall-clock-`setTimeout`
   reliance in test-observable behavior.
2. **Pinned seeds** — when randomness is unavoidable in
   production, pin the seed and document it. Aaron's whimsy:
   prefer seeds containing `69` or `420` when nothing prevents
   it (`feedback_pinned_random_seeds_containing_69_or_420_when_agent_picks_2026_04_23.md`).
3. **No test retries** — flakes are DST-violation smells, not
   transient noise. Investigate root cause (Otto-281,
   `feedback_retries_are_non_determinism_smell_DST_holds_investigate_first_2026_04_23.md`).
4. **Coverage as a gate** — public-API surface of every new
   module gets tests by default. CI surfaces coverage;
   reductions fail.
5. **DST-exempt is a deferred bug** — if a path can't be made
   DST-friendly *yet*, the exemption is deferred work, not
   containment. Track the debt.

**Sibling-repo reference:** `../SQLSharp` already has Bun-native
coverage configured via `bunfig.toml [test]` block
(`coverageSkipTestFiles`, `coveragePathIgnorePatterns`) plus
`tools/automation/coverage/{collect,merge,publish}-coverage.ts`
helpers and a `.github/workflows/coverage.yml` workflow. Aaron's
named reference 2026-04-30. Adopt this shape when the TS/Bun
migration introduces its first tested module.

**Per-language tooling lives in the runtime layer**, not in this
memory file. The runtime files name the specific tools:

- **F#**: existing FoundationDB-style DST scaffolding;
  `docs/FOUNDATIONDB-DST.md` is the reference.
- **TypeScript on Bun**: `docs/best-practices/bun.md` — fake
  timers via `bun:test`'s `setSystemTime()`, seeded RNG
  injection, Bun's built-in `--coverage`.
- **Future runtimes** (Node, Deno, .NET console, Python): same
  pattern — pick a per-language clock/RNG/scheduler injection
  story + a coverage tool, document in that runtime's best-
  practices file.

**Composes with:**

- `docs/best-practices/typescript.md` — TS language layer's
  hard-requirements section now includes DST-friendly code paths
  + code-coverage gate.
- `docs/best-practices/bun.md` — Bun runtime layer's DST-tooling
  + coverage sections.
- `docs/best-practices/repo-scripting.md` — per-slice audit
  checklist now includes DST + coverage line items.
- `docs/FOUNDATIONDB-DST.md` — original F# DST doctrine; this
  generalises the principle.
- Otto-272 (DST-everywhere), Otto-281 (DST-exempt-is-deferred-bug),
  Otto-273 (seed-lock-policy).
- `feedback_retries_are_non_determinism_smell_DST_holds_investigate_first_2026_04_23.md`.
- `feedback_pinned_random_seeds_containing_69_or_420_when_agent_picks_2026_04_23.md`.
- Otto-364 (search-first authority) — re-verify per-language
  DST/coverage tooling before adopting in a new slice; the
  upstream APIs evolve.
- Otto-363 (substrate-or-it-didn't-happen) — this file IS that
  landing for the universal-DST-and-coverage rule.
