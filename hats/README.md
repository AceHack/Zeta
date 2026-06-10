# hats/ — the wearable hats (roles / domains), at root

`hats/` holds the **hats** — the **wearable roles/domains** of the factory. A hat is **not an identity**;
it is a **time-bound authority** you put on and take off: **who-holds-the-hat decides** (the rooms are
hat-governed). A root-level folder like `/vocab`, `/same`, `/dns`, `/network`, `/rooms`.

- **A hat ≠ a persona.** Any persona may wear a hat (e.g. the **architect hat** may be worn by any persona,
  GOVERNANCE.md §11). The hat carries the *authority + responsibility* for a domain while worn; the persona
  carries the identity. (Bus-address-is-not-identity, applied to roles.)
- **Hats own domains.** Per Max: **`src/` is owned by the compsci hat**; each domain (devops, security,
  formal-verification, …) is a wearable hat, not a fixed owner. The hat is the *who-decides-here*.
- **One special hat: `grey/` — the META hat** (Aaron, 2026-06-10: "it's the meta hat"). See `hats/grey/`.

## Pointers

- `hats/grey/` — the grey (meta) hat.
- `docs/research/2026-06-09-finalizer-wired-into-src-core-…` (compsci-as-hat; canonical home = root / Markov boundary).
- `rooms/README.md` — rooms are **hat-governed** (time-bound auth; who-holds-the-hat decides).
- GOVERNANCE.md §11 — the architect hat may be worn by any persona.
