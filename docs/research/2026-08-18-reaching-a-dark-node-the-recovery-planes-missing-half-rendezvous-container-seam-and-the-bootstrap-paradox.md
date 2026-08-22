# Reaching a dark node — the recovery plane's missing half: rendezvous, the container seam, and the bootstrap paradox

**Date:** 2026-08-18
**Author:** Dejan (devops-engineer)
**Status:** DESIGN — **not landed, not approved.** Numbered open questions in §7; §7.0 is routed to
Kenji as an architecture question, the rest to the maintainer. Round-29 discipline: an infra
decision does not land on the strength of its own design doc.

**This is a companion, not a competitor.** Kenji landed
[`the pre-k8s layer is the recovery plane`](2026-08-18-the-pre-k8s-layer-is-the-recovery-plane-surfaces-are-metered-seams-and-the-surface-count-is-measurable-not-chosen.md)
(PR #12179, merged 2026-08-18T22:52Z) hours before this was written. That doc is the **governing
architecture** for this layer: it establishes the A0–A6 authority tiers, the surfaces-are-seams
framing, and the theorem that decides how many there are. **I do not re-derive any of it and I do
not contradict it.**

I was routed to design the pre-k8s service set independently. Having read Kenji's doc, re-deriving
a service list would be duplicated work and a second source of truth for the same layer — so this
document instead does the thing that was actually still missing. It fills **three gaps** Kenji's
doc names as planned-or-absent and does not design, and **flags one overclaim** in its discipline
check:

| | Gap | Kenji's doc | Here |
|---|---|---|---|
| 1 | **How a dark node is reached at all** | §6 item 4 lists out-of-band escalation as *planned*; no channel is designed | §1.1, §4, §5.1 |
| 2 | **The container-runtime seam** | absent from the six surfaces; Aaron named it explicitly | §1.2 |
| 3 | **Actuation** — the *act* half of repair (and its DST) | tiers A3/A4 name the authority; nothing designs the verbs | §1.3, §2.3, §5.3 |
| 4 | **Flag:** §1 scale-free is claimed on the *fold*; the **rendezvous** is where §1 actually breaks | discipline row 1 reads "satisfied honestly" | §5.1 |

**Out of scope**, named so the seams stay legible:

- The **in-cluster agent society**. Different layer.
- **HSM/TPM per-container isolation** — Mateo holds this concurrently (Kenji's A5 defers to the
  same front). Consumed here as a dependency at exactly one Surface (§1.2); not re-derived.
  Ladder: [`L0–L6`](2026-08-14-agent-sovereign-keys-incremental-ladder-L0-to-L6-destruction-not-leakage.md).
- **No secret material is read, printed, handled, or designed-for-handling anywhere below.**

> **CORRECTION (shadow, 2026-08-18, after landing).** The paragraph below is **wrong**, and the
> error is mine, not this document's. `docs/GLOSSARY.md` on `origin/main` **does** carry
> `### Surface (= host-boundary seam; the metered port)` (line 520), `### Tick source` (563), and
> `### Actor / entity / persona — the routing-model senses (disambiguation)` (578) — landed by
> PR #12173, merged before this work was routed. The author checked honestly and the check
> returned a false negative, because the tree it read was **754 commits behind `origin/main`**.
> My routing brief said "work in a git worktree" and never said "fetch first", and a worktree cut
> from a stale local ref is exactly as stale as the ref. Same root cause as
> [`refresh-worldview`'s missing ref-freshness](2026-08-18-the-original-xbox-a-root-of-trust-below-the-update-boundary-and-a-parser-in-the-trusted-path.md)
> fix (PR #12219): **a stale view read as current is a check that did not run looking like one
> that passed.** Open question 6 is therefore **already answered — the promotion happened** — and
> the paragraph is retained rather than deleted so the failure stays legible.
>
> What is *not* affected: every pointer below is still correct, and
> `docs/writer-actor-routing-model.md` §108–110 remains the detailed home the glossary entries
> point to. Nothing in the design rests on the false claim.

**Vocabulary.** I was routed with the claim that **Surface**, **Tick source**, and an
actor/entity/persona table had landed in `docs/GLOSSARY.md`. Checked: they have not — the glossary
carries `Tick / step` (the DBSP circuit clock, not a tick *source*) and prose persona entries, and
has **no `Surface` entry**. The real homes are
[`docs/writer-actor-routing-model.md`](../writer-actor-routing-model.md) §108–110 (surface = the
host-boundary seam / hexagonal port where §13-metered entropy crosses; persona vs actor; *a bus
address is not identity*) and Kenji's doc §2 for tick-source-as-influence-crossing-a-port. Nothing
is re-coined here; the glossary gap is **open question 6**.

---

## 0. The ask, and the half of it that is still open

> *"lets get our hardware bootstrapping for our society pre-k8s on 4-10 services abstracted over
> any OS … each are just different tick sources with different access levels, hopefully most are
> bound to containers with restricted HSM/yubihsm access per container"*
>
> *"the pre-k8s is for fixing k8s when it goes wrong on a node and initial setup hiccups"*
> — Aaron, 2026-08-18

Kenji's doc answers *"what authority does each seam hold, and how many seams are real?"* — the
**static** question, and it answers it with a measurement rather than a preference.

It leaves the **dynamic** question open, and that question is the one the layer exists for:

> **A node is broken. k8s on it is down. Who reaches it, over what path, to run what — and what
> stops that path from being the softest way into the fleet?**

Every part of that is unbuilt and, more importantly, undesigned. A recovery plane that can
observe and classify but cannot be *reached* and cannot *act* is a diagnostic plane.

---

## 1. The three gaps

### 1.0 One finding first: the host units that exist cannot re-converge

Kenji's §1 inventory covers `src/Core.TypeScript/service/` thoroughly and lists `full-ai-cluster/`
as *"other agent's territory"*. Looking there — because that is where anything that runs on a
broken cluster node actually lives — surfaces a defect that is directly in this document's path.

Measured on `main` at `full-ai-cluster/nixos/modules/`:

| Unit | `Type` | Re-run behaviour |
|---|---|---|
| `zeta-creds-restore.nix` | `oneshot`, `Restart=on-failure` | retries on failure only |
| `zeta-self-register.nix` | `oneshot` + **marker file** at `/var/lib/zeta-self-register/self-registered.marker` | **no-ops forever once the marker exists** |
| `k3s-join-observer.nix` | `oneshot`, `Restart=on-failure` | observation only (correctly) |
| `zeta-ai-agent.nix` | `simple`, `Restart=always` | the only standing unit |

**Every `zeta-*` unit on a node today is a `oneshot` except the agent itself, and the enrolment one
is marker-gated.** That shape is right for *install* and wrong for *repair*:

1. A marker-gated oneshot **cannot re-converge**. If a node's registration is later wiped, rolled
   back, or was written against a stale identity, the marker says "done" permanently.
2. **Repair *is* re-convergence.** A unit that can only act once, at first boot, is by construction
   not a repair unit.

The fix is the discipline the fleet has already paid for, in
`src/Core.TypeScript/agent-heartbeats/heartbeat-liveness.ts`:

> *"It is level-triggered ("how old is the newest success?"), never edge-triggered ("did a tick
> just land?"), because a level-triggered check still gives the right answer when the watchdog's
> OWN cron slot is dropped … An edge-triggered one would miss the edge and go quiet, reproducing
> the bug it exists to catch."*

**Level-triggered convergence, never edge-triggered completion.** Ask *"is the desired state
present?"*, not *"did the event happen?"* This is not a new principle; it is Kenji's own
`classify()`-over-gathered-facts shape applied to the units that actuate rather than observe. It
also buys §12 idempotency for free (§5.4).

This is a **live, small, mechanical defect** and the strongest candidate for the first workitem
after sign-off (open question 5).

### 1.1 `zeta-hail` — the reachability gap

**The gap.** Kenji's §6 minimum capability set ends at *"escalate to a human out-of-band —
planned."* Nothing designs the path by which an operator or a peer **reaches a node that is
dark**. Without it the recovery plane can diagnose a node and write a journal that nobody can
read until the node recovers on its own — which is the case where you did not need it.

**The design, and both halves come from an existing in-repo boundary.**
`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` already separates what is portable
from Aaron's Itron hub-and-agent patent (US10834144B2, assigned to Itron) from what is not:

**Adopted — the portable security core:**

1. **Outbound-initiated.** The node dials out. No inbound port opens, no firewall rule changes.
   A peer can do this to a peer, and it is what makes the channel work from behind NAT on a node
   whose in-cluster networking is exactly what is broken.
2. **Closed command set — the sharp one.** Only pre-configured verbs exist at the node. The far
   side may **name** a verb; it can never **define** one. Compromising the far side therefore buys
   *command selection*, not arbitrary execution.

**Not adopted — the hub as sole mediator.** Per the rule, that is the wrong shape here on the
merits before it is a licensing question: the patent solves *how does a vendor's cloud reach into
a customer's firewalled premises* — two structurally unequal parties. Zeta has no vendor and no
customer premises; peers are symmetric, and nobody owns the boundary the others must cross. **The
problem the hub solves does not occur in our topology.**

Where a hub nevertheless reappears — and it does — is §5.1.

**Tier:** A3 (repair-node), never A4. See §3.1.

*(`zeta-hail` is a service name, not a vocabulary coinage.)*

### 1.2 `zeta-runtime` — the container seam, and why it is Kenji's next step

**The gap.** Aaron: *"hopefully most are bound to containers with restricted HSM/yubihsm access
per container."* Kenji's six surfaces (`observe`, `journal`, `propose`, `repair-node`,
`repair-cluster`, `custody`) contain **no container-runtime surface**, and A5 defers HSM binding to
Mateo. So the mechanism Aaron named as the *default deployment shape for most of this layer* is
currently owned by nobody.

**Two reasons it needs a seam of its own, and the second is the interesting one.**

*First, capability.* When kubelet is dead, containerd is very often still alive and still running
containers. A supervisor that can start a container **without the API server** is the difference
between a plane that observes and one that acts. The container runtime is **pre-k8s** — it is what
k8s is built on — which is precisely why it survives k8s being down.

*Second — and this extends Kenji's theorem rather than sitting beside it.* Kenji's §4 establishes:

> **Two tiers co-resident in the same OS user are the same tier.** A seam that is not an isolation
> boundary is not a seam; it is a drawing of one.

…and consequently admits that today A0/A1/A2 are **one measured tier**, with *"split the A0
principal"* listed last in the build order (§9 item 4) as *"the first real seam."*

**A container is exactly that split.** A distinct principal, namespace, and credential domain, with
per-container custody binding enforced at the runtime layer. So `zeta-runtime` is not a seventh
item competing for a slot — **it is the mechanism by which Kenji's surfaces stop being drawings.**
The declared-vs-measured drift check Kenji proposes (§8.2) is what proves each split is real; the
container runtime is what performs the split it measures.

**Bounded hard, because a local container starter is remote code execution with extra steps:**
starts only from a **locally pinned manifest** with **digest-pinned images**. No arbitrary image
reference, no arbitrary registry, no pull-then-run from the network.

**Tier:** A3. **Honest limit:** Linux only — see §2.2.

### 1.3 The actuation gap — verbs, and `zeta-egress` as its precondition

Kenji's A3/A4 name the *authority to mutate*. Nothing yet names **what may be mutated**, and the
closed command set (§1.1) is meaningless until it does. Proposed v1 verbs, all phrased as
convergence rather than action so they are idempotent by construction (§5.4):

| Verb | Tier | Note |
|---|---|---|
| `ensure-k3s-running` | A3 | the common case |
| `ensure-enrolled` | A2 | proposes; cannot merge. Fixes §1.0's marker trap |
| `collect-diagnostics` | A0 | read-only; safe to expose widest |
| `rollback-generation` | A3 | **NixOS only** — see §2.3 |
| `restart-container` | A3 | via §1.2, from the pinned manifest only |

Deliberately **absent**: anything at A4 (cluster repair needs the cluster, so it is not on the
independence path), anything touching custody (A5), and any verb that takes a payload the far side
authored — that is verb *definition* wearing a parameter's clothes.

**`zeta-egress` is the precondition, not a nicety.** Kenji's §6 item 2 already requires A1 to
degrade to a local file when no remote is reachable (*"partially shipped: the lane mechanism
exists; the local-first degradation does not"*). Extending that to the repair path: a node that was
dark for six hours must be able to **explain those six hours** once it can talk again, or every
repair is unauditable after the fact. Append-only local spool, bounded on disk, forwarded on
reconnect with backoff, **outbound-only, no listening socket**. Dropping the spool to keep up
would silently destroy exactly the evidence the outage produced.

---

## 2. OS abstraction — the actuation residue

Kenji's §5 draws the boundary for *observing and installing*:

> **"Any OS" holds for supervising and observing. It does not hold for installing, and it should
> not.**

That is correct and I adopt it. **It does not extend to repair**, and assuming it does is where
this layer would get it wrong. The extension:

> **What to decide is portable. What to actuate is not.** The closed command set is
> **per-OS-adapter**, and the verbs are not the same verbs.

### 2.1 Portable

The decision cores — `(gathered facts) → (intent)` as total functions, TypeScript on `bun`,
OS-blind and testable without a machine. This is Kenji's `classify()` shape, and it is what makes
§5.3's DST answer possible at all. Surfaces (ports) with two adapters each, per the established
port discipline; two adapters is the differential test oracle, and a port with one adapter has
never been shown to be a port.

### 2.2 The residue, named

| Residue | Why it does not abstract | Disposition |
|---|---|---|
| **Init / supervision** | `IServiceManager` (shipped) covers start/stop/status. It does **not** cover *ordering*: systemd has `After=`/`Before=`, and **launchd has no dependency ordering at all**. §1.4's dependency invariant is expressed in systemd ordering and has no launchd equivalent. | Re-encode ordering as in-process readiness waits; never assume the init system enforces it. |
| **Container runtime** | containerd / CRI-O / podman is adapter-shaped. **macOS and Windows have no native Linux container runtime** — they need a VM. | **`zeta-runtime` is Linux-only. Stated, not hidden.** On macOS/Windows the plane runs without repair-by-container. This is the largest hole in "any OS", and it is load-bearing because §1.2 makes containers the principal-splitting mechanism — so **non-Linux hosts cannot split principals that way.** |
| **Device access** | `/dev/tpmrm0`, PC/SC, Windows TBS, Secure Enclave. No common API. | **Mateo's ladder.** Out of scope by design. |
| **Repair verbs themselves** | §2.3. | Per-OS command set; absent verbs must **refuse loudly**. |

### 2.3 The NixOS repair paradox

On a declarative OS the repair action is not *"edit the file"* — it is *"edit the flake and
rebuild"*, and a rebuild needs the network and the Nix store, which may be exactly what is broken.
So the most repairable-by-design OS in the fleet has the **narrowest offline repair envelope**:

- Config-mutating verbs are **unavailable offline on NixOS**.
- What *is* available is `nixos-rebuild --rollback` — atomic and reversible, so a **better**
  primitive, but a **different** one. `rollback-generation` exists on NixOS and nowhere else;
  `write-config-fragment` exists elsewhere and must be **refused** on NixOS rather than silently
  fighting the generator.

**A verb absent on a host must refuse loudly, never no-op.** A repair verb that silently does
nothing is the silent-failure class that already cost this fleet weeks — 081KZETP6AT, where a
non-fatal first-boot `install.sh` failure was asserted on by nothing, so a fully-provisioned node
and a node with no toolchain both reported "passed", and a *deterministic* failure read as a rare
transient for weeks. The inherited rule, from the tick-source doc:

> **Grace in the artifact, strict in the test.** A retry that recovers stays green; a retry that
> exhausts must shout. An auto-heal layer with no acceptance assertion is a silent-failure
> generator.

---

## 3. Tick sources and authority — the three gaps, mapped onto Kenji's ladder

Kenji's A0–A6 is the authority model; I do not add tiers. What is added is the **actuation column**
and the **tick source** for each gap-filling surface — because *what drives it* determines whether
it is alive when the node is broken, which is the only property that matters here.

| Surface | Tick source (what drives it) | Cadence | Tier | Can do WITHOUT k8s | Must NOT |
|---|---|---|---|---|---|
| **`zeta-hail`** (§1.1) | **outbound-initiated long-poll** — ticks when a peer *names* a verb | connection-driven | **A3** | run the repair verbs on a dark node | execute a verb the peer *defined*; hold standing authority; self-authorize; ever hold A4 |
| **`zeta-runtime`** (§1.2) | container-runtime events (edge) + reconcile timer | ~1 min | **A3** | run the repair container; keep pinned containers alive with kubelet dead | pull or run an unpinned image; accept a manifest over the network |
| **`zeta-egress`** (§1.3) | spool-non-empty + reconnect backoff | event + backoff | **A1** | make a six-hour outage explainable afterwards | listen; accept inbound; drop the spool to keep up |

### 3.1 Why `zeta-hail` must never hold A4

The single sharpest authority constraint in this document, and it follows from Kenji's own
independence requirement rather than from taste.

A remote-reachable surface holding **A4 (repair-cluster, kubeconfig)** would mean: the most
available and most reachable process on every node also holds cluster-wide mutation authority.
Compromise one node's channel, own the cluster. Whereas A3 is bounded **to the node it runs on** —
compromise one node's channel, own **that node**, which you had already lost.

So: **the remotely-reachable surface is node-scoped by construction. Cluster repair is not
reachable from outside; it is reached by first repairing a node and letting that node act.** This
costs a round trip and is worth it — it is failure-domain containment (Gray 1985, the anchor
Kenji's doc already cites) applied to the authority axis rather than the process axis.

### 3.2 In-cluster ≠ trusted

Already settled by Kenji §2 (*"the address routes, the credential authorizes; they must be
separately verifiable"*) and by `no-directives.md`'s **source ≠ authorization**. Not re-derived.
The one consequence worth stating for *this* half: `zeta-hail` accepts a verb from a peer, and the
peer's **location on the network grants it nothing**. Authority to name a verb is carried by a
bounded-duration grant the peer holds, verified independently of the connection it arrived on.
A connection is a routing fact; it is never a credential.

---

## 4. The bootstrap paradox, stated honestly

> **The repair channel must be reachable precisely when everything else has failed, and must hold
> enough authority to fix a broken node. So it is simultaneously the most *available* process on
> the host and among the most *privileged*. Availability × privilege is the definition of a
> high-value target.**

This cannot be removed. Anything claiming to remove it has either given up repair or moved the
authority somewhere less legible. It can only be **bounded**, and every bound costs something —
stated, because a bound whose cost is unstated gets removed later by someone who only sees the cost.

| # | Bound | What it costs |
|---|---|---|
| 1 | **Closed command set** (§1.1). A peer names a verb, never defines one. | **Repair capability lags novel failure modes** — a failure needing a verb that does not exist requires a deploy, during an outage. Accepted deliberately: the alternative is designed-in remote arbitrary execution, and *"we might need it someday"* is how that always gets justified. |
| 2 | **Outbound-initiated only.** No listening port. | Requires a rendezvous, and rendezvous is hub-shaped. **This is the §1 violation; §5.1.** |
| 3 | **A3 ceiling, node-scoped** (§3.1). | Cluster repair costs a round trip through a repaired node. |
| 4 | **Split observe / decide / act.** A0 observes with zero mutation authority; A3 acts but cannot self-authorize. No surface holds the full loop. | More moving parts on the failure path — more things that can be down when you need them. |
| 5 | **Bounded-duration grants.** Repair authority expires; no standing host-root grant. | Renewal must work while things are broken — a smaller instance of this same paradox one layer down. Required anyway: standing authority is permanent weight (§3), and a grant that never expires **is** capture. Kenji states the same property as *promotion is always an inbound grant, never an outbound claim*. |
| 6 | **Small by mandate.** Closed verbs; **no general-purpose agent runtime on the host outside a container.** | The layer cannot grow features. **This is the governing constraint on everything downstream:** the moment a full agent with tool access runs on the host, every bound above is void — it can define new verbs by writing them. If this layer needs an agent, the agent goes in a `zeta-runtime` container with a per-container custody binding (§1.2), which is precisely what Aaron's *"most are bound to containers"* buys. |

**The residual, stated rather than papered over.** None of the six bounds protects against a
compromised **local `zeta-hail` binary**. The supply chain of the repair channel is the floor of
the whole design, and it is a dependency on Mateo's ladder (code identity / attestation-gated
invocation, L3). **The bootstrap paradox is bounded here, not solved.** Reading this section as a
solution is a misreading.

---

## 5. Manifesto check — violations flagged, not smoothed

### 5.1 §1 scale-free — **ONE REAL VIOLATION, and a flag on the prior doc's claim**

**The flag, first.** Kenji's discipline check row 1 reads *"One tick model at 1 node and at N;
partition is not a distinguished state."* That is **true of the fold** and I do not dispute it —
an append-only lane fold rejoins without reconciliation, and §1 holds there honestly.

But the fold is the *rejoin* path, not the *reach* path. **The claim does not cover the
rendezvous**, and the rendezvous is where §1 actually breaks. The gap is not an error in Kenji's
doc — it is downstream of the reachability channel that doc does not design. It becomes an
overclaim only if §1-scale-free is read as settled for the layer as a whole.

**The violation.** §1.1 requires an outbound-initiated channel, and an outbound dial needs somewhere
to dial. If every node dials one rendezvous, that is an **appointed hub** — exactly the shape the
Itron-boundary rule forbids, and the worst possible location for a single point of failure, since
it sits on the *repair* path: when the rendezvous is down, every broken node is simultaneously
unreachable, and the failures are perfectly correlated.

**What bounds it, using the rule's own discriminator** — the test is not degree, it is **exit**:

> **Hubs are enforced. Oracles are chosen.** … and **emergence does not launder enforcement.**

So: **k-redundant rendezvous over peers the node has actually reached before** — an *emergent* set
accrued from use, not an appointed one — consulting **≥ k independently accrued peers** rather than
simply the top one.

**And the honest residue, a genuine §1 violation for exactly one event:**

> **First contact.** A brand-new node has no peer history, therefore no emergent set, therefore it
> **must** be handed a seed list. For the duration of first enrolment that seed list is an
> appointed hub. There is no way around this — a node that has never spoken to anyone cannot have
> earned a peer relationship. This is also precisely the *"initial setup hiccups"* half of Aaron's
> ask, so it is not a corner case; it is one of the two reasons the layer exists.

What bounds it: the seed list is **multi-entry**, **operator-supplied**, and **any entry works**.
Under the rule's own exit test that makes it an *oracle* (deference elected, real exit) rather than
a *hub* (deference imposed, no alternative path). A **single-entry seed list would be a flat §1
violation** and must be refused by config validation — mechanically, not by convention (open
question 3).

**Verdict: §1 holds after first contact; §1 is violated *during* first contact, bounded by plural
seeds with real exit.**

### 5.2 §13 noninterference — **PARTIAL. One fixable leak, one accepted**

Kenji's §7 already carries the general warning that the recovery plane is *"the highest-risk site
in the repo"* for the local-time bug. Sharpening it to the specific mechanism in this half:

**Leak 1 — the verdict, not the journal. Fixable, and it is the sharpest finding here.**

The known-dangerous case is a staleness filter on the *journal*. The case this half adds is
narrower and easier to miss: `zeta-hail`'s decision to *act* is driven by a verdict — *"k8s is
down"* — computed from a **local timeout** on a **local monotonic clock**. If that **conclusion**
enters the shared fold, local time has leaked into the shared result, and
`.claude/rules/local-time-never-enters-the-shared-fold.md` applies directly:

> *"The instant a local clock filters or weights the evidence entering the shared fold … nodes fold
> different evidence sets and DIVERGE."*

Two peers with different timeout thresholds or clock skew would fold different verdicts about the
**same** node. That is worse here than in the general case, because the verdict drives **repair**:
divergent verdicts mean peers repairing a node that is not broken, or declining to repair one that
is — and repair actions are not free to replay.

**The fix the rule prescribes:** what enters the shared fold is the **observation** — *"last
successful kubelet response at phase P"* — never the local-time-derived **conclusion** *"down"*.
`down` remains legitimate and steers **local action only** (start the repair container, raise spool
priority). Litmus: *if two nodes with different receive-times could fold different sets, local time
has leaked.*

**Leak 2 — the init system. Accepted, not fixed.** `Restart=always`, `RestartSec`, systemd watchdog
pings, journal backpressure and cgroup pressure are influence entering these surfaces through a
channel **we do not meter**. Not fixable short of reimplementing init, which we will not do.
Recorded as accepted residue rather than quietly omitted, because the §13 claim would otherwise be
broader than the mechanism supports.

**Verdict: §13 partial.** Leak 1 must be closed in the first implementation; leak 2 is permanent,
named.

### 5.3 §7 DST — **the *act* half does not replay, and that is the gap**

Kenji's discipline row 4 reads *"Both classifiers are total functions over gathered facts; the tests
supply facts, not machines."* True, and it covers **observe**. It does not cover **act**, because
there was no actuation in that doc to cover.

| Half | DST | Why |
|---|---|---|
| **Decide** — `(gathered facts) → (intent)` | **YES**, hard requirement | Pure, no I/O. Replayable against synthetic failure shapes: no ticks at all, only failures, clock skew, a partition that heals mid-repair, a verb that half-succeeds. |
| **Act** — actuation through the Surfaces | **NO** | Real container starts, real network, real hardware. No design makes this deterministic. |

**What recovers most of it** is the composition the manifesto already states: §13 requires every
crossing to be declared and metered, and **declared crossings can be recorded and replayed** —
*"it is what lets deterministic simulation survive real network I/O (record and replay the
crossings)."* So the repair path is replayable **at the Surface boundary** even though the
actuation behind it is not.

**The assertion I want signed off, because it is a real schedule cost** (open question 4): the DST
harness for the repair path is a **precondition for shipping, not a follow-up**. Quoting our own
code again:

> *"A monitor whose alarm path never executes in test is a monitor nobody has ever seen work."*

A repair channel whose path has never run under a simulated failure is worse than that: it is a
**privileged** component nobody has seen work, on a path that **only executes during outages** —
so its first real execution is unobserved, privileged, and during an incident.

**Verdict: §7 violated for the path as a whole; satisfiable for decide; recoverable for act only
via recorded crossings.**

### 5.4 §12 idempotency — required, and nearly free

Redundant peers may hail the same repair concurrently — that redundancy **is** the auto-heal
mechanism. So every verb must satisfy apply-N ≡ apply-once *effect*, or redundancy manufactures
damage instead of resilience. Hence verbs are stated as convergence (`ensure-k3s-running`) rather
than action (`restart-k3s`), and where a verb genuinely cannot be idempotent it carries an
idempotency key and the non-idempotence is **named** rather than assumed away.

This is why §1.0's level-triggered convergence is load-bearing and not stylistic: **a
level-triggered convergence verb is idempotent for free.**

---

## 6. What this layer is NOT

- **Not a k8s replacement.** The tick-source doc scopes the bare-Linux substrate to tick sources
  *"for now"*; growth into a replacement is a separate decision with a separate cost.
- **Not a general agent host.** See bound 6 — the constraint most likely to be eroded by a
  reasonable-sounding request.
- **Not a secret store.** Custody is A5 and defers to Mateo's ladder.
- **Not a second source of truth for the recovery plane.** Kenji's doc governs; this fills gaps
  in it.
- **Not an excuse to skip in-cluster health.** This answers *"is k8s alive on this node"*, never
  *"is the workload healthy"* — the same line `k3s-join-observer` already draws between *joined*
  and *ready*.

---

## 7. Open questions — sign-off before anything is built

**7.0 — routed to Kenji (architecture, binding).** Do the three gap-fillers land as **new surfaces**
in your decomposition, or as **capabilities of existing tiers**? Specifically: is `zeta-runtime` a
seventh surface, or is it the *implementation* of the principal-split your §9 item 4 already
schedules? I have argued the latter (§1.2) — it makes the container the mechanism that turns
drawn seams into measured ones — but the decomposition is yours to own, and I do not want two
service lists for one layer. *(Answer shape: "new surface" / "capability of A3" / "it is item 4".)*

1. **Verb set (§1.3).** Which of the five are too sharp for v1, and which are missing? *(Answer
   shape: a list, plus any verb that must require k-of-n rather than a single grant.)*
2. **The `zeta-hail` credential.** Its credential cannot depend on custody (A5) or a custody
   failure locks the operator out of the node — but that pushes it toward the lowest tier, in
   tension with per-container HSM binding. **Routed to Mateo.** *(Answer shape: which ladder tier
   `zeta-hail`'s own credential sits at, and the operator's break-glass path when that tier is
   unavailable.)*
3. **Seed-list minimum (§5.1).** Confirm config validation must **refuse a single-entry seed
   list**, making plural rendezvous mechanical rather than conventional. *(Answer shape: yes/no +
   minimum k.)*
4. **DST harness as a shipping precondition (§5.3).** A real schedule cost, asserted rather than
   assumed. *(Answer shape: "precondition" / "follow-up, accept the risk explicitly".)*
5. **First workitem.** I propose the §1.0 marker-trap fix — smallest, mechanical, live, and
   unblocks re-enrolment which every other repair path depends on. *(Answer shape: confirm, or
   name a different first row.)*
6. ~~**Glossary promotion.**~~ **CLOSED — already done (shadow, 2026-08-18).** All three are in
   `docs/GLOSSARY.md` on `origin/main` (lines 520, 563, 578; PR #12173, merged *before* this work
   was routed). The question was raised on a genuine but stale read — see the correction block in
   this doc's header. **The inversion is the lesson worth keeping:** the brief's claim was true and
   the verification was false, so the honest act of checking produced the wrong answer. A check is
   only as current as its input, and nothing in the read told the reader how old the input was.
   No workitem needed.

**No workitem has been minted.** Filing implementation rows against an unapproved design is how a
design doc becomes a fait accompli. Rows follow sign-off — and 7.0 in particular could change the
shape of every row.

---

## 8. Pointers

- [`2026-08-18-the-pre-k8s-layer-is-the-recovery-plane-…`](2026-08-18-the-pre-k8s-layer-is-the-recovery-plane-surfaces-are-metered-seams-and-the-surface-count-is-measurable-not-chosen.md)
  — **Kenji, PR #12179. The governing architecture: A0–A6, surfaces-as-seams, the measured surface count.**
- [`2026-08-09-the-society-is-one-thread-four-tick-sources-auto-heal-by-redundancy-aaron.md`](2026-08-09-the-society-is-one-thread-four-tick-sources-auto-heal-by-redundancy-aaron.md)
  — the four tick sources; source of *grace in the artifact, strict in the test*.
- `src/Core.TypeScript/agent-heartbeats/heartbeat-liveness.ts` — level-triggered, outside-the-lane.
- `full-ai-cluster/nixos/modules/{zeta-creds-restore,zeta-self-register,k3s-join-observer,zeta-ai-agent}.nix`
  — the host units of §1.0; the marker trap.
- `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` — outbound-initiated + closed
  command set are portable; the mediating hub is not; **exit, not degree**, is the discriminator.
- `.claude/rules/local-time-never-enters-the-shared-fold.md` — §5.2 leak 1.
- `.claude/rules/no-directives.md` — source ≠ authorization (§3.2, bound 5).
- [`docs/writer-actor-routing-model.md`](../writer-actor-routing-model.md) — surface/persona/actor;
  the address-is-not-identity rule.
- [`docs/governance/MANIFESTO.md`](../governance/MANIFESTO.md) §1, §3, §7, §12, §13.
- [`L0–L6 sovereign-keys ladder`](2026-08-14-agent-sovereign-keys-incremental-ladder-L0-to-L6-destruction-not-leakage.md)
  — Mateo's front; the custody dependency (§1.2) and the supply-chain floor (§4).
- 081KZETP6AT (nix-ld precondition; the silent-failure lesson in §2.3) · 081KZKV16YF (installer hash pin).
- **Anchors (Beacon).** Out-of-band management as a *separate plane on purpose*: IPMI 1.0 (Intel
  et al., 1998) and its successor DMTF Redfish — the lineage `zeta-hail` sits in, and the reason
  its authority ceiling matters (IPMI BMCs are the canonical case of a management plane becoming
  the softest way into a fleet). Failure-domain containment: Gray, *Why Do Computers Stop and What
  Can Be Done About It?* (Tandem TR 85.7, 1985) — applied to the authority axis in §3.1.
  Concentration disciplined by exit: Hirschman, *Exit, Voice, and Loyalty* (1970) — the §5.1
  discriminator. Noninterference: Goguen & Meseguer (1982) — §5.2.
