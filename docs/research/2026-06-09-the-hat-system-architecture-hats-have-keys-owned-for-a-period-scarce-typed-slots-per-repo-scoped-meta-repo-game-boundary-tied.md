# The hat-system architecture: hats have their own keys, are owned-for-a-period, scarce (typed slots per repo), scoped (meta / repo / game), and tied to a Markov boundary

**Register:** [grounded] architecture (Aaron) + [synthesis]. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). Specs the hat system that carries the time-bound,
auth-bearing inter-member contracts.

## Aaron's words

> "so they will need their own key too, and a system to assign owners of the hats
> during their period. there is a limited number of types and slots per type per git
> repo. some are meta and some are repo-specific and some are game-specific — really
> can be tied to any of the Markov boundaries and some internal structures."

## What a hat is (refined)

A **hat** is a role-scoped capacity a persona wears (SEED-VOCABULARY: *skill* = a
procedure; *hat* = a role-scoped bundle). This refines it into a **first-class,
keyed, scarce, owned-for-a-period, boundary-scoped entity**:

### 1. A hat has its OWN key

Each hat is **key-bearing** — its own keypair (like a persona's keyring). The hat's
**contract + auth are signed by the hat's key**, so "who holds this hat right now" is
cryptographically attributable, and a hat's actions are signed *as the hat*, distinct
from the persona's own identity key. (The keyring generator extends to hats:
`keyring.sh generate hat:<repo>/<type>/<slot>` style, same byte-locked derivation.)

### 2. Owned-for-a-PERIOD (the assignment system)

There is a **system to assign owners of hats during their period** — a hat is held by
a persona for a **bounded tenure**, then reassigned. This **matches the time-bound
contracts** (the hat's contract expires with the period; renewal is unanimous +
re-time-bound). Tenure/term-limited office: no one holds a hat forever (weight-free
§3 — no permanent authority), and the assignment ledger records who held what, when.

### 3. SCARCE — limited types × limited slots per type, per git repo

Hats are a **bounded resource**: a finite set of **hat types**, and a finite number of
**slots per type**, **per git repo**. The **repo is the registry/scope** that declares
its hat taxonomy + slot counts (e.g. *N architect slots, M reviewer slots*). Scarcity
makes hats meaningful (contention, allocation, value) and ties to existing bounded-role
discipline (AGENTS.md §13 reviewer-count; the economy — slots as a scarce good the
privacy-budget/hard-money market can price/allocate).

### 4. SCOPED — meta / repo-specific / game-specific; tied to a boundary

Hat types are scoped:

- **meta** — cross-cutting hats (apply across repos/games);
- **repo-specific** — roles defined by and bound to a particular git repo;
- **game-specific** — roles within a particular game/sim (e.g. the Dark Hall chip8
  society sim).

More generally, **a hat can be tied to any Markov boundary** (a cell, a persona, a
repo, a game, a sub-society) **or to internal structures**. The hat exists *at* a
boundary — it is the role-capacity for acting at/within that boundary. (Traveler-frame

+ cell: a hat is how a persona is authorized to act across a specific boundary for a

specific period.)

## How it all composes

```
hat = { type, scope (meta|repo|game|boundary), slot,            // scarce, repo-registered
        key,                                                    // its own keypair (signs as the hat)
        owner: persona  for  period [t0, t1),                   // assigned tenure (time-bound)
        contract { auth, exit, time-bound, renewable-by-all } } // the inter-member commitment it carries
```

- the **contract** (time-bound, exit-paired, renewable-by-unanimous, comes-with-auth)
  is **carried by the hat** and **signed by the hat's key**;
- the **owner** holds the hat (and thus its contract + auth) **for the period**, then
  it reassigns — so obligations to others bind the *holder during tenure*, attributable
  by the hat's signature, and don't leak past the period;
- **scarcity + scope** (typed slots per repo, meta/repo/game, boundary-tied) make the
  hat system a **bounded, legible authority map** — you can enumerate every role, its
  holder, its term, its boundary, and its contract.

## Honest scope / handoff

Architecture capture, not built. Building blocks exist (SEED-VOCABULARY hat def;
`Persona.fs` "a persona wears a superposition/subset of hats"; the keyring derivation;
AGENTS.md §13 bounded roles). To build: a **hat registry per repo** (types + slot
counts), a **keyed-hat derivation** (extend the keyring), an **assignment/tenure
system** (owner-for-period, time-bound, with the contract properties), and
**boundary-binding** (which Markov boundary each hat type attaches to). Routes to the
Architect (Kenji) for the registry/assignment design + Ilyana (public surface) +
the math team (slot-allocation / tenure as part of the toymodel docket).

## Anchors / ties

Role-based access control (RBAC) + capability roles; term-limited / tenured office
(time-bound ownership, no permanent authority — §3 weight-free); scarce-slot allocation
(AGENTS.md §13 reviewer-count; resource contention; the hard-money market); object-
capability (keyed hats sign their own actions); the Markov boundary / cell / traveler
frame (boundary-tied scope); SEED-VOCABULARY (skill vs hat); `Persona.fs` (persona wears
hats); the hat-contract properties doc (time-bound/exit/renewable/auth) — this is the
container those contracts live in.
