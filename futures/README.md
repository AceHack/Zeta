# futures/ — unfulfilled promises society makes to itself (Promise Theory)

`futures/` holds **projected futures** — and Aaron's framing (2026-06-11) makes them precise: *"these
are unfulfilled promises from society to itself; these need treaties, and discovery of any implicit ones
that exist."*

A **future is a promise not yet kept** (Promise Theory — Mark Burgess). The substrate already speaks this:
uncertainty travels *at the promise level* (the rooms-are-IO-packet-wrappers doc); a speculative branch
(`SoftChip8Flux.conferenceOnFork`) is a future the room is holding open; a treaty (FourCorner / MeshPong /
MembraneLog) is a promise **ratified** — kept by construction, byte-locked across oracles.

## The two jobs of this folder

1. **Treaty the explicit promises.** Every future society declares to itself — a planned capability, a
   stated invariant, a "we will…" — is an unfulfilled promise until it is *ratified as a treaty* (made
   true by construction + cross-oracle byte-lock) or *honestly retracted*. "Everything in Zeta ends up
   treaty-ratified, little by little" — `futures/` is the ledger of what hasn't been yet.
2. **Discover the IMPLICIT promises.** The dangerous ones are unstated: a function whose callers *assume*
   a contract it never declared (the ragged-`dot` "I'm PSD" was an implicit promise that was FALSE until
   the Math Razor caught it). Surface implicit promises, then either treaty them (declare + enforce) or
   break them honestly. An implicit promise is a treaty waiting to be discovered.

## The shape

```
futures/<name>.md     one unfulfilled promise: who promises, to whom, what, and its treaty status
                      (open | ratified→<treaty> | retracted | implicit-discovered)
```

A future resolves the way a fork does: when the present arrives, one branch is kept and the others
retract (`SoftChip8Flux.reconcile`). A promise resolves the same way — kept, or honestly retracted.

## Pointers

- `docs/research/2026-06-10-rooms-are-io-packet-wrappers-uncertainty-at-the-promise-level-*.md` — Promise
  Theory (Burgess) in the substrate; uncertainty travels with the promise.
- `src/Core/SoftChip8Flux.fs` — `conferenceOnFork` / `reconcile` (a room holding open its futures, then
  resolving to the kept one).
- the treaty board: `src/Core.TypeScript/{four-corner,mesh-pong,recorded-source}/` — promises already kept.
- [`../saves`](../saves/README.md) — resume a save and *fork* it to project futures.
