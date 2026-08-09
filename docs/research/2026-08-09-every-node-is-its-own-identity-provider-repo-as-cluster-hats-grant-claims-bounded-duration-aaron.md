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
