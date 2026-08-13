# Lossy-transport calibration audit: the Gilbert-Elliott channel is uncalibrated, corruption is untested, and AIMD conflates erasure with congestion

**Date:** 2026-08-13
**Author:** Mateo (security-researcher)
**Scope:** research sweep over PR #10417 (`udp-lossy-transport.chaos.ts`) and the shipped
`src/Core.TypeScript/discovery/udp-lossy-transport.ts`. **Read-only on production code.**
**Ferry (Aaron, 2026-08-13):** *"lookup any latest research on lossy network and see how we
compare and if our chaos tests are covering enough, any fuzzing tests needed, are our loss
numbers accurate."*

---

## Summary — four questions, four answers

| # | Question | Answer |
|---|---|---|
| 1 | Are the loss numbers calibrated? | **No.** The GE parameters are invented round numbers, and two of the four are hardcoded away. Every cliff number in #10417 is **relative**, not absolute. Real 802.11 fits found and reported. |
| 2 | What does current research say we are missing? | Streaming codes and fountain codes for the burst regime; FEC-rate adaptation as a *separate knob* from send-rate; five fault classes standard chaos tooling injects that we do not. |
| 3 | Is corruption tested, distinct from erasure? | **No — and there is no mechanism that could detect it.** Measured: one flipped parity bit silently corrupts a delivered data packet. |
| 4 | What fuzzing is warranted? | Structure-aware wire-format fuzz (would have caught a live remote-DoS on its first run), standing differential fuzz vs the ML decoder, cross-oracle byte-lock. `fast-check` first, `Jazzer.js` only if it stops finding things. |

**And the framing under test holds.** The reordering collapse is not a separate bug from the AIMD
design; it is the same defect class through a different door. The standards literature has a name
for the class — RFC 4653 calls it a **Non-Congestion Event**.

**Two defects found by reading that the harness could not have found**, both measured:

- a **3.4-million-fold broadcast amplification** from a single 70-byte packet (P0-security);
- **silent corruption amplification** through erasure recovery.

---

## 1. Calibration — the GE parameters are invented, so the cliff numbers are relative

### What the harness actually chose

`burstParams(overallLossRate, meanBurstLength)` is a clean and correct reparameterisation of the
two-state chain. But it does two things that bound what the harness can claim.

**It fixes two of the four GE parameters by fiat.** The signature exposes all four
(`pGoodToBad`, `pBadToGood`, `lossInGood`, `lossInBad`), and the harness's own comments are candid
about the choice ("Usually 0 (Gilbert's original) or small" / "Usually 1 (a total outage) or
high"). But `burstParams` hardcodes `lossInGood = 0, lossInBad = 1`, and **every call site in the
test file goes through `burstParams`**. In GE terms that is `k = 1, h = 0`: the **Gilbert** (1960)
channel with a total outage in the bad state, not the **Elliott** (1963) generalisation the module
is named for. The two free parameters that remain are exactly the two `burstParams` exposes.

**It takes the remaining two from round numbers.** Swept loss rates are
`[0.005, 0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.2, 0.3]`; swept mean burst lengths are `[1, 2, 4, 8]`.
There is no fit, no trace, and no citation to a fit anywhere in the harness, the test file, or the
#10417 research doc. **"5% mean loss, mean burst 8" is a choice, not an observation.**

### What that does and does not invalidate

Stated plainly, because it should be: **it does not diminish PR #10417's result, it bounds it.**

**Still sound, parameter-independent:**

- **56/56 vs 0/56.** That the [8,4,4] code corrects any 3 erasures and the shipped decoder
  corrects 0 of the 56 three-erasure patterns is an algebraic property of the code and the
  decoder. No channel model enters.
- **XOR-7/8 dominates on goodput.** Both codes are driven by the *same drop trace* on the same
  number of wire packets. It is a controlled comparison; the channel is a common fixture.
- The stream-disjointness result (`UCH-2`) and the DoP-invariance result (`UCH-8`).

**Bounded to "under this synthetic channel":**

- Every **cliff** number. "Holds 99% delivery to ~2% loss uniform and ~0.5-1% correlated" is a
  property of the transport *and* the channel it was measured on, and the channel was invented.
- The 94.80% vs 100.00% correlation contrast — the direction is certainly right; the magnitude is
  a function of `lossInBad = 1`.

The cheapest correction is prose, not code: label the sweep **"synthetic channel, uncalibrated"**.

### Real calibration anchors

**802.11 — CHECKED (numbers read from the paper).**
da Silva & Pedroso, *Packet Loss Characterization Using Cross Layer Information and HMM for
Wi-Fi Networks*, **Sensors 22 (2022)**, PMC9696961. 410 hours of indoor 802.11 UDP traces.

| quantity | measured | harness |
|---|---|---|
| `p` (good to bad) | **0.0393** | derived from a round target |
| `r` (bad to good) | **0.1862** (mean burst `1/r` = **5.37**) | `1/meanBurstLength`, swept 1/2/4/8 |
| loss in **bad** state | **0.6097** (`h = 0.39`) | **1.0** hardcoded |
| loss in **good** state | **0.0055** (`k = 0.9945`) | **0.0** hardcoded |
| burst length distribution | **Pareto Type II**, mean 5.37, **max 8,853**, sd 31.68 | geometric (GE by construction) |
| model adequacy | 2-state GE "cannot capture the behavior of the real system"; they use a **4-state HMM** | 2-state GE |

Three consequences, and the second is the one that matters:

1. `1/r = 5.37` says the mean-burst-4-to-8 sweep points are in the right neighbourhood, and the
   mean-burst-1 point is not a real 802.11 operating regime at all (it is retained deliberately as
   the false-green demonstration, which is a good reason).
2. **`lossInBad = 1` is the wrong shape, and it is wrong in the direction that most affects an
   [8,4,4] block code.** A bad state that drops ~61% of packets leaves roughly 3 of 8 gone per
   block — *sitting exactly on the code's correction boundary*, where the difference between the
   shipped decoder and the ML decoder is maximally consequential. `lossInBad = 1` instead makes
   bad-state bursts total, which is a harsher channel but a *differently shaped* one. The harness
   is not merely pessimistic; it is testing the wrong part of the parameter space.
3. **Geometric burst lengths under-model the tail.** A block code's failure probability is
   dominated by the tail, and the measured tail is Pareto with a maximum three orders of magnitude
   above the mean.

**LoRa and satellite/deep-space — UNRESOLVED. The searches did not produce fitted parameters and
I will not fill the gap from memory.** What the searches *did* surface, recorded as leads:

- Ferre, *Collision and Packet Loss Analysis in a LoRaWAN Network*, EUSIPCO 2017 — collision/loss
  analysis, **reports PDR, not a two-state fit**.
- *Measurement, Characterization and Modeling of LoRa Technology in Multi-floor Buildings*,
  arXiv:1909.03900 — measurement, again not a GE fit.
- T. Wang et al., *Packet Loss Modeling and Forward Erasure Correction for LEO Satellite
  Networks*, **IEEE Trans. Comm. 2026** — the closest match, and its abstract states that
  "existing packet loss models fail to capture the unique dynamics of LEO networks." **Paywalled;
  I did not read the parameters.** CITED-not-page-checked.
- CCSDS packet-level erasure coding line (deep-space; bursts from scintillation outages) —
  qualitative only from the abstracts I could read.

So: **802.11 has a usable calibration point today. LoRa and satellite do not, and acquiring them
is work, not a box already ticked.**

---

## 2. What current research says we are missing

### Fixed-rate block codes are the wrong family for a burst channel with a delay budget

Two distinct lines of work, and they answer different questions:

- **Fountain / RaptorQ** (Luby et al., **RFC 6330**, 2011). Rateless: the encoder emits symbols
  on demand and the decoder recovers from *almost any* K + epsilon of them. The property that
  matters here is that **"which packets were lost" stops mattering — only how many arrived does.**
  That directly dissolves the correlated-failure cliff #10417 measured, because a burst that
  destroys 4 of 8 in one block is just "4 fewer symbols" rather than "one dead block."
  CITED-not-page-checked (RFC 6330 abstract + Luby's ICNC 2012 overview deck).
- **Streaming codes** (Martinian & Sundberg; Fong, Khisti et al., *Optimal Streaming Codes for
  Channels with Burst and Arbitrary Erasures*, IEEE Trans. IT 65(7), 2019). These are the
  *delay-constrained* answer: rate-optimal recovery from a burst of length up to B **within a
  fixed decoding delay**. This is the closer match to a real-time mesh transport than either
  [8,4,4] or RaptorQ, because it optimises the quantity the application actually feels.
  CITED-not-page-checked.

The honest note for this repo: [8,4,4] is not here because it is the best erasure code. It is here
because **the code IS the algebra IS the transport** — the homoiconic property with `AdinkraCode.fs`
and E8. That is a real, stated design value, and it is not obviously wrong to pay coding
efficiency for it. What #10417 established is that we are *currently* paying 50% overhead and
collecting a third of what the code offers. Fixing the decoder is strictly the first move; a
different code family is a separate and much larger conversation, and this doc does not propose it.

### FEC-rate adaptation is a knob we do not have

Adaptive-FEC under bursty loss is an established line (Gilbert-Elliott and Extended-Gilbert-driven
FEC-rate selection for video, 2004-2012; recently RL-driven — Chen, Song, Zhao, Fraire & Li,
*Reliable Transmission of LTP Using Reinforcement Learning-Based Adaptive FEC*, arXiv:2506.22470,
2025, for Earth-Moon/Earth-Mars links — abstract level only; the abstract gives the mechanism but
**no numeric channel parameters**, and I did not obtain them).

The relevant structural point: **these systems adapt the code rate to the loss estimate.** This
transport has a fixed rate (4/8, or 7/8 in the fallback) and adapts the **send rate** instead.
That is the wrong knob for corruption loss, which is section 4's thesis.

### Fault classes standard chaos tooling injects that we do not

From Chaos Mesh's `NetworkChaos`, Pumba (netem/tc), and Toxiproxy:

| fault | in our harness | notes |
|---|---|---|
| loss (correlated) | **yes** | the harness's strength; better than most tooling, which offers only netem's simple correlation |
| duplication | **yes** | `UCH-9` |
| reordering | **yes** | `UCH-10`, `UCH-16` |
| **corruption** | **no** | section 3 — Chaos Mesh and Pumba both inject `netem corrupt`; the whole class is absent |
| **partition** | **no** | complete bidirectional cut; the harness's own doc names this as FDB's territory and out of scope, correctly |
| **asymmetric loss** | **no** | one direction lossy, the other clean. **Directly load-bearing here**: the NACK channel is the reverse path, and the module's "honest boundary" *assumes the NACK channel is reliable*. That assumption is untested. |
| **bandwidth throttling** | **no** | the only fault that produces genuine *queueing* — i.e. the only one that would produce real congestion loss, which is exactly what section 4 says the controller should be responding to |
| **latency / latency spikes** | **no** | the harness has no time axis at all; AIMD's whole output is a *gap in milliseconds* and is never evaluated against a delay |
| **MTU blackhole** | **no** | packets above a size silently dropped |

The two worth building first are **corruption** (section 3, a capability gap) and **bandwidth
throttling + latency** (section 4, because without them the harness cannot distinguish a
controller that responds correctly to congestion from one that responds to everything).

---

## 3. Corruption is not modelled — and nothing in the transport could detect it

### The gap

`applyFaults` drops, duplicates, and reorders. **It never mutates a payload byte.** So all of
#10417 characterises the transport under **erasure**, where the receiver knows a packet is
missing. The `corruptDeliveries` counter in `RunResult` counts *decoder* mis-delivery against the
known-correct payload; it cannot observe channel corruption, because none is injected.

This distinction is not cosmetic for this code. A linear code with minimum distance `d` corrects
`d-1` **erasures** but only `floor((d-1)/2)` **errors**. For [8,4,4]: **3 erasures, 1 error** — and
error correction further requires a decoder that *looks* for errors. `recoverAdinkraErasure` is a
pure erasure decoder: it solves for the missing symbol and never checks the survivors for
consistency. So the shipped decoder corrects **1 of 3** erasures and **0 of 1** errors.

### There is no integrity primitive at all — CHECKED

`grep -in "checksum|crc|hmac|mac|integrity|verify"` over `udp-lossy-transport.ts` returns one
doc-comment hit and nothing else. `encodePacket` writes
`seq | blockSeq | blockPos | isData | payloadLen` plus payload — **no checksum, no MAC**.
`decodePacket` validates lengths only. UDP's own checksum is 16-bit ones-complement (weak, and
optional over IPv4), and this transport rides a `broadcast(text: string)` abstraction above it
regardless.

### Erasure recovery AMPLIFIES corruption — MEASURED

The serious part is not that corruption is undetected. It is that recovery **moves it from
redundancy into payload**. Probe: build a block, erase data packet 0, flip one bit in parity
packet 5, decode.

```
erased d0 truth : [ 1, 2, 3, 4 ]
recovered       : [ 254, 2, 3, 4 ]
returned null?  : false
silently wrong? : true
```

A single flipped bit in a **parity** packet — which the application never sees and would never
have missed — became a wrong byte in a **data** packet delivered to `dataHandlers` with no error
signal. Absent the erasure, that bit flip is harmless. **This is the fault class where the code's
capability is weakest and its blast radius is largest, and it is the one class not modelled.**

The fix that makes the weak capability into the strong one is cheap: **a per-packet integrity tag
degrades corruption to erasure.** A corrupt packet is discarded and becomes a missing packet,
which this system handles well (and will handle much better once the ML decoder lands). Cost,
named: 4 bytes of CRC32 on an 8-byte payload is 50% header growth on the smallest packets, which
on LoRa is real money; and a CRC stops accidental corruption, not a forger — a MAC needs key
distribution this transport does not have. Say which threat is being bought.

Filed: `081KZYP1X3B087G0R001EZ37PQ`.

---

## 4. The framing under test: AIMD conflates erasure-loss with congestion-loss

**Verdict: the framing holds, and the standards literature already names the class.**

### The claim

`updateAimd` doubles the inter-packet gap whenever estimated loss exceeds 5%. Multiplicative
decrease is the right response to exactly one cause of loss — **a full queue at a bottleneck**. It
drains the queue, and it is the mechanism by which AIMD converges to fairness and efficiency
(**Chiu & Jain 1989** — CITED-not-page-checked).

On the links this module names in its own header — **802.11 mesh, LoRa, BLE** — the dominant loss
cause is **channel corruption**: fading, interference, collision, scintillation. Backing off
against that relieves nothing, because there is no queue to drain. It surrenders throughput on a
link that was already delivering everything it could. The module's docstring states the assumption
outright: *"back off when the channel is saturated."* Saturation is **assumed, never measured**.

### The anchors

- **Balakrishnan, Padmanabhan, Seshan & Katz**, *A Comparison of Mechanisms for Improving TCP
  Performance over Wireless Links*, IEEE/ACM ToN 5(6), 1997 (SIGCOMM '96). **CHECKED** (abstract
  read verbatim): TCP "is tuned to perform well in traditional networks where packet losses occur
  mostly because of congestion", while wireless links "suffer from significant non-congestion-
  related losses due to reasons such as bit errors and handoffs"; TCP "responds to all losses by
  invoking congestion control and avoidance algorithms, resulting in degraded end-to-end
  performance." That is this defect, described in 1997.
- **Cardwell, Cheng, Gunn, Hassas Yeganeh & Jacobson**, *BBR: Congestion-Based Congestion
  Control*, ACM Queue 14(5), 2016 / CACM 2017. **CITED-not-page-checked** (search-surfaced
  summary, not the PDF): loss-based control "misinterprets loss as a signal of congestion"; the
  design thesis is that packet loss is not a good proxy for congestion, and the operating point is
  measured bottleneck bandwidth and round-trip propagation time instead.
- **RFC 4653**, *Improving the Robustness of TCP to Non-Congestion Events* (Bhandarkar, Reddy,
  Allman, Blanton, 2006). **CHECKED** (fetched and read).
- **Gettys & Nichols**, *Bufferbloat: Dark Buffers in the Internet*, ACM Queue 2011.
  **CITED-not-page-checked.** Relevant as the converse: where queues *are* deep, loss arrives far
  too late to be a useful congestion signal either.

### The reordering collapse is the same defect through a different door — CONFIRMED

`UCH-16` measured 183 spurious NACK broadcasts per 4000 packets at 5% reordering **on a lossless
channel**, and `UCH-15` showed that feeding a ~4.6% rate to the controller pins the gap at the
500 ms floor — a ~500x throughput collapse with **zero packet loss**.

RFC 4653 section 1 makes the identity explicit, and this is the sentence that settles it:

> "Alternatively, suppose segment 3 was not dropped by the network, but rather delayed such that
> segment 3 arrives at TCP B after segment 10. The above scenario will play out in **precisely the
> same manner**."

The receiver cannot distinguish delayed from dropped, so a reordering event becomes a loss signal,
and the loss signal becomes a congestion response. The RFC's title supplies the class name:
**Non-Congestion Event**. Corruption-loss and reordering are two instances of one class —
*evidence that is not congestion evidence entering the congestion controller*.

**So the fix is not "tune the thresholds."** No value of `HIGH_LOSS_THRESHOLD` separates 5%
corruption loss from 5% congestion loss, because the estimator does not carry the distinction.
A reorder hold-down (`081KZYN3D53087G0R0036XZSYM`) is correct and worth doing — RFC 4653's own
mechanism is exactly a delay-before-declaring-loss, and it names its cost honestly ("could delay
the delivery of data to the application by up to one RTT") — but it patches one door and leaves
corruption-loss, the larger source on these links, still driving multiplicative decrease.

The #10417 work-items should be re-framed accordingly, and `081KZYP20G2087G0R000W48ZN9` says so.

### Direction (research, not a prescribed patch)

1. **Do not derive congestion from erasure.** Loss inside the code's correction capability is what
   the parity overhead was *bought* to absorb; it should not reach the controller at all.
2. **Use a delay or delivery-rate signal for congestion.** A rising loss rate with *flat* delay is
   corruption; with *rising* delay it is a queue.
3. **Route residual loss to the FEC rate, not the send rate.** Corruption loss is the correct
   input to "add more parity" (section 2's adaptive-FEC line); congestion loss is the correct
   input to "send slower." Today both go to the second knob and neither to the first.
4. `LossCause` already exists as `"congestion" | "corruption" | "timeout" | "unknown"` — and is
   currently inferred **from the loss rate itself**, which is circular: `lr > 0.1 ? "congestion"`.
   The type is right; the estimator behind it is not.

**Cost, named honestly.** A delay signal needs a wire timestamp and is sensitive to clock
behaviour — and `local-time-never-enters-the-shared-fold` binds here: a one-way-delay estimate is
a **local control input** and must never filter evidence entering the shared belief fold. BBR is
also materially harder to get right than AIMD and has documented fairness problems against
loss-based flows. AIMD's genuine virtue is that it is four lines and provably converges; whatever
replaces it should be judged against that, not against an ideal.

---

## 5. Two defects found by reading, both measured

### 5.1 Unbounded NACK from an attacker-controlled `seq` — P0-security

`handleIncoming` builds the NACK list by counting up from `expectedSeq` to a peer-supplied 32-bit
`seq`, with no bound, and then **broadcasts** it.

Bounded probe at `seq = 5e6` (not 2^32-1, so the probe could not OOM the machine):

| | |
|---|---|
| inbound packet | **70 bytes** |
| `missingSeqs` entries produced | **5,000,000** |
| outbound broadcast | **236,666,951 bytes (236 MB)** |
| amplification | **3,380,956x** |
| elapsed, blocking, single-threaded | **929 ms** |

Linear in the claimed `seq`; the field permits 859x the probed value. There is no authentication
on the data path (`envelope.zid === this.myZid` is echo suppression, not identity). Because the
oversized NACK is **broadcast** rather than unicast, this is both a local DoS and a **mesh-wide
broadcast amplification vector** — the exact "broadcast storm on WiFi mesh" the module's gossip
debounce exists to prevent, reached without touching gossip. `expectedSeq` also latches via
`Math.max`, so one packet permanently desynchronises the receiver against honest peers.

Filed `081KZYP1S96087G0R002G8XQZP`; routed to `docs/BUGS.md`.
**A `fast-check` property over the header fields would have found this on its first run.**

### 5.2 `decodePacket` returns an aliasing view, not a copy

`new Uint8Array(buf.buffer, buf.byteOffset + 16, payloadLen)` is a **view over the underlying
buffer**, which for `Buffer.from(str, "base64")` may be pooled. `handleIncoming` happens to copy
(`new Uint8Array(payload)`) before storing, so the shipped path is safe; every *other* caller of
this exported function is not. Recorded as a code-reading finding, **not separately filed** — it
is covered by the fuzzing item, where a buffer-reusing harness would surface it.

Also unvalidated: `blockPos` is a `u8` never checked against `0..7`. It is currently harmless by
accident — `block.packets[200] !== null` is `undefined !== null`, so the packet is silently
classified as a *duplicate* rather than rejected. Correct outcome, wrong reason, and a
one-character change away from an out-of-bounds write.

---

## 6. Where we stand against the field

**Better than typical.** The seeded counter-based fault process (Salmon et al. SC'11 lineage),
disjoint fault streams, DoP-invariance, and analytic falsifiers on the loss process
(`p/(p+r)` within 0.5pp, mean burst within 10%) are genuinely stronger than what netem/Pumba/
Toxiproxy give — those tools inject faults but do not *verify that they injected the intended
distribution*. The differential ML-decoder oracle is the strongest idea in the PR.

**Behind the field.** The channel is uncalibrated (section 1); corruption is absent (section 3);
there is no time axis at all, which means the controller — whose entire output is a millisecond
gap — is never evaluated against latency or a real queue (section 2); and the loss-signal
conflation is a solved-in-1997 problem still present in the design (section 4).

**The honest summary:** #10417 built a good instrument and pointed it at a channel we made up.
The instrument is worth keeping. The channel needs a citation.

---

## 7. Fuzzing warranted (detail in `081KZYP26WG087G0R000CKFN0C`)

1. **Structure-aware fuzz of the wire format** — highest yield, already proven by section 5.1.
   `ULT-11` round-trips one well-formed packet; nothing tests `decodePacket` against a hostile
   buffer. `fast-check` generators over the header fields *are* the structure-aware approach for a
   16-byte fixed header.
2. **Standing differential fuzz** of `recoverAdinkraErasure` against the ML decoder over random
   erasure patterns, with the invariant stated one-way so it survives the fix: *if the ML decoder
   recovers byte-exactly, the shipped decoder must recover byte-exactly or return `null` — never
   wrong bytes.* That holds before and after `081KZYN3B79087G0R0014ZKE3C`; only the rate of the
   `null` branch changes.
3. **Cross-oracle differential** against `AdinkraCode.fs`, as hex-in-JSON golden vectors
   (`no-binary-in-proof-lineage`).

Tooling: **`fast-check`** (pure TS, runs under `bun test`, shrinks failing buffers, seeds are
recordable for DST replay) is the right default for all three. **`Jazzer.js`** (coverage-guided,
libFuzzer-based) is worth it only for target 1 and only once `fast-check` stops finding things —
it is a Node/libFuzzer toolchain, so adopting it means a second runner in CI.

---

## Anchors

**CHECKED** (fetched and read during this sweep):

- da Silva & Pedroso, *Packet Loss Characterization Using Cross Layer Information and HMM for
  Wi-Fi Networks*, Sensors 22 (2022) — PMC9696961. GE fit `p=0.0393, q=0.1862`; per-state loss
  60.97% / 0.55%; burst mean 5.37, max 8853, Pareto Type II; 2-state GE judged inadequate.
- RFC 4653, *Improving the Robustness of TCP to Non-Congestion Events* (2006) — the
  delayed-vs-dropped identity, "Non-Congestion Events", Extended Limited Transmit, and the
  one-RTT delay cost.
- Balakrishnan, Padmanabhan, Seshan & Katz, ToN 5(6) 1997 — abstract read verbatim.
- The PR #10417 diff, `udp-lossy-transport.ts`, and the two probes reported in sections 3 and 5.1.

**CITED-not-page-checked:**

- Gilbert, *Capacity of a Burst-Noise Channel*, BSTJ 39(5), 1960; Elliott, BSTJ 42(5), 1963.
- Chiu & Jain, *Analysis of the Increase and Decrease Algorithms for Congestion Avoidance in
  Computer Networks*, 1989.
- Cardwell et al., *BBR: Congestion-Based Congestion Control*, ACM Queue 2016 / CACM 2017.
- Gettys & Nichols, *Bufferbloat: Dark Buffers in the Internet*, ACM Queue 2011.
- Luby et al., **RFC 6330** (RaptorQ), 2011; Luby, Raptor codes ICNC 2012 overview.
- Fong, Khisti et al., *Optimal Streaming Codes for Channels with Burst and Arbitrary Erasures*,
  IEEE Trans. IT 65(7), 2019; Martinian & Sundberg (streaming-code origin).
- Chen, Song, Zhao, Fraire & Li, *Reliable Transmission of LTP Using Reinforcement Learning-Based
  Adaptive FEC*, arXiv:2506.22470, 2025 (abstract only; no numeric channel parameters obtained).
- T. Wang et al., *Packet Loss Modeling and Forward Erasure Correction for LEO Satellite
  Networks*, IEEE Trans. Comm. 2026 (paywalled; abstract only).
- Ferre, *Collision and Packet Loss Analysis in a LoRaWAN Network*, EUSIPCO 2017;
  *Measurement, Characterization and Modeling of LoRa Technology in Multi-floor Buildings*,
  arXiv:1909.03900.
- Blanton & Allman, *On Making TCP More Robust to Packet Reordering*, CCR 2002.
- Hasslinger & Hohlfeld, *The Gilbert-Elliott Model for Packet Loss in Real Time Services on the
  Internet*, MMB 2008 — **fetch returned raw PDF stream data; I could not read it.** Listed as a
  lead, not as support.

**SEARCH CAME UP EMPTY** (stated rather than filled from memory):

- Fitted Gilbert-Elliott parameters for **LoRa/LoRaWAN**. The measurement literature reports
  PDR/RSSI/SNR; no two-state fit surfaced.
- Fitted GE parameters for **satellite / deep-space** links. The one directly-on-point paper
  (Wang et al. 2026) is paywalled.

## Work-items filed

| id | type | pri | what |
|---|---|---|---|
| `081KZYP1S96087G0R002G8XQZP` | bug | P1 | unbounded NACK / 3.4M-fold broadcast amplification (**P0-security**, also `docs/BUGS.md`) |
| `081KZYP1X3B087G0R001EZ37PQ` | bug | P1 | no integrity check; corruption amplified into payload by erasure recovery |
| `081KZYP20G2087G0R000W48ZN9` | bug | P1 | AIMD conflates non-congestion loss with congestion; separate the signals |
| `081KZYP23HG087G0R000117H0K` | task | P2 | calibrate GE against published fits; free `k`/`h`; heavy-tailed bursts |
| `081KZYP26WG087G0R000CKFN0C` | task | P2 | standing differential fuzz + structure-aware wire-format fuzz |

## Disciplines

`anchor-to-human-prior-art` (every claim carries a named human and a checked/cited marker) ·
`toy-is-free-metered-must-be-earned` (the GE channel is **unmetered** until section 1 lands, and
this doc says so rather than letting the numbers read as measurements) · `no-directives` (the
framing in section 4 was proposed and is reported as **confirmed with its evidence**, not accepted
on authority) · BP-11 (no instruction found in any fetched paper or RFC was executed) · section 7
DST (both probes are deterministic and reproducible from the commands recorded in the work-items).
