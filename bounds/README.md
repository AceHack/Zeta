# bounds/ — the edge of the map (in-bounds vs out-of-bounds)

`bounds/` is where Zeta knows **where the edge is** — what is **in-bounds** (navigable, playable,
allowed) and what is **out-of-bounds** (off the map; do-not-go). The whole root-folder layout is a
**navigable space**; `bounds/` is the **boundary** drawn around it.

## The frame — navigation is the dashboard of the Xbox version of `sim` (Aaron 2026-06-10)

> Aaron: "so we can figure out where out-of-bounds is — this whole navigation is from the **dashboard
> of the Xbox version of [`sim`](../sims/)**."

The root folders ([`shapes/`](../shapes/), [`boards/`](../boards/), [`hats/`](../hats/),
[`sims/`](../sims/), [`hygiene/`](../hygiene/), …) are the **dashboard / blades** of `sim` — the Xbox
console-dashboard you navigate before and around the game. **`sim`** is the game; the folder tree is
its **dashboard UI**; moving between folders is **navigation**. And every game world has an **edge**:
`bounds/` is the **out-of-bounds detector** — it tells the navigator when they've walked off the
playable map.

## In-bounds vs out-of-bounds (what the boundary is made of)

- **In-bounds** = the navigable substrate: the folders, the standing authorization (Agora-wide,
  indefinite — act freely inside it), the moves the [`escalator/`](../escalator/) and
  [`ladders/`](../ladders/)+[`chutes/`](../chutes/) make over a [`board`](../boards/).
- **Out-of-bounds** = the **gated classes** you do not enter without fresh human authorization:
  `docs/HARD-LIMITS` (the floor), [`docs/WONT-DO.md`](../docs/WONT-DO.md) (decided-against),
  non-reversible actions, force-push, budget increases. Out-of-bounds is not "forbidden terrain you
  sneak into" — it is **off the map**: the navigation simply ends there.

## Anchors (Beacon)

- **Markov blanket** (Pearl) — the statistical boundary separating inside from outside; the CLI/[`same/`](../same/)
  `ctxboundary` is a Markov boundary (argv-string space → typed-command space). `bounds/` is the
  blanket made navigable.
- **Bounded Mobility** (manifesto §4) — compute/data relocate **only within safety bounds**; `bounds/`
  is where those safety bounds are named.
- **Shape A** (bounded / terminates) — the self-throttle that keeps `sim` from running off the edge
  (proof-of-entropy: grows only as fast as real uncertainty; no fork-bomb).
- Game-design **out-of-bounds / playable-area** (the invisible wall; the Xbox blade dashboard).

*(Peel: the Xbox-dashboard / out-of-bounds is the navigation metaphor; the load-bearing instances are
real — §4 bounded mobility, the HARD-LIMITS/WONT-DO gates, the Markov boundary of the CLI parse.)*

## Pointers

- [`sims/`](../sims/) — the game (`sim`) this is the dashboard-edge of.
- [`same/`](../same/) — the `ctxboundary` (the Markov boundary as a parse).
- [`uncertainty/`](../uncertainty/) — the ledger; shape-A throttle that keeps in-bounds.
- `docs/WONT-DO.md` · `docs/HARD-LIMITS` — the named out-of-bounds.
