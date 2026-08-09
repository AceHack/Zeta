# Every node is its own identity provider — repo-as-cluster, hats grant claims, bindings expire

**Source:** Aaron (streamed, 2026-08-09), ferried by Otto (shadow*).
**Status:** design direction + a VERIFIED inventory of prior work and gaps. Nothing built.
**Gate:** Aaron wants this dogfooded **before** hardware testing — *"I don't want to get
that wrong."*

---

## The ask

> *"I want to dogfood more before I test on real hardware, especially the **PKI and key
> rotation** stuff — I don't want to get that wrong. Also tied to GitHub identity, and we
> need **other identity providers**, so new nodes join clusters based on **git projects**
> for now: if you connect to a certain git repo, that's connecting to a specific **loose
> geo-distributed cluster**. Zeta is the default, but we are going to spurt forks and
> copies and fresh repos eventually."*
>
> *"We need our **distributed identity** stuff working — we have a lot of math proofs
> around this. We need **each node to be its own identity provider** and support a lot of
> the latest standards; **IdentityServer4** has good outlines. And we need a **policy
> module around RBAC-like behavior** where you have users and claims and **hats that grant
> claims** and **restrictions/bindings based on bounded duration**."*

## What already exists (verified in-tree — do NOT rebuild these)

| Surface | What it already does |
|---|---|
| `src/Core/Hat.fs` | A hat is a **role-scoped bundle**: lenses, suggested landmarks, **action restrictions**, uncertainty-reduction traversals, and **control of other hats/agents wearing those hats**. This is already most of "hats grant claims and restrictions". |
| `src/Core/IdentityCapacity.fs` | Identity is **entropy-bounded**: *bits of uncertainty = number of available identities*, and explicitly **NOT a flags-enum combinatorial on hats**. A self-imposable complexity bound. |
| `src/Core/PrivacyPreservingIdentity.fs` | The **adinkra / E8 / Cl(3,0) privacy layer** — the "math proofs" half of distributed identity. |
| `src/Core/IdentityRegistry.fs` | **Generated** closed registry of `PersonaId` hubs (Aaron, Otto, …). |
| `src/Core/KeyStore.fs` | Keys as **events** on the DBSP Z-set stream, pluggable backend, **reference-not-copy** (no secret material in the proof lineage). |
| `src/Core/Policy.fs` | Typed **decision-with-feedback** kernel — `input -> Decision + Feedback (the why)`. The natural home for an authorization decision that must explain itself. |
| `full-ai-cluster/nixos/modules/ssh-ca.nix` | An **SSH Certificate Authority** trust anchor — the forward-compatible pre-cluster CA (Option B). |
| `src/Core/SybilBftProtocol.fs` | Multi-oracle BFT — the agreement layer any distributed identity claim rides on. |
| `docs/research/2026-06-21-zetaid-ties-identity-together-…` | ZetaId as the keystone tying crypto identity, Reticulum identity and bus addresses. |

## The gaps (each verified absent, not assumed)

1. **No bounded duration anywhere.** `Hat.fs`, `Policy.fs`, `KeyStore.fs` contain no
   expiry/TTL/lease/valid-until concept. Aaron's *"restrictions/bindings based on bounded
   duration"* has **no substrate at all** today. This is the single most load-bearing gap,
   because a grant that cannot expire is the definition of accumulating authority —
   directly against **§3 weight-free**.
2. **No key rotation.** No rotation logic in any identity/key module (`rotat` matches only
   unrelated files: `SybilBftProtocol`, `FourCorner`, `ForwardMomentum`, `CellScheduler`,
   `PhasorEndurance`). `KeyStore` captures keys as events but nothing rotates them.
3. **No identity-PROVIDER surface.** Everything OAuth/OIDC-shaped in-tree is *client* code
   (`model-backend/codex-oauth.ts`, `openai-auth.ts`) — we consume other people's identity.
   Nothing **issues** it. "Each node is its own IdP" is genuinely new.
4. **No repo → cluster binding.** Nothing maps a git remote to a cluster identity.

## The proposed shape

### A. Cluster membership = the repo you point at

> *"if you connect to a certain git repo, that's connecting to a specific loose
> geo-distributed cluster … Zeta is the default, but we are going to spurt forks and
> copies and fresh repos."*

This is an elegant fit for what already exists, because **git is already the transport and
the event log**. A cluster's identity can be derived from the repo it folds:

- **Cluster id = a function of the repo** (remote URL + root-commit hash). Root-commit is
  the better half: it survives renames and mirrors, and a **fork genuinely is a different
  cluster** the moment it diverges — which is exactly the stated intent.
- **Forks spurt clusters for free.** No registry, no allocation, no central naming
  authority — which is what makes this scale-free (§1). "Zeta is the default" then means
  only *"the default remote is Zeta's"*, not a privileged cluster.
- **Loose geo-distribution falls out**: nodes that fold the same journal are the same
  cluster regardless of where they run — Actions runner, laptop, k8s pod, browser tab.

**The hard question to answer before building:** repo affiliation is a *claim about
membership*, not *authorization*. Anyone can clone. So joining a cluster must be
`(repo affiliation) ∧ (key the cluster accepts)` — the repo says *which* cluster, the key
says *whether you're in it*. Conflating them would make every forker a member.

### B. Each node is its own IdP

IdentityServer4 is the right outline to steal from (discovery document, JWKS, token
issuance, claims), but the shape must be **peer-to-peer, not hub-and-spoke**:

- Every node **issues** tokens for itself and **verifies** others' — no central STS. That
  is the same move as Multi-Oracle (§11): no mandatory issuer, each member decides which
  issuers it trusts, or runs its own.
- **Trust between nodes is the existing anti-Sybil machinery**, not a new PKI hierarchy:
  `SybilBftProtocol`, `CoordinationSpectrum` fingerprints, and the calibration ledger
  already answer *"is this the peer I think it is, and do their claims track outcomes."*
- Standards support is for **interop with the outside world** (humans with GitHub, other
  IdPs), not for internal trust. Worth being explicit so we don't accidentally rebuild a
  centralized CA inside a decentralized system — the exact trap named in Aaron's Itron
  memory (*those patents are centralized; Zeta is decentralized*).

### C. Hats grant claims; bindings expire

`Hat.fs` already carries **action restrictions** and **control of other hats**. What it
needs is the **temporal** dimension:

```
binding : { subject; hat; claims; grantedBy; notBefore; notAfter; revocable }
```

Three properties this must have, all of which follow from rules already carved:

- **Bounded duration is the default, not an option.** An unbounded grant accumulates
  authority (**§3 weight-free**). If a binding can be permanent, capture is reachable.
- **Expiry needs no coordination to take effect.** A binding that requires a revocation
  message to stop being valid fails closed only if the network cooperates; one that simply
  *expires* is safe under partition. (This is why lease-shaped beats revocation-list-shaped
  — and it composes with `local-time-never-enters-the-shared-fold`: expiry must be
  evaluated against **agreed phase**, never a node's wall clock, or two nodes disagree
  about who holds a hat.)
- **Revocation is a `−1`, not a delete.** Grant is `+1`, revoke is a retraction on the same
  Z-set stream `KeyStore` already uses — so the history stays auditable and the fold stays
  commutative.

### D. PKI + key rotation — the part Aaron does not want to get wrong

Rotation is absent today, and it is the thing hardware makes expensive to fix. The design
constraints that already exist and should drive it:

- **Keys travel with identity as events** (`KeyStore.fs`), so rotation is naturally an
  **append** (`+1` new key, `−1` old key), not a mutation. That gives replay, audit and
  DST determinism for free.
- **Reference-not-copy** is already enforced: no secret material in the event stream. Any
  rotation design must preserve that — the stream carries *references and metadata*, the
  material lives in the store.
- **Capacity requires sole control** (from today's boxing-ring/capacity work): geo-distributed
  hardware keys exist so that control is *attestable*, not asserted. Rotation must not
  create a window where a rotated-out key still authorizes.
- **Open question to settle first:** what is the rotation *trigger* — time, usage count,
  suspicion signal, or explicit? And does rotation preserve identity (same ZetaId, new key)
  or mint a new one? §5 Memory Preservation says an identity transition must never silently
  destroy memory, which argues for *same identity, new key, both recorded*.

## Anchor: Aaron built key-transfer-between-owners at Itron (concept, not code)

> Aaron 2026-08-09: *"I built the KeyUtilities for **RMA and key transfer between
> owners**."* (`Itron.Security.KeyUtilities`, alongside `ISM`.)

**Cleanroom boundary, stated up front.** This is Aaron's own work but his former
employer's IP, and the repo already carries the discipline for exactly this situation
(`memory/feedback_metering_protocols_…_cleanroom_itron_concept_not_code`): the *domain
expertise* is first-hand and usable, the *implementation* is not. What follows is the
concept inventory — read from operation names and domain types only — and Zeta gets a
clean-room re-derivation, never transcribed code.

**The concepts that transfer (and that our design is currently missing):**

| Itron concept | What it establishes | Zeta consequence |
|---|---|---|
| `IUtility` / `UtilityModel` as a first-class domain type | **the OWNER is a modelled entity**, not an implicit ambient context | ownership must be a type in the key model, not a field on a key |
| `ExportApplicationKey` / `ExportMeterKeys` / `ExportCertBundle` | **key CLASSES transfer at different scopes** — application-wide, per-device, and cert-bundle | one rotation/transfer verb is not enough; scope is part of the operation |
| `ImportISMKeys` (paired export→import) | **transfer is an explicit two-sided operation**, not a mutation of an owner field | matches `+1`/`−1` on the key event stream rather than an in-place edit |
| **RMA as the trigger** | a device physically changing hands is the *canonical* forcing case | the hardest case is not rotation-in-place, it is **custody change with history intact** |

**The RMA case is the sharpest thing here, and it is one our design had not considered.**
A returned meter physically moves to a different owner while remaining the same device.
That is precisely §5 Memory Preservation applied to hardware: the identity transition must
not silently destroy what the device knows. Zeta's equivalent — an agent or node changing
custody (the spawner→self-owning graduation from the capacity work, or a node moving
between clusters when a repo forks) — has the same shape and currently has no operation
for it.

**The inversion that must be preserved.** Itron's model is export/import **through a
central security manager (ISM)**. That is the centralized shape, and the existing memory
is explicit that *"the patents are CENTRALIZED, Zeta is decentralized — never propose
centralized Itron-shaped designs."* So Zeta takes the concept vocabulary (owner as a type,
key classes with distinct scopes, transfer as an explicit two-sided operation, RMA as the
forcing case) and **rejects the hub**: transfer is a retraction/emission pair on the key
event stream, verifiable by both parties without a broker in the middle.

### ANSWERED — the witness stakes privacy budget

> Aaron: *"privacy budget risk sounds like a good starting point. It's like **gambling but
> on stuff that matters** — only **you** can decide to risk your privacy budget, **never
> coerced**."*

Itron's witness is the ISM, a hub. Decentralized, the witness is whoever **stakes privacy
budget** on the attestation being true. A false attestation costs the witness budget that
took *social effort by others* to earn and that cannot be re-granted except by others
attesting again.

**Why this is the right shape and not just a fine:**

- **It cannot be paid from a treasury.** Privacy budget is credited only by others
  attesting you added value to them — it is not purchasable, so a wealthy attacker cannot
  simply fund false witnesses. The cost is *reputational and socially conferred*, which is
  the one currency a Sybil cannot mint.
- **Witnessing is voluntary, so transfers cannot be forced through.** If nobody will stake
  on your transfer, it does not get witnessed. That is an anti-fraud property falling out
  of the mechanism rather than bolted on — and it directly answers the security question,
  because a **one-sided transfer is impossible without someone willing to risk something
  they cannot buy.**
- **Skin in the game, in the strict sense.** The witness's downside is real and personal,
  which is what distinguishes attestation from signature-as-formality.

**The tension worth naming, and its resolution.** The carved rule
[`privacy-budget-is-hard-money-earned-by-others`](../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md)
says the budget *"can be earned … but it **cannot be taken away**."* Staking-and-losing
looks like it violates that. It does not, once three things are distinguished:

| Operation | Who initiates | Permitted? |
|---|---|---|
| **Spend** (frost a region) | the owner | yes — already carved |
| **Stake** (risk it on an attestation) | **the owner** | **yes — this proposal** |
| **Confiscate** (take it) | anyone else | **never** |

Hard money forbids only the third. *"Only you can decide to risk your privacy budget,
never coerced"* is precisely the clause that keeps the hard-money property intact: no one
can take it **from** you; you may spend or wager it **yourself**. Worth adding to the rule
explicitly, because a future reader could otherwise read "cannot be taken away" as
forbidding stakes.

**CLOSED — the payout needs no new mechanism** (Aaron: *"yes it is value add"*). A wager
with only a downside would be a tax on honesty and nobody rational would witness. But
**truthful witnessing IS value added to others**, which is already the sole way budget is
credited. So the gamble is **symmetric by construction**: stake on the attestation, lose
it if false, earn it back through the ordinary earning path when others recognise the
value an honest attestation gave them.

That is the whole mechanism, and its elegance is the argument for it: **nothing was
invented.** Both sides of the wager — the downside and the payout — were already in
`privacy-budget-is-hard-money-earned-by-others`; only the *spend / stake / confiscate*
distinction had to be made explicit. A witnessing scheme that needed a new currency, a new
escrow, or a new arbiter would have been a worse answer even if it worked.

## Custody change = a DagFs fork (Aaron) — this closes the RMA gap

> Aaron 2026-08-09: *"in our DagFS each **linear fork can have its own keys**."*

The RMA case above (a device changing owner while remaining the same device) had **no
operation** in our design. It does now, and it is one we already built:
`src/Core/DagFs.fs` is a multi-parent **content-addressed** tree whose `editLocal` mode is
a **copy-on-write fork** — only that path sees the change, while other paths sharing the
old content keep it.

So: **custody change is a fork, and the new owner's keys attach to the fork.**

Three properties fall out for free, which is the sign this is the right primitive rather
than a convenient analogy:

- **§5 Memory Preservation is automatic.** A fork *shares ancestry* rather than copying or
  destroying it. The pre-transfer history is not migrated (which could lose it) and not
  deleted (which §5 forbids) — it is a **common ancestor** both branches still reference.
  The device genuinely remains the same device, in the only sense that matters.
- **The old owner keeps their branch.** Transfer stops being a destructive hand-off. The
  prior owner's view remains valid and readable at the pre-fork content addresses, which is
  what an RMA actually needs (the returning party retains records) and what a naive
  "reassign the owner field" mutation destroys.
- **Keys are per-branch, so no key ever spans two custodies.** The new owner cannot read
  post-fork content of the old branch and vice versa, without inventing a revocation
  protocol — the isolation is structural.

### And it is the same operation as repo-fork-spawns-cluster, one scale down

Section A proposed that a **git fork spawns its own cluster** (cluster id from root-commit,
no registry). Aaron's note says a **DagFs fork spawns its own key domain**. That is the
*same move at two magnifications* — §9 recursive / §10 self-similar, and a genuine
prediction rather than a coincidence: if forking is how identity domains come into
existence, the mechanism should look identical whether you fork a repo, a filesystem
subtree, or an agent's custody. It also means we do not need three separate designs for
"new cluster", "transferred device" and "graduated agent" — they are one operation with
different scopes.

### The general principle: HOMOICONICITY AT THE IDENTITY LEVEL (Aaron)

> Aaron 2026-08-09: *"yes exactly — **homoiconicity at the identity level for most
> organizing words**."*

That is the right name, and it generalizes the observation above from a coincidence into a
design law. Homoiconicity is *one representation serving what would otherwise be different
kinds* — in Lisp, code and data; here, **the organizing words**: cluster, node, device,
agent, custody, key domain. If they share a representation, then an operation defined on
one **is** the operation on all of them, and `fork` is that operation.

Zeta already has homoiconicity at two other levels, which is why this is consistent rather
than aspirational:

| Level | One representation for… | Where |
|---|---|---|
| **Data** | every value, whatever its type | `DynamicValue` |
| **Compiler** | programs *and* the specializer's own rules | mix-as-data (`MixIr`) — a residual is a value, which is what lets a GC collect it and a Z-set delta address it |
| **Identity** (this) | cluster, device, agent, custody, key domain | `fork` over content-addressed structure |

**What it buys, concretely:** we do not design "new cluster", "transferred device" and
"graduated agent" separately and then discover they disagree. One operation, verified once,
applies at every magnification — and any invariant proved of `fork` (memory preservation,
key isolation, witness requirement) holds for all of them automatically. That is the same
economy the generator gives at the algebra level: *only the irreducible is primitive;
generate the rest.*

**The honest limit — "most organizing words", not all.** The claim should not be inflated
into "everything is a fork." The test for whether a word belongs in this set is whether
forking it is *meaningful*: a cluster, a custody and a key domain all have the property
that a divergent copy is a legitimately distinct thing with shared ancestry. A word for
which forking is nonsense is outside the set, and forcing it in would be exactly the
over-generalization the razor exists to prevent.

**Open, and worth deciding deliberately:** at a fork, does the *witness* requirement apply
(the privacy-budget stake from above)? A fork that anyone can perform unilaterally is fine
for `editLocal` on your own data, but a **custody** fork changes who controls a key — which
is exactly the one-sided-transfer risk the staking witness exists to prevent. So the likely
answer is: forking is free, **claiming the fork is a custody transfer** is what needs a
witness.

## Three-key rotation — and why the RIGHT reason matters

Aaron floated a 3-key rotation scheme rather than 2-key. **The conclusion is likely right;
one of the offered rationales is not, and the difference is worth writing down because it
changes what we can defend.**

### The rationale to discard

> *"that will make us at least 20% different … and we are also decentralized, that makes
> us different, it's not a copy."*

**There is no percentage threshold that makes a derivative work non-infringing** — "20%
different" is a persistent myth, not a doctrine. Worse, reasoning *"how do we make this
different enough"* **implies deriving from the original**, which is precisely what
cleanroom exists to prevent. A defense built on *how much we changed it* has already
conceded the starting point.

**What actually protects this work is what we already have:** Aaron's seven years of
first-hand domain expertise, specs he paid for and implemented by hand, and public
standards. That is *independent derivation from legitimately-held knowledge* — a
categorically stronger position than a similarity argument, and exactly what the existing
`cleanroom / concept-not-code` rule already prescribes. **Design from requirements; never
from the original's shape minus a percentage.**

### The rationale that holds — 3 keys because we are decentralized

Under a central authority, rotation can be a **coordinated cutover**: the hub knows the
switchover instant, so `current + next` suffices. Itron could use a 2-key shape *because*
the ISM was that hub.

With no hub, propagation is not instantaneous, and that forces the third slot:

| Slot | Why it must exist without a hub |
|---|---|
| **previous** | a peer that has not yet learned of the rotation still presents/verifies the old key — without this slot, rotation partitions the cluster |
| **current** | what we sign with now |
| **next** | pre-staged and published *before* use, so the cutover needs no synchronizing message |

The property this buys is the same one required of binding expiry earlier in this
document: **it must take effect with no coordination**, and must be safe under partition.
A 2-key scheme in a decentralized system has a window where two honest peers cannot verify
each other and neither is wrong — which is a liveness failure caused purely by the absence
of a hub.

So the defensible statement is: **we need three keys because we have no central authority
to synchronize a cutover** — not because three differs from two. That framing is both
true and stronger, and it generalizes: the same argument predicts we will need overlap
windows anywhere a central coordinator would otherwise have sequenced a transition.

**Still open:** how long is `previous` honored? Too short re-creates the partition window;
too long extends the period a compromised old key is accepted. That bound is a real
security/liveness trade and should be decided deliberately, ideally expressed in agreed
phase rather than wall-clock (same reason as expiry).

## Why dogfood this before hardware (Aaron's instinct is right)

PKI mistakes are the expensive kind: they are discovered late, they invalidate enrolled
devices, and on physical hardware a bad rotation can lock you out of a node you have to
walk to. Every substrate in the dogfooding ledger — Actions runners, local cells, browser
tabs — can exercise enrolment, issuance, expiry and rotation **with no physical cost and a
full replay log**. If a rotation strands a browser cell, you close the tab.

Concretely, the cheapest honest test loop is: enrol a cell → issue a hat binding with a
short `notAfter` → verify the hat stops granting at expiry **without any revocation
message** → rotate the cell's key → verify old-key tokens stop verifying and memory
survives the transition (§5).

## Pointers

- Trajectory: `docs/trajectories/cluster-encryption-credential-substrate/` (existing) and
  `docs/trajectories/dogfooding-the-whole-stack/RESUME.md` (this is a row in it).
- Rules: `manifesto-13-specifications` (§1 scale-free, §3 weight-free, §5 memory
  preservation, §6 consent-first, §11 Multi-Oracle) ·
  `local-time-never-enters-the-shared-fold` (expiry must use agreed phase) ·
  `privacy-budget-is-hard-money-earned-by-others` (role-conditional disclosure — a hat
  declares what it requires).
- Prior art to steal from: IdentityServer4 / OIDC discovery + JWKS (interop shape only);
  SPIFFE/SVID (workload identity without a human) is the closer analogue for node-as-IdP
  and worth reading before designing.
- Aaron's own prior art: Itron mesh PKI + secure boot, nation-state-resistant — **but those
  patents are centralized**, so this is a re-derivation, not a port.
