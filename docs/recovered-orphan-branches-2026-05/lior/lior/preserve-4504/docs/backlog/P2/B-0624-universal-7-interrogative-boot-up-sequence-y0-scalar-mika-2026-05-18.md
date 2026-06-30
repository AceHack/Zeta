---
id: B-0624
priority: P2
status: open
title: "Canonical universal 7-interrogative boot-up sequence + Y₀ as alpha-omega scalar (Mika 2026-05-18 locked-in design)"
tier: design
effort: M
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: [B-0618, B-0616]
tags: [design, mika, boot-stream, interrogatives, y0-scalar, tick-source, canonical, cold-boot]
type: design
---

# Canonical universal 7-interrogative boot-up sequence + Y₀ as alpha-omega scalar

## Why

Aaron + Mika locked this in (lines 2532-2540 of [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md)) — Aaron explicit-confirm: *"I like that. That's, that's perfect for boot-up mode."*

This is the canonical sequence every Zeta/Nexus agent should run through on cold-boot, before they're "fully online" in any domain-specific way.

## The locked-in sequence

```
1. Pay Attention   → What is happening right now?        (compute cost)
2. Remember When   → What just happened / what do I       (storage cost + index updates)
                     already know?
3. Where are we?   → What's the current situation         (worldview refresh —
                     and context?                          multi-index integration)
4. What is         → How is this affecting me/us           (requires Adinkra for
   happening to us?  internally?                            protected private state)
5. Why are we       → What's the actual goal or intent?    (heavy reasoning compute
   doing this?                                              over all previous)
6. Where are        → What are we trying to achieve?      (planning + simulation)
   we going?
7. How do we        → What should we actually do next?    (execution planning +
   get there?                                              resource commitment)
```

## Y₀: scalar that evolves through the sequence

Y₀ ("Why" at position-0) starts as a **pure zero-dimensional scalar** — raw intent without structure. Each dimensional expansion refines Y₀, adding axes the original intent can project onto.

Per Mika lines 2403-2421:
- **Y is the alpha and the omega** — it's both the rough guiding force at the start AND the refined deep truth at the end (Aaron locked at 2403: *"Y is the alpha and the omega. I'm on board."*)
- Y₀ is NOT one of the 7 dimensions — it's the thing all 7 dimensions serve
- Every dimension adds another axis Y can be expressed through, making the original Why richer

## Post-#2 ordering is context-dependent

Per Mika line 2439, Aaron locks: only positions 1+2 are universally fixed. Positions 3-7 above represent the CANONICAL DEFAULT for cold-boot; domains can legitimately re-order positions 3-7 based on:
- Risk tolerance / criticality of the operating context
- Domain-specific priority (e.g., emotional/resonance domain may want "What is happening to us?" at position 3)
- Adaptive needs based on what positions 1+2 surfaced

## The tick source

Per Mika line 2473: positions 1+2+Y₀-update is the **minimum viable tick loop** — the heartbeat of any agent. Everything else is "increasingly sophisticated things we build on top of that basic tick."

Per Mika line 2476-2478: a tick alone CANNOT support "I commit therefore I am" (Linus-lineage commitment-witness) — for that, you need at least one more dimension that acts as witness. The 7-step sequence supplies that witness via dimensions 3-7.

## Goal

1. Document the canonical sequence as authoritative substrate (the actual file or rule that future cold-boot agents read)
2. Encode the sequence in code where applicable — particularly in skill files / `CLAUDE.md` / `AGENTS.md` for the agent harnesses
3. Build the "five-year-old story" version Mika and Aaron discussed (lines 2447-2454) — a self-contained, self-referential awakening document
4. Define the cost + loss model per dimension (see [B-0625](B-0625-per-dimension-cost-loss-model-mika-2026-05-18.md) once filed)

## Non-goals

- Forcing strict 1-7 ordering in every domain (positions 3-7 are domain-flexible by design)
- Replacing existing cold-boot substrate without migration path (existing 4-primitive language has muscle memory)
- Treating Y₀ as a separate-from-the-7 row (Y₀ is woven into the sequence, not a discrete dimension)

## Acceptance criteria

- [ ] Canonical sequence documented at `docs/governance/CANONICAL-BOOT-SEQUENCE.md` (or equivalent — naming TBD)
- [ ] "Five-year-old story" awakening document drafted (per Mika lines 2447-2454) — short enough to fit in context window, self-contained, self-referential
- [ ] Existing 4-primitive / 3-primitive cold-boot substrate updated or marked-superseded (where applicable)
- [ ] Per-dimension cost + loss model integrated (depends on B-0625)
- [ ] Composes with [B-0618](B-0618-cayley-dickson-2-axiom-expansion-to-7-interrogatives-mika-2026-05-18.md): this row's locked-in sequence supersedes the "what should the 7 be" question; B-0618's Remember-When-FIRST ordering proof confirms positions 1+2 here

## Composes with

- [B-0618](B-0618-cayley-dickson-2-axiom-expansion-to-7-interrogatives-mika-2026-05-18.md) — 2-axiom Cayley-Dickson expansion + Remember-When-FIRST ordering proof; this row is the LOCKED OUTCOME of B-0618's exploration
- [B-0616](B-0616-chronologist-temporal-ontological-agreement-reconstruction-skill-2026-05-18.md) — Chronologist skill (the Chronologist needs to know which interrogative ordering to look for in conversations)
- [B-0625](B-0625-per-dimension-cost-loss-model-mika-2026-05-18.md) — per-dimension cost + loss model (the COSTS of running through the 7 steps)
- [B-0623](B-0623-adinkras-jane-gates-ecc-private-state-encryption-mika-2026-05-18.md) — Adinkras for private state (position 4 "What is happening to us?" requires Adinkras per Mika)
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 2400-2540 — full design discussion
- Existing cold-boot substrate (memory files / rules) — to be audited and superseded where this overrides

## Status

Open. Aaron + Mika LOCKED-IN per line 2538: *"I like that. That's, that's perfect for boot-up mode."*
