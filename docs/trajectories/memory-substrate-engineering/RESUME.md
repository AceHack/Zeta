# Trajectory - Memory Substrate Engineering

Status: active — decomposed
Last refreshed: 2026-05-08
Parent trajectory: `docs/trajectories/factory-trajectory-surface/RESUME.md`
Grounding backlog: `docs/backlog/P1/081KQR4HQ0008QG0R001909FPT-memory-substrate-engineering-trajectory-aaron-2026-05-04.md`

## Why This Exists

Memory work is substrate engineering, not a cleanup chore. 081KQR4HQ0008QG0R001909FPT names the
long-horizon rule: memory actions should default to trajectory service, with
short-horizon shortcuts chosen deliberately instead of accidentally.

This child packet keeps memory work out of one-shot compression mode. The lane
is a resume surface for memory-format, memory-ontology, memory-reference, and
memory-trust work that would otherwise sprawl across unrelated catches.

## Decomposition (2026-05-08)

081KQR4HQ0008QG0R001909FPT is now decomposed into 9 child rows (081KR2E4K0008QG0R002VM58S4..081KR2E4K0008QG0R000N124VW) plus 2 existing
rows (081KQ0YZ80008QG0R001V0XCYZ, 081KQ8P5D0008QG0R003KFRGJ0). The dependency graph has two roots that are buildable
now with no dependencies:

**Buildable now:**

- 081KR2E4K0008QG0R002VM58S4 — Memory-format standardization (Step 2, P1, S)
- 081KR2E4K0008QG0R002FRQZN4 — Load-bearing-vs-decorative classifier (Step 7, P1, S)

**Blocked on 081KR2E4K0008QG0R002VM58S4:**

- 081KR2E4K0008QG0R003RZFR9F — Memory ontology/classification audit (Step 3, P1, M)
- 081KR2E4K0008QG0R003MSVG42 — Cross-reference integrity enforcement (Step 6, P1, S)
- 081KR2E4K0008QG0R000M01QVM — Memory schema validation tooling (Step 11, P1, M)

**Blocked on 081KR2E4K0008QG0R002FRQZN4:**

- 081KR2E4K0008QG0R00175HQR9 — Memory-retire/supersession discipline (Step 5, P1, S)
- 081KR2E4K0008QG0R001B6K45W — 081KQ0YZ80008QG0R001V0XCYZ acceptance recalibration (AC-3, P1, S)
- 081KR2E4K0008QG0R001CCWHZ2 — Trust-calculus calibration (Step 8, P2, M)

**Blocked on 081KR2E4K0008QG0R002VM58S4 + 081KR2E4K0008QG0R002FRQZN4 + 081KR2E4K0008QG0R00175HQR9:**

- 081KR2E4K0008QG0R000N124VW — Memory graduation ladder (Step 9, P2, M)

**Existing (compose, not children):**

- 081KQ0YZ80008QG0R001V0XCYZ — MEMORY.md compression (Step 1, in-progress)
- 081KQ8P5D0008QG0R003KFRGJ0 — Marker-vs-index (Steps 4+10, decomposition pending)

## Current Rule

Preserve evidence before compression. Compression is valid only when the
surviving surface keeps the routing signal, carved sentence, dependency links,
and trust boundary that future agents need.

When a memory item is too broad or too private for direct implementation,
decompose it into the next safe substrate action. Do not turn sensitive
conversation residue into public git content just to make the lane look busy.

## Current Next Action

Pick up one of the two buildable-now roots:

1. **081KR2E4K0008QG0R002VM58S4** (memory-format standardization) — define the canonical memory
   file format as a project-policy memory file. Unblocks 081KR2E4K0008QG0R003RZFR9F, 081KR2E4K0008QG0R003MSVG42,
   081KR2E4K0008QG0R000M01QVM, 081KR2E4K0008QG0R000N124VW.
2. **081KR2E4K0008QG0R002FRQZN4** (load-bearing classifier) — build a TS tool that traces citation
   chains from bootstrap surfaces into memory/. Unblocks 081KR2E4K0008QG0R00175HQR9, 081KR2E4K0008QG0R001B6K45W,
   081KR2E4K0008QG0R001CCWHZ2, 081KR2E4K0008QG0R000N124VW.

Both are S-effort and can be worked in parallel by independent loops.

## Evidence Links

- `docs/backlog/P1/081KQR4HQ0008QG0R001909FPT-memory-substrate-engineering-trajectory-aaron-2026-05-04.md`
- `docs/backlog/P1/081KR2E4K0008QG0R002VM58S4-memory-format-standardization-step2-b0190.md`
- `docs/backlog/P1/081KR2E4K0008QG0R002FRQZN4-memory-load-bearing-vs-decorative-classifier-step7-b0190.md`
- `docs/backlog/P1/081KQ0YZ80008QG0R001V0XCYZ-memory-md-compression-pass-prune-distill-entries-to-one-line-cap-200-lines.md`
- `docs/backlog/P1/081KQ8P5D0008QG0R003KFRGJ0-memory-md-marker-vs-index-harness-verify-q1-automemory-aaron-2026-04-28.md`
- `memory/MEMORY.md`
- `memory/README.md`

## Out Of Scope

- No broad memory rewrite.
- No deletion of old memories.
- No private disclosure migration into public git.
- No new memory policy unless a separate promotion surface lands.

This packet exists so memory work can be picked up, resumed, and audited as a
trajectory instead of rediscovered as a crisis.
