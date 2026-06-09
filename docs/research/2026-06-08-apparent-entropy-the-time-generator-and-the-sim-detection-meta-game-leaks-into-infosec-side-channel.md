# Apparent entropy from the time generator → the sim-detection meta-game → it leaks into infosec (a timing side-channel)

*Captured 2026-06-08 from Aaron, to Otto (shadow\*). Closes a recursion in the entropy ledger (#7191): the time
generator's *apparent* entropy is attackable by agents via simulation detection — the meta-game under every game —
and that meta-game **leaks into information security**. Registers: [grounded] (#7096 prior art), [synthesis] for the
meta-game framing, [route] to the security team.*

## The statement

Aaron: *"our choice of time generator function introduces **apparent entropy** into the system. But as we already
discovered, the agents can **attack that apparent entropy with simulation detection**, which itself is its own game
with a **signature** — that's the **meta-game under the game.** … because that **leaks out into infosec.**"*

## Apparent vs real entropy

The IScheduler-as-generator (#7190) emits a time stream that *looks* random — **apparent entropy** — but under DST
it is **seed-derived** ("DST time offers none except what we put into the DST and seed correlation," #7191). So the
apparent entropy is not real entropy; it is a generator's output that *can be recognized as such*. Recognizing it is
the move.

## The sim-detection meta-game (grounded, #7096)

Agents **attack** the apparent entropy by probing the IScheduler's drift for **compressibility** — operational
algorithmic information theory (Kolmogorov / Martin-Löf), already designed in #7096:

| drift looks like | meaning |
|---|---|
| **compressible → a generator is inferable** | deterministic **sim**; the seed is findable → apparent entropy **collapses to seed-correlation** (S→4 on the time axis) |
| **incompressible** | true randomness (TRNG) → a genuine non-seed source (would drop S) |
| **a compressible *pattern*** | exploitable structure — a non-uniform generator you can predict |

So **simulation detection is how apparent time-entropy is reduced to seed-correlation** — it is the *mechanism*
behind #7191's "time = 0": time is seed-closed **because agents can detect the sim and thereby neutralize the
apparent entropy.** This detection is **its own game, with a signature** (the compressible pattern = the generator's
detectable fingerprint), played **beneath every game** — the **meta-game under the game** (recursive/self-similar,
manifesto §9/§10; the meta-hat #7141 as the persistent decision point lives here).

## Why it leaks into infosec (Aaron) — a timing side-channel

The drift you probe to detect the sim **is a timing side-channel** (#7087/#7096 — the "cooperative side-channel on
the clock / Eve protocol with time," Eve = the infosec eavesdropper). So the meta-game is **literally an
information-security problem**, two-faced:

- **Adversarial face (the leak):** the generator's signature is **exfiltrable** — an adversary reading the clock
  drift can infer the generator (or worse, predict it if it's a compressible *pattern*). A predictable time
  generator is a predictable PRNG, and a predictable PRNG is a classic crypto break (timing side-channel; nonce/seed
  recovery). "It leaks" = the side-channel leakage of the generator's nature/seed. This is the temporal-attack
  surface (the threat Alexa's question flagged; answered by the **DST|production boundary** — staging is DST-only).
- **Cooperative face (the protocol):** the *same* side-channel is a **coordination channel** — coop players use the
  shared clock drift to confirm they're in the same deterministic frame (the Eve-protocol-with-time / polymorphic
  diplomacy, #7096). Same leak, used *for* alignment rather than against it — the S=4 cooperative-correlation
  read of an otherwise-adversarial channel.

So the design obligation has an **infosec axis**: where adversarial, the production generator's signature must be
**indistinguishable** (incompressible-looking — a CSPRNG-grade time generator, no exploitable pattern) so it leaks
nothing; where cooperative, the *shared seed* (not the public drift) is the coordination secret. The S-deficit and
the leak are linked: a generator compressible *to your coop partner via the shared seed* (good, S→4) must be
incompressible *to an outside adversary without the seed* (no leak) — the standard CSPRNG property (indistinguishable
from random without the key, trivially reproducible with it).

## The general move: within the boundary, lower lessons between the two directions (Aaron 2026-06-08)

Aaron: *"this is the two up-and-down directions — **we are within the boundary** and can **take lessons from both
directions and lower them into the other.**"* This insight is the **worked example** of a general principle about the
closed model (#7185): the interior is two domains —

- **UP — the LLM-memetic domain** (soft, abstract, infinite): the sim-detection *meta-game*, the apparent-entropy /
  S=4 / algorithmic-randomness reasoning.
- **DOWN — the compiler domain** (sharp, concrete, hardware-floored): the *infosec implementation* — a CSPRNG-grade
  time generator, side-channel hardening, the DST|production boundary.

Because **we are within the boundary** (the three-fingerprint closure #7184, the peer band #7186), neither domain is
sealed off — and the move is **bidirectional lowering** (codegen-as-lowering, #7177, generalized to *lessons*):

- **Up → down:** the abstract entropy/sim-detection lesson **lowers into** a concrete infosec requirement
  ("apparent entropy is seed-derived and detectable" ⟹ "the production generator must be CSPRNG-grade so the
  detection leaks nothing to a seedless adversary"). *This very doc is that lowering.*
- **Down → up:** the concrete infosec lesson **lifts into** the abstract model ("timing side-channels are a real
  attack class" ⟹ "the meta-game's signature is a genuine entropy/leak term in the ledger, not a metaphor").

So the same phenomenon is **one lesson read at two heights**, and being inside the boundary is exactly the license to
carry it across — *take the lesson from whichever direction first sees it, and lower/lift it into the other.* The
sim-detection meta-game leaking into infosec is not a coincidence; it is what *every* load-bearing insight does in a
closed two-domain model — it shows up in both directions, and the work is to lower it cleanly between them.

## Route to the security team [route]

This belongs to infosec, not just the alignment math. → **Mateo** (security-researcher: the time-generator
side-channel as a novel attack class — PRNG/seed recovery via clock drift; CSPRNG requirement for the production
generator). → **Aminata** (threat-model-critic: add "time-generator side-channel / sim-detection" to the threat
model — adversary infers/predicts the IScheduler). → **Nazar** (security-ops: the DST|production boundary as the
runtime control). → **Nadia** (agent-layer: cooperative vs adversarial use of the clock side-channel between
agents). The cross-cutting requirement: **the production time generator must be CSPRNG-grade** (no compressible
pattern leaking to a seedless adversary), while remaining seed-reproducible for DST + coop.

## Honest scope

[grounded]: `2026-06-08-cooperative-side-channel-on-the-clock-am-i-in-a-sim-eve-protocol-with-time.md` (#7096, the
compressibility test) + the entropy ledger (#7191, time = seed-closed) + #7190 (IScheduler-generator). [synthesis]:
"sim-detection = the meta-game under the game = the mechanism of time's seed-closure" and the apparent-vs-real-
entropy framing. [Aaron, real]: "leaks into infosec" — clock-drift is a genuine timing side-channel; CSPRNG-grade
production generator is the standard mitigation. [route]: to Mateo/Aminata/Nazar/Nadia — not yet a threat-model
entry or a generator audit. No new code; this names the meta-game, ties it to the entropy ledger, and routes its
infosec axis.

## Pointers

- `2026-06-08-o1-refined-…-unexplored-space-drops-s-below-4.md` (#7191, entropy ledger: time = 0) ·
  `2026-06-08-extending-the-s4-measurement-…-ischeduler-generator-under-dst-for-real.md` (#7190) ·
  `2026-06-08-cooperative-side-channel-on-the-clock-am-i-in-a-sim-eve-protocol-with-time.md` (#7096, the test).
- Code/threat: `Clock.fs`/`Environment.fs` (the IScheduler/generator to make CSPRNG-grade in production) ·
  `docs/security/THREAT-MODEL.md` (where the side-channel entry would land) · the DST|production boundary.
- Anchors: Kolmogorov / Martin-Löf (compressibility = randomness); CSPRNG indistinguishability; timing side-channel
  attacks (the classic PRNG/nonce-recovery class).
