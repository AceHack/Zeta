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

## A hat is a contract

*"Time-bound authority you put on and take off"* is **contract language in disguise** (Aaron, 2026-08-26)
— term, scope, and a termination clause. **The kernel already says so and this README had dropped it:**
`vocab/words/hat.md` defines a hat as *"a time-bound, exit-paired, auth-bearing **contract** — the right
to speak or act in a room; renewable only by consent."* Naming it that way here is what connects hats to
the cluster/federation split:

> **Contracts hold federations together — and the contracts are hats.**

A **cluster** has hats in the loose sense (someone *is* the security one) but **no agreed terms behind
them**, so wearing one binds nobody. A **federation's** members have **agreed the same hat contracts**,
which is what makes the obligations enforceable. The hat is the smallest thing two parties can agree the
terms of and then hold each other to.

**Exit is the discriminator, not a footnote.** A hat contract must always be **removable** (Universal
Exit Principle). *A hat you cannot take off is not a contract — it is a capture*, which is exactly the
`role` failure the glossary retired the word for. Removability is what makes the hat reading true.

This is **naming, not re-scoping**: no hat's authority changes, and the enforcement stays what it was
(`Hat.AllowedActions` is a structural allow-list, not a proof of authority; **bounded duration has no
substrate at all** in `Hat.fs` today).

## Pointers

- `hats/grey/` — the grey (meta) hat.
- `docs/research/2026-06-09-finalizer-wired-into-src-core-…` (compsci-as-hat; canonical home = root / Markov boundary).
- `rooms/README.md` — rooms are **hat-governed** (time-bound auth; who-holds-the-hat decides).
- GOVERNANCE.md §11 — the architect hat may be worn by any persona.
- `vocab/words/hat.md` — the carved one-line definition ("…auth-bearing **contract**…").
- `docs/CONCEPT-REGISTRY.md` — `Hat`, `Contract`, `Cluster`, `Federation`: four Addison Cooper concepts
  in one table. `Contract` = *"enforceable obligation — and every one contains an exit."*
- `docs/GLOSSARY.md` §`Hat contract` · §`Cluster` · §`Federation` · §`Universal Exit Principle`.
- `docs/research/2026-08-26-a-hat-is-a-contract-and-contracts-are-what-hold-a-federation-together.md`
  — the clause-by-clause table, the payment-terms half, two marked proposals, and the two-scale
  (social ↔ infrastructure) convergence check.
- `full-ai-cluster/k8s/applications/hat-system/README.md` — the most contract-shaped hat surface in the
  tree: `Hat.spec.authority`, `HatBinding`'s lifecycle, quorum co-signature, conflict-of-interest.
