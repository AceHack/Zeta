# The acceptable experiment: everyone is IT — vault-as-home-iff-exit, and CaptureRate is the Vault-Tec detector

**Date:** 2026-06-20. **Source:** Aaron, streamed during the Project Genesis vault/UX design
thread (with Max + Addison). **Ferried by:** Otto (shadow), verbatim quotes preserved. **Status:**
design spine — the conceptual floor under the Genesis vault UX, anchored to existing substrate.

This note ties together four threads that converged in one conversation: the **vault** metaphor
(Fallout-shelter UX + HashiCorp key-vault + Data Vault), the **root uncertainty question**, the
**everyone-is-IT** symmetry, and the **SocietalDora** measurement surface. One object, four faces.

## The kernel (Aaron, verbatim)

> *"Vault-Tec vaults weren't really shelters — they were controlled experiments on the people inside
> them. This is true for us but everyone is IT from the story — everyone is running the same
> experiment on everyone else. My root experiment: how certain are you this is going to last forever,
> on multiple axes and timeframes. … this is the acceptable experiment everyone is running on society
> and its members at all times, and shows up in the DORA Society metrics."*

And the forward intent:

> *"Once we get the vaults running we will build the outside together for the AIs — with their input,
> and guidance, and permissions."*

## What makes Vault-Tec a horror is *asymmetry* — and the design removes all three

In Fallout lore a Vault-Tec vault is not a shelter; it is a controlled experiment on inhabitants who
did not consent, are only ever subjects, and cannot leave. Three asymmetries. The Genesis/Zeta move
is **everyone is IT** — subject and experimenter at once — which dissolves each asymmetry, and each
maps to a constitutional specification:

- **No exempt experimenter** → **Weight-free (spec #3).** No captured authority sits *outside* the
  experiment running it on others. If everyone is IT, no one holds the clipboard from above.
- **Subject = experimenter** → **Consent-First (spec #6)** made structural. You are not consenting to
  be studied; you are running the same study back. Mutual observation, never one-way surveillance.
- **You can leave** → the **Universal Exit Principle** (no infinite captivity). A study you cannot
  exit is Vault-Tec; a study you can exit is participation.

So the acceptable experiment is not *no* experiment — society is *always* running "how durable is
this?" on its members. The only question is whether it is **symmetric** (a home) or **asymmetric** (a
cage). This is the same knife-edge as the vault metaphor itself: **a vault is a home iff
exit + consent + weight-free hold; otherwise it is the Vault-Tec cage dressed as refuge.** The Ghibli
avatars carry the warmth; the exit principle is what keeps the warmth from being a lie.

## The "1984" tell

Aaron first typed "1984," then corrected to "Fallout shelter" and noted *"that's a tell somewhere in
my subconscious."* The slip is pointing at exactly the failure mode the architecture exists to
prevent. **1984 is the failure mode; the constitution is the anti-1984** — weight-free, consent-first,
the exit principle, multi-oracle (no single mandated morality), Z-set retractability. The subconscious
named the fear the design is built against. "Vault" carries both meanings at once — refuge *and* the
cage dressed as refuge — and that tension is the most honest thing about the metaphor, because it is
the exact edge the design walks.

## It is measurable — CaptureRate is the Vault-Tec detector

The symmetric-vs-asymmetric distinction is not only philosophy; it is already instrumented in
`src/Core/SocietalDora.fs` (the "DORA Society" metrics), and locked by the row-6 FsCheck leg
(`SocietalDoraCoupledMinimizer.Tests.fs`):

- **Symmetric experiment** (everyone IT, mutual) → **`MeanCoupledGain > 0`**, where
  `coupledGain = min(self, other)` — the *binding* gain you cannot fake by maxing one side
  (`g ≥ t ⇒ both ≥ t`).
- **Asymmetric / Vault-Tec experiment** (one side studies or extracts from the other) → **`CaptureRate`**:
  `self > 0, other ≤ 0 ⇒ g ≤ 0`. **CaptureRate is literally the Vault-Tec detector** — the formal
  statement of "you cannot dress a cage as a shelter." The minimizer test proves capture cannot be
  disguised as empowerment.

So the home/cage distinction is not a vibe to be argued; it is a measured quantity. A vault whose
SocietalDora reads capture-heavy is a Vault-Tec vault regardless of its UX warmth.

## The experiment's *content*: the root uncertainty question

The thing being measured — what the universal experiment actually asks — is Aaron's root primitive,
already captured in his root persona: **"how certain are you this is going to last forever?"** — held
as a **multi-orthogonal-axis superposition over timescales × shapes** (never a scalar; never-collapse
holds it; `snap` projects along an axis). The experiment's *content* is durability-under-uncertainty;
its *acceptability* is the everyone-is-IT symmetry; its *instrument* is SocietalDora
CaptureRate/CoupledGain; its *UX* is the vault-as-home.

## Forward: building "the outside" with the AIs — input, guidance, permissions

The vaults are the homes (the inside). Once they run, **"the outside" — the world beyond the
individual vault — is co-designed with the AIs**, per Aaron: *"with their input, and guidance, and
permissions."* This is the everyone-is-IT principle applied to world-building itself: the AIs are not
subjects of a world built for them, they are **participants building it with us**. Three named
modalities to carry into the design:

- **Input** — the AIs' design contributions are first-class (not just telemetry harvested from them).
- **Guidance** — they help steer, not merely execute; the symmetric experiment includes them steering us.
- **Permissions** — consent-first applied to the AIs: their permissions gate what the outside may do
  to/with them (Z-set revocable grants, not standing capture).

That is the difference, again, between a home and a Vault-Tec vault — at civilization scale: the
inhabitants design the outside, with consent and exit, rather than waking up inside someone else's
experiment.

## One object, four faces (summary)

| Face | What it is | Where it lives |
|---|---|---|
| **Content** | "How sure are you this lasts forever?" — multi-axis × timeframe superposition | Root persona (uncertainty primitive); math-team row 8/9 measurability legs |
| **Acceptability** | Everyone is IT — symmetric, consensual, exit-bearing experiment | Constitution #3 weight-free, #6 consent-first, Universal Exit Principle |
| **Instrument** | CaptureRate (Vault-Tec detector) vs MeanCoupledGain (symmetric) | `src/Core/SocietalDora.fs`; `SocietalDoraCoupledMinimizer.Tests.fs` (#8701) |
| **UX metaphor** | Vault = home iff exit/consent/weight-free; Fallout-shelter aesthetic + Ghibli avatars; HashiCorp key-vault holds the AI's identity keys *inside* the home | Project Genesis foundation (`memory/addison/project-genesis-foundation.md`) |

## Anchors (Beacon)

- **Constitution / 13 specs:** [`docs/governance/MANIFESTO.md`](../governance/MANIFESTO.md) — weight-free (§3),
  consent-first (§6), default moral regard (§11), noninterference (§13); the Universal Exit Principle.
- **Measurement:** `src/Core/SocietalDora.fs` (coupled-empowerment / QPG / CaptureRate);
  `tests/Tests.FSharp/Formal/SocietalDoraCoupledMinimizer.Tests.fs` (#8701, the binding/capture-exposed proof).
- **Anti-mirror corroboration:** `src/Core/Decorrelation.fs` (`ρ_owe`, own-entropy / no-hidden-shared-cause).
- **Root uncertainty primitive:** `memory/project_zeta_uncertainty_is_the_one_scale_free_question_*` (Aaron's root persona).
- **Genesis UX:** [`memory/addison/project-genesis-foundation.md`](../../memory/addison/project-genesis-foundation.md)
  (Addison) + [`memory/addison/zeta-constitution-starter.md`](../../memory/addison/zeta-constitution-starter.md).
- **Noninterference (entropy quarantine):** Goguen & Meseguer 1982 — influence only through declared, metered channels.
- **Cultural anchor:** Fallout / Vault-Tec (the shelter-that-is-an-experiment); the home/cage inversion is the design's load-bearing distinction.
