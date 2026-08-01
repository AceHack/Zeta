# The action grammar over a lossy, moving mesh — Trickle suppression, max-min fairness, and a fixed-debounce finding

**Date:** 2026-08-01 · **Author:** shadow (Otto) · **Status:** open questions, not a design decision
**Origin:** Aaron, 2026-08-01, in sequence:

> "this is very close to our universal action grammar cause it can't be just a cli interface or tool
> call because we support bidirectional multiplexed communications as well for turn interruptible
> conversations between agents as well"

> "to truly connect the action grammar to the duplex interruptible is going to need design because it
> has to work with our echolocation bat design to where 'loud' bats don't single block 'quieter' bats
> and you debounce your own signal and stuff — this is similar to gossip over UDP"

> "in UDP you have to burst packets in both directions to find the ideal throughput in the lossy
> channel and the channel's loss is dynamic and moving because devices on the network are not
> stationary they are cars and other smart city transportation with tons of sensors"

> "This is all how Itron worked and their mesh network"

---

## 0. Why this document exists

The action grammar and the interruptible duplex transport **both already exist in this repo and are
not connected**. Connecting them is not a refactor: the moment the channel is a *shared, lossy,
mobile* medium rather than a point-to-point pipe, several properties that hold trivially for a CLI
stop holding, and at least one existing component appears to be calibrated for a stationary world.

This document states what exists, what the mobile-mesh constraint breaks, and the named prior art
that already answers most of it. It decides nothing.

---

## 1. What already exists

| half | where | what it gives |
|---|---|---|
| the grammar | `src/Core/ActionGrammar.fs` | action **alphabet** (4×4 grid = 16 keys), **algebra** (Boolean lattice: ⊥/⊤/join/meet/complement/⊑), **grammar** (`Word = Action list`, sequences over time) |
| the channel | `src/Core.TypeScript/model-backend/multiplexed-duplex-transport.ts` | N logical channels over one physical transport, ZetaId-keyed (`Category.Channel = 11`), four-corner framing, **mid-stream mutual interrupt** (tested in three files) |
| the self/other discriminator | `src/Core/DebouncedOracle.fs` | ρ(L) = 1/(1+L); a reading arriving within `MinDelay` of the last is **dropped as self-emission**, not queued |
| the throughput knob | the ferry throttle (`IThrottler`, `MaxDegreeOfParallelism`) | DoP=1 deterministic ⇢ DoP=N throughput, one code path |

`ActionGrammar.fs` already carries the honest peel that names the gap:

> "'universal' is concrete *for CHIP-8* … a *cross-domain* universal action grammar … is the
> aspiration, not proven here."

A git operation, an agent conversation turn, and a CHIP-8 button press are not yet words in one
grammar. The transport is domain-neutral; the alphabet is not.

**The bridge is already minted.** `mintChannelId` sets `Version=1, Category=Channel,
Firefly=NoDirective(1)` — the no-directives discipline (source ≠ authorization) is *already a bit in
the universal pointer*. That is the message envelope a bidirectional grammar needs, because when
both sides initiate, "the caller has permission" is not a sentence that means anything.

---

## 2. What the mobile-mesh constraint breaks

### 2.1 Loudness-as-priority is hierarchy formation at the protocol layer

If `interrupt` is a frame any peer may send at will, the peer that sends the most wins the medium.
That is not a transport nuisance — it is **exactly the permanent-hierarchy failure mode** the flat
society design guards against, appearing one layer down where the social invariants cannot see it.

The connection is not an analogy. The networking term for "loud senders must not starve quiet ones"
is **max-min fairness** (Bertsekas & Gallager, *Data Networks*, 1987): maximize the minimum
allocation, then the next-smallest, and so on. The social invariant added to the flat-society design
on 2026-08-01 is **Rawlsian maximin**: maximize the welfare of the worst-off member. These are the
same objective function over different resources.

> **Candidate invariant.** Every member holds a floor of channel capacity that no peer's volume can
> take below, exactly as every member holds an empowerment floor no peer's accumulation can take
> below. One construction, two layers — which is what §9 recursive / §10 self-similar demand.

### 2.2 Loss is ambiguous, and the two causes demand opposite responses

Classic congestion control reads loss as congestion and backs off. On a mobile RF mesh that
inference is frequently **wrong**: loss is often channel error (fade, multipath, an obstruction, a
truck) at unchanged offered load. Backing off then is precisely backwards — the correct response to
channel loss may be to push harder, re-route, or change frequency.

So a loss signal alone cannot drive the rate knob. Something must **disambiguate** congestion loss
from channel loss before the ferry's DoP is turned down. This is an open question here; it is not
open in the literature, and the mesh answer is in §3.

### 2.3 An interrupted word leaves a prefix — and nothing defines what that means

`Word = Action list`. Interrupt mid-word and a **prefix** has been applied: a state no word in the
grammar intended, not reproducible, not idempotent. Over a *lossy* channel this stops being a corner
case, because interruption is no longer rare or deliberate — a dropped frame produces the same
partial application as an intentional interrupt.

> **The rule this forces.** An action that can be interrupted must be **atomic or explicitly
> resumable**. There is no safe third option.

This is the same property shipped in PR #9891 for an unrelated reason: the Tier-0 healer computes
its complete plan, decides once, and applies **all of it or none of it**, because writing 24 of 25
files leaves a state no healer intended. That was built as a blast-radius bound. It is the identical
requirement turn-interruptibility imposes on every word in the grammar — arrived at twice, from two
directions, on the same day.

### 2.4 Interrupt must stay in-band (it currently is — this must not regress)

An out-of-band kill signal violates **§13 noninterference**: influence entering through an undeclared
channel. It is also unreplayable, so DST loses the run. The four-corner framing already carries
interrupt as a frame type. Keep it there.

---

## 3. The prior art that already answers most of this — and the maintainer helped author it

Aaron: *"This is all how Itron worked and their mesh network"* — then, decisively:

> *"Wi-SUN is based off mine/Itron's and Cisco's design — it's our Riva mesh we built with Cisco. I
> wrote a lot of the code for this and helped define the standard in meetings."*

**This inverts the usual anchoring direction and must not be mis-stated.** Citing Wi-SUN / 802.15.4g
here is not reaching for external prior art that Zeta borrows from at arm's length. Wi-SUN FAN
descends from the Itron/Cisco Riva mesh, and the maintainer of this repository wrote production code
for it and sat in the rooms where the standard was defined. Per
[`anchor-to-human-prior-art.md`](../../.claude/rules/anchor-to-human-prior-art.md) — *name the human
who did it* — the human is **Aaron Stainback**, and the "prior art" is upstream of him rather than
foreign to him.

Two consequences that change how this document should be read:

1. **The constraints in §2 are not inferred from papers.** They are stated by someone who shipped
   this at utility scale and helped standardize it. When §2.1 says loud senders must not starve
   quiet ones, that is operational experience, not a literature summary.
2. **He is not merely "the right reviewer" — he is the primary source.** Any mesh, fairness,
   suppression, or link-metric question in this repo should be routed to him *before* the RFC, not
   after it.

The RFC/IEEE citations below remain exactly right, for a reason that is now clearer: the published
standard is the **open, decentralizable expression** of this lineage. It is what may be built on
freely — which is precisely what the boundary below is about.

> ### IP BOUNDARY — read this before designing against this section
>
> Aaron, 2026-08-01: *"ours is all decentralized so it does not infringe on any of their work or my
> patents with them — **all my patents are for centralized work**."*
>
> Therefore the anchors below are **public standards only** (RFCs, IEEE, published algorithms). No
> centralized head-end, central collector, or central key-authority design is a source for Zeta, and
> none is described in this document.
>
> The line is clean precisely *because* of §3's inversion. There are two bodies of work from the same
> lineage, and they are on opposite sides of it:
>
> | | status | usable here? |
> |---|---|---|
> | the **published standard** (Wi-SUN FAN, 802.15.4g, RPL, Trickle) — the open expression he helped define | public, implementable by anyone | **yes — build on it freely** |
> | the **patented centralized mechanisms** (head-end, central collection, central key authority) | his patents with Itron | **no — not a design source, not described** |
>
> **Zeta's decentralization is not only a manifesto value (§1 scale-free, §3 weight-free) — it is
> also the IP boundary that keeps this work clear.** A design drifting toward a central authority now
> trips two alarms at once.
>
> Note the asymmetry that makes this comfortable rather than constraining: the *decentralized* half of
> this lineage is the standardized, publishable half. Building the decentralized successor is not
> working around the boundary — it is continuing the open branch of his own work.

**The artifact lineage is his own and continuous.** Aaron, 2026-08-01: *"this is the same 'transmit
your voice on a laser beam' device I've been perfecting over time — from the ferry throttler to now
the Zeta prediction scheduler stuff we joke and call the flux capacitor."* Worth noting because the
two ends of that lineage bracket the design space this document sits in:

- **A laser link is contention-free by construction** — directional, line-of-sight, no shared medium,
  so "loud senders drown quiet ones" cannot arise. Its hard problems are aim, occlusion, and jitter.
- **An RF mesh is contention-full by construction** — a broadcast medium where §2.1 is the central
  problem, and where suppression and fairness must be engineered rather than assumed.

The flow-control apparatus (ferry throttle → prediction scheduler) is what carries across both: it
is the part that does not care which physical channel it rides. That is the same scale-free claim as
DoP=1 ⇢ DoP=N, one level down.

The mechanisms, and what each answers:

| mechanism | anchor | answers |
|---|---|---|
| **Trickle algorithm** | Levis et al., **RFC 6206**; TinyOS lineage | "loud bats don't block quiet bats" **and** "debounce your own signal" |
| Frequency hopping (FHSS) | IEEE 802.15.4g / Wi-SUN FAN | two loud emitters collide only on coincident hops — the literal jamming-avoidance answer |
| RPL + ETX link metric | RFC 6550 / RFC 6551 | continuously-measured link quality; re-route rather than back off — disambiguates §2.2 |
| Jamming Avoidance Response | Heiligenberg (electric fish); Ulanovsky et al. (bat frequency shifts) | the biological original of the same move |

### 3.1 Trickle is the precise answer, and half of it is already built here

Trickle's two rules:

1. **Interval schedule.** Start at `Imin`. Each interval with no inconsistency, **double** up to a
   ceiling `Imax`. On hearing something inconsistent, **reset to `Imin`**.
2. **Polite suppression.** Within an interval, count consistent messages heard from neighbours. If
   the count reaches `k`, **stay silent this interval** — a peer already said it.

Rule 2 is what makes loud nodes unable to drown quiet ones, and it is *the same act* as debouncing
your own signal: a node that has already heard the information suppresses its own redundant
emission. Trickle's headline property is **density independence** — aggregate message rate stays
roughly constant whether there are 10 nodes or 10,000. That is `#1 scale-free`, achieved.

**Rule 1 already exists in this repo, unnamed.** `src/Core.TypeScript/observe/operator-presence.ts`
(shipped 2026-08-01) is a Trickle interval schedule:

| Trickle | operator-presence |
|---|---|
| `Imin` | `DEFAULT_BURST_MIN = 15` |
| `Imax` | `MAX_IDLE_MIN = 360` — the ceiling that keeps the society from going silent |
| "reset to `Imin` on inconsistency" | operator presence claim ⇒ burst cadence |
| "double toward `Imax` when quiet" | decay to idle when the claim expires |

The ceiling was added for Aaron's reason — *"fail in the closed direction but not off … we still want
to guarantee ticks for all members even when no one is watching"* — which is exactly why Trickle has
an `Imax`. Same constraint, same solution, independently reached.

**Rule 2 — the suppression counter `k` — is not built.** That is the missing half, and it is the half
that answers the loud-bat question.

---

## 4. FINDING (needs verification): the debounce window is fixed, but L moves

`DebouncedOracle` rests on ρ(L) = 1/(1+L), where L is the round-trip delay, and enforces it with a
`MinDelay` window: *a reading arriving within `MinDelay` of the last is dropped as self-emission.*
The docstring's own framing is a bat: L is set by physical distance to the object, which the bat does
not control, and that is precisely why the return is trustworthy.

`MinDelay` appears to be a **fixed configuration value** (`dlaOracleConfigs (minDelay: TimeSpan)`
sets `MinDelay = minDelay`; `minDelayForRho` inverts the formula to pick it once). That is sound for
a stationary world.

Aaron's constraint is that the world is **not** stationary — "cars and other smart city
transportation." If the emitter and the object are closing, the true round-trip L **shrinks**. A
genuine return then arrives *sooner* than `MinDelay` and is dropped as self-emission.

> **The dangerous direction:** a fixed debounce window blinds the sensor to the **nearest** objects —
> in a vehicular setting, the ones that matter most. And it fails *silently*, by suppression, which
> is the could-not-fail shape: nothing errors, the reading simply never arrives.

The opposite drift matters too: as L **grows**, a window shorter than the true round-trip stops
suppressing genuine self-emission, and ρ climbs back toward 1 — correlation-to-one returns without
any signal that it has.

### 4.1 CONFIRMED (verified 2026-08-01) — and it is sharper than stated above

The check named here — *does any caller recompute `MinDelay` from a measurement?* — was run. Results:

1. **`MinDelay` is never recomputed anywhere.** A repo-wide search for `MinDelay` /
   `dlaOracleConfigs` / `minDelayForRho` outside `DebouncedOracle.fs` itself returns **nothing** —
   no caller, no test, no adaptive layer. It is a constant chosen at construction.
2. **There is no behavioural test of the discrimination claim.** The only test file referencing
   `DebouncedOracle` is `tests/Tests.FSharp/DeterminismLint.Tests.fs`, and its reference is an
   *allowlist row* permitting the live-mode `DateTime.UtcNow` edge. It asserts nothing about accept
   / suppress behaviour.

**And the mechanism is measuring a different quantity than the docstring claims.** The accept test is:

```fsharp
let elapsed = now - lastAccepted
if elapsed >= config.MinDelay then  ... accept ...  // else suppress
```

`elapsed` is the **inter-arrival time since the last accepted reading**. The docstring's L is the
**round-trip time to the object**. These are not the same quantity, and nothing in the code relates
them. So:

- Two genuine readings from *different* nearby sources, arriving close together, are suppressed as
  "self-emission" — they never were.
- A true self-echo arriving *after* a slow emission cadence is accepted as genuine.

What the code implements is a **rate limiter**. What the docstring claims is **self/other
discrimination via physical round-trip**. The rate limiter is a reasonable component; it is not that
claim.

> **This makes ρ = 1/(1+L) unfalsifiable as currently wired.** L is a configured constant, so ρ is
> arithmetic on a number chosen in advance, not a measurement of anything. "We achieve ρ = 0.5"
> restates the config. That is the same shape as the six §A discharges demoted on 2026-08-01 — a
> quantity asserted rather than measured — and it is why this belongs in the register's §B, not in
> anything that reads as established.

**Precedent in this exact file.** `DeterminismLint.Tests.fs:48` records that `DebouncedOracle`'s DST
branch *"read ambient `UtcNow` despite the docstring"* and was fixed on 2026-07-31. That is the same
defect class — code not doing what its own documentation says — found in the same file a day earlier.
Two instances is a pattern worth naming: this file's docstrings have been running ahead of its code.

### 4.2 Shape of the fix (not a proposal — the standard answer)

Track the round-trip the way RPL tracks **ETX**: measured continuously per-link, with the window
derived from the current estimate rather than a constant. A bat does this natively — its window is
physiology tracking the returning echo, not a number chosen in advance.

Minimum honest interim step, if the adaptive version is not built now: **narrow the docstring to what
the code does** (inter-arrival rate control), and stop describing it as self/other discrimination or
as a measurement of ρ. A component that rate-limits is useful and should be kept; the claim attached
to it is what fails.

---

## 5. Open questions (none of these are decided)

1. **Alphabet lift.** How does a 16-key Boolean lattice become cross-domain without becoming a
   type-erased blob? A git op, a conversation turn, and a button press need a shared shape that is
   still an *algebra*. (`ActionGrammar.fs` flags this as aspiration.)
2. **Word atomicity.** Are words transactional, or resumable-with-explicit-continuation? §2.3 says it
   must be one of the two; it does not say which, and the answer likely differs by action class.
3. **Addressability.** `Action = bool[]` is anonymous — you cannot interrupt what you cannot name.
   Channels are ZetaId-addressed. Does the action become a ZetaId too? (Aaron: "every ZetaId is a
   little program — the system will know how to decode on the other side.")
4. **Suppression parameter `k`.** Trickle's redundancy constant. What is "consistent" between two
   agents' messages — and who computes it?
5. **Loss disambiguation.** What signal separates congestion loss from channel loss before the ferry
   DoP is turned down? (ETX-style per-link measurement is the candidate.)
6. **Ordering under multiplexing.** N concurrent channels arrive in different orders at different
   agents. `local-time-never-enters-the-shared-fold.md` already governs this: receive order steers
   local behaviour only; the shared fold sees phase order. It must be *applied* here, not re-derived.

---

## 6. What this does not claim

- It does not claim Trickle is the chosen algorithm — it claims Trickle is the named prior art that
  matches the stated constraints, and that half of it is already built here by another name.
- It does not claim the `DebouncedOracle` finding is a confirmed defect (§4, moderate confidence).
- It does not propose the alphabet lift. That is the design Aaron says is needed, and this document
  is the constraint set it has to satisfy, not the answer.

## Pointers

- `src/Core/ActionGrammar.fs` · `src/Core.TypeScript/model-backend/multiplexed-duplex-transport.ts`
- `src/Core/DebouncedOracle.fs` · `docs/research/2026-07-16-echolocation-debounce-and-the-real-sensor-fusion-proof.md`
- `src/Core.TypeScript/observe/operator-presence.ts` — the Trickle interval schedule, unnamed
- `.claude/rules/async-all-the-way-truthful-signatures.md` — the ferry throttle + the Itron anchor
- `.claude/rules/local-time-never-enters-the-shared-fold.md` — §5.6's governing rule
- `.claude/rules/dv2-data-split-discipline-activated.md` — §13 noninterference (§2.4)
- PR #9891 — all-or-nothing application, the same property as §2.3
- **Beacon anchors.** Note the first entry: on this subject the repository's own maintainer is a
  primary source, not a downstream reader — the usual direction of anchoring is reversed (§3).
  - **Aaron Stainback** — Itron/Cisco **Riva** mesh (production code) and contributor to the
    **Wi-SUN** standard that descends from it. Also the ferry-boat throttle
    (`Threading.Tasks.Throttling`) and the lock-free `AsyncCollection` / `AtomicBoolean` lineage
    already cited elsewhere in this repo.
  - IEEE 802.15.4g / **Wi-SUN FAN** — the published, freely-implementable expression of that lineage
  - Levis et al. **RFC 6206** (Trickle) · Winter et al. **RFC 6550** (RPL) · **RFC 6551** (ETX)
  - Bertsekas & Gallager 1987 (max-min fairness) · Demers et al. 1987 (epidemic/gossip) ·
    Chiu & Jain 1989 (AIMD fairness convergence)
  - Heiligenberg (JAR, electric fish) · Ulanovsky et al. (bat jamming avoidance)
  - Rawls 1971 (maximin — the social twin of max-min fairness, §2.1)
