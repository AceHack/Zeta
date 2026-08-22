# Greedy small-world routing is hub-free by construction, and our Kademlia has less exit than a ring

**Design doc, 2026-08-21. Clean-side derivation from published literature only.** Answering the
requirement *"decentralised key-based routing over a peer-to-peer overlay with no central
directory … polylogarithmic hops … peers join and leave without a coordinator."*

> **One-line answer.** Greedy routing over a harmonic-ring small-world overlay meets the
> requirement at `O((1/k)·log²n)` expected hops with `k+2` links per node, and it is **§1-compatible
> for a reason stronger than the one the brief expected**: the overlay is **degree-bounded by
> construction**, so it is not scale-free, so the Albert–Jeong–Barabási targeted-attack result
> **does not apply to it at all**. The fragility that *does* apply is identity-side, not
> degree-side. Separately and measurably: the XOR geometry we already ship in
> `src/Core.TypeScript/discovery/dht-discovery.ts` has **strictly less route-selection flexibility —
> less exit — than a ring**, by Gummadi et al.'s Table 1 and their 30%-failure simulation.

**Nothing in this document is metered.** Every quantitative claim below is either (a) a result
measured by the cited authors in their own paper, attributed as such, or (b) an **unimplemented
design** decision. Zeta has measured none of it. Section 7 draws the line explicitly.

---

## 0. Provenance — clean side, and what that cost

This document was written under
[`.claude/rules/cleanroom-two-team-separation.md`](../../.claude/rules/cleanroom-two-team-separation.md).
The author **has not read, and did not seek out**, any Freenet source code, any Freenet-authored
paper, or the talk transcript held at `docs/ip-questionable/`. Freenet is GPL-2.0-or-later, which is
license-incompatible with this tree independently of the clean-room question, so the wall and the
license point the same way.

Every result below is taken from a paper the author fetched, converted to text, and read directly.
Where a bound is quoted it is quoted from the paper's own theorem statement, not from a summary —
this is [`anchor-to-human-prior-art`](../../.claude/rules/anchor-to-human-prior-art.md)'s
*checked-not-cited* requirement, and it caught one error in the brief that produced this doc
(see §5.1).

**The honest cost of the wall.** Freenet's routing has been described in peer-reviewed venues by its
own authors, and those descriptions were deliberately not consulted. So this document cannot say how
close or far the design below sits from theirs, and **must not be read as a claim that it differs**.
It is an independent derivation from the general literature; that is the only claim it makes about
its relationship to any other system.

---

## 1. The requirement, restated as checkable properties

| # | Property | The check |
|---|---|---|
| R1 | No central directory | No node's absence stops lookup for keys it does not own |
| R2 | Small per-node state | Degree is `O(1)` or `O(log n)`, not `O(n)` |
| R3 | Greedy forwarding toward the key | Next hop is chosen by a **local** distance comparison, no global view |
| R4 | Polylogarithmic hops | Expected path length is `polylog(n)` |
| R5 | Join / leave without a coordinator | Membership change is a local operation |

R3 is the constraint that does the work. It is exactly Kleinberg's **decentralized algorithm**: a
message-holder `u` knows the underlying metric, the target's position in it, and its own contacts —
and **crucially does not know the long-range contacts of nodes the message has not touched**
(Kleinberg 2000, "The Model"). Everything downstream follows from taking that restriction seriously.

---

## 2. The two anchors that decide the design

### 2.1 Kleinberg 2000 — the exponent *is* the result

Jon Kleinberg, *The Small-World Phenomenon: An Algorithmic Perspective*, **STOC 2000, pp. 163–170**
(also Cornell CS TR 99-1776, Oct 1999).

The model: nodes are the lattice points of an `n × n` grid; lattice distance
`d((i,j),(k,l)) = |k−i| + |l−j|`. Each node has directed edges to every node within distance `p`
(**local contacts**) and to `q` further nodes (**long-range contacts**), where the `i`-th long-range
edge lands on `v` with probability proportional to `d(u,v)^(−r)`, normalised — the **inverse
`r`-th-power distribution**.

Three theorems, quoted in substance from the paper:

- **Theorem 1.** At `r = 0` (uniform long links — the Watts–Strogatz choice) the expected delivery
  time of *any* decentralized algorithm is at least `α₀·n^(2/3)`. Short paths **exist** and are
  **unfindable**.
- **Theorem 2.** At `r = 2` with `p = q = 1` there is a decentralized algorithm `A` with expected
  delivery time at most `α₂·(log n)²`. `A` is simply: *forward to whichever contact is closest to
  the target in lattice distance.* Plain greedy, and it needs even less than the model allows — no
  memory of previous holders.
- **Theorem 3.** For `0 ≤ r < 2` the lower bound is `αᵣ·n^((2−r)/3)`; for `r > 2` it is
  `αᵣ·n^((r−2)/(r−1))`. So `r = 2` is the **unique** exponent admitting polylog delivery, and
  Kleinberg states the `k`-dimensional generalisation: polylog paths are constructible **if and only
  if `r = k`**.

Two precision points that matter and are easy to get wrong:

1. **`n` is the grid side, not the node count.** The network has `N = n²` nodes, so `(log n)² =
   (log N)²/4`. Polylog either way, but a doc that writes `O(log²n)` in node-count terms without
   saying so has quietly dropped a factor of 4.
2. Kleinberg's own explanation of *why* `r = d` works: it is "the unique exponent at which a node's
   long-range contacts are nearly uniformly distributed over all **distance scales**." That sentence,
   not the number 2, is the portable content — and it is what generalises the design to a ring.

### 2.2 Symphony 2003 — the same result made into a protocol

Gurmeet Singh Manku, Mayank Bawa, Prabhakar Raghavan, *Symphony: Distributed Hashing in a Small
World*, **4th USENIX Symposium on Internet Technologies and Systems (USITS), 2003, pp. 127–140**.

Symphony instantiates Kleinberg at `d = 1` on a ring, which turns the inverse-`d`-th-power
distribution into the **harmonic** distribution:

> `pₙ(x) = 1/(x · ln n)` for `x ∈ [1/n, 1]`, and `0` otherwise.

Sampling it is one line: `exp(log(n) · (drand48() − 1.0))`.

Their central quantity is `p_half` — the probability a single long link at least **halves** the
remaining distance:

> `∫[z/2 … z] pₙ(x) dx = 1/log₂n`, **independent of `z`**.

Scale-invariance restated as an integral: wherever you are, one link is equally likely to halve the
gap. Hence the number of links to consider before halving is geometric with mean `log₂n`, there are
`log₂n` halvings, and with `k` links per node:

> **Theorem 3.1** — expected path length with unidirectional routing and `k = O(1)` links is
> `O((1/k)·log²n)` hops.

And the falsifier the same paper supplies, which is the reason the distribution is not negotiable:

> if the `k` links are drawn **uniformly** from `[0,1)` instead, average latency is `Θ(√n / k)`.

Polynomial, not polylog. **A "roughly long-range" link budget spent on the wrong distribution buys
nothing.** This is Kleinberg's Theorem 3 showing up as an engineering result.

Measured by the Symphony authors in their own simulation (not by us): bidirectional routing improves
average latency ~25–30%; 1-lookahead improves it ~40%; a **2¹⁵-node network with `k = 4` has average
latency ≤ 7.5 hops**.

### 2.3 The rest of the reading, and what each one is for

- **Milgram (1967)**, "The small world problem", *Psychology Today* 1:61; **Travers & Milgram
  (1969)**, "An experimental study of the small world problem", *Sociometry* 32:425. The empirical
  anchor: chains of five to six, found by people with only local knowledge. Kleinberg's Question
  (∗∗) — *why can strangers **find** the short chains?* — is the requirement in this doc, stated in
  1967.
- **Watts & Strogatz (1998)**, "Collective dynamics of small-world networks", *Nature* 393:440. The
  local+long-range decomposition the whole family is built on. Kleinberg's Theorem 1 is precisely
  the statement that the WS choice of long links is the **unfindable** one — WS explains short paths,
  not navigation.
- **Chord** (Stoica et al., SIGCOMM 2001 / *IEEE/ACM ToN* 11(1):17–32, 2003), **Pastry** (Rowstron &
  Druschel, Middleware 2001), **Tapestry** (Zhao et al., 2001/*JSAC* 2004), **Kademlia**
  (Maymounkov & Mazières, IPTPS 2002). The contrast class: same `O(log n)` bound from a **maintained,
  structurally-determined** routing table rather than a distance-distributed random one.
- **Barabási & Albert (1999)**, "Emergence of scaling in random networks", *Science* 286:509–512;
  **Albert, Jeong & Barabási (2000)**, "Error and attack tolerance of complex networks", *Nature*
  406:378–382 (correction *Nature* 409:542, 2001). The robustness/fragility asymmetry — and, as §5.1
  shows, the paper that **rules itself out** of applying here.
- **Gummadi et al. (2003)**, "The Impact of DHT Routing Geometry on Resilience and Proximity",
  *SIGCOMM 2003*, pp. 381–394. The paper that turns "can you route around it?" into a number. This
  is the §1 instrument.
- **Douceur (2002)**, "The Sybil Attack", *IPTPS 2002*; **Castro et al. (2002)**, "Secure routing for
  structured peer-to-peer overlay networks", *OSDI 2002*. The failure class that actually threatens
  this design.

---

## 3. The design, derived

Each row states the decision, the paper it follows from, and — where relevant — the thing it must
**not** be confused with.

### D1 — One-dimensional cyclic identifier space

**From:** Kleinberg Thm 3 (`r = k` exactly, in `k` dimensions) + Gummadi §2.3.4 (ring geometry).

Take the identifier space to be a cycle. Kleinberg's optimality condition is knife-edge in *every*
dimension, but `d = 1` is the cheapest one to get exactly right: the sampling law collapses to the
one-line harmonic draw, and there is no dimension parameter to mis-estimate. Gummadi et al. then give
an independent reason to prefer `d = 1`: of tree, hypercube, ring, butterfly, XOR and hybrid, the
**ring is the only geometry with both maximal neighbour-selection flexibility and maximal
route-selection flexibility** (their Table 1, reproduced in §6.1).

Our existing self-certifying identifier — the truncated-SHA-256 Reticulum destination hash already
used by `dht-discovery.ts` — maps onto a cycle unchanged. Nothing about D1 requires new identifiers.

### D2 — Two short links, extended to a successor list

**From:** Symphony §3.1 (2 short links) + Gummadi §3, Question #2 (sequential neighbours).

Every node keeps its immediate predecessor and successor on the cycle. This is what makes greedy
routing **complete** rather than merely fast: the short links guarantee the final approach.

Gummadi et al. measured the value of extending this. With **16 sequential neighbours** added, **no
path failures were observed in any geometry even at 30% node failure** — at a cost in path stretch.
That is the single highest-leverage robustness knob in the whole design and it is not the clever part.

### D3 — `k` long links drawn from the harmonic distribution

**From:** Symphony §3.1, §3.2, Theorem 3.1.

Draw `x ~ pₙ`, take the manager of the point `x` clockwise from yourself, link to it. `k` is a
per-node tuning knob and need not be uniform across nodes (Symphony notes this explicitly: it is the
only protocol in their comparison offering the knob at run time). `k = 4` is their working point.

**Do not approximate the distribution.** See the `Θ(√n / k)` falsifier in §2.2.

### D4 — Greedy forwarding, bidirectional

**From:** Symphony §3.2 / §3.3.

Unidirectional: forward along whichever link (short or long) **minimises clockwise distance** to the
key. Bidirectional: because the source-id distribution of *incoming* long links mirrors `pₙ`
anticlockwise, treat incoming links as routing candidates too and minimise **absolute** distance.
Same asymptotic bound, constant below 1, ~25–30% measured improvement (theirs).

### D5 — In-degree cap of `2k` — this is the §1 clause

**From:** Symphony §3.1: *"We ensure that the number of incoming links per node is bounded by placing
an upper limit of `2k` incoming links per node."* Once saturated, further link requests are rejected
and the requester re-samples.

Out-degree is `2 + k`; in-degree is `≤ 2k`. **The overlay is degree-bounded by construction.** Read
as an engineering detail this is a load-balancing measure. Read against
[`itron-hub-patent-boundary-p2p-is-the-upgrade`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md)
it is the clause that makes the design §1-compliant, and §5.1 and §6 are about why.

### D6 — Estimate `n` locally, re-link on a factor-of-two band

**From:** Symphony §3.4, §3.6 (the estimator idea credited by them to Viceroy, Malkhi–Naor–Ratajczak
PODC 2002).

A node needs `n` to draw from `pₙ`, and no node may be asked to know `n` authoritatively — that would
reintroduce a directory. The estimator: for any set of `s` distinct nodes with segment lengths
summing to `X_s`, `s / X_s` is an unbiased estimator of `n`. Symphony uses **`s = 3`** — your own
segment and your two neighbours' — which costs **zero extra messages**, because a joining node learns
exactly those three lengths from the two nodes it inserts between.

Re-link only when `ñ / ñ_link ∉ [1/2, 2]`. Their measured consequence: if nodes arrive sequentially
and each knows `n` precisely, at most **one** node re-links at any time.

Note what D6 is and is not. It is a **locally-computed estimate of a global scalar**, refreshed by
gossip. It is not a directory, not a registry, and not a membership list; no node can enumerate the
network from it. §5.6 records the one place this still rubs against an in-repo discipline.

### D7 — Join and leave, no coordinator

**From:** Symphony §3.5.

**Join:** know one member; pick your own id uniformly from the space; route to its manager; run the
`s = 3` estimation; establish `k` long links, each costing one lookup. Total `Θ(log²n)` messages,
constant below 1.

**Leave:** links snap; nodes that had links to you re-establish by re-sampling; short links heal by
introduction between your former neighbours. Expected `O(log²n)` messages. **Crash-stop and graceful
departure are the same procedure** — nothing waits for the leaver to cooperate, which is what R5
demands.

### D8 — 1-lookahead, and the honest note that it stops being greedy

**From:** Symphony §3.7.

Neighbours exchange their own neighbour lists on keep-alives. A node picks the entry `u` in the
lookahead list that gets closest to the destination, then forwards to **the neighbour that holds
`u`** — not to `u`. List size `O(k²)`; ~40% measured latency improvement (theirs); updates are lazy
and piggy-backed, and stale entries are safe because they are *hints*, not routing state.

Symphony says the quiet part themselves: *"The choice of neighbor is not greedy anymore."* Kleinberg's
Theorem 2 is a statement about the strictly-greedy rule. Lookahead is an empirically-justified
improvement **outside** the theorem, and this doc does not extend the theorem to cover it.

### D9 — Bind the identifier to the key material before any of this ships

**From:** Douceur 2002; Castro et al. 2002; and `docs/BUGS.md`.

Greedy KBR's entire safety argument rests on *a node cannot choose which part of the identifier
space it occupies*. Our identifier is already the right shape (self-certifying hash of the ZetaId),
but `docs/BUGS.md` currently records that **the Reticulum announce wire is unsigned and `dest` is
unbound to `zid`** — a route-hijack and category-confusion downgrade, with `dht-discovery.ts` named
as a downstream consumer. **D9 is a precondition, not a follow-up.** A greedy KBR layer over an
unbound identifier is a system where an attacker picks its own coordinates.

---

## 4. What this is *not*: the structured-DHT contrast

Chord, Pastry, Tapestry and Kademlia reach the same `O(log n)` bound with a routing table whose
entries are **determined by the identifiers present**, maintained by an explicit stabilisation
protocol. Symphony's is **drawn from a distribution** and needs no agreement about what it should
contain.

Three consequences, and the third is the one that matters here:

1. **State.** Structured DHTs hold `O(log n)` neighbours; Symphony holds `k = O(1)`, at the cost of a
   `log n` factor in hops. Their `O((1/k)log²n)` is worse than Chord's `O(log n)` when `k` is
   constant, and equals it at `k = Θ(log n)`. **This design is not asymptotically faster than Chord —
   it is cheaper per node and structurally softer.**
2. **Maintenance.** A stabilisation protocol has a correct state to converge to; a sampled table does
   not, so there is nothing to be *inconsistent* with. Repair is re-sampling.
3. **Failure mode.** A structurally-determined table has, for each destination, a specific entry that
   is *the* right next hop. That is precisely what §6 measures.

---

## 5. Honest limits, from the literature

### 5.1 The targeted-attack fragility does not apply — and the reason is checkable

The brief that commissioned this doc asked for the honest limit that *"greedy small-world routing is
robust to random failure and fragile to targeted attack on high-degree nodes."* **That is not what
Albert–Jeong–Barabási established, and the paper excludes this design from its own scope in its
second paragraph.**

What AJB actually measured (*Nature* 406:378–382, 2000):

| network class | random removal | degree-ordered removal |
|---|---|---|
| **scale-free** (`P(k) ~ k^(−γ)`) | diameter unchanged at `f = 5%` | diameter **doubles** at `f = 5%`; fragmentation at `f_c^sf ≈ 0.18` |
| **exponential** (Erdős–Rényi, Watts–Strogatz) | diameter rises steadily; fragmentation at `f_c ≈ 0.28` | similar to random |
| Internet (AS-level, `P(k) ~ k^(−2.48)`) | diameter unaffected to `f = 2.5%` | diameter **more than triples**; critical point `f_c^I ≈ 0.03` |

And their own scoping sentence: the Erdős–Rényi and Watts–Strogatz models both lead to *"a fairly
homogeneous network, in which each node has approximately the same number of links"* — the
**exponential** class — as against scale-free networks, for which *"the probability that a node has a
very large number of connections is practically prohibited in exponential networks."*

The fragility is a **consequence of the degree distribution**, and the degree distribution is the
thing D5 bounds. Out-degree `2 + k`, in-degree `≤ 2k`, both `O(1)`: there is **no heavy tail to
target**. Barabási–Albert (1999) is equally clear about the generating conditions — growth **plus
preferential attachment**, `Π(kᵢ) = kᵢ/Σkⱼ`, producing `γ = 3` in their model and `2.1 ≤ γ ≤ 4` in the
networks they measured. Harmonic long-link sampling has **no preferential-attachment term**: the draw
depends on ring distance, never on the target's current degree, and the `2k` cap actively suppresses
the rich-get-richer term even where segment-length variation would introduce mild heterogeneity.

**So the correct honest limit is the opposite of the expected one, and there are two real ones in its
place:**

- **(a) The exponential-class percolation threshold applies instead.** AJB put fragmentation of the
  homogeneous class at `f_c ≈ 0.28` under random removal. A degree-bounded overlay is in that class.
  It does not get scale-free networks' graceful `f → 1` deflation; it has a cliff, and the cliff is
  around a quarter to a third of nodes gone. Note this is a **connectivity** measurement on a static
  graph and must not be conflated with the Gummadi routing-table measurement in §6 that also mentions
  30% — they measure different objects (see §5.5).
- **(b) The attack that works is identity-side, not degree-side.** Douceur (2002) proves that
  *without a central certifying authority*, distinct remote entities cannot in general be
  distinguished — so an adversary mints identifiers until it owns a chosen arc of the ring, and greedy
  routing walks into it by design. Castro et al. (2002) is the standard treatment: certified
  identifiers, constrained routing tables, redundant routing. **This, not hub-removal, is where the
  design is fragile,** and it is what makes D9 a precondition. It is also why
  [`privacy-budget-is-hard-money-earned-by-others`](../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md)'s
  observation that socially-conferred standing is the one currency a Sybil cannot mint is directly
  load-bearing here rather than adjacent.

### 5.2 The exponent is knife-edge; degradation is polynomial, not graceful

Kleinberg Theorem 3 is a **lower bound for every decentralized algorithm**, so a wrong exponent
cannot be recovered by a cleverer forwarding rule. In `d = 2`, `r = 1.5` forces `Ω(n^(1/6))`; `r = 3`
forces `Ω(n^(1/2))`. There is no smooth shoulder.

Symphony's `[1/2, 2]` re-link band shows a factor-2 error in `ñ` is tolerable **in their simulation**.
We have not reproduced that and must not present their tolerance as ours.

### 5.3 Theorem 2 is an expectation over a static graph

Kleinberg's bound is on **expected** delivery time, for source and target drawn **uniformly at
random**, on a **fully-formed** network. It says nothing about tail latency, adversarially-chosen
pairs, or churn. Symphony's churn results are simulation, theirs, and at their parameters.

### 5.4 Lookahead sits outside the theorem

Restating §D8 because it is exactly the kind of thing that gets rounded up: 1-lookahead is
non-greedy, so Theorem 2 does not cover it. Its 40% is measured, by Symphony, in simulation.

### 5.5 Two different 30%s appear in this document

AJB's `f_c ≈ 0.28` is **graph connectivity** under node deletion. Gummadi's "30% of nodes failed" is
**routing-table** entries voided in a maintained overlay, asking whether *live* nodes can still route
to each other. They are different measurements of different objects and the numerical coincidence
means nothing. Flagged here so nobody later fuses them into one claim — a coincidence of counts is
not an identification
([`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md)).

### 5.6 The `n`-estimate rubs against the no-enumeration discipline

`src/Core.TypeScript/observe/local-neighbourhood.ts` deliberately ships **no enumeration primitive** —
no `allSubjects()`, no `size()` — citing Narayanan–Shmatikov de-anonymisation. D6 needs an estimate of
`n`, which is a global scalar.

This is a genuine tension and it is **not** resolved by pointing out that an estimate is not a list.
What is true: `s / X_s` is computed from three local segment lengths, reveals nothing about *who* is
in the network, and cannot be inverted to a membership set. What is also true: it is a network-size
signal that discipline currently declines to expose, and shipping D6 means deciding — explicitly, not
by accident — that a size **estimate** and an enumeration **capability** are different things worth
treating differently. That decision has not been made and this doc does not make it.

### 5.7 What key-based routing does not provide

Lookup, and only lookup. Not storage, not replication, not anonymity, not deniability, not censorship
resistance. Greedy KBR **discloses the target key to every hop** — that is how forwarding decides.
Any privacy property must be built above this layer and argued separately.

---

## 6. The §1 question: route around, or route through?

[`itron-hub-patent-boundary-p2p-is-the-upgrade`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md)
sets the test: *"Can you defer elsewhere? Then it is an **oracle** … Must you route through it? Then
it is a **hub**, however it got there — including if it emerged. Emergence does not launder
enforcement."* (Hirschman 1970 — exit disciplines concentration.)

Gummadi et al. (2003) turn that into an instrument. Their **route-selection flexibility** is
literally the count of alternatives available when the obvious next hop is gone.

### 6.1 Their Table 1, verbatim in structure

| property | tree | hypercube | **ring** | butterfly | **xor** | hybrid |
|---|---|---|---|---|---|---|
| Neighbour selection | `n^(log n /2)` | 1 | `n^(log n /2)` | 1 | `n^(log n /2)` | `n^(log n /2)` |
| Route selection (optimal paths) | 1 | `c₁(log n)!` | **`c₁(log n)!`** | 1 | **1** | 1 |
| Route selection (non-optimal paths) | — | — | **`2c₂(log n)!`** | — | `c₂(log n)!` | `c₂(log n)!` |
| Natural support for sequential neighbours | no | no | **yes** | no | **no** | fallback only |

And their static-resilience simulation, 65,536 nodes, equal routing-table state per node:

- No failures: XOR 7.7 hops average, **Ring 7.4**, Tree 7.7, Hypercube 7.7, Hybrid 7.7, Butterfly 21.4.
- **30% of nodes failed:** Tree and Butterfly ~**90%** of paths fail; Hybrid and **XOR ~20%**; Ring and
  Hypercube **under 7%**.
- With 16 sequential neighbours added: **no path failures at 30%** for any geometry that supports
  them — and XOR is excluded from that experiment *because the XOR geometry does not support
  sequential neighbours at all.*

Their conclusion, in their words: *"the static resilience of a geometry is largely determined by the
amount of routing flexibility it offers"*, and *"despite our initial preference for more complex
geometries, the ring geometry allows the greatest flexibility."*

### 6.2 The answer

**Routing over a harmonic ring produces hubs you route around, and in the strong sense it produces no
hubs at all.** Three independent reasons, in increasing order of strength:

1. **No node is on a required path.** `c₁(log n)!` optimal-length alternatives plus `2c₂(log n)!`
   longer ones. Exit is available at *every* hop, not just at the endpoints.
2. **No node accumulates degree.** D5 caps in-degree at `2k`. There is no preferential-attachment
   term anywhere in the construction, so the emergent-hub phenomenon that §1 tolerates does not even
   arise — which is why §5.1's fragility result has nothing to bite on.
3. **Deference is not routed.** A node forwards on a *local metric comparison*, never on a *choice of
   whom to trust*. There is no locus of deference to concentrate.

By the rule's own discriminator this is neither an appointed hub nor an emergent one. It is closer to
a road network than to an oracle.

### 6.3 The honest counter — responsibility is not routing

Every DHT assigns each key a **manager**, and for that key the manager is a route-*through*: one node,
by construction, with no alternative. That is hub-shaped, and calling it "just data placement" would be
exactly the rounding-up this repo refuses.

The standard answer is `r`-way replication over the successor list (Chord's successor list, Kademlia's
`k` closest, Pastry's leaf set), which turns "one manager" into "any of `r`", restoring exit at the
responsibility layer as D2 restores it at the routing layer. **We have not designed that here, and
`dht-discovery.ts` has no key-value layer at all** — so this is a *named open gap*, not a solved
problem. §1 compatibility as claimed in §6.2 is a claim about **routing**. The responsibility layer is
unanswered.

### 6.4 The finding that was not asked for: our current geometry has less exit

`src/Core.TypeScript/discovery/dht-discovery.ts` implements Kademlia — XOR metric, `k`-buckets,
α-parallel iterative lookup, over Reticulum destination hashes. Under Gummadi's instrument:

- Route selection on optimal paths: **1**, versus `c₁(log n)!` for a ring.
- Sequential neighbours: **not supported by the geometry**, which is why Gummadi had to drop XOR from
  the experiment that eliminated path failure entirely.
- At 30% node failure: **~20% of routes fail**, versus **under 7%** for a ring — same state per node.

Kademlia's iterative α-parallel lookup recovers some of this in practice — an implementation-level
mitigation the static-resilience metric deliberately does not model, since it measures the geometry.
But the geometric fact stands, and it is the fact §1 asks about: **on the exit discriminator, the
geometry we ship is measurably weaker than the one derived here.**

That is a finding about a shipped artifact, and it should be read carefully. It is **not** an argument
to rip out working, tested, pure-core code. It is one input — Gummadi et al.'s static-resilience metric
measures one property among several, and the existing module's DST-purity, injected `query`/`nowMs`,
and byte-locked identifiers are real properties a rewrite would have to re-earn.

---

## 7. Implemented vs. designed vs. measured

**Implemented and tested in this repo** (from the survey, not from this design):
`src/Core.TypeScript/discovery/dht-discovery.ts` — Kademlia XOR metric, `k`-buckets with MRU
eviction, TTL expiry, `closest`, guarded JSON decode, α-parallel iterative lookup; `dht-discovery.test.ts`
covers multi-hop `S→A→T`, convergence to the true `k`-closest, and termination on a sparse ring;
erasure profiles measured by bounded model sweeps. **No key-value layer, no bucket splitting, no
liveness ping, no refresh/republish, no bootstrap node — and no central directory anywhere, by design.**

**Unimplemented design — every one of D1–D9.** Nothing in §3 exists in this tree.

**Measured by the cited authors, in their papers, never reproduced by us:** Kleinberg's `(log n)²`
upper bound and the `r ≠ 2` lower bounds (proved, not simulated); Symphony's `O((1/k)log²n)` and
`Θ(√n/k)` (proved) and its 25–30% / 40% / 7.5-hop figures (their simulation); Gummadi et al.'s Table 1
and every percentage in §6.1 (their simulation); AJB's diameter and `f_c` figures (their simulation
and measurement).

**Measured by us: nothing.** Under
[`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) this
design is **unmetered**, not toy and not metered: derived from proved results, implemented nowhere,
falsified by no test we own. The falsifier it would need is a DST-seeded simulation over an injected
`Source` reproducing the `(log n)²` scaling and the `Θ(√n/k)` degradation under uniform links — the
second being the more valuable, because a hop count that *fails* to blow up under a deliberately wrong
distribution would prove the harness was not measuring routing at all.

---

## 8. What would have to be decided before any implementation

1. **§6.3** — the responsibility layer. Replication factor, and what "manager" even means for a repo
   that has no key-value store yet.
2. **§5.6** — whether a locally-derived estimate of `n` is admissible under the no-enumeration
   discipline. An explicit decision, not a side effect.
3. **§D9** — identifier binding. `docs/BUGS.md`'s unsigned-announce entry is on the critical path.
4. **Coexistence** — whether this is a second geometry beside the shipped Kademlia, a replacement, or
   an experiment. §6.4 is an input to that, not an answer.
5. **Anti-Sybil posture** — §5.1(b). Certified identifiers (Castro et al.) versus this repo's
   socially-conferred-standing approach (`TravelerRankLedger`, `SocietyUsefulWork`). These are
   different answers to the same question and the repo already prefers the second.

---

## 9. Sources

- Jon Kleinberg (2000), "The Small-World Phenomenon: An Algorithmic Perspective", *STOC 2000*, 163–170 (Cornell CS TR 99-1776, 1999).
- Gurmeet Singh Manku, Mayank Bawa, Prabhakar Raghavan (2003), "Symphony: Distributed Hashing in a Small World", *USITS 2003*, 127–140.
- Krishna P. Gummadi, Ramakrishna Gummadi, Steven D. Gribble, Sylvia Ratnasamy, Scott Shenker, Ion Stoica (2003), "The Impact of DHT Routing Geometry on Resilience and Proximity", *SIGCOMM 2003*, 381–394.
- Duncan J. Watts, Steven H. Strogatz (1998), "Collective dynamics of 'small-world' networks", *Nature* 393:440–442.
- Stanley Milgram (1967), "The small world problem", *Psychology Today* 1:61–67; Jeffrey Travers, Stanley Milgram (1969), "An experimental study of the small world problem", *Sociometry* 32:425–443.
- Albert-László Barabási, Réka Albert (1999), "Emergence of scaling in random networks", *Science* 286:509–512.
- Réka Albert, Hawoong Jeong, Albert-László Barabási (2000), "Error and attack tolerance of complex networks", *Nature* 406:378–382; correction *Nature* 409:542 (2001).
- Ion Stoica, Robert Morris, David Liben-Nowell, David R. Karger, M. Frans Kaashoek, Frank Dabek, Hari Balakrishnan (2001/2003), "Chord: A Scalable Peer-to-peer Lookup Protocol for Internet Applications", *SIGCOMM 2001* / *IEEE/ACM Transactions on Networking* 11(1):17–32.
- Petar Maymounkov, David Mazières (2002), "Kademlia: A Peer-to-peer Information System Based on the XOR Metric", *IPTPS 2002*.
- Antony Rowstron, Peter Druschel (2001), "Pastry: Scalable, decentralized object location and routing for large-scale peer-to-peer systems", *Middleware 2001*.
- Ben Y. Zhao, John Kubiatowicz, Anthony D. Joseph (2001), "Tapestry: An Infrastructure for Fault-tolerant Wide-area Location and Routing", UCB/CSD-01-1141; Zhao et al. (2004), *IEEE JSAC* 22(1):41–53.
- John R. Douceur (2002), "The Sybil Attack", *IPTPS 2002*.
- Miguel Castro, Peter Druschel, Ayalvadi Ganesh, Antony Rowstron, Dan S. Wallach (2002), "Secure routing for structured peer-to-peer overlay networks", *OSDI 2002*.
- Dahlia Malkhi, Moni Naor, David Ratajczak (2002), "Viceroy: A Scalable and Dynamic Emulation of the Butterfly", *PODC 2002* — the `n`-estimator D6 uses, as credited by Symphony.
