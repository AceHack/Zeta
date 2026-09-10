# Geo-distributed sites: federate, do not stretch the cluster — and the RTT that decides it

**Source:** Aaron, 2026-09-08, answering what a dev stick should carry. Written up by shadow*.
**Register:** the etcd mechanism is **established** (vendor-documented, cited below). The
Zeta-specific argument in §4 is **argued, not measured**. The recommendation in §6 rests on
an **unmeasured RTT** and §5 says how to measure it rather than asserting a verdict.

---

## 1. What was asked

Aaron, verbatim:

> *"yes for dev we want the cluster join materials, for us, we are using the repo+github
> login of the contributor to join, this way a fork can have different clusters over time.
> Also max is geo destributed from me with his hardware. i think clusters are okay for local
> connections but we likely need federation for geo distributed, **this is an assumption on
> k8s design prinicples**, if we can do geo distriubted clusters without peanlity then me and
> max can join the same cluster with our hardware casue we are both using zeta repo and have
> access to zeta cause we are contributors if not, then we can still federate via zeta but
> maybe not cluster. Right now we are using github for coordination between geodistributed
> sites until we have our own decentralized version."*

He flagged the middle of that as an assumption. It is a correct one, and the reason is
mechanical rather than a matter of principle.

## 2. The penalty is real, and it is quorum latency

The cluster runs **k3s with embedded etcd** — `--cluster-init`, and `k3s-server.nix:331`
notes *"K3S embedded etcd binds 127.0.0.1 by default."* etcd replicates by **Raft**, so:

- **Every write needs a quorum.** A write is not acknowledged until a majority of members
  have received and **fsync'd** it. So control-plane write latency has a floor of the RTT to
  the median member, plus disk sync. Two sites at 60 ms RTT means every API write pays it.
- **Leader election is timing-based.** etcd's defaults — heartbeat interval **100 ms**,
  election timeout **1000 ms** — are documented as suiting a local network. On a WAN link
  where RTT approaches or exceeds the heartbeat interval, followers miss heartbeats that
  were merely slow, call elections, and the cluster churns leaders under no fault at all.
- **Tuning trades one cost for another.** The documented remedy is to raise the heartbeat
  toward the RTT and the election timeout to ~10x that. It buys stability by making
  **failover slower** — the cluster now takes seconds to notice a genuinely dead leader.

**Nothing in-tree tunes any of this.** Measured: no `heartbeat-interval`, no
`election-timeout`, no `etcd-arg` anywhere under `full-ai-cluster/`. So a stretched cluster
built today would run a WAN link at LAN defaults, which is the configuration most likely to
produce spurious elections.

**Where the penalty does NOT land:** workload-to-workload traffic. Pods talking to pods pay
network latency and nothing else. The cost is specifically on the **control plane** — kubectl
writes, scheduling decisions, lease renewals, controller reconciliation.

## 3. So the answer to "without penalty" is no — but "impossible" is also wrong

A stretched cluster is **buildable** and people run them. What it is not is free. The honest
formulation:

> A geo-stretched control plane trades **write latency and failover time** for the
> convenience of one API surface. Whether that trade is acceptable is a function of the RTT
> and of how write-heavy the control plane is.

## 4. The Zeta-specific argument, which is stronger than the Kubernetes one

This is mine, argued rather than measured, and it is the reason I would federate even at a
*low* RTT.

**Zeta's substrate is built to avoid global consensus.** Z-set retraction (`+1` then `−1`,
never erase), CRDT merge, the commutative belief fold, *reintegration is not reconvergence*
in [`anti-babel-preserve-reconcilability`](../../.claude/rules/anti-babel-preserve-reconcilability.md),
and [`local-time-never-enters-the-shared-fold`](../../.claude/rules/local-time-never-enters-the-shared-fold.md)
— which exists precisely so a node's own clock cannot decide what enters the shared result.
All of that machinery is there so decorrelated peers can reconcile **without a quorum**.

Putting a geo-stretched etcd underneath it inverts the stack: it makes the **strongest
consistency requirement in the system** the foundation for a design whose whole point is not
needing one. Every cross-site control-plane write would then be gated by a Raft majority in a
substrate that otherwise treats partition as a normal condition and disagreement as
information.

It also collides with [`manifesto-13-specifications`](../../.claude/rules/manifesto-13-specifications.md)
**§1 scale-free** (no central point of coordination) and **§2 lock/wait-free**: a shared etcd
quorum is exactly a coordination point that blocks progress on another party's availability.

## 4b. CORRECTION — Zeta already has the geo layer, and it is not etcd-shaped

Aaron, on reading §4:

> *"our geodistibuted etcd like database is our zetafs/db it's supported to support consensus
> even over distributed plants like earth and mars we have a lot of research on this"*

**This corrects the framing of §1–§4, and in a way that strengthens the recommendation.** I
wrote as though the cross-site plane were an unnamed future thing and GitHub a stopgap. It is
neither: it is named, on the roadmap at **item #1**, and under active development today.

| | evidence |
|---|---|
| **ROADMAP item #1 — "NO GIT CLI"** | route all persistence through `ZetaFsDualFold` / `ZetaFsDeltaLog` / `DagFs` (dual `+1 I` and `−1` generator-reinterpret over Merkle), *"not git(1) and not LibGit2Sharp-as-the-store. **The definition of done.**"* |
| **actively developed** | four live branches at time of writing: `feat/zetafs-d10-skip-single-leaf-layout`, `feat/zetafs-groupcommit-blockio`, `feat/zetafs-posix-object-skip-existing`, `feat/zetafs-pr6-jumprope` |
| **the geo design exists** | `2026-07-11-multi-planet-convergence-...md`, whose header states *"Grounded in code (not aspiration): every mechanism below already exists in the repo."* |

### The mechanism difference is the whole point, and it is why §6 still holds

The multi-planet design and Raft are solving **different problems under different couplings**:

| | etcd / Raft | Zeta's multi-planet convergence |
|---|---|---|
| what it needs | a **quorum acknowledging every write**, fsync'd | the **same evidence set** to yield the same conclusion |
| message loss | fatal to progress — a missed append stalls or re-elects | **tolerated by construction** — Adinkra ECC on the messaging, so you *"can miss messages also and arrive to the same conclusion"* |
| ordering | a single leader imposes a total order | **commutative `observe`** + phase-canonical order — reorder is not an error |
| clock | election timers are wall-clock | agreed phase only; local time never enters the shared fold |
| cost of distance | **every write pays RTT to the majority** | latency delays *arrival*, not correctness |

So the honest statement is **not** "geo consensus is impossible, therefore federate." It is:

> **Zeta already solved the cross-site problem with a strictly weaker coupling than
> consensus, and etcd's Raft is the wrong tool for it.** Raft buys a total order nobody
> across sites needs, at a price — quorum per write, intolerance of loss — that scales with
> distance. The convergence route buys agreement without either.

That is the same distinction CALM draws: coordination is required only by the operations
that actually need it. A stretched etcd imposes coordination on **every** control-plane write
regardless.

**Which means §6's recommendation stands, with its reason replaced.** Keep etcd per-site
because it is a *local* consistency tool doing a local job well — not because the geo problem
is unsolved. The geo layer is ZetaFS/ZetaDB, and GitHub is the **current implementation** of
that plane rather than a placeholder for it: git is already the dual-fold shape (append-only,
partition-tolerant, fork-as-divergence), which is precisely why item #1 is a *replacement of
the store* rather than of the model.

**One nuance I should not smooth over:** the multi-planet doc records that Aaron's HLC plan
*"works multi-planet, but only in the role he actually needs"* — so the design has a stated
limit of its own, and I have not read far enough into it to restate that limit accurately
here. Anyone building on this should read that document rather than this summary of it.

## 4c. SECOND CORRECTION — it is not "a total order nobody needs". Total order is never the goal

Aaron, on §4b's phrasing:

> *"never looking for total order just partial join memory based order that's cowberated"*
> [corroborated]

My sentence — *"Raft buys a total order nobody across sites needs"* — still priced total
order as the thing being bought and declined. That concedes the wrong frame. **Total order is
not an expensive luxury here; it is the wrong output type.**

Every word of Aaron's replacement is load-bearing, and each one is already shipped:

| word | what it names | where |
|---|---|---|
| **partial** | a semilattice induces a **partial** order — incomparable elements stay incomparable | — |
| **join** | *"a bounded **join-semilattice** over a source-keyed set"* — idempotent, commutative, associative, unit `empty` | `src/Core/QuorumAlgebra.fs` |
| **memory based** | the order comes from the accumulated **source-keyed set** of who observed what, not from a clock or a leader | same |
| **corroborated** | *"independent evidence, so **the same source twice counts once**"* | same |

### Why this is a stronger objection to Raft than latency

A join-semilattice and a Raft log compute **different objects**:

- **Raft** produces a **total order** over a log. Two concurrent writes are *forced* into a
  sequence; which one "came first" is decided by a leader, and that decision is manufactured
  rather than observed.
- **`join`** produces a **least upper bound**. Two concurrent observations that are
  incomparable **remain incomparable**, and their incomparability survives the merge.

That surviving incomparability is not a loss of precision — it is
[`anti-babel-preserve-reconcilability`](../../.claude/rules/anti-babel-preserve-reconcilability.md)'s
*reintegration is NOT reconvergence*: two paths around a pole yield genuinely different
results, and **that difference is information, not error**. It is the raw vault's *single
version of the facts, never a single version of the truth*.

**So a stretched etcd would be wrong even at zero latency.** It would take a partial order
that correctly records "these two sites saw different things" and flatten it into "site A
happened before site B" — inventing an ordering fact nobody observed, and destroying the one
the design exists to preserve. Latency is the *second* objection; the first is that a
sequencer answers a question the substrate never asks.

### Corroboration is the part with a measured failure

`QuorumAlgebra`'s source-keying is not bookkeeping — it is what makes the order
*corroborated* rather than merely large. The header records what its absence cost:

> deduplicating by source *"is the only thing that stops six agents on one data stream folding
> to six times the confidence (bug B3, `precision = 66.0` on a mean wrong by 5.66)"*

Six copies of one observation are **not** corroboration, and without source-keying the fold
could not tell the difference. That is the same property the Astra ferry's escalation ladder
climbs — *union → witnessed union → **distinct-source** quorum → BFT* — and the same reason
that ferry's negative control matters: under a common seed, agreement between agents may just
be one cause unfolding twice.

**Note the split this module also makes, because it bears on the wording above:** `join` is
where evidence is *counted* (idempotent, dedup by source) and `interfere` is where it is
*combined* (**not** idempotent, `interfere a a = 2a`, opposite phases annihilate). Calling the
whole thing "join" is right for the *ordering* question and wrong for the *amplitude* one.

## 4d. Total order is RECONSTRUCTIBLE, and the descent into it is priced

Aaron, completing the model:

> *"in regular cases this total order can be reconstructed with enough research over partial
> order with CRDT, when trust calculus fails it takes a gradient descent into slower time,
> CAS over row, CAS over partition, CAS over table/stream, then BFT, each one slows down time
> for the partial observer and makes the global observers job harder"*

This is the piece §4c was missing. **Total order is not refused — it is derived.** Over a
partial order plus CRDT you can reconstruct a sequence when you actually need one; what the
substrate declines is *paying for it on every write*.

### Why the partial order survives even at the bottom of the ladder

The escalation spec
(`2026-09-03-society-crdt-default-consensus-escalation-spec-per-key-ladder-over-disagreement-and-distrust.md`)
is exact about this, and it is the sentence that makes "reconstructible" true rather than
hopeful:

> *"Consensus is never applied to the state; it is applied to **a key** ... Both branches of
> every disagreement stay in the set forever; **a consensus certificate is one more atom, not
> a deletion**."*

So even **BFT does not collapse anything**. It appends a certificate saying "on this key, at
this point, these sources agreed on this value" — and the losing branch is still there. That
is the difference between *ordering* and *sequencing*: the certificate is an observation
about the evidence, not a rewrite of it. Raft's log is the opposite — the order **is** the
state.

### The descent is demand-driven, and it climbs back

Aaron's *"when trust calculus fails"* is the spec's trigger, measured **from the evidence set
itself**: **disagreement** (how split the distinct sources are on that key) and **distrust**
(what the rank ledger says about those sources). And critically, a key *"climbs back down on
evidence, **never on a clock**"* — so this is a gradient in both directions, not a ratchet.

**Two ladders, two axes** — the distinction Astra drew, and Aaron's sentence walks the first:

| axis | rungs |
|---|---|
| **scope of coordination** (Aaron's) | CAS over **row** → over **partition** → over **table/stream** |
| **failure class tolerated** (the spec's) | union → witnessed union → distinct-source quorum → **BFT** |

BFT is not "an even bigger table lock"; it answers a different question — whether agreement
survives participants behaving arbitrarily. Broader CAS scope is not stronger protection
against a dishonest peer.

### The two costs, and the second one is the interesting claim

> *"each one slows down time for the partial observer and makes the global observers job
> harder"*

- **Partial observer** (a participant): each rung is more coordination before it may proceed.
  Its own time dilates. That is the ordinary, expected price.
- **Global observer:** I asserted this was uniformly harder. **Aaron immediately questioned
  it** — *"it might be inversed too maybe the BFT is easier to observe for the global observer
  i'm not sure"* — and on inspection he is right for the case that matters, so the claim is
  replaced rather than defended.

**The direction is SCOPE-DEPENDENT, and I had conflated two scopes.**

**Per key, a higher rung is EASIER to observe globally.** A BFT rung produces a
**certificate** — an explicit, signed, verifiable artifact saying *these sources agreed on
this value at this point*. Anyone holding the public keys can read it without reconstructing
anything. At the union rung there is no such artifact: to know what the system "believes" you
must hold the whole evidence set and apply a policy.

And the spec makes that worse than merely laborious: *"the rung is a **reading** each node
takes with its own policy; the evidence set it reads is shared."* So at low rungs **there may
be no single global fact to observe at all** — two nodes can legitimately read the same
evidence differently, and neither is wrong. Escalation therefore *manufactures* global
legibility: it converts a situation with no agreed answer into one with a citable one. That
is the opposite of harder.

**System-wide, the ladder is harder to describe** — but that is a property of the *ladder*,
not of BFT. Because the rung is per key and dynamic, there is no uniform ordering rule to
state; a global description is a time-varying map from keys to rungs. That holds no matter
which rung any particular key currently sits at, so it was never an argument about BFT.

**Resolution:**

| question | direction |
|---|---|
| "what is the agreed value of THIS key?" | **higher rung = easier** — a certificate is a global fact; union may have no single answer |
| "how does this system order writes, in general?" | **harder at every rung** — heterogeneous, demand-driven, time-varying |
| "how long must I wait to proceed?" | **higher rung = slower**, unambiguously — the partial observer's cost is the one clear direction |

**What stays true regardless:** the partial observer's time dilates with every rung, and that
cost is the one the design deliberately keeps rare. The trade against a stretched etcd is
unchanged — etcd buys one easy global story with every participant paying RTT for it, always,
whether or not that key was ever contested.

**Register:** the per-key direction is argued from the spec's own text and I am confident in
it; the system-wide claim is my inference and is weaker; and the whole subsection began as an
unjustified assertion of mine that its author caught. Recorded that way on purpose.

### The certificate is NON-FUNGIBLE, and that is why it can only be added

Aaron: *"a consensus certificate we kind of call non fungible or NFT"* — in the ordinary
sense of the word, not the crypto one. His standing clarification: *"when i say root NFT i
just mean it's our version of non fungable, not a special term, we don't define NFT by crypto
terms."*

**This supplies the reason behind the spec's sentence rather than restating it.** *"A
consensus certificate is one more atom, not a deletion"* is not a policy choice that could
have gone the other way — it follows from what the certificate **is**:

| | consequence |
|---|---|
| **fungible** artifact | one is interchangeable with another, so a new one can *substitute* for an old one — and substitution is deletion wearing a merge's clothes |
| **non-fungible** artifact | each is a distinct thing — *these* sources, on *this* key, over *this* evidence — so a later one can only be **added alongside** |

So non-fungibility is what makes the evidence set append-only. If certificates were
interchangeable, the raw vault's *single version of the facts, never a single version of the
truth* would be unenforceable: you could swap one certificate for another and lose the fact
that the first was ever issued.

It also connects the ordering model to Aaron's earlier root-NFT framing — **two decorrelated
Bayesian factor-graph-like entities, compared together over mutual memories.** A certificate
is exactly that object: corroboration between *distinct* sources (§4c's source-keying) over
*shared* memory, producing an artifact unique to that pairing. Which is why §4c's dedup and
this section are the same property seen from two sides — the same source twice adds nothing
*because* the atom it would produce is not a new one.

## 5. The measurement that settles it, instead of a rule

Aaron's framing — *"if we can do geo distributed clusters without penalty"* — is a
conditional, so it deserves a number rather than a doctrine:

```
# from each site, against the other site's control-plane address
ping -c 100 <peer>          # median and p99 RTT
# and the thing that actually matters, disk:
#   etcd write latency floor ~= RTT_to_median_member + fsync time
```

| median RTT | reading |
|---|---|
| **< ~10 ms** | same-metro. A shared cluster is unremarkable; the defaults hold. |
| **~10–50 ms** | stretched. Workable **with tuning**, and the tuning is not in-tree today. |
| **> ~50 ms** | every control-plane write pays it, and the default election timeout is close enough to be dangerous. Federate. |

**This is the falsifier for the recommendation below.** If Aaron and Max measure single-digit
RTT, §6 is wrong for their case and a shared cluster is fine.

## 6. Recommendation: one cluster per site, federate across

- **Per site:** Aaron's hardware is one cluster; Max's is another. Local etcd, LAN latency,
  defaults valid, no cross-site quorum on any write path.
- **Across sites:** federation, which this repo has already been building toward —
  `src/Core.TypeScript/federated-identity/` (ceremony-gate, local-issuer, node-attestation,
  verdict-vault). **Honest status:** `federation-loop.ts` is explicit that it is an
  in-process model — *"No network listener of any kind ... No real SPIRE ... No hardware ...
  Ephemeral keys only"* — so federation is **modelled, not deployed**.
- **The cross-site plane today is GitHub**, and that is already a federation rather than a
  stopgap: git is append-only, partition-tolerant, and needs no quorum to accept a write.
  A fork is a legitimate divergent branch of the world, which is the same shape as
  reintegration-without-reconvergence. Prior art in-tree:
  `2026-06-01-cap-per-layer-map-multi-oracle-review-at-merge-federated-git-push-truth-machine-calm-aaron-otto.md`.

**Aaron's identity design already points this way.** Join authorised by *repo + contributor's
GitHub login*, with a fork able to run different clusters over time, means **identity is
anchored outside any cluster**. A cluster-CA-anchored join would make the cluster the root of
trust and a fork a second-class citizen; repo-anchored join makes each site's cluster an
implementation detail. That is federation-native, and it is the part that makes §6 cheap
rather than a compromise.

## 7. What this implies for the dev stick

Aaron: *"for dev we want the cluster join materials."* That is consistent with everything
above — join material is **per-site**, not global, and a dev stick joining the local cluster
is exactly the intended shape. It does not commit to a stretched cluster.

Current state, measured: `--role`, `--join-server-url` and `--join-token` are accepted only by
`file-backed.ts`, which writes an image rather than a device, so the device-flashing path
cannot carry them (B5, #17075). Wiring them onto the device path is the follow-up this
document unblocks.

## Pointers

- `full-ai-cluster/nixos/modules/k3s-server.nix` — embedded etcd, `--cluster-init`, the 127.0.0.1 bind note
- `src/Core.TypeScript/federated-identity/` — the modelled federation; `federation-loop.ts` states its own limits
- [`manifesto-13-specifications.md`](../../.claude/rules/manifesto-13-specifications.md) §1 scale-free, §2 lock/wait-free
- [`local-time-never-enters-the-shared-fold.md`](../../.claude/rules/local-time-never-enters-the-shared-fold.md) · [`anti-babel-preserve-reconcilability.md`](../../.claude/rules/anti-babel-preserve-reconcilability.md)
- **Anchors (Beacon):** Ongaro & Ousterhout, *In Search of an Understandable Consensus Algorithm* (Raft, 2014) — quorum on every commit; etcd's own tuning documentation for the heartbeat/election defaults and the RTT guidance; Brewer's CAP and the CALM result (Hellerstein & Alvaro) for why coordination is required only by the operations that need it.
