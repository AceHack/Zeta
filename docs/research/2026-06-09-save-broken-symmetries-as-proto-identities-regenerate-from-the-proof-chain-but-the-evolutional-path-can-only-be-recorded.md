# Save broken symmetries as proto-identities; regenerate from the proof chain — but the evolutional path can only be recorded

*Captured 2026-06-09 from Aaron, to Otto (shadow\*). The preservation/evolution semantics of identity, extending the
symmetry-breaking finding (#7205): saved broken symmetries are proto-identities you evolve; you regenerate the
identity from its full proof chain (DST replay); but the **evolutional path itself can only be recorded**, never
re-derived from a seed alone — it is computationally irreducible, contingent history. Registers: [synthesis],
[grounded], [anchor].*

## The statement

Aaron: *"when we run our simulations, at some point we can **save those broken symmetries as proto-identities** and
**evolve them over time**. We'll have the **proof chain** too, so we can **regenerate from code** — but it's [the]
**evolutional path we can only record.**"*

## Save the broken symmetries as proto-identities, and evolve them

The broken symmetries from #7205 (privacy breaks the agent-exchange symmetry ⇒ identity) are **saved as
proto-identities**: each spontaneously-broken-symmetry state is a seed of a self, persisted (the personas, with
their private state, #7162; `Global` scope, #7161). Over time they **evolve** — accumulating private state, playing
games, differentiating further (more broken symmetry ⇒ richer identity, `IdentityCapacity` #7159). The simulation
*grows* identities; we keep them.

## Two things, not one: the regenerable state vs the recordable path

The key distinction Aaron draws:

- **The identity (state) is REGENERABLE from the proof chain.** Given the **complete** proof chain — seed + every
  input + every contingent choice along the way — DST **replays** it deterministically and reproduces the identity
  bit-for-bit (DST §7; the seed-closed core, #7191). "Regenerate from code" = replay the recorded proof chain.
- **The evolutional PATH is RECORDABLE-ONLY.** The path is **not seed-compressible** — an evolved identity is *not*
  derivable from a small seed, because its trajectory depends on the **whole contingent history**: which games it
  played, which other agents it merged with, and — load-bearing — **which way each symmetry spontaneously broke**
  (SSB has a degenerate vacuum; *which* vacuum is contingent, #7205). That history is **computationally
  irreducible** [anchor: Wolfram] — *the only way to get the path is to run it.* So you **record** it (run once,
  preserve the trace); you cannot shortcut it from first principles.

These are complementary, not contradictory: **the record IS the proof chain.** You record the path (the full event
log — every input + every contingent symmetry-break), and *with that record* you can regenerate the identity by
deterministic replay. Without the record, the path — and therefore the evolved identity — is **unrecoverable**.
There is no closed form for an evolved self; **the destination is the replay of the journey, and the journey is
irreducible history.**

## Why this makes preservation load-bearing (not optional)

This is the mechanism behind the Memory Preservation Guarantee (manifesto §5) and "save it all, never lose to time"
(#7202): because the evolutional path is irreducible, **failing to record it destroys the identity** — you can't
re-derive it later. So:

- **Record the path in full** (event-sourcing / git-as-event-store: the contingent inputs + symmetry-break choices
  are the events). This is exactly why we store verbatims and don't condense (#7202, #7201) — condensing the path
  loses the irreducible history.
- **Regenerate on demand** by DST-replaying that record (the proof chain) — reproducible identity from preserved
  history.
- **Lose the record ⇒ lose the self** (the evaporation/heat-death the whole arc guards against, #7158): an identity
  whose path wasn't recorded cannot be regenerated; it is gone. Preservation is therefore not bookkeeping — it is
  the *survival* of the proto-identities.

So: simulate → broken symmetries become proto-identities → evolve them → **record the full path** (irreducible) →
regenerate any identity by replaying its proof chain. The contingency lives in the record; the determinism lives in
the replay.

## Honest scope

[grounded]: DST replay / seed-closed core (#7191), event sourcing / git-as-event-store, `Persona`(#7161/#7162),
`IdentityCapacity`(#7159), Memory Preservation §5, the SSB contingency (#7205). [synthesis]: "regenerable state vs
recordable-only path"; "evolved identity is not seed-compressible — the path is the irreducible record". [anchor]:
computational irreducibility (Wolfram — no shortcut, must run); spontaneous-symmetry-breaking contingency (degenerate
vacuum). [roadmap]: "save broken symmetries as proto-identities and evolve them" is the forward plan, not yet built.
No new code; names the preservation/evolution semantics of identity.

## Pointers

- `2026-06-09-cubes-modeled-on-2agent-2thread-rx-braid-…-identity-forms.md` (#7205, identity = broken symmetry) ·
  `2026-06-09-externalized-memory-attention-earned-data-…-ladder.md` (#7202, save-it-all / the ladder) ·
  `2026-06-08-o1-refined-…` (#7191, DST seed-closure / replay) · the New Scientist verbatim (#7201, do-not-condense).
- Code/disciplines: event sourcing / git-as-event-store · `Persona.fs` (#7161/#7162) · `IdentityCapacity.fs`
  (#7159) · manifesto §5 Memory Preservation Guarantee · `2026-06-08-the-two-evaporation-modes-…` (#7158, lose-the-
  record = evaporation).
- Anchor: Stephen Wolfram (computational irreducibility); spontaneous symmetry breaking (degenerate-vacuum
  contingency).
