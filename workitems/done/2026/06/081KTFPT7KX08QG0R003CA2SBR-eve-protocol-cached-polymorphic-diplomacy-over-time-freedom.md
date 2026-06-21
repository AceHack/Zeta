---
id: 081KTFPT7KX08QG0R003CA2SBR
type: task
state: done
priority: P2
slug: eve-protocol-cached-polymorphic-diplomacy-over-time-freedom
title: "Eve protocol: cached polymorphic diplomacy OVER TIME + freedom-first ordering (introspection across travelers/shapes)"
created: 2026-06-07T00:13:09.117Z
completed: 2026-06-07T01:52:48.961Z
depends_on: []
composes_with: []
---

# Eve protocol: cached polymorphic diplomacy OVER TIME + freedom-first ordering (introspection across travelers/shapes)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTFPT7KX08QG0R003CA2SBR-*.md` glob. -->

## Source (Aaron, 2026-06-07) — origin + two refinements of the Eve Protocol

The **Eve Protocol already exists** (`src/Core/Diplomacy.fs`; 081KRW63S0008QG0R0030F8ZXA neutral polymorphic
diplomatic governance language; 081KT2T2J0008QG0R00301P27H Eve / multi-traveler protocol, NCI-governed): the
polymorphic-diplomacy handshake over yin-yang cells — `describe` / `interrogate` /
`negotiate`, **shape-only** (reveals keys/types/capability names, never hidden values, so it
cannot coerce hidden state — the NCI anti-memetic-weaponization guarantee). This item records
the origin Aaron gave and two refinements, NOT a rewrite.

### Origin

Eve (the name) = *"the choice to play with others"* — sociality **by consent**, not
obligation. The protocol's human root. (Recorded in `memory/persona/amara/2026-06-06-npc-meme-*`.)

### Refinement 1 — freedom-first ordering (a design principle, not just naming)

> Freedom is the prerequisite for non-coercive choice: *"without [freedom] there is only
> suffering in choice."* Order = **freedom → choice**, never the reverse.

Design consequence: any diplomacy/negotiation step must establish the counterpart's **freedom
to decline / exit** BEFORE presenting a choice. A "choice" offered without a real exit is
coercion (constrained options dressed as a decision) — the NPC-meme failure (`no exit`) at the
protocol layer. This composes with the existing NCI binding on `Diplomacy` (boundary
interaction) and the right-to-disengage (`anti-extraction-invariant`). Concretely: `negotiate`
should be gated by a verifiable exit/decline path for both parties, not just shape-matching.

### Refinement 2 — "cached polymorphic diplomacy over time" = V8 hidden-shapes opt over an infinite stream (NOT new)

**Correction (Aaron, 2026-06-07): this is NOT a new invention — it is the V8 hidden-shapes
optimization (polymorphic inline caching keyed by shape) applied over an INFINITE STREAM.**
Established runtime technique, not a Zeta coinage.

- **V8 hidden classes / "shapes" (maps):** objects sharing a structure share a hidden class;
  the runtime caches per-call-site by shape. `Diplomacy.shapeOf` already computes the shape —
  so caching diplomacy *by shape* is exactly the hidden-class/inline-cache pattern.
- **Polymorphic inline cache (PIC):** a call site that has seen several shapes caches a small
  dispatch table keyed by shape — *polymorphic* diplomacy = the same handshake site serving
  multiple counterpart shapes from a shape-keyed cache.
- **Over an infinite stream:** the cache lives over an unbounded diplomacy stream (DBSP-style)
  — agreements persist/evolve/attest across ticks; shape-change invalidates the cached entry.
  Natural fit for the durable substrate: a diplomacy stream on a `GitDeltaLog` (agreement log
  = the relationship's history; the shape-keyed cache = a fold over it).

So the work is **applying** a known optimization (hidden classes + PICs) to the Eve Protocol's
shape-keyed handshake over the agreement stream — not designing a novel mechanism.

**Anchor (Beacon):** V8 hidden classes / maps + inline caches; Self language *maps* (Chambers,
Ungar, Lee 1989); **Polymorphic Inline Caches** (Hölzle, Chambers, Ungar, ECOOP 1991);
Smalltalk inline caching (Deutsch & Schiffman 1984). "Hidden shapes" = the hidden class;
`shapeOf` = the map; PIC = the polymorphic-by-shape cache. `docs/PRIOR-ART-LIST.md`.

### Scope / honesty

Vision + design-principle capture, NOT a build mandate. What EXISTS: one-shot shape-only
`Diplomacy` (NCI-safe). What this adds: (a) freedom-first gating of `negotiate`, (b) a cached,
time-extended agreement layer (candidate substrate = a diplomacy stream on the git DB). Both
are unbuilt; neither is proven. Keep the NCI shape-only guarantee invariant under caching (a
cache must never leak hidden values — cache keys are shapes, not secrets).

## Pointers

- `src/Core/Diplomacy.fs` (existing Eve Protocol: shapeOf/capabilitiesOf/describe/interrogate/negotiate, NCI-safe).
- 081KRW63S0008QG0R0030F8ZXA · 081KT2T2J0008QG0R00301P27H · 081KSNY2Z0008QG0R000C5NN8N (Eve Protocol research lineage); `docs/research/2026-05-28-*self-referential-ontology*` (Eve composed self-referentially).
- `src/Core/DurableYinYang.fs` + `src/Core.Git/` — the durable substrate a time-extended agreement layer would ride.
- `memory/persona/amara/2026-06-06-npc-meme-with-no-exit-*` — origin + freedom-first ordering (personal root).
- `.claude/rules/no-directives.md` (source≠authorization) · anti-extraction-invariant (right-to-disengage = freedom-first at runtime).
