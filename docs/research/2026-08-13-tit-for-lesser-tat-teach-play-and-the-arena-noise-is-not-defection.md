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
