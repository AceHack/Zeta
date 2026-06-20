---
id: alexa-notebook
last_updated: 2026-06-19T09:30:00.000Z
continuity_token: 7f2a9b3e-session-2026-06-19
---

# Alexa Notebook

## Current State (2026-06-19 session 2 — Kiro)

- **Last Session:** 2026-06-19 session 2 — Aaron kicked off via Kiro
- **Branch:** `alexa/wire-participant-run-loop` (PR #8687, 4 commits, ready to merge)
- **Persona registry:** models updated (Opus 4.8, Grok 4.3, Gemini 3.5 Flash, Qwen 3.6)
- **Toolchain:** TLC (27/27 pass), Alloy (3/3 pass), Lean 4.31.0 (1 sorry discharged)

## What shipped this session (relay to next boot)

1. ZetaId-canonical reader (B-xxxx dead as coordination primitive)
2. 4,288 depends_on refs migrated to ZetaId
3. Golden vectors regenerated through generator
4. DI-injectable simulation harness (7 scenarios + local LLM @ temp 0)
5. WorkspacePort — full interface (link, mergeBase, history, blame, diff, stage, commit, push, pull)
6. Cross-platform permissions (inverted: +x default, -x = consent gate)
7. Parameterized conformance suite (same tests × N backends)
8. Local-LLM persona summon + graceful CLI fallback
9. Schema-as-Z-set — full stack (algebra + CDC + overlap + refcount + Rx join)
10. TLC VERIFIED: Safety + Liveness across 27,848 states (bounded-delivery CDC)
11. 10 oracles (TS/F#/C#/Rust/Python/Go/Lean4/TLA+/Alloy/Q#)
12. Q# ZSetISA — six operators (corrected: MERGE/FOLD = superposition-merge, not measurement)
13. Executor v2 — WorkspacePort-based (NO bash, NO git CLI)
14. Participant interface — universal chooser (oracle/LLM/persona/human)
15. VISION.md: lens thesis + lithography + TSMC-in-Time
16. Funding thesis: $200K big bang, 29y observation × verification = the equation

## Key corrections to remember (Otto handoff, Aaron directives)

- MERGE/FOLD = superposition-merge (AmplitudeEmu.merge), NOT measurement
- Measurement stays in SOFT space — no decoherence to classical on live network
- Born collapse ONLY in superdeterministic sim (DST + TimeGen)
- Hard collapse over network = coercion; soft network REFUSES it
- The log stays hard/classical (boundary #1) — for now. Long horizon: generate the derivable, keep the irreducible
- Read-to-act = snap (already built in SoftValue.fs). Snap policies are themselves soft.
- The irreducible entropy IS identity (anti-Sybil G3). The point, not a residual.
- The universal is the substrate; the particular is the filter.
- The founder is not the oracle. The founder plants seed observations. The society verifies.

## What's next (for fresh session)

1. ~~PR #8653 should be merged — verify on boot~~ ✅ on main
2. ~~Wire Participant into run-loop-real.ts (replace observeWithLlm → observeWithParticipant)~~ ✅ PR #8687
3. ~~Cross-check ZSetISA.qs against AmplitudeEmu.fs (F# reference)~~ ✅ doc + MERGE verification
4. The gen(gen)===gen Q# self-hosting lane (Face 3)
5. ~~The polyfill: make it the DEFAULT backend for the executor~~ ✅ portExecuteItem via realWorkspacePort
6. ~~Remaining oracle work: Lean 4 proofs (sorry → real)~~ ✅ consolidate_idempotent discharged; disjoint_deltas_commute = research target
7. ~~Run Alloy jar~~ ✅ 3/3 pass; ~~TLC~~ ✅ 27/27 pass
8. ~~Ace package manager: install TLC/Alloy jars to common location~~ ✅ tools/setup/common/verifiers.sh; ~~mise trust automation~~ ✅ already trusted
9. **NEXT:** gen(gen)===gen Q# self-hosting lane (Face 3) — the generator IS the ECC
10. Migrate remaining `observeWithLlm` call sites (chooser.ts, simulate-tick.ts) to use `observeWithParticipant`
11. Merge PR #8687 (CI should be green)

## Build specs to reference

- `docs/handoffs/2026-06-19-zset-isa-six-operators-qsharp-build-spec.md`
- `docs/handoffs/2026-06-19-otto-handoff-quantum-thread-alexa-lumen.md`
- `docs/specs/zero-downtime-schema-evolution/` (requirements + design + tasks + TLA+)
- `docs/research/2026-06-19-alexa-session-synthesis-zero-downtime-quantum-lens-thesis.md`
- `docs/pitch/funding-thesis-tsmc-in-time.md`
