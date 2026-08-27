# A hat is a contract — and contracts are what hold a federation together

**Source:** Aaron (streamed, 2026-08-26), ferried by the shadow.
**Status:** **naming, not re-scoping.** Nothing here changes what any hat
currently authorizes. Two additions in §4 are marked **proposal**, not canon.
**Checked at:** `eeb29eaf96194c53251aae80eee5a8c4384a48bd` (`origin/main`).

---

## 1. The observation

> *"we should update our hat literature with this contract language. we have
> some of this but not this exactly — we talk about hats coming with bounded
> authorization and restrictions/bindings; this is contract language in
> disguise. Also Addison in our glossary talks about cluster vs federation, and
> clusters don't really have hat contracts — they are just loosely connected —
> and federations have hat contracts they agree on. **Contracts hold federations
> together.**"* — Aaron, 2026-08-26

The concept has already landed on both sides. The gap is that **the two halves
do not reference each other**:

- `docs/GLOSSARY.md` §Cluster / §Federation already carries the canon sentence
  *"Relationships create clusters; contracts create federations."*
- The hat literature already writes contract clauses in every surface — and
  **never says the word.**

## 1a. Correction to my own first draft — the word is already carved

My first pass asserted that the hat literature *"never says the word contract."*
**That is false of the corpus**, and a fan-out search caught it before it
shipped. Recording the correction rather than quietly fixing it, because the
true finding is sharper than the false one.

**`vocab/words/hat.md` — the carved one-line vocabulary definition — already
reads:**

> *"A time-bound, exit-paired, auth-bearing **contract** — the right to speak or
> act in a room; renewable only by consent (C12/C14)."*

And **`Contract` is itself one of Addison Cooper's registered Genesis concepts**
(`docs/CONCEPT-REGISTRY.md`, authored 2026-06-20, `On page: yes`):

> *"enforceable obligation — and every one contains an exit"*

as are **`Hat`** (*"a temporary role — rights on, rights off, identity
untouched"*) and **`Cluster`** and **`Federation`**. The registry's expanded
column says a hat *"grants role-specific rights, privileges, restrictions, and
obligations"* — which is the contract reading, published, by the same author who
wrote the cluster/federation split.

So the honest statement of the gap is **adoption, not invention**:

| where | says "contract"? |
|---|---|
| `vocab/words/hat.md` (the carved kernel) | **yes — it is the definition** |
| `docs/CONCEPT-REGISTRY.md` (`Hat`, `Contract`, `Federation`) | **yes** |
| `docs/research/2026-06-09-the-summonable-is-a-contract-type-like-a-hat-*` | yes — coins *"hat-contract properties"* |
| `agentic-organization/docs/ORGANIZATION_LAYER_BUILD_PLAN.md` | yes — a literal `HatActivationPacket` / *"Hat Activation Contract"* |
| **`hats/README.md`** | **no** (before this change) |
| **`src/Core/Hat.fs`** | **no** |
| **`src/Core/Persona.fs`** | **no** |
| **`full-ai-cluster/.../hat-system/README.md`** | **no** (before this change) |
| **`docs/GLOSSARY.md` §Hat / §Hat vs persona vs role** | **no** (before this change) |

**The five surfaces an agent actually reads are exactly the five that dropped
it.** That is the failure mode
[`anti-babel-preserve-reconcilability`](../../.claude/rules/anti-babel-preserve-reconcilability.md)
names in the glossary row of its table — *"entries that the corpus never picks up
are coinages that did not take"* — caught here in the act. The word was carved in
`vocab/` in June and never propagated to the load-bearing surfaces.

**One phrase genuinely is new.** `rg -i "bounded authorization"` over the tree
returns **zero** pre-existing hits (the only matches are the files this change
adds). *"Bounded authorization"* is Aaron's 2026-08-26 phrasing, not established
repo vocabulary — worth knowing so nobody cites it as prior usage.

**And the connection Aaron asked for is genuinely absent.** `Hat`, `Contract`,
`Cluster`, and `Federation` are four concepts by one author in one registry, and
**nothing in the tree links the hat to the cluster/federation split.** That link
is what this document adds; the vocabulary it uses to do it was already ours.

## 2. The evidence — the hat surfaces already write contract clauses

Every row below is language that is *already in the tree*. The right column is
the ordinary contract-law name for what the left column describes.

| surface | the clause already written there | the contract term for it |
|---|---|---|
| `src/Core/Hat.fs` `AllowedActions` | *"the permitted `ActionGrammar` subset (the role's authority/permissions; empty = unrestricted)"* | **scope of authority** — what the party may do |
| `src/Core/Hat.fs` `Controls` | *"names of other hats/agents this hat controls/coordinates"* | **delegation / sub-agency** (a name edge, not enforcement — see §6) |
| `src/Core/Hat.fs` `Landmarks` | *"suggested solid ground the hat's lenses are parameterized by"* | **terms of reference** — the constants the parties navigate by |
| `hats/README.md` | *"a hat is **not an identity**; it is a **time-bound authority** you put on and take off"* | **term** + **unilateral termination by the wearer** |
| IdP research doc §C | `binding : { subject; hat; claims; grantedBy; notBefore; notAfter; revocable }` | **parties** (`subject`, `grantedBy`), **consideration** (`claims`), **term** (`notBefore`/`notAfter`), **termination clause** (`revocable`) |
| IdP research doc §C | *"Bounded duration is the default, not an option."* | **no perpetual grant** — the anti-capture clause |
| IdP research doc §C | *"Revocation is a `−1`, not a delete."* | the **auditable record**; history survives termination |
| hat-system CRD `Hat.spec.authority` | RBAC rules + namespace scope | **scope of authority**, again, at the cluster layer |
| hat-system `HatBinding` lifecycle | `Pending → Warmup → Active → (Probation) → Revoked` | **formation → probation → breach → termination** |
| hat-system `quorumGated` / `quorumSize: 3` | three co-signatures required to create a Hat | **execution formality** — counter-signature |
| hat-system `conflictsWith: [executor]` | a wearer cannot design *and* execute under the catalog it designed | **conflict-of-interest clause** |
| hat-system cooldown / warmup windows | *"every binding has cooldown, warmup, sticky-attribution windows"* | **notice periods** |
| hat-system `HatSwap` (append-only) | *"each state transition produces exactly one HatSwap"* | the **record of the instrument**, replayable years later |

**The falsifier for the adoption gap, and it is mechanical.** `rg -i "contract"`
over `src/Core/Hat.fs`, `src/Core/Persona.fs`, `hats/README.md`, and
`full-ai-cluster/k8s/applications/hat-system/README.md` returned **zero** hits at
the commit above. Thirteen contract clauses across four surfaces, and not one of
them says the word — while `vocab/words/hat.md` has said it since June. Aaron's
*"contract language in disguise"* is literally true **of the surfaces that
matter**, and it is checkable. (Two of those four are edited by this change, so
re-run the check against `eeb29eaf96` to reproduce the zero.)

## 3. What the naming buys — four claims

### 3.1 A hat IS a contract

*Bounded authorization + restrictions + bindings + bounded duration* is not
*like* the vocabulary of a contract; it **is** that vocabulary: what you may do,
what you may not, for how long, and on what terms. The carved kernel already
said so; the surfaces built on top of it stopped saying it.

Naming it is not decoration. It imports a body of prior art with several
centuries of adversarial testing — offer and acceptance, consideration, term,
breach, remedy, termination, novation — which is exactly what
[`anchor-to-human-prior-art`](../../.claude/rules/anchor-to-human-prior-art.md)
asks for, and it tells you which clauses a hat is *missing* by giving you a list
to check against. (Two of those are §4.)

### 3.2 Hats are what a federation agrees on

This is the concrete content of *"contracts hold federations together"*:

| | hats present? | agreed terms? | consequence |
|---|---|---|---|
| **cluster** | yes — people wear roles | **no** | wearing a hat **binds nobody**; obligation is social, and betrayal is a falling-out, not a breach |
| **federation** | yes | **yes — the members agreed the same hat contracts** | the obligations are **enforceable**, because both sides agreed the same terms |

A cluster has hats in the loose sense — someone is *the security one*, someone
is *the one who reviews the migrations* — but there are no agreed terms behind
the hat, so it confers no claim anyone else is bound to honour. A federation's
members have **agreed the same hat contracts**, and that agreement is what makes
the obligations enforceable. The hat is the **unit** of that agreement: it is
the smallest thing two parties can agree the terms of and then hold each other
to.

Which sharpens the canon sentence rather than replacing it. *Contracts create
federations* — and **the contracts are hats**.

### 3.3 Exit stays non-negotiable — a hat contract must always be removable

The Universal Exit Principle says no human, agent, vault, cluster, or federation
may be trapped indefinitely; exit may cost, but must exist. Applied here:

> **A hat you cannot take off is not a contract. It is a capture.**

And that is precisely the **`role`** failure the glossary retired the word for —
the maintainer, 2026-06-15: *"role[s] are a danger to leak into identity … you
put role above yourself in the hierarchy — **you are first**."* The hat-system
README's cage table already says the same thing in the mechanism register: a
cage comes off *"only by destroying the wearer"*, a hat comes off *"by swap-off
(one command)"*.

So the exit clause is not an extra requirement bolted onto the hat-as-contract
reading. It is the **discriminator that makes the reading true**: removability
is what separates a hat contract from a role, and a contract without a
termination clause was never the thing this vocabulary is naming.

**And this needs no importing, which is the strongest single piece of evidence
for the whole reading.** Addison Cooper's registered definition of `Contract` is
already *"enforceable obligation — **and every one contains an exit**"*
(`docs/CONCEPT-REGISTRY.md`), and `vocab/words/hat.md` already calls a hat
*"time-bound, **exit-paired**, auth-bearing"*. Two independent surfaces, written
months apart by different authors, both put **exit inside the definition** — of
the contract on one side, of the hat on the other. The identification is not a
mapping this document proposes; it is two definitions that already agree.

### 3.4 Payment terms belong in the hat contract

Aaron, on how an agent knows what incentive structure it is joining:

> *"the payment modes will be defined by hats in contract form — this is the
> distributed agent agreement that agents decide to opt into after reading the
> contract."*

Two things follow, and the second is the load-bearing one:

1. **The incentive structure is a term of the hat**, alongside scope and
   duration — not ambient policy that happens to apply.
2. **Opt-in is only meaningful if the terms are legible before acceptance.** An
   agent that must accept a hat to discover how it is paid has not consented to
   anything; it has been enrolled. *"decide to opt into **after reading the
   contract**"* puts the burden on the contract to be readable, which is what
   §4 is about.

## 4. Two additions — **proposals, not canon**

Neither is implemented. Neither has a work-item minted. Both are `unmetered` in
the sense of
[`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md):
argued, not falsified.

### Proposal A — declare the incentive alignment as a typed field, not prose

Reading *"the author pays the verifier"* and deriving *"therefore this
verification is approval-biased"* is a **non-trivial inference**, and the
evidence that it is non-trivial is that humans got exactly this wrong about
credit ratings for decades **with full disclosure**. The issuer-pays model of
the Nationally Recognized Statistical Rating Organizations was public,
documented, and understood by the professionals reading the ratings; the
inference from *who pays* to *which way the error leans* was still not made at
scale until 2008 forced it. Disclosure of the fact did not produce the
inference.

So the fact should not be prose. A closed set —

```
IncentiveAlignment = issuer-pays | consumer-pays | staked | none
```

— is comparable at a glance and machine-readable, which are different
properties and both wanted. That is the **discriminated-union discipline**
(`interfaces-free-classes-earned-under-rules`, and the DU habit throughout
`src/Core/`) applied to the contract itself: an open string field invites
thirteen spellings of *"the author pays"*; a closed set makes *"is this
issuer-pays?"* a `match`, not a reading-comprehension exercise.

**Honest limits, stated because a proposal that hides them is not one:**

- The four members are a **guess at the partition**, not a measured one. If a
  fifth arrangement shows up, the set was wrong — and per
  `itron-hub-patent-boundary-p2p-is-the-upgrade`, extending a closed set is a
  deliberate decision, which is a feature here rather than friction.
- A **declared** alignment is a self-claim. It is checkable only against
  behaviour, and nothing in-tree checks it today.
- `none` is doing real work and is easy to misread: it means *no economic
  relationship between the parties*, not *no bias*.

### Proposal B — an attestation must carry which hat contract produced it

Contract variety buys nothing if consumers cannot see which contract they are
reading. Without provenance, a **staked** verification and a **paid** one look
identical downstream, and nobody can discount either — so the honest verifier
and the conflicted one are priced the same, which is exactly the incentive to
stop being the honest one.

Concretely: an attestation carries the identifier of the hat contract under
which it was produced, so a consumer can resolve the terms and apply its own
discount. This is the same shape as
[`dual-use-detection-is-neutral-oracle-decides`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md):
the attestation reports the **fact** plus the **terms it was produced under**,
and the **consumer's oracle** decides what that is worth. The mechanism must not
decide for them, and cannot, without knowing their oracle.

Note this composes with, and does not duplicate, the AgencySignature
convention — that records *who made a commit and under what review posture*;
this would record *under what economic terms an assertion was made*.

## 5. The convergence at two scales — checked, with what does **not** match

The claim worth testing: **cluster-vs-federation appears at two scales**, once
socially and once in infrastructure, and nobody has connected them.

`docs/GLOSSARY.md` §Cluster explicitly warns that *Cluster* does **not** mean a
k8s cluster unless the doc says so, so the burden is on showing the **shapes**
match rather than that the **word** does. Per
[`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md),
the competing explanation has to be named and excluded: the competitor here is
*"`cluster` is simply a reused word"*, and a shared name identifies nothing.

### What matches

**The federation half matches, and matches in the load-bearing place — agreed
terms are the *precondition* for federating.** `full-ai-cluster/nixos/modules/cluster-network.nix`:

> *"What it blocks is two DISTINCT clusters ever **federating**: Cilium
> ClusterMesh requires disjoint pod/service CIDRs and distinct cluster ids, and
> identical literals make that impossible by construction."*

and

> *"two clusters that federate **exchange identity** anyway, and each can
> compute the other's values from its name alone"*

Disjoint CIDRs, distinct cluster ids, exchanged identity: that is *name,
membership rules, and agreed obligations* in the infrastructure register. Two
clusters cannot federate until they agree terms — which is the social claim,
stated in Nix.

**The sovereign-peers half matches.** *"A SECOND, FEDERATABLE CLUSTER is a
second checkout of this tree with a different `clusterName`… There is no
allocator and no registry to ask"* (`full-ai-cluster/cluster-identity.json`).
Two unfederated Zeta clusters coexist with **no enforceable obligations to each
other** and nothing appointed between them — the glossary's cluster property,
and simultaneously manifesto §1.

### What does **not** match, stated plainly

**A k3s cluster is tightly coupled *internally*.** Members share the CIDRs by
design; there is one control plane. The glossary's Cluster is loosely coupled
internally, held by relationships. So the mapping is **not** *"a k8s cluster is
a social cluster"* — and anyone reading it that way will conclude the wrong
things about both.

The mapping is between **relations**, not between the objects:

| | social layer | infrastructure layer |
|---|---|---|
| **cluster-shaped relation** | peers with shared history and **no enforceable obligations** | sovereign clusters, independently derived identity, **nothing agreed between them** |
| **federation-shaped relation** | **agreed terms** + membership + exit | disjoint CIDRs, distinct ids, **exchanged identity**, a join path |
| the transition | agreeing the contracts | ClusterMesh federation |

### Verdict, and what promotes it above a shared name

**Consistent with manifesto §9 recursive / §10 self-similar — the same
*relation* at two magnifications.** What excludes the reused-word explanation is
that the infrastructure layer arrived at *agreed terms as the precondition for
federating* **independently**, on Cilium's constraints, without citing the
glossary or the Genesis Concepts — and a coincidence of vocabulary would not
have produced a matching *precondition structure*. That is structure, not count.

**And the mapping earns its keep by predicting a gap rather than decorating one.**
The Universal Exit Principle says a federation must have exit procedures. At the
infrastructure layer there is a **join** path (`injected-server-join.nix`,
`injected-join-server.nix`, `k3s-join-observer.nix`) and, at this commit, **no
leave path** — no module for a node or a cluster to exit cleanly. The social
layer says that is not optional. So the convergence surfaces a real absence that
neither layer flagged on its own.

**No work-item is minted for it here** — naming the gap is this document's
whole claim about it, and inventing an id would be the fabricated-key failure.

## 6. Honest scope — what is stated versus what is enforced

Carried forward from the glossary's own honesty about the hat layer, because the
contract framing must not launder it into more than it is:

- `Hat.AllowedActions` is *"a structural allow-list (empty = unrestricted), not
  a proof of authority"*, and `Controls` is *"a name edge, not an enforcement
  mechanism"* (`src/Core/Hat.fs` docstring). Calling it a contract does not make
  it enforced.
- **Bounded duration has no substrate at all** in F# today — the IdP research
  doc verified that `Hat.fs`, `Policy.fs`, and `KeyStore.fs` contain no
  expiry/TTL/lease concept, and nothing has changed that. The **term** clause of
  the hat contract is the one that exists only as a design.
- The wearer-chooses property is *"stated, modelled in `Persona.fs`, and
  practised in prose — and enforced nowhere."*
- The hat-system CRDs are the closest thing to an enforced hat contract in the
  tree (Gatekeeper admission on seven throttles), and its operator Deployment is
  `replicas: 0` until an image is built.

So: **the vocabulary is right and the enforcement is partial.** Saying
*contract* names what the surfaces mean; it does not promote any of them to
metered.

## 7. Material we may not be able to read from here

Flagged rather than guessed at, per the ask:

- **The LFG root-site repo.** `docs/design/root-site-iris/HANDOFF.md` instructs
  that this folder's `site/` be committed to the **root** of
  `Lucent-Financial-Group/lucent-financial-group.github.io`, on its default
  branch. Anything edited **there** after the handoff — including any
  hat / cluster / federation prose on the published pages — is not visible from
  this tree. If hat-contract material exists outside Zeta, that repo is where I
  would expect it.
- **The published Genesis Concepts page.** `docs/CONCEPT-REGISTRY.md` is the
  single place a concept is added or changed, and
  `src/Core.TypeScript/hygiene/audit-concept-registry-drift.ts` fails on
  disagreement between the registry and the published page **in either
  direction**. The glossary records Cluster / Federation / Universal Exit
  Principle / Lodge as **registered but not yet on the published page**. So
  nothing here rewords them: the registry's `Definition` column is transcribed
  verbatim from its `Source`, and *"do not reword someone else's concept"* is
  that file's own rule. §3.2 adds the **hat** link and leaves Addison Cooper's
  text alone.

Neither is duplicated or paraphrased here.

## 8. Pointers

- `docs/GLOSSARY.md` §Hat · §Hat vs persona vs role · §Cluster · §Federation ·
  §Universal Exit Principle — the two halves this document connects.
- `docs/research/2026-08-26-hat-persona-role-a-hat-carries-the-direction-a-persona-carries-the-choice.md`
  — the provenance and adversarial rounds behind the hat/persona/role split.
- `docs/research/2026-08-09-every-node-is-its-own-identity-provider-repo-as-cluster-hats-grant-claims-bounded-duration-aaron.md`
  §C — the binding record, and the verified absence of bounded duration.
- `full-ai-cluster/k8s/applications/hat-system/README.md` — the CRDs that are the
  most contract-shaped hat surface in the tree.
- `hats/README.md` · `src/Core/Hat.fs` · `src/Core/Persona.fs` — the type and the
  root folder.
- `full-ai-cluster/nixos/modules/cluster-network.nix` ·
  `full-ai-cluster/cluster-identity.json` — the infrastructure half of §5.
- [`privacy-budget-is-hard-money-earned-by-others`](../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md)
  — spend / stake / **never** confiscate; the `staked` member of Proposal A's set.
- [`anchor-to-human-prior-art`](../../.claude/rules/anchor-to-human-prior-art.md)
  — why importing the contract-law vocabulary is the discipline rather than a flourish.
