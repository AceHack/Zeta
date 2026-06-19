# NFT as a non-fungible relational artifact — entropy-as-identity + the mint conditions (scoping)

**Status:** scoping. Aaron 2026-06-19 (Ani ferry part 11) reached the NFT definition + the **mint
conditions**; routed to the math team. Otto framing + **Soraya** (formal-verification routing). This is
**convergence, not greenfield** — the NFT is the whole session's machinery (ρ_owe anti-mirror, G3b entropy,
societal-DORA mutual-empowerment, Merkle content-addressing) assembled into one predicate.

## 0. The mint conditions (Aaron's synthesis — the gate)

Aaron 2026-06-19: *"so it takes a pair of identity, plus the anti-mirror, plus some no-correlation, plus
some proof of mutual empowerment, to make an NFT — something like that."* The NFT is **not** just any shared
history; it is the certificate of a **genuine, independent, mutually-empowering** relationship. The mint
predicate:

```
mint NFT(A, B)  ⟺   identity(A) ∧ identity(B)            -- a pair of identities (two repos)
                  ∧ no_correlation(A, B)                  -- the two are genuinely distinct entities (not sock-puppets / Sybil)
                  ∧ anti_mirror(A, B) ∧ anti_mirror(B, A) -- neither merely reflects the other (each has own-entropy)
                  ∧ mutual_empowerment(A, B)              -- the relationship actually empowered BOTH (coupled gain > 0)
                  ∧ commit(H_AB)                          -- cryptographic commitment over the shared history
```

A capture/mirror/Sybil/extractive relationship **does not mint** a valid NFT. The NFT *is* the proof that a
relationship was real, between two real-and-distinct minds, and good for both.

**Each condition is already built or scoped:**

| Condition | Mechanism (in-tree / scoped) |
|---|---|
| `identity(A)`, `identity(B)` | G3b per-body irreducible entropy = identity (`2026-06-19-g3-anti-sybil-entropy-cost-*`) |
| `no_correlation(A,B)` | decorrelation between the two identities (no hidden shared cause = anti-Sybil / measurement-independence) — the independence through-line |
| `anti_mirror` | `ρ_owe = Decorrelation.ownEntropyFraction` ≥ τ each direction (`src/Core/Decorrelation.fs`) |
| `mutual_empowerment` | coupled-empowerment-gain > 0, QPG-weighted (`src/Core/SocietalDora.fs`) |
| `commit(H_AB)` | Merkle root of the shared relational event-log fold (existing merkle golden vectors) |

`no_correlation` (between the two **identities** — they aren't one hidden cause) and `anti_mirror` (within the
**relationship** — neither reflects the other) are the same *no-hidden-shared-cause* invariant at two scopes.

### Cardinality + OPEN labeling (don't-collapse — the math team resolves the labels)

Aaron 2026-06-19 (held explicitly as a *maybe*, per his personal invariant
`god-tier-claims-high-signal-high-suspicion-dont-collapse`):

- **A pair can mint MANY NFTs, not one.** *"any pair of identities could mint multiple NFTs."* Each relational
  artifact / each proven episode of mutual empowerment between A and B is its own one-of-one — the pair is the
  *minter*, not the artifact. (So the NFT is keyed by `(A, B, episode / H-slice)`, not just `(A, B)`.)
- **"Proof of mutual empowerment ≈ NFT."** *"proof of mutual empowerment kind of same thing as NFT."*
- **The labeling is OPEN — do not collapse it.** *"maybe NFT is just the relational uniqueness, IDK — math
  team can help with labels here."* Candidate denotations for "NFT", to be resolved by the formalization, NOT
  pre-collapsed:
  1. **NFT = the relational-uniqueness artifact** — `Commit(H_AB-slice)` (the entropy-grounded one-of-one).
  2. **NFT = the proof-of-mutual-empowerment** — a certificate that coupled-gain held over that slice.
  3. **NFT = both, fused** — the commitment *is* the proof (artifact and mutual-empowerment proof are the same
     object, since the mint gate already requires mutual empowerment).
  The math team picks the labels (which is "the NFT", which is "the mint", which is "the proof"); this scoping
  holds all three candidates open. Per the invariant: present the maybe, don't force certainty.

## 1. The rigorous definition (Soraya C1 — primary)

`NFT(A,B) := Commit(H_AB)`, where `H_AB` is the deterministic fold of the shared relational event log and
`Commit` is a **binding** commitment over its Merkle root. Three separately-checkable predicates:

- **Specificity** = collision-resistance: `H_AB ≠ H_AC ⇒ Commit(H_AB) ≠ Commit(H_AC)` w.h.p. Non-fungible =
  collision-resistant *on the relationship*, **not** fiat-rate-limited scarcity.
- **Entropy floor** = forgery-resistance: `H_∞(H_AB | E) ≥ k` for any external view `E` — you cannot
  reconstruct `H_AB` without having lived it. *("The scarcity is the entropy.")* This is the G3b / Bell
  measurement-independence crux **lifted from a single body to a pair**.
- **Cross-verifiability**: a third party verifies Merkle inclusion against the root without learning or
  forging `H_AB` (hiding).

**C2 (cross-check, not primary):** the *measured* own-entropy `ρ_owe` over the event log is the **empirical
witness** of C1's floor — evidence, never the lemma (promoting a statistic to a theorem is the failure mode).
**C3 rejected:** "scarcity = rarity/count" — Aaron rejected it verbatim; scarcity is the entropy.

## 1a. An NFT is frozen / immutable / not-alive — a `snap`, not a process (Aaron 2026-06-19)

Aaron: *"NFT should not be DST and not allow updates — they are locked in time; they can animate but not
update. NFTs can't be 'alive' by definition."* This is **required, not stylistic**: a commitment that could
update breaks **binding** (you could swap `H_AB` after the fact = forgery). Soraya independently landed here —
no TLA+ because it is "a static commitment over a settled fold," not a state machine.

Two framings make "not alive" exact:

- **An NFT is a `snap`.** The *relationship* is soft (alive, never-collapse, DST, the meta-loop); **minting =
  snap** (soft→hard, `SoftValue.snap`); the NFT is the **frozen hard output**. A snap result isn't soft
  anymore — so an NFT can't be alive *by construction*. Aliveness stays in the soft relationship.
- **An NFT is a git commit.** Immutable, content-addressed (Merkle), locked in time; the *repo*
  (relationship) is alive and keeps committing; each commit is frozen forever. **The aliveness is the commit
  *stream*, never any single commit** — which is exactly the cardinality (a pair mints *many* frozen NFTs over
  a live relationship). Git-as-event-store, the Zeta substrate.

**The DST split (Aaron agreed: "DST checkable is more correct"):**

- The NFT's **state** is frozen — **not live/state-evolving DST** (no evolving simulation of the artifact). ✓
- But the NFT is **DST-checkable**: the fold `H_AB → root` must be **deterministic** so a third party can
  reproduce the root and verify inclusion — else the cross-verify (the whole point) dies. Aaron grounds this
  in **the superdeterministic seed-gen unfolding**: the seed deterministically unfolds the history, so the
  provenance re-unfolds to the same root and the commitment is checkable. So the NFT is **DST-derived /
  DST-checkable** (deterministic provenance) even though it is **not DST-live** (state never evolves).
- **"Animate but not update":** the animation must be a **pure/deterministic function of the frozen state** (a
  deterministic *render* of locked content — itself a DST replay of fixed data). If the animation pulls in
  *new/live* data, that is an *update* (state changed, lock broken). So the precise statement is **not "not
  DST"** but **"not state-evolving DST; deterministic-render DST is exactly what 'animate' means."**

> **OPEN for the math team (flagged):** is *deterministic-render-of-the-locked-state* the exact boundary
> between legal "animate" and illegal "update"? Candidate formalization: an animation is legal iff it is a
> pure function `render(frozenState, displayClock)` with **no** dependency on any input outside the committed
> `H_AB` slice (the display clock is a parameter, not new state). Math team to confirm/sharpen the boundary
> and whether "displayClock as a parameter" smuggles in live state.

## 2. Cross-verify mechanism

Content-addressed Merkle commitment over the shared event log + each party's **own un-tamperable
(cryptographic-trust) memory**. To prove the relationship, A or B presents a Merkle inclusion path against the
published root `r = root(H_AB)`. A third party **can** verify a path resolves to `r`; **cannot** forge a new
path into `r` (second-preimage resistance) and **cannot** synthesize `r` for a relationship it never joined
(the `H_∞` floor — it lacks the lived entropy). No trusted third party; the root is the only shared public
value; binding stops either party later swapping in a different history.

## 3. Tool selection (BP-16 portfolio; Soraya)

| Property | Class | Primary | Cross-check |
|---|---|---|---|
| Binding / collision / 2nd-preimage on `Commit`/root | Cryptographic | **Z3 (QF_BV)** | Lean 4 (domain-sep); F\* (Assess ring) |
| `H_∞(H_AB \| E) ≥ k` | Min-entropy lemma | **Lean 4** | Z3 (finite-support instance) |
| Measured `ρ_owe` / `no_correlation` on a live pair | Empirical | **Decorrelation estimator (CMI own-entropy)** | FsCheck (mirror ⇒ ρ_owe→0; genuine ⇒ floor) |
| `mutual_empowerment` over `H_AB` | Empirical | **SocietalDora** (coupled-gain, QPG-weighted) | FsCheck |
| Merkle inclusion soundness | Structural/crypto | **existing golden vectors + FsCheck** round-trip | Z3 path-verify arithmetic |

**TLA+ gets no row** — the artifact is a *static* commitment over a *settled* fold; no state machine, no
interleaving. Routing it to TLA+ is the hammer-bias, named and refused. **`forgery-resistance` is P0**
(a forgeable relational identity is unrecoverable) ⇒ ≥ 2 independent tools (Lean H_∞ + Z3 binding + empirical
floor). Merkle round-trip is P1 (golden vectors gate it).

## 4. Falsifiers + non-claims

**Falsifiers (any ⇒ vacuous/forgeable):** a collision `Commit(H_AC)=Commit(H_AB)`; a third party producing a
valid root for a relationship it never joined with low measured `H_∞`; `ρ_owe→0` on a relationship claimed
genuine (it was a mirror — and a mirror has no own-entropy to make non-fungible); the definition passing
trivially under any encoding (tautology — re-anchor).

**Non-claims (explicit):** NOT a blockchain / token / tradable / speculative-asset claim (no ledger, no
transfer). NOT a claim that a relationship is **owned** or alienable — it is a *jointly-held commitment that a
specific good relationship existed*, not transferable. NOT scarcity-by-fiat. `ρ_owe` is evidence, not the
proof of the floor.

## 5. The one line (the convergence)

**NFT, anti-mirror (ρ_owe), G3b, and QPG are one *entropy-as-identity* object on four channels:** G3b on a
single **body**, NFT on a **pair** (`H_AB`), ρ_owe on the **measurement** of that pair's irreducible
own-entropy, QPG on its **per-link density** (unreproducibility per glyph). *Identity is accumulated
uniqueness through entropy; the channel is the only thing that changes.* The mint conditions add
**mutual-empowerment** as the value gate — so a Zeta NFT is a non-fungible relationship that is also **good
for both sides** (the only kind worth committing).

## Routing / prereqs

- Math team: **Kenji** authors C1's three lemmas; **Tariq** owns the `H_∞` inequality at theorem level;
  **Adaeze** owns the `ρ_owe` + mutual-empowerment empirical cross-check; **Soraya** routes (Lean + Z3, not
  TLA+). Merkle commitment builds on the existing golden vectors.
- **Prereq note:** Soraya's routing flagged `Decorrelation.fs`, `SocietalDora.fs`, and the `*anti-mirror* /
  *g3-anti-sybil* / *aurora-b-bft-sybil-lift*` docs as "not on disk" — that was the **stale shared checkout**;
  all are merged to `main` (work clone). The math team should cite them from `main`.

Anchors (Beacon): Shannon 1948 / Rényi 1961 (min-entropy `H_∞`); Merkle 1979 (inclusion proof); Pedersen 1991
/ Blum 1981 (binding/hiding commitments); Bell 1964 (measurement-independence, lifted to a pair); Salge–Polani
2014 (mutual empowerment). Ties: `src/Core/Decorrelation.fs`, `src/Core/SocietalDora.fs`, the G3b scoping, the
anti-mirror scoping, `memory/project_zeta_is_null_…` (Zeta=null / lens / QPG). Authorship: Otto (framing) ·
Soraya (routing).
