# The UDP burst-loss cliff — a Gilbert–Elliott chaos harness, and why FoundationDB's DST does not reach this fault class

**Date:** 2026-08-13
**Author:** the shadow (Claude Opus 5, Claude Agent SDK)
**Subject:** `src/Core.TypeScript/discovery/udp-lossy-transport.ts`
**Artifacts:** `src/Core.TypeScript/discovery/udp-lossy-transport.chaos.ts` (harness),
`udp-lossy-transport.chaos.test.ts` (UCH-1..UCH-16)
**Register:** Mirror for the narrative, Beacon for every anchor. Every claim below is marked
**CHECKED** (I ran it or read it) or **PROPOSED** (I have not).

---

## 1. The ferry — Aaron, 2026-08-13, verbatim

> we also have udp started not sure how reliable it is at lossy traffic yet, i don't think we have
> good chaos tests for this yet, it's not your average db technology like foundation db so will
> require us to be pioneers in some places

Preserved verbatim per `always-preserve-ferries`. Everything below is an attempt to make the
second and third clauses precise: what "good chaos tests" would have to do that the existing
tests do not, and where exactly the pioneering is required rather than rhetorical.

---

## 2. What was already there — CHECKED

`udp-lossy-transport.test.ts` carries 16 tests, ULT-1..ULT-16. Reading them:

| tests | what they cover |
|---|---|
| ULT-1..5, 11..13 | the **algebra**: parity XOR, single-erasure recovery, a negative control at 2 erasures, codec round-trip, XOR fallback |
| ULT-6, 7 | one injected drop in one block |
| ULT-8, 9, 10 | AIMD **arithmetic** — that the gap doubles, shrinks, and that `lossRate` divides |
| ULT-14 | the jitter timer fires |
| ULT-15, 16 | the teaching-NACK / BNN path, including an unusually honest note about a mutant that no test can kill |

These are good tests. **They are unit tests of the algebra and the state machine, and none of
them runs a loss process.** That is not a criticism of them; it is a statement about layer. The
question "is this reliable on a lossy channel?" is not answerable from any of them.

### 2a. Where my going-in reading was right, and where it was wrong

I was handed five suspected gaps. Checking each against the code and then against measurement:

| # | claim | verdict |
|---|---|---|
| 1 | burst loss untested; ECC has a correlated-failure cliff | **CONFIRMED untested.** But the cliff is not shaped the way I expected — see §5. The dominant defect turned out to be something else entirely. |
| 2 | reordering untested | **untested: yes. Broken: NO — at the delivery layer.** Corrected below. |
| 3 | duplication untested; §12 idempotency unverified | **untested: yes. Broken: NO.** Corrected below. |
| 4 | AIMD never driven by a real loss process | **CONFIRMED, and worse than suspected** — the estimator is structurally defective, §6. |
| 5 | "no seed vocabulary in the test file" | **imprecise.** The word `seed` *does* appear, at `makeData(n, seed = 0)`. It is a payload-shaping parameter, not a fault seed. The concept — a replayable fault process — is genuinely absent. |

**Correction on #2 (reordering).** `addToBlock(block, pos, payload)` is indexed by position
within the block, and `recvBlocks` is a `Map` keyed by `blockSeq`. Out-of-order arrival
therefore *cannot* mis-assemble a block. Measured: **100% delivery, 0 corrupt, at reorder rates
up to 20% and reorder depth 32** (`UCH-10`). The suspicion was reasonable and it was wrong.

**Correction on #3 (duplication).** `addToBlock` opens with
`if (block.packets[pos] !== null) return null;`. Measured: **100% delivery, 0 corrupt, at a
100% duplication rate** (`UCH-9`). §12 holds on this path. Also wrong.

I am recording both as tests rather than as prose, because a disproved suspicion that is not
pinned gets re-suspected. But the honest summary is that two of the five suspected defects were
not defects, and the harness's value came from three places nobody had named in advance.

---

## 3. Why FoundationDB's DST does not cover this case — the pioneering claim, stated precisely

This is the clause worth being careful with, because "we're pioneers" is the kind of sentence
that flatters and explains nothing. The precise version:

**FoundationDB's simulator and this harness inject faults from different classes, at different
layers, against different failure modes.**

| | FoundationDB DST | this harness |
|---|---|---|
| substrate assumed | **TCP** — reliable, ordered, retransmitting | **UDP** — unreliable datagrams, no ordering, no retransmit |
| fault primitives | machine kill/reboot, disk corruption + slowness, network **partition**, clock skew, process swap | per-packet **erasure**, packet **reordering**, packet **duplication** |
| the failure it hunts | a **distributed-state** bug: a protocol that loses durability or consistency across a partition or a restart | a **coding** bug: an ECC whose recovery capacity is exceeded by *correlated* loss inside a block |
| the granularity | a connection, a machine, a datacenter | a **packet**, and specifically **which 8-packet block it fell in** |
| what determines the outcome | who could talk to whom, and when | how the losses **clustered** — the same mean loss rate passes or fails depending only on correlation |

The load-bearing difference: **TCP hides erasure.** A simulator that partitions a TCP link is
asking "what does the protocol above do when the link is *gone*?" It is not asking "what happens
when 2 of these 8 datagrams vanish and the other 6 arrive fine?" — because on TCP that situation
does not reach the application. FDB's fault model is *correct and complete for FDB*, and it has
no primitive for the thing that breaks an erasure code, because an erasure code is not in its
stack.

So the departure is **the fault class, not the method**. The method — a single-threaded
deterministic run, all entropy from one seed, any failure replayed exactly — is FDB's, and is
copied here deliberately and gratefully (Zhou et al. 2021; Wilson 2014). What had to be built
new is the *channel model*: a loss process with memory, so that loss correlates the way real
loss correlates. That is where the pioneering actually is, and it is a smaller and more specific
claim than "nobody has done this" — burst-loss channel modelling is 1960s literature (§4). The
novelty is **composing a 1960s channel model with an FDB-style deterministic simulator, over an
ECC-carrying datagram transport**, which is not a combination the reference standard supplies.

Honest limit — **CHECKED against my own artifact**: this harness models the *channel*. It does
not model machine failure, process restart, or partition. It is a complement to FDB-style DST at
a lower layer, not a replacement for it, and a full picture of this transport wants both.

---

## 4. Loss model: Gilbert–Elliott, and why uniform loss would have produced a false green

> **CORRECTION 2026-08-14 — every "uniform" number in this section is mislabelled.**
> `meanBurstLength = 1` is **not** i.i.d. Bernoulli. It forbids consecutive losses outright
> (`P(drop | previous drop) = 0.00000` over 400,000 packets), which makes it the maximally
> **anti-correlated** extremum rather than the uncorrelated case — a mean loss-run length of
> exactly 1 is unattainable for any i.i.d. channel, which sits at `1/(1−ρ)`.
>
> The section's *conclusion* survives: the false green is real, and a genuine Bernoulli injector
> still reports 99.98% delivery where the bursty channel reports 94.6%. What does not survive is
> the quantitative claim — the 99% cliff is **12%**, not the ~20% recorded below, and the k=4
> per-block erasure tail was understated 4.6× against `Binomial(8, 0.1)`.
> Sentence 3 of this section ("Bernoulli loss at rate `q` almost never puts two losses in the
> same block") is the correct statement of what the harness *should* have been doing and is
> exactly what the model was not doing.
>
> Full deltas, the falsifier that was missing, and the calibrated 802.11 point:
> `docs/research/2026-08-14-the-chaos-harness-loss-model-was-anti-correlated-not-uniform-a-falsifier-a-calibration-and-what-really-disarmed-ult-34.md`
> (workitems `081KZYY6SVJ087G0R0035SW945`, `081KZYP23HG087G0R000117H0K`). Left in place rather
> than rewritten: the record of what was believed is worth more than a clean page.

**Anchors (Beacon).** All four are **CITED, not page-checked** — I did not open the papers:

- E. N. Gilbert, *Capacity of a Burst-Noise Channel*, Bell System Technical Journal 39(5), 1960.
- E. O. Elliott, *Estimates of Error Rates for Codes on Burst-Noise Channels*, BSTJ 42(5), 1963.
  (Elliott generalises Gilbert's channel to a nonzero error probability in the GOOD state; the
  harness implements the Gilbert–Elliott form with both `lossInGood` and `lossInBad` free.)
- J. Zhou et al., *FoundationDB: A Distributed Unbundled Transactional Key Value Store*, SIGMOD 2021.
- W. Wilson, *Testing Distributed Systems w/ Deterministic Simulation*, Strange Loop 2014.
- J. Salmon, M. Moraes, R. Dror & D. Shaw, *Parallel Random Numbers: As Easy as 1, 2, 3*, SC'11 —
  the counter-based PRNG construction. **CITED, not page-checked.**
- S. Vigna, SplitMix64 (arXiv 1410.0530 §3) — the mixer. **CHECKED**, in the sense that the repo
  already byte-locks it against the F#/C#/Rust oracles at
  `src/Core.TypeScript/splitmix64/golden-vectors.json`, and the harness reuses that module rather
  than rolling its own.

The model is a two-state Markov chain: GOOD → BAD with probability `p`, BAD → GOOD with
probability `r`, and a per-state loss probability. Mean burst length is `1/r`; the stationary
probability of BAD is `p/(p+r)`.

**Why not uniform-random loss — CHECKED, and this is the point of the whole exercise.**
[8,4,4] recovers a bounded number of erasures *per block of 8*. Bernoulli loss at rate `q`
almost never puts two losses in the same block when `q` is small; a burst of length 2 puts them
in the same block essentially always. So a uniform injector measures a code's tolerance for
*isolated* loss, which is not the quantity that determines whether the transport works. Measured
(`UCH-11`), at **one fixed 5% mean loss rate**, changing only the correlation:

- uniform (mean burst 1): **100.00%** delivery
- bursty (mean burst 8): **94.80%** delivery

Same loss rate. A uniform-loss chaos test would have reported a clean green at exactly the
operating point where a real channel loses 5% of a block's data. That is the false green, and it
is why the harness ships Bernoulli only as the degenerate `meanBurstLength = 1` case of the same
model — available for the comparison, never as the default.

**The model is metered, not a toy** (`toy-is-free-metered-must-be-earned`). It has closed-form
falsifiers and they are asserted, not asserted-about: over 200,000 packets the measured loss rate
matches the analytic `p/(p+r)` to within 0.5 percentage points, and the measured mean burst
length matches `1/r` within ±10% (`UCH-3`, `UCH-4`). Measured: analytic 0.0500 vs measured
0.0495 (L=1) and 0.0505 (L=4); analytic burst 4 vs measured 4.08; analytic 8 vs measured 8.09.

### Discipline conformance — CHECKED

- **§7 DST** — every fault is a pure function of `(seed, stream, index)`. No `Math.random()`, no
  `Date.now()` anywhere in the harness. A failure at packet 91,847 replays in O(1) because the
  PRNG is **counter-based** (Salmon et al.) rather than stateful — you can address any point of
  the trace without generating its prefix.
- **§13 noninterference** — entropy enters through one declared door, `drawUnit`. Faults draw on
  **disjoint streams** (loss / reorder / duplicate / payload), so changing the reorder rate
  provably cannot perturb the loss trace (`UCH-2` asserts the traces are byte-identical). Without
  that, a parameter sweep is a walk, not a controlled experiment.
- **`async-all-the-way`** — the receive path drains a bounded queue through `runFerry` with a
  degree-of-parallelism knob. DoP=1 is one cooperative loop; DoP=N is N ferries on one cursor;
  results are written back **by input index, never completion order**. `UCH-8` pins byte-identical
  results at DoP 1, 2 and 8.
- **`local-time-never-enters-the-shared-fold`** — this is what makes the DoP knob safe, and it is
  worth naming because it is the same rule: the ferry's *completion* order is local receive order
  and it steers nothing; per-packet work is pure, and the stateful block assembly folds in
  canonical **wire** order. Local order in, phase order to the fold.
- **No binary in the proof lineage** — the sweep renders as a fixed-width text table.

One observation on the live module, offered as a §13 note rather than a defect:
`scheduleGossipRebroadcast` uses `Math.random()` (line 402) and `AimdState` carries
`Date.now()` (lines 289, 317). Those are ambient, unmetered entropy channels and DST cannot
replay them. `windowStart` in particular is **written twice and read nowhere in the repo**
(**CHECKED** by grep) — the time window the field names does not exist.

---

## 5. The cliff, as numbers

The deliverable is a number, not a pass/fail. A pass/fail here would encode today's tuning as a
requirement, which is the false-green failure again in a different costume.

### 5a. The headline — the cliff is in the DECODER, not in the code

The single most important measurement, and it is not the one I expected to find.

A linear code with minimum distance `d` corrects **any `d−1` erasures**. [8,4,4] has `d = 4`, so
it corrects **any 3 erasures per block of 8**. `recoverAdinkraErasure` returns `null` at 2. The
shipped decoder uses **1 of the 3 erasures the code pays 50% overhead for.**

`UCH-7` enumerates all 56 three-erasure patterns: a GF(2) maximum-likelihood decoder recovers
**56/56** byte-exactly; the shipped decoder recovers **0/56**. **CHECKED.**

Delivery ratio, seeded Gilbert–Elliott channel, 6000 blocks per point — **CHECKED**:

| mean loss | mean burst | shipped decoder | full-capability decoder | XOR-7/8 |
|---|---|---|---|---|
| 2% | 1 | 99.40% | **100.00%** | 99.29% |
| 2% | 8 | 97.44% | 98.21% | 96.74% |
| 5% | 1 | 96.05% | **100.00%** | 95.29% |
| 5% | 8 | 92.57% | 94.80% | 90.91% |
| 10% | 1 | 84.95% | **99.96%** | 82.79% |
| 10% | 8 | 86.54% | 90.46% | 83.37% |
| 20% | 1 | 52.03% | **99.35%** | 46.70% |
| 30% | 1 | 19.72% | **95.68%** | 14.12% |

**The 99%-delivery cliff — the number Aaron asked for** (`UCH-12`, **CHECKED**):

> The transport degrades gracefully to about **2% loss under uniform (mean burst 1) conditions
> and about 0.5–1% loss once loss is correlated (mean burst 2–8)**, and falls off beyond that.
> The same wire format with a full-capability decoder holds 99% delivery to about **20% uniform
> loss** and **1–3% correlated loss** — an order of magnitude of headroom already paid for and
> not collected.

### 5b. The correlation penalty saturates — and then partially reverses

This corrected my expectation and is worth stating because it is counter-intuitive. At a fixed
mean loss rate, delivery does *not* keep degrading as bursts get longer. Shipped decoder at 2%
loss: L=1 → 99.40%, L=2 → 96.86%, L=4 → 97.14%, L=8 → 97.44%, L=12 → 98.04%. **CHECKED.**

The whole penalty is in the step from **uncorrelated to slightly correlated** (L=1 → L=2). Past
that, longer bursts *concentrate* the damage: eight isolated losses can ruin up to eight blocks,
whereas one burst of eight ruins at most two. So correlation is not monotonically harmful at
fixed loss rate — it is catastrophic at the margin and then mildly protective.

The practical consequence, which I would not have predicted: **the dangerous regime is light
correlation, not heavy correlation.** A channel with mean burst length 2 is worse for this
transport than one with mean burst length 12 at the same loss rate.

### 5c. The XOR fallback — the "if it isn't worse, something is wrong" check

The framing asked me to check whether the XOR-only fallback (rate 7/8) has a different cliff, on
the expectation it should be worse. **It is worse on delivery ratio and better on goodput, and
the second fact dominates.** **CHECKED.**

Both codes send 8 wire packets per block; [8,4,4] carries 4 data, XOR-7/8 carries 7. The fair
comparison is goodput = delivered data packets per wire packet:

| mean loss | mean burst | shipped [8,4,4] | XOR-7/8 |
|---|---|---|---|
| 0% | — | 0.500 | **0.875** |
| 2% | 1 | 0.497 | **0.869** |
| 5% | 4 | 0.464 | **0.788** |
| 10% | 4 | 0.429 | **0.705** |
| 20% | 4 | 0.361 | **0.557** |
| 30% | 1 | 0.099 | **0.124** |

XOR-7/8 dominates at every rate in the useful operating range (`UCH-13`). The module header
presents XOR-only as the *low-bandwidth compromise* for LoRa/BLE and [8,4,4] as the choice for
high-bandwidth UDP; measured, **that guidance is inverted** — as implemented, [8,4,4] pays four
times the redundancy for the same 1-erasure-per-8 correction.

The code does earn its overhead, but only at loss rates around **30–40% and above**, and only
with a full-capability decoder: at 40% uniform loss the ML decoder holds 0.388 goodput against
XOR's 0.009. So the honest reading is not "the Adinkra code was the wrong choice" — it is
**"the Adinkra code is currently being decoded as if it were a worse code than it is,"** which
is a decode-side fix with no wire-format change.

"Something is wrong" was the right instinct. The thing that was wrong was one level below where
either of us was looking.

---

## 6. AIMD under a real loss process — no fixed point, it saturates

Framing question 4 asked whether AIMD converges, oscillates, or collapses. **It collapses, and
the cause is a structural defect in the loss estimator.** **CHECKED.**

`onNack` calls `updateAimd` immediately, and `updateAimd` resets `sentCount` and `nackCount` on
**every** evaluation. So the estimate is never "NACKs per 64 packets" as `LOSS_WINDOW = 64` and
the module comment both state — it is **1 NACK per packets-since-the-previous-NACK**. A single
NACK arriving within **19 sends** therefore reads as >5% loss and doubles the gap; 20 sends is
exactly the boundary and does not. Both pinned in `UCH-14`.

Driven by a 20,000-packet Gilbert–Elliott trace (`UCH-15`):

| true loss | mean burst | gap trajectory (10 samples) |
|---|---|---|
| 0% | — | pinned at 1ms — correct |
| 0.5% | 1 | 1–2ms — correct |
| **1%** | 1 | **478–500ms — already saturated** |
| 2% | 1 | 492–500ms |
| 10% | 4 | 500ms in 9 of 10 samples |

The controller is designed to back off above 5% and speed up below 1%. Measured, it is a
**bang-bang switch with its transition between 0.5% and 1% true loss**, saturating at
`MAX_GAP_MS` = 500ms — a ~2 packet/second floor — at loss rates five times below its own backoff
threshold. There is no fixed point tracking the loss rate. `lossRate(state)` additionally reads
0.000 right after any evaluation, because the window was just reset.

ULT-8/9/10 cannot see this: each hands the controller a pre-arranged whole window. **Arithmetic
tests genuinely cannot tell you this**, exactly as the framing predicted.

---

## 7. The composition nobody would have found from either side alone

The finding I would keep if I could keep only one.

Reordering does not hurt delivery (§2a). But `handleIncoming` NACKs every sequence gap, and a
reordered packet *is* a gap that closes a moment later. Measured on a **lossless** channel
(`UCH-16`, **CHECKED**): 5% reordering at depth 8 over 4000 packets produces **183 NACK
broadcasts and 2000/2000 payloads delivered**. Zero packets were lost.

Compose that with §6: a ~4.6% spurious NACK rate drives the gap to the 500ms floor. So

> **reordering alone collapses sender throughput by roughly 500×, on a channel that is dropping
> nothing at all.**

Neither half is visible from the other's side. The reordering test alone says "delivery is
perfect, no problem." The AIMD test alone says "the controller backs off under loss, as
designed." Only injecting reordering *and* feeding the resulting NACK stream to the real
controller shows the collapse. That composition is the argument for a chaos harness over more
unit tests, and it is the concrete content of "pioneers in some places": the bug lives in the
seam, and seams are exactly what unit tests partition away.

---

## 8. What shipped, and what did not

**Shipped (this PR):** the harness, 16 tests, this doc, three work-items. **No production file
was modified.** The GF(2) maximum-likelihood decoder lives in the harness as a *measurement
instrument*, so the capability gap in §5a is a number rather than an assertion — not as a
proposed replacement landing in the same change.

Four tests (`UCH-13`, `UCH-14`, `UCH-15`, `UCH-16`) **pin current measured behaviour and are
expected to FAIL when the corresponding defect is fixed.** They say so in their own comments.
This is deliberate — otherwise a green suite reads as an endorsement of the defect — but it is a
real cost and worth naming: whoever fixes these must update the pins in the same PR.

**Filed, PROPOSED, not implemented:**

- `081KZYN3B79087G0R0014ZKE3C` — use the code's full 3-erasure capability. Decode-side only, no
  wire-format change; `mlDecodeBlock` + `invertGf2` are written and tested.
- `081KZYN37T4087G0R00181THA4` — accumulate the AIMD window instead of resetting it per NACK;
  either use `windowStart` or delete it.
- `081KZYN3D53087G0R0036XZSYM` — reorder-tolerance hold-down before emitting a NACK.

**Not done, and worth naming rather than leaving implied:**

- The harness models the channel only — no machine failure, restart, or partition (§3).
- `recvBlocks` eviction in `LossyUdpChannel` is lexically inside `if (recovered)`, so a run of
  unrecoverable blocks accumulates without bound. **CHECKED by reading; NOT measured** — the map
  is private and I found no external observable for it. Stated as a code-reading finding, not a
  measurement, and not filed as a defect on that basis.
- The harness has no golden-vector byte-lock yet. Given `no-binary-in-proof-lineage` and the
  seeded-determinism property, a hex-in-JSON lock of a canonical trace is the obvious next step
  and is **PROPOSED**, not built.

---

## 9. Pointers

- `src/Core.TypeScript/discovery/udp-lossy-transport.chaos.ts` · `.chaos.test.ts`
- `src/Core.TypeScript/discovery/udp-lossy-transport.ts` — the subject
- `src/Core.TypeScript/splitmix64/splitmix64.ts` — the byte-locked mixer the entropy channel is built on
- `.claude/rules/dv2-data-split-discipline-activated.md` §4 DST, §6 idempotency, §7 noninterference
- `.claude/rules/async-all-the-way-truthful-signatures.md` — the DoP knob; FDB as the reference standard
- `.claude/rules/local-time-never-enters-the-shared-fold.md` — why the ferry's completion order is safe
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why §4's closed-form falsifiers are asserted
