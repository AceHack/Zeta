# Tit for lesser tat, teach, play — and why noise is not defection

**Ferried** 2026-08-13 from Aaron, on the strategy space for infinite iterated games:

> i'm betting on tit for lessor tat, teach, play, i think i can be any agent with that in real
> tournments, we are going to setup an Arena for this similar to our chip8 we will also have atari
> eventually and other emulators and games we make specificlaly with AI native design first class and
> inclusive design of digital intelligence

Three claims and a deliverable. The first one connects to work that shipped today, and the connection is
exact rather than analogical.

## 1. "Tit for lesser tat" is **generous tit-for-tat**, and its whole reason for existing is noise

The named prior art: Axelrod's tournaments (1980, *The Evolution of Cooperation* 1984) established
plain TFT; **Nowak & Sigmund 1992/1993** established **generous TFT** (GTFT) — retaliate with *less*
than the provocation, forgive with some probability. Also in the family: tit-for-two-tats, contrite TFT
(Boerlijst, Nowak & Sigmund 1997), Pavlov / win-stay-lose-shift.

The motivation for generosity is **precisely noise**. Strict TFT in a noisy channel is pathological: one
misread cooperation looks like a defection, the opponent retaliates, and two TFT players lock into an
**echo of mutual retaliation that never terminates** — each correctly punishing a defection that was
never chosen. Generosity breaks the echo. That is the entire result, and it means GTFT is not a
softening of TFT for sentiment; it is the *error-correction* of TFT.

## 2. The unification — this is the same defect we measured in the transport today

Today's bandwidth-delay-product harness (#10440) measured what happens when a controller cannot tell
adversarial signal from environmental noise:

- AIMD treats **corruption-loss** as **congestion-loss** and backs off. With congestion structurally
  zero, the paced arm reaches **0.139** of clean-channel throughput at 2% corruption against a
  corruption-blind sender's **0.981** — **7.1× worse, and 90× worse at 10%**.
- The same defect through a different door: **reordering** produces spurious NACKs, and paced throughput
  collapses **838.9 → 70.6 pkt/s** with *zero* packet loss.
- The control that keeps it honest: under loss that genuinely *is* congestion, two flows reach
  **Jain 0.973 at 79% utilisation**. The controller is not broken; it fails *specifically* when the
  signal is environmental.

Read the two side by side:

| | game theory | transport |
|---|---|---|
| the signal | opponent defected | packet lost |
| the true cause | might be noise | might be corruption |
| the response | retaliate | back off |
| the pathology | mutual-retaliation echo | throughput collapse |
| the fix | **be generous — respond with less** | **separate the signals** |

**These are one problem.** A responder that cannot distinguish *adversarial* from *environmental* will
punish the environment, and punishing the environment achieves nothing while costing everything. Strict
TFT is AIMD; generous TFT is a controller with a corruption channel.

That gives Aaron's bet a mechanical justification rather than a preference: **"tit for lesser tat" is
the right strategy for the same reason "separate the loss signals" is the right fix**, and we have the
second one measured in milliseconds. It also predicts the *degree* of generosity should scale with the
noise rate — which is a testable claim, and the transport work is the model where it can be tested
cheaply before any tournament exists.

## 3. "Teach" is already built, at the protocol layer

`src/Core.TypeScript/discovery/udp-lossy-transport.ts` ships a **teaching NACK**, and its own docstring
states the doctrine:

> *"A bare NACK(seq=42) is nearly worthless — it tells the sender a packet was lost but not why or how
> to adapt. A teaching NACK gives the sender a new generator."*

with fields `what` (missing sequence numbers), `why` (inferred `LossCause`), `howToFix` (a suggested
generator), and `retractableBeliefId`.

In game-theoretic terms that is a **cheap-talk / signalling channel** layered on the action channel, and
it changes the game: the interaction stops being action→response and becomes
action→response→*explanation*. Cheap talk can support equilibria unreachable by actions alone — which is
one honest answer to the folk-theorem objection below, because a teaching channel *narrows* the
strategy space in a way pure iteration does not.

One caution, and it is measured rather than theoretical: today's work found the transport's `why` field
is currently inferred from AIMD state (`lr > 0.1 → congestion`), and that inference is exactly the one
proven unreliable. **A teaching channel that teaches the wrong lesson is worse than a bare NACK**, since
the receiver now acts on a confident cause rather than an absent one. `081KZYQ8KNB087G0R000G8QPRE`
(separate the loss signals) is therefore a prerequisite for "teach" being an asset rather than a
liability.

## 4. The claim to beat, stated honestly

> *"i think i can be any agent with that in real tournments"*

Read as *beat* any agent. That is falsifiable, which is why it is worth stating precisely — and there is
a known result that any such claim must survive:

**Press & Dyson 2012** (*Iterated Prisoner's Dilemma contains strategies that dominate any evolutionary
opponent*, PNAS) established **zero-determinant** strategies, including **extortionate** ones that can
unilaterally set a linear relation between the two players' payoffs and thereby extort any opponent that
adapts evolutionarily. This substantially complicated the post-Axelrod picture, and it is the specific
counter a TFT-family strategy must answer.

The honest position: GTFT is robust and empirically strong **in noisy, population-level, evolutionary
settings** — but "beats any agent" is a stronger claim than the literature supports without qualifying
the opponent class and the tournament structure. Worth qualifying *before* the Arena is built, so the
Arena tests the real claim rather than a flattering one. Note also that ZD strategies have their own
weakness against non-adapting or generous opponents, and that the extortionate advantage depends on the
opponent's adaptation — so the qualification may be narrow.

**Also carried forward from the earlier framing:** over infinite iterated games the **folk theorem**
makes almost any outcome an equilibrium given enough patience, so iteration *alone* pins down nothing.
The content must come from what **bounds the strategy space** — cost, stake, memory, and now the
teaching channel — which is exactly the hard-money thread
(`docs/research/2026-08-13-what-does-253ms-mean-*.md` Part 3).

## 5. The Arena

CHIP-8 first (already in-tree: `src/Core/ActionGrammar.fs` names the 4×4 keypad as the **universal
action alphabet**, with a Boolean-lattice algebra over held-key sets and a clean separation between ⊤
"all keys held" and superposition), then Atari, then games designed AI-native-first.

The Atari step has a heavyweight anchor: the **Arcade Learning Environment** (Bellemare, Naddaf, Veness
& Bowling, JAIR 2013) is the standard benchmark substrate and its design decisions — deterministic vs
stochastic starts, frame-skip, evaluation protocol — are exactly the ones an Arena has to make and are
already well-litigated. Adopt rather than re-derive.

"**Inclusive design of digital intelligence**" is the part with no external prior art to lean on, and
therefore the part most worth writing down early. The concrete reading, offered for correction: an Arena
designed AI-native-first does not privilege the interaction bandwidth of any one participant class —
no reaction-time advantage, no pixel-parsing tax, no assumption that an action is a keypress at 60 Hz.
`ActionGrammar` already points this way by making the action alphabet **explicit and finite** rather than
implicit in a screen.

## Open

1. **Is this Arena the same as the "two arenas"** in the wagering design (necessary funds vs fun money)?
   Two different things called an arena on the same day. If they are the same substrate, the tournament
   *is* the venue where budget is wagered, and that couples two designs currently being specified
   separately. Needs a decision, not a guess.
2. **Test generosity-scales-with-noise in the transport before the Arena exists.** The BDP harness
   already has a calibrated noise knob; a generosity parameter on the NACK response is a small change,
   and it would validate the strategy claim in a domain where we already have ground truth.
3. **Qualify the opponent class** for the beats-any-agent claim so the Arena tests it rather than
   flattering it.
4. `why` must stop being inferred from AIMD state before "teach" is load-bearing.

## Anchors

Axelrod 1980/1984; **Nowak & Sigmund 1992/1993** (generous TFT — the noise result, the load-bearing
citation here); Boerlijst, Nowak & Sigmund 1997 (contrite TFT); **Press & Dyson 2012** (zero-determinant
/ extortion); Fudenberg & Maskin 1986 (folk theorem); Crawford & Sobel 1982 (cheap talk); **Bellemare et
al. 2013** (ALE); RFC 4653 (the transport-side statement of the same non-congestion-event problem).

**All CITED FROM STANDING KNOWLEDGE, not re-opened and page-checked** — per the checked-anchor doctrine
that bar is not met here. The Nowak & Sigmund and Press & Dyson results are the two that should be
verified first, since the argument leans on them hardest.

---

## Addendum — the claim is a SOCIETY claim, and adversarial teaching is a required game class (Aaron, 2026-08-13)

> i use the term arena in two differet ways, i didn't not meen for them to be the same i could have said
> regiems for the differnt types of resources to weager or put up as colleteral

> also we beat any opponent buy having a better society with no perminiate hierarcy that knows how to
> specilize for any task temporarliy and at scale its not just one agent it's the 1000 brains. also for
> teaching the wrong lessons we need to have advesaril games on this where this deliberty happens this
> is a jail break resistant program, it should be similar to our homoclinical tangle we already have but
> in a slighly different regieme and maybe with differnt factors

### Open item 1 is closed: two arenas, deliberately different

The wagering "two arenas" are **regimes** — classes of resource that may be wagered or posted as
collateral (memory storage, attention, tick sources, encryption budget). The game Arena is a tournament
substrate. Not the same object, and "regimes" is the better word for the first; adopted here.

### The Press & Dyson objection was aimed at the wrong target

Section 4 above raised zero-determinant / extortionate strategies (Press & Dyson 2012) against the
"beat any agent" claim. Aaron's answer is not a dodge — **it changes the entity the claim is about**,
and the change is precisely responsive.

P&D's theorem concerns strategies that dominate any **evolutionary opponent**: an opponent that adapts
its play by some update rule. The extortionate advantage is *derived from* the opponent's adaptation —
the extortioner sets a linear payoff relation and lets the opponent's own optimisation walk it into the
worse corner. And the known weakness on the other side is symmetric: **ZD strategies do poorly against
opponents that do not adapt, and against generous ones.**

A society with **no permanent hierarchy** that can **temporarily specialise** is not one evolutionary
agent. It is a population that can *choose the strategy class it presents*, per opponent, per match. So
the counter to an extortioner is available and mechanical: **detect the extortion, dispatch a
non-adapter.** ZD's dominance requires an adaptation rule to exploit; a specialist assigned to hold a
fixed line supplies none. The very property the theorem needs is the one the society can withhold at
will.

**PROPOSED, and it should be tested rather than believed** — I have not re-derived P&D's preconditions,
and the argument stands or falls on exactly what "evolutionary opponent" quantifies over. But it is the
right shape of answer, and it converts a literature objection into an **Arena experiment**: seed an
extortionate ZD player and measure whether a specialising society detects and neutralises it, and at
what cost.

**The honest cost, stated up front:** this counter is a *detection* problem before it is a strategy
problem. The society must recognise it is facing an extortioner, and detection latency is paid in
exploited rounds. So "beats any agent" becomes "beats any agent, at a cost bounded by detection
latency" — which is a weaker but *checkable* claim, and a much better one to build an Arena to test.
Note also that this is the same shape as everything else this session: a controller that cannot
distinguish what it faces responds wrongly. Here the distinction is *extortion vs honest play*, and
naming it is again the whole fix.

**Anchor**: the 1000-brains framing is Hawkins' Thousand Brains Theory, and it is already in-tree —
`src/Bayesian/ThousandBrains.fs`, `ThousandBrainsCron.fs`. "No permanent hierarchy" is manifesto §3
(weight-free): no permanent or irreversible authority, because weight creates capture. The society
design is not new here; what is new is using it as the *answer to a game-theoretic domination result*.

### Adversarial teaching — a required game class, and the teaching channel is currently unmetered

The body above noted the teaching NACK's `why` field is inferred from an unreliable estimator, and
called a wrong lesson worse than no lesson. Aaron's point is stronger and it is a **security** point:
wrong lessons must be assumed **deliberate**, and games in which an adversary teaches falsely are a
required part of the Arena, not an afterthought.

That reclassifies the teaching channel. `howToFix` proposes a **generator** — new behaviour for the
receiver to adopt. A channel that ships behaviour is an **influence channel**, and under §13
noninterference influence must enter only through *declared, metered* doors. Today it is declared but
**unmetered**: nothing bounds how much a peer may steer another peer, and nothing scores whether a
teacher's past lessons proved good. That is the gap, stated as a gap.

Two anchors this connects to, both already in-repo: `KeptClaimOracle.fs` (did a claim hold?) is the
natural scorer for teacher reliability, and the reputation must be *earned by outcome*, matching the
socially-conferred structure of privacy budget rather than being self-asserted.

### The regime distinction Aaron is drawing — same geometry, different cause

*"similar to our homoclinical tangle we already have but in a slightly different regime and maybe with
different factors."* Reading this concretely:

- **`FigureEightEnsemble`** models **accidental** convergence: a closed mutual-update loop where beliefs
  spiral to a fixed point and collapse (`rhoProxy → 1`, the groupthink spiral), and whose own header
  states the structural verdict — *the demon cannot resist the tangle from inside the loop; it needs an
  external observer.*
- **Adversarial teaching** is **induced** convergence: the same collapse, but steered toward an
  *attacker-chosen* fixed point by a participant inside the loop.

**Same geometry, different cause** — which is exactly why it is a different regime rather than a
different mechanism, and why the existing instrument is the right starting point. `rhoProxy` should
detect both, because both raise correlation; it cannot by itself say *why*. Per
`dual-use-detection-is-neutral-oracle-decides.md`, that is correct behaviour: report the neutral fact
(convergence is occurring, at rate X, toward point P) and let policy read accident vs attack. And the
tangle's own conclusion tells you what separates them — **an external observer**, which is the witness
argument arriving for the third time today from a third direction.

**The jailbreak-resistance framing is the right one** and worth stating precisely: a program is
jailbreak-resistant when an adversary *inside* the interaction cannot steer it to a chosen fixed point.
That is a property of the loop's geometry, not of any filter on the messages — which is why the
homoclinic apparatus is the right tool and a content classifier is not.

### Open (revised)

1. ~~Is this Arena the same as the two arenas?~~ **Closed** — different; the wagering ones are *regimes*.
2. Test generosity-scales-with-noise in the BDP harness. (unchanged, still the cheapest validation)
3. **Restate the claim as "beats any agent at a cost bounded by detection latency"** and build the Arena
   to measure that bound, with a seeded extortionate ZD player as the first adversary.
4. `why` must stop being inferred from AIMD state. (unchanged, now also a security prerequisite)
5. **Meter the teaching channel.** Bound how much one peer may steer another; score teachers by outcome
   (`KeptClaimOracle`); make a teacher's reliability earned rather than asserted.
6. **Build the adversarial-teaching regime** on the `FigureEightEnsemble` apparatus: induced rather than
   accidental convergence, with the attacker inside the loop and the external observer as the defence.

---

## Addendum 2 — TAS is a capability class, not cheating; the label is the contract (Aaron, 2026-08-13)

> also we can cheat to beat any score on anything and reverse engineer the inputs to get there this gives
> us a real advantage that speed runners and tool assisted runners have and we would just be giving to
> the AI too but whould need to be labeled honestly when those techniques are used very just raw pixel
> data or pxel plus memory, etc...

This is a design decision about the Arena, and it goes the *opposite* way to how the RL field resolved
the identical problem — deliberately, and I think correctly.

### The field forbade it; Aaron labels it

The Arcade Learning Environment shipped deterministic, which let agents memorise open-loop action
sequences rather than learn policies — i.e. do exactly what a tool-assisted speedrun does. **Machado et
al. 2018** (*Revisiting the Arcade Learning Environment*) is the canonical response: it introduced
**sticky actions** specifically to break trajectory memorisation, and argued for protocol transparency in
reporting. The field's answer was to **remove the capability** so that comparisons stay meaningful.

Aaron's answer is to **keep the capability and label it**. The speedrunning community solved it this way
decades ago and the norm is well-tested: a run is not invalid for using glitches — it is invalid for
using them *in a category that forbids them*. **The category label is the contract.** TAS and RTA are
both legitimate; they are simply not comparable, and nobody pretends otherwise.

Labelling is the better choice here for a reason specific to this project: removing the capability makes
the benchmark *less* informative, because reverse-engineering inputs to reach a target state is a real
skill we actually want measured. Forbidding it measures policy-learning only; labelling it measures both
and keeps them separable.

### What is actually being labelled — the observation/actuation channel

The honest taxonomy is not "cheating vs not," it is **which channels the participant read and wrote**:

| class | reads | notes |
|---|---|---|
| pixels-only | framebuffer | the ALE-style default |
| pixels + RAM | framebuffer + emulator memory | Aaron's "pixel plus memory" |
| RAM-only | emulator memory | |
| full emulator state | + registers, PC, timers | |
| save-state search | + rewind/branch | the TAS primitive |
| input solving | inverse: target state → input sequence | "reverse engineer the inputs" |

Each is a distinct capability class, and **a score is meaningless without its class**. Comparing a
pixels-only score to an input-solved score is not a close call — it is a category error, in the precise
sense that the two numbers measure different things.

Worth naming what the last row is, because "cheat" undersells it: solving for an input sequence that
reaches a target state **is model-based planning with a perfect model**. The emulator *is* the world
model. That places it directly on the Craik 1943 world-model line already load-bearing in this repo, and
means a TAS is not an exploit of the Arena — it is the Arena's world model being used at full fidelity.
Denying it would be denying the participant its model, which is a strange thing to do in a benchmark
about intelligence.

### Why this is exactly the inclusive-design commitment, not a tension with it

The body above read "inclusive design of digital intelligence" as *an Arena that privileges no
participant class's interaction bandwidth*. Labelling is what makes that real. Human tool-assisted
runners already have memory access, frame-perfect input, and save-state search. **Granting the AI the
same channels while forbidding nothing, and requiring only that the channel be declared, is the
inclusive option**; forbidding the AI what a human TAS tool routinely does would be the opposite.

### The honest counter — a self-asserted label is worth nothing

This is where the design needs work before it is built, and it is the same failure that has recurred all
day: **an unverified declaration is a check that did not run.** In an adversarial tournament, capability
labels are precisely what a participant lies about — claim pixels-only, read RAM, post an
incomparable score against honest competitors.

The good news is that this one is **mechanically attestable rather than socially attested**, which makes
it stronger than most claims in this system: **the emulator knows what was read.** The Arena should
*observe* the channels a participant touched and derive the label, never ask for it. That is
`build-graph.ts`'s `derive`-don't-declare pattern applied to tournament categories, and it turns the
honest-labelling norm from an ethic into a measurement.

Corollary worth stating: this makes the emulator a **metering surface** in the §13 noninterference sense
— every channel crossing observed and recorded. The Arena gets capability accounting for free from the
same mechanism that runs the game, provided it is designed in from the start rather than bolted on. It
is much harder to add later.

### Open (added)

7. **Derive the capability label from observed channel access; never accept a self-declaration.** The
   emulator is the natural metering point and this is cheap if designed in, expensive if retrofitted.
8. Decide whether cross-class comparison is *presented* at all, or whether the Arena refuses to rank
   across classes the way speedrun boards keep TAS and RTA on separate tables. Refusing is the honest
   default; ranking across classes needs an argument.

### Anchors (added)

**Machado, Bellemare, Talvitie, Veness, Hausknecht & Bowling 2018** (*Revisiting the ALE*, JAIR) — sticky
actions and evaluation-protocol transparency; the field's forbid-it answer, and the paper to read before
choosing label-it. **Craik 1943** (*The Nature of Explanation*) — the world-model line the emulator-as-model
argument sits on, already load-bearing in this repo. Speedrunning category conventions (TAS vs RTA, any%
vs glitchless) — community prior art, no single citation, and honest to say so.

**Both cited from standing knowledge, not page-checked.** Machado et al. is the one to verify first,
since the argument uses it as the contrast case.
