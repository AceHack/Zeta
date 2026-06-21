---
id: 081KT07NV0008QG0R002KWQS05
title: Phase 1 — typed Claim/Lock coordination events (optimistic CAS: mechanism-deadlock-free + symmetry-breaking observe-menu; app-level safety needs fencing + release-before-acquire)
status: open
priority: P2
created: 2026-06-01
last_updated: 2026-06-01
author: otto-cli
composes_with:
  - 081KSXN940008QG0R000JZVFXX # taxonomy gap-analysis — this IS its Phase 1 (typed events under existing categories)
  - 081KSXN940008QG0R00171YAZW # git-native bus / G-Set (Claim is monotone, lives here)
  - 081KT07NV0008QG0R000QWEKTE # bus-tip partition tolerance (Lock = the non-monotone single-row CAS)
  - 081KSXN940008QG0R003FCQ7WT # sovereign-DB lane master (CALM boundary + lock-free/wait-free disciplines)
---

# 081KT07NV0008QG0R002KWQS05 — Phase 1: typed Claim/Lock coordination events

> **Why this row exists (not dogma):** 081KSXN940008QG0R000JZVFXX chose Phase 1 = model Claim/Lock as
> typed events under existing categories. Aaron asked _"do we risk deadlocks? can
> we never deadlock and stay simple?"_ — and, separately, _"is there a livelock
> guarantee on the observe 4×4 menu too?"_ A **multi-round** review (Grok +
> Gemini round 1, Amara round 2, 2026-06-01) **disciplined the answer**: the first
> draft over-claimed "deadlock-free by construction." The honest, defensible
> result is below. WHYs stated inline so they can be questioned/agreed/revised.

## §0 The honest deadlock answer — mechanism-deadlock-free; app-level needs three hard invariants

The core intuition holds and is right: **optimistic short-TTL single-resource
coordination is far safer than blocking locks.** But "deadlock-free by
construction" was too strong. Split the claim cleanly (round-1 reviewers
converged here):

- **Mechanism level — deadlock-free, yes.** CAS (`push --force-with-lease`) and
  cooperative claim (try-or-pick-different) are **protocol-level nonblocking** —
  Coffman's hold-and-wait is broken in the coordination algebra. (Round-2 caveat:
  external I/O — a `git push` / network call — can still _hang outside the
  algebra_; that's a separate hazard handled by the `timeout --kill-after`
  discipline, not by CAS. "Nonblocking" is about the coordination protocol, not
  about every syscall it rides on.)
- **Application level — NOT free "by construction."** An agent _policy_ can still
  hold claim A while waiting (sleeping, awaiting human review, awaiting another
  topic) to get B. "No blocking API" is a statement about the library surface,
  not about what a policy does. That circular wait becomes **livelock** (spinning,
  not frozen) — no progress, but not a classic deadlock.

Coffman conditions, honestly:

| Coffman condition   | Mechanism                          | Application (policy)                                                                  |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------------------------- |
| 1. Mutual exclusion | yes (Lock is exclusive)            | yes                                                                                   |
| 2. Hold-and-wait    | **broken** (try-or-fail, no block) | **only broken if policy releases-before-acquiring-different** (§1.3, now a HARD rule) |
| 3. No-preemption    | **broken** (TTL preempts)          | TTL preemption is **unsafe without fencing** (§2 — the real flaw)                     |
| 4. Circular wait    | **broken** (single-resource)       | broken iff single-resource + total-order escape held                                  |

So: deadlock-free at the mechanism; the application is deadlock-free **iff** three
invariants hold as HARD rules — (a) release-before-acquire-different (§1.3),
(b) fencing / CAS-at-write (§2), (c) lease-protected release (§2). The residual is
**livelock**, addressed in §3 (and turned into a real guarantee for the menu).

### §0.1 CAP posture per layer — the per-row CP backstop in a layered stack (Gemini + Grok huddle + Aaron, 2026-06-01)

A CAP huddle on the wider architecture located _where_ the consistency tradeoff lands,
and it lands HERE — but scoped per-row, not globally. The per-layer map:

| Layer                                  | CAP posture                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Per-agent Z-sets / G-sets + git log    | **CA, locally** — single-writer, in-process synchronous indexes; no concurrent writer ⇒ no distributed-C to reconcile    |
| Read-side reporting aggregate          | **AP** — bounded staleness (eventual consistency)                                                                        |
| **Claim/lock coordination (this row)** | **per-row CP** — mutual exclusion is an _agreement_ problem, scoped to one workitem row (per-key CAS), NOT a global lock |

The load-bearing point: **mutual exclusion is not CRDT-able.** A G-set/Z-set converges
_commutatively_; "exactly one agent holds row X" is _not commutative_ → it needs
agreement, and under partition that forces deny-availability OR risk-double-claim. CRDTs
converge state _after_ the exclusive decision; they don't make it. BUT the agreement is
**per-key**: non-contended rows never coordinate (pure AP, parallel); the CP requirement
exists only on the one row two agents claim at the same instant — **per-key
linearizability, not global** (coordination avoidance, Bailis et al.). There is **no
global coordination surface** — no shared register, and no shared `main` (agents own
their own repos across dozens of projects; a per-repo `main` is just another per-key CAS
local to that repo, AP-with-retry via force-with-lease, never a CP bottleneck).

So the optimistic-CAS + fencing mechanism (§0/§2) IS the per-key CP enforcement: under
partition the bite is scoped to the _contended row_ and degrades to **try-or-pick-different
/ rebase-retry** (the §3 livelock discipline) — availability degrades per-contended-key,
consistency holds per-key always.

**Round-2 correction (do not over-read the table):** a second review refuted "the per-row
git CAS is the ONLY CP." Aaron's core — _no single global surface across the
multi-repo/multi-project society_ — holds, but coordination is a **layered stack**, not
one per-row CP: the per-row git CAS is the **authoritative backstop**, sitting under
(a) the **bus claim** (`tools/bus/claim.ts` — first-to-claim + TTL, multi-agent
visibility, advisory/optimistic; bus partition ⇒ two agents can both acquire then race
on git), (b) **ID allocation** (sequential `B-NNNN` needs a consistent `origin/main` +
in-flight view ⇒ stale view ⇒ collision; **content-addressed ZetaIds per 081KSXN940008QG0R000JZVFXX avoid
this**), and (c) per-shared-repo **`origin/main`** serialization (per-ref CAS,
AP-with-retry; GitHub is the availability dependency). Correctness is in how those layers
**compose under partial connectivity**. Also: per-agent state is **CA-local** —
**PACELC is undefined intra-process** (no network boundary), NOT "PC/EC." Cross-row work
(decomposition / cascades) needs the §1.3 single-resource + release-before-acquire rule;
hot-row contention needs §3 backoff + the (unproven) 081KT07NV0008QG0R001N9GJWX bounded-wait-freedom.

**Round-3 resolution (Aaron, 2026-06-01) — Claim is best-effort AP, not CP; this row's
two primitives ARE the AP/CP split.** Round 2's pessimism resolves:

- **Mutual exclusion is NOT a correctness requirement for deterministic/idempotent work.**
  Two agents double-claiming the same backlog item is fine — even valuable: two PRs that
  **cross-verify** each other, or one finishes first and the second sees it on main and
  converges (**deterministic ending; "git decides"**). No lock ⇒ no deadlock/livelock to
  contend (the round-2 deadlock/livelock objections only bite if at-most-once is required).
  So **Claim** (§4: cooperative, monotone, G-Set, try-or-pick-different) is **best-effort
  AP** — redundancy-as-verification, not a CP island.
- **Lock** (§4: hard CAS + fencing) is the **CP** primitive, reserved for the gated
  **non-idempotent** class (money / provisioning / external charges — 081KSNY2Z0008QG0R0036SJ3T1 banker-bot
  territory) where double-work IS unsafe. So this row's Claim-vs-Lock split = the AP/CP
  split: Claim = AP default; Lock = CP escape.
- **PACELC correction-of-the-correction:** per-agent state is geo-replicated for safety
  (F# deterministic DB / CockroachDB — a single copy would be unsafe), so PACELC DOES
  apply: per-agent = **PC/EC** (single-writer; replication chooses C). Round-2's
  "undefined intra-process" assumed a single copy.
- **ID surface being removed:** B-NNNN is a stopgap; ZetaId 128-bit (081KSKBP80008QG0R001KK9WV6 v1 /
  081KSNY2Z0008QG0R000V24M7E v2, already implemented; content/structure-addressed) needs no global allocator.

Full three-round analysis (Gemini + Grok verbatim, both huddle rounds + Aaron's
resolutions):
[`docs/research/2026-06-01-cap-posture-per-row-not-global-coordination-avoidance-gemini-grok-aaron.md`](../../research/2026-06-01-cap-posture-per-row-not-global-coordination-avoidance-gemini-grok-aaron.md).

## §1 The patterns — never-deadlock AND keep-it-simple

Items 1–3 are the simple defaults; #4 is the only-if-ever escape; #5 the livelock
guard; #6 the CALM lens:

1. **Optimistic CAS, never blocking locks (THE pattern).** `git push
--force-with-lease=ref:expectedSha` is compare-and-set: succeeds, or fails-fast
   on drift. Claim is try-or-pick-different (exit-1, no wait). No blocking-acquire
   API exists — breaks hold-and-wait at the mechanism.
2. **TTL on every claim and lock.** No permanent hold; a crashed holder
   auto-expires. **But TTL preemption is only SAFE with fencing (§2)** — without
   it, TTL trades deadlock for a worse stale-holder hazard.
3. **Single-resource + release-before-acquire-different (HARD rule, not a
   preference — round-1 correction).** Hold at most one resource; you MUST release
   it before attempting a different one. This is what actually breaks circular
   wait at the _policy_ level (the mechanism alone doesn't). Mechanically
   enforceable: the API offers `withResource(r, fn)` (acquire→do→release in one
   scope), not a free-standing `acquire` you can stash and hold.
4. **Total lock-order — only if you EVER must hold two.** Acquire in a global
   canonical order (sort keys). Prefer to never need it; first ask whether one
   coarser resource or a redesign removes the second lock.
5. **Bounded randomized backoff (livelock guard, not deadlock).** CAS contention
   can livelock (agents retry in lockstep); randomized backoff + "pick a different
   work-item" breaks symmetry. (Stronger guarantee for the menu in §3.)
6. **Minimize the non-monotone surface (CALM lens).** Claims are **monotone**
   (G-Set, coordination-free) — they cannot deadlock at all. Only **Lock** is
   non-monotone and uses CAS. Smaller lock surface = smaller place deadlock could
   even be contemplated.

## §2 The real flaw round 1 caught — fencing / CAS-at-write (Kleppmann)

A TTL'd lock without **fencing tokens** is unsafe (Kleppmann, _How to do
distributed locking_; the Redlock critique; Chubby sequence numbers): a holder
that pauses (GC, hypervisor, API latency) past its TTL wakes up believing it still
holds the lock and clobbers a resource a new holder now owns → lost update /
split-brain. **`leaseSha` as written only fences the lock-ACQUISITION ref move, not
the protected WRITE.** Two hard requirements:

- **CAS-at-write (mandatory):** the protected mutation must itself re-validate the
  lease at write time — `push --force-with-lease=<resource-ref>:<leaseSha>` on the
  _actual_ mutation, so a stale holder's write fails-fast. Acquisition-CAS is not
  enough; the write carries the fence.
- **Lease-protected release:** release must be lease-checked too — a stale holder
  must not be able to delete a ref it no longer holds.

**Gemini's simplification (worth taking):** if the protected mutation IS a git
commit, then `push --force-with-lease` on the **data branch** is the lock _and_
the fence, combined. In that case **we may not need a separate `LockEvent` at
all** — the data-branch tip is the lock. Keep `LockEvent` only for resources whose
mutation is _not_ a single git-ref move (where `leaseSha` must be threaded to the
writer). **Open design question for Phase-1 impl: which resources actually need a
LockEvent vs. are already fenced by their own data-ref CAS?**

## §3 Livelock on the observe 4×4 menu — a symmetry breaker, not a fairness theorem (Aaron's question, round-2 disciplined)

Yes, livelock matters on the menu (two agents pick the same option, both CAS, one
loses). The first draft claimed "lock-free **by construction**" — **round 2 caught
that as the same overclaim sin §0 had.** The honest statement (Amara keeper):

> **Menu-as-state-fold is a symmetry breaker, not a fairness theorem.**

What the construction actually buys, with the assumptions named:

- **Symmetry-breaking (the real, defensible property).** The menu is `f(current
observed state)`, re-derived each tick. A CAS loser, **once the winner's
  reservation is visible to it**, re-derives a menu with the taken cell gone → it
  picks a **different** cell. So the state-fold prevents _lockstep re-picking of a
  dead option_. That's symmetry-breaking — it stops the classic two-agents-spin
  livelock. It is **not** a proof of progress on its own.
- **Menu selection is lock-free ONLY under three assumptions** — (a) fair retry,
  (b) fresh-state re-derivation each tick, (c) the winner's successful reservation
  is **visible** before the loser re-derives. CAS gives **at most one** winner per
  contended resource per round (zero if stale reads / non-contention failure), so
  "exactly one progresses" does **not** hold under visibility lag or partition
  (the local-vs-remote ref lag round 1 also flagged).
- **NOT proven:** lock-freedom of _task completion_ (vs. selection), per-agent
  **wait-freedom**, fairness, or monotone shrink of the global work set under new
  work / requeues / stale reads / a stalled winner. Don't claim these.
- **Practical (not guaranteed) progress via breadth.** 4×4 = 16 cells; with N < 16
  agents + randomized tie-break, losers disperse to uncontended cells, so under
  normal load starvation is transient. This is an empirical expectation, not a
  theorem.
- **Hard wait-freedom — deferred, only if starvation is observed.** Pure CAS has
  no fairness; add age/ticket priority on a hot resource if a victim actually
  starves. Don't build it pre-emptively (all-complexity-accidental).

**Net (honest):** the menu **breaks lockstep livelock** (symmetry-breaking via
state-fold) and gives **lock-free selection under fair-retry + fresh-state +
visible-reservation**; it does **not** prove completion-lock-freedom or per-agent
wait-freedom — those are **deferred to [081KT07NV0008QG0R001N9GJWX](081KT07NV0008QG0R001N9GJWX-prove-completion-lock-freedom-and-per-agent-wait-freedom-in-fsharp-model-first-then-extend-to-git-2026-06-01.md)
for formal proof** (open follow-up; F# model first, then extended to git — not yet
proven here).
That's still a real win — much of "easy-as-fuck" survives — but it's
a symmetry breaker, not a fairness theorem. Composes with the framework's
lock-free/wait-free always-active disciplines (`dv2-data-split`) as the _selection_
layer, with fairness left explicit-if-needed.

### §3.1 Physics RHYME (operator 2026-06-01 — marked rhyme, not derivation)

The menu's symmetry-break **rhymes with spontaneous symmetry breaking (SSB)** —
operator-authorized to record _as a rhyme_, not a theorem-transfer (per
`grep-substrate-anchors-before-razor` + "rhymes ≠ derivation"):

| SSB ingredient                                 | The menu                                                  |
| ---------------------------------------------- | --------------------------------------------------------- |
| symmetric laws                                 | the protocol privileges no agent                          |
| degenerate equivalent ground states            | "A wins" ≅ "B wins" (same value, relabeled)               |
| a microscopic fluctuation lifts the degeneracy | **CAS-race timing jitter** decides who hits the ref first |
| amplified to macroscopic asymmetry             | the winner **locks in** the resource                      |

So **livelock IS the system stuck in the unbroken symmetric state**; progress
_requires_ the symmetry to break. Two ways, both fine:

- **Spontaneous-like** — let the **CAS race** decide (intrinsic timing fluctuation;
  zero added machinery).
- **Explicit** — **inject jitter / randomness**, which operator confirms is fine
  **especially for fairness** (the explicit symmetry-breaking term is the fairness
  knob; use it when starvation needs breaking).

Boundary: SSB proper is ground-states/order-parameters/Goldstone machinery we are
**not** invoking — this is a structural rhyme that names _why_ the menu needs the
break (the symmetric state is the livelock), not a physics derivation.

### §3.2 Intelligent-agent supervision — the advantage dumb locks lack (operator 2026-06-01)

> **Aaron 2026-06-01:** "we have one advantage … it's intelligent agents doing the
> locks, not dumb code — so we can likely build in the ability for the agents to
> notice the lock issues."

Classical distributed locking has to be provable-by-construction precisely because
the participants are **dumb code** that can't introspect — a spinning process
can't tell it's livelocked. Here the participants are **intelligent agents** who
can _observe their own coordination history_ and adapt. That gives a **second,
complementary defense layer** exactly where construction is weakest — the soft
properties (livelock, starvation, fairness) that §3 / 081KT07NV0008QG0R001N9GJWX cannot guarantee by
construction:

- **Detection is cheap — it's already in the observe loop.** The agent's
  observe→act fold can surface coordination-health signals per tick: CAS
  loss-rate, contention-count on a resource, age-since-own-progress, repeated-
  same-loser. A dumb lock has none of this; an intelligent agent reads it for free.
- **Adaptation is the practical fairness mechanism.** On noticing "I've lost this
  CAS N times / I'm starved," the agent can back off, **switch to different work**
  (the menu always offers other cells), escalate to a human, **negotiate with the
  peer** holding the resource, or propose a redesign. That IS the anti-starvation /
  per-agent-progress mechanism pure CAS lacks — supplied by intelligence, not by a
  ticket queue (build the queue only if intelligence proves insufficient).
- **It's a natural fit for wait-freedom-in-practice (081KT07NV0008QG0R001N9GJWX).** Formal wait-freedom
  needs an explicit fairness term; intelligent supervision provides one without
  hard-coding it — the agent that notices it's starved self-corrects. 081KT07NV0008QG0R001N9GJWX proves
  the construction bound; this layer covers the residual operationally.

**Honest boundaries (defense-in-depth, not a replacement):**

- This is **complementary**, not a substitute for the structural guarantees. The
  **frozen-deadlock** and **lost-update** failures stay closed **by construction**
  (mechanism-nonblocking + fencing + release-before-acquire) — those must NOT
  depend on an agent being clever enough to notice. Intelligence handles the
  _soft_ failures (livelock/starvation), not the _dangerous_ ones.
- It is **not a guarantee.** An agent can fail to notice, or notice and act wrongly
  (make contention worse). So it's a layer that _raises the floor in practice_, not
  a proof — and it never licenses skipping fencing or release-before-acquire.
- **Buildable + falsifiable:** surface the coordination-health signals as explicit
  observe-loop telemetry; an agent that ignores a starvation signal is a detectable
  bug, not an invisible hang.

## §4 The typed event shapes (Phase 1 — payloads under existing `Bus(6)`)

Both ride `Bus(6)` (no root-`Category` change — Phase 2 is gated per 081KSXN940008QG0R000JZVFXX).
`kind` is the subtype discriminator (Grok's "one Coordination + subtype" at
payload scope).

### Claim — cooperative ownership (monotone, G-Set)

```ts
interface ClaimEvent {
  kind: "claim";
  resource: string; // logical: work-item id, lane
  holder: SenderId; // surface-tagged: otto-cli, vera-codex, ...
  acquiredAt: Milliseconds;
  ttlMs: Milliseconds; // long (24h); expiry == release
  action: "acquire" | "release";
}
```

Acquire = observe-then-assert (fold G-Set; if unheld publish `acquire`; if held,
pick a different resource — no wait). The existing `tools/bus/claim.ts`, typed.

### Lock — hard mutual-exclusion (non-monotone, CAS + fencing)

```ts
interface LockEvent {
  kind: "lock";
  resource: string; // specific: ref / row / file path
  holder: SenderId;
  acquiredAt: Milliseconds;
  ttlMs: Milliseconds; // SHORT — critical-op scoped
  leaseSha: string; // fencing token — threaded to the WRITE (§2), not just acquire
  action: "acquire" | "release";
}
```

Acquire = CAS; the **protected write re-validates `leaseSha`** (§2 fencing);
release is lease-checked; TTL expiry auto-releases. (Or skip `LockEvent` entirely
where the data-ref CAS already fences — §2.)

## §5 Acceptance criteria

- [ ] `ClaimEvent` + `LockEvent` typed shapes (TS) as `Bus(6)` payloads; F# parity
      later (mirror the GSet pair).
- [ ] **Scoped API only** — `withResource(r, fn)` (acquire→do→release in one
      scope); no free-standing `acquire` you can stash → release-before-acquire is
      mechanically enforced (§1.3).
- [ ] **Fencing mandatory** — protected write does `--force-with-lease=<ref>:<leaseSha>`;
      release is lease-checked; stale holder fails-fast (§2).
- [ ] Decide per-resource: needs `LockEvent`, or already fenced by its own data-ref
      CAS (§2 Gemini simplification)?
- [ ] TTL on both; short for Lock; expiry == release.
- [ ] Tests: CAS-contention (**at most** one winner), **stale-holder write
      rejected** (fencing), TTL-expiry-releases, **menu symmetry-breaking** (loser
      re-derives + picks a different cell once the winner's reservation is visible;
      no lockstep re-pick), livelock-backoff converges. (Per-agent wait-freedom is
      NOT asserted — see §3.)
- [ ] Total-order helper only if a real multi-lock consumer appears.

## §6 Candidate rules (cooling period — not minted here)

- "Coordination is optimistic CAS, never blocking; mechanism-deadlock-free, with
  app-level safety via fencing + release-before-acquire."
- "Menu-as-state-fold is a symmetry breaker, not a fairness theorem: selection is
  lock-free under fair-retry + fresh-state + visible-reservation; completion
  lock-freedom and per-agent wait-freedom are not proven." (Composes the existing
  lock-free/wait-free disciplines as the _selection_ layer.)

Strong rule candidates, but rules are razored (cooling-period). Revisit after this
lands + a second consumer exists.

## §7 Master-checklist linkage

Phase-1 slice of 081KSXN940008QG0R000JZVFXX, under the sovereign-DB lane (081KSXN940008QG0R003FCQ7WT), reachable from
`docs/ACTIVE-WORKSTREAMS.md`. Unblocks 081KT07NV0008QG0R000QWEKTE (Lock = single-row CAS + fencing)
with no root-`Category` change. The menu symmetry-breaking / selection-lock-freedom
(§3) composes with the observe.ts 4×4 move-next construction.
