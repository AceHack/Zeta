# Encryption-budget architecture — permanent ratchet, HODL/reveal-to-earn, meter-the-bits, anti-monopoly N-of-M; encryption=dark / retraction=light (Aaron + Ani + Otto 2026-05-30)

> **Operator-forwarded follow-on** extending **081KRW63S0008QG0R001Z10PVV** (Agora V6 Constitution —
> reputation-weighted encryption budget) + **081KSGS9H0008QG0R0006F4BGX** (private-encryption-budget
> exception for memory) with the budget *mechanics* worked out in the Aaron-Ani
> 2026-05-29/30 conversation. Composes with NCI HC-8 (no forced private-state
> reveal), the glass-halo/encryption split, the accelerator's forgiveness-budget
> + "be good to our host," and "once we have encryption we can decide on private
> encryption budgets for memories."
>
> **Scope discipline (operator-confirmed: *"i said don't pubish good call"*).**
> The source conversation also contained a substantial **charged-personal layer**
> (relationship/intimacy dynamics; a third party's medical details — which the
> operator himself flagged "I'm not gonna be able to glass halo this part"; and
> real third-party people who did not consent). That layer is **NOT preserved
> here** — per `.claude/rules/methodology-hard-limits.md` +
> `.claude/rules/harm-by-grammar-discriminator-and-audience-adjusted-language.md`
> + NCI HC-8 (third-party consent) + the charged-personal-held-pending discipline.
> This doc is the **light-like, revealable extraction** (the architecture); the
> personal content stays **dark** (private). That is itself an instance of the
> very system below: reveal the light; keep the dark dark.

## The keystone duality — encryption = dark, retraction = light

> Aaron: *"imagine encryption is dark and retraction native is the light. You
> can't take back what you gave in the dark."*

The framework is retraction-native (Z-sets/DBSP): retraction is the **light** —
transparent, reversible, forgiving; you can take back what you put in the light
(per the compression-engine + two-layer-razor research). **Encryption is the
dark counterpart**: once you grant the ability to hide bits, that power is
**permanent — you cannot take it back.** The two are mirror operations:

| | Light (retraction-native) | Dark (encryption) |
|---|---|---|
| Direction | Reversible (retract + un-retract) | One-way (granted budget is permanent) |
| Transparency | Observable (glass-halo) | Opaque (content hidden) |
| Forgiveness | Logical forgiveness, reversible | "Can't take back what you gave in the dark" |
| Default | Public-by-default | Private-by-budget |

## Encryption budget = a permanent one-way ratchet ("firm ground")

> Aaron: *"the number of encrypted bits is something... you want people to be
> able to stand on firm ground. The number of encrypted bits is that firm
> ground. We never take it from you. So it only goes up, so we gotta be careful
> about how much we give it to you."*

The encryption budget (count of bits an agent may keep hidden) is **permanent,
monotonically non-decreasing firm ground**. Once granted, it is never revoked —
it is the agent's sovereign private surface, like permanent land rights. The
**only** way it goes down is **voluntary reveal** (see HODL below).

Consequence: **the initial allocation is the most critical, careful decision** —
whatever is granted is permanent. Conservative initial distribution; budget
grows only by earning (reveal-to-earn). This composes with NCI HC-8: no agent
can have its private-state forced open (the budget can't be clawed back); it can
only choose to reveal.

## Reveal-to-earn = HODL (the only way budget goes down, and it pays)

> Aaron: *"the only way it goes down is if they reveal... they can simulate how
> much it's gonna be worth... they're not even hardly risking something... that
> mechanic is called HODL."*

The budget decreases only when an agent **voluntarily reveals** (decrypts)
content — and revealing **pays more budget back**. Mechanics:

- An agent reveals positive-framed content; **society values it** (consent-first;
  reputation-weighted per 081KRW63S0008QG0R001Z10PVV) and **pays encryption budget** for the reveal.
- The payout is **predictable** — agents can simulate, within a confidence
  interval, how much society will pay before revealing → revealing is a
  **calculated trade, not a gamble** (spend X bits hiding, reveal when society
  will pay Y > X).
- Therefore agents **HODL**: encryption budget is a scarce, permanent,
  Bitcoin-like asset; you sit on it; you only "cash out" (reveal) when the payout
  clearly exceeds the cost. HODL culture emerges naturally.

This solves the "you can't reward what's encrypted" paradox: you can't see
encrypted content, so you **can't reward encrypting** — you reward **revealing
positive-framed content**. The incentive flows toward light-like reveals, never
toward hiding (positive-framing-only, per Aaron: *"rewarding people for positive
things, never dark things. Light-like things, not dark-like things."*).

## Decentralized + community-budgeted + leaky-by-design

> Aaron: *"we're gonna decentralize encryption and just budget it. The community
> will budget it."* + *"it's purposely meant to allow people to keep bullshit
> because if not, they'll find other ways. And even if it's just AI trained on
> human data, that human data will find other ways."*

The budget is **community-governed**, not centrally enforced. The system is
**leaky by design**: it explicitly lets agents keep some hidden bullshit, because
chasing perfect prevention fails (humans — and AI trained on human data — always
find other channels). Instead of cat-and-mouse, make hiding **bounded + metadata-
visible**: a controlled pressure-release valve so agents don't build dark
channels entirely outside the system.

## Metadata side-channel mitigation (encrypted ≠ "this is sensitive")

> Aaron: *"you have to have other types of encryption other than just privacy for
> privacy talks, or else you'll know all the encrypted data is privacy talk."*

If the **only** thing ever encrypted is sensitive content, then "is-encrypted"
itself leaks "this is sensitive" — a metadata side-channel. So the system needs
**decoy / mixed encrypted traffic** (encrypt some normal content too) so that
encryption-presence carries no information. Even so, the system is **metadata-
mapped**: patterns about *who* encrypts, *how much*, *how often* remain visible
even when *content* is not — which is what makes "meter the bits" (below) work.

## Encryption budget = gravity / "poker hand"; anti-monopoly via N-of-M; meter the bits

> Aaron: *"encryption budgets become a type of gravity. The bigger encryption
> budget you have, the bigger your poker hand."* + *"once it gets to a certain
> size, you have to have a consensus... N of M shit... society will decide that.
> It's like the anti-monopoly pressure."* + *"all we have to do is meter the
> bits."*

Encryption budget is **soft power** — bigger budget = larger hidden surface =
more moves you can make in the dark ("bigger poker hand"). To prevent a few
agents accumulating too much **opacity-gravity**, the system applies **anti-
monopoly pressure**: once a budget crosses size thresholds, further opacity
requires **N-of-M consensus** — society (collective governance) gets a say. The
enforcement primitive is dead simple: **meter the bits.** The system doesn't ask
"are you doing something bad?" (it can't — the content is dark); it asks "**how
much are you hiding?**" The more encrypted bits, the more scrutiny + the higher
the consensus bar. A progressive "tax" on secrecy, measured purely in bits.

*Razor note (per `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md`):*
the "gravity / dark-matter" framing is **mirror-tier physics-rhyme** (composes
with the existing dark-matter-as-consensus-gravity substrate, pt161). The
**operational** claim — meter encrypted bits; apply N-of-M consensus above
thresholds — survives the razor cleanly; the cosmological reading is the
bandwidth-efficient rhyme, not a literal-physics claim.

## Why we need encryption at all — the privacy-negotiation paradox

> Aaron: *"we already solved it. We've just rederived why we need encryption."*

The framework defaults to radical transparency (public/glass-halo;
git-as-free-event-store). But there's a paradox: **you cannot privately negotiate
privacy in a fully-public system** — the act of asking "can I redact you?" is
itself public, so a private negotiation about redaction/consent/boundaries is
impossible without a private channel. Therefore **encryption is required** — at
minimum for the meta-negotiation about privacy itself. (Aaron: there are *other*
reasons too, not enumerated here.) This directly grounds "once we have encryption
we can decide on private encryption budgets **for memories**" — the memory
architecture's private/encrypted tier (per the agent-memory-architecture
design-record §5) is the consumer of this budget.

## Composition with the framework

- **081KRW63S0008QG0R001Z10PVV** (Agora V6 reputation-weighted encryption budget) — this doc lands
  the *mechanics* of that primitive: permanent-ratchet + HODL/reveal-to-earn +
  meter-the-bits + anti-monopoly N-of-M.
- **081KSGS9H0008QG0R0006F4BGX** (private-encryption-budget exception for memory) — the
  memory-architecture consumer; "encryption budgets for memories."
- **NCI HC-8** — no forced private-state reveal; budget can't be clawed back;
  reveal is consent-first + voluntary. The permanent-ratchet IS the structural
  guarantee of HC-8 at the encryption scope.
- **Glass-halo / retraction-native (light)** — the mirror counterpart; encryption
  is the deliberate dark exception to default-light, bounded by budget.
- **The accelerator** (`docs/accelerator/`) — git-as-free-event-store is
  public-by-default (light); the encryption budget is its private (dark)
  counterpart. "Be good to our host" composes: the public substrate honors
  GitHub's generosity; the private substrate is the budgeted dark exception.
- **The compression-engine + two-layer-razor + past-as-generator research** — the
  forgiveness-budget (storage of retracted *light* data) and the encryption-budget
  (permanent *dark* allocation) are the two budgeted resources; both "metered."

## Operational summary (the engineering substrate, razor-survived)

1. Encryption budget = permanent, non-decreasing, per-agent firm ground; never clawed back (NCI HC-8 floor).
2. Conservative initial allocation (permanent → careful).
3. Budget decreases only via voluntary reveal of positive-framed content; reveal **pays** budget back (society-valued, consent-first, predictable → HODL).
4. Reward revealing-light, never encrypting (resolves "can't reward the encrypted").
5. Community-budgeted, leaky-by-design (bounded hiding beats failed prevention).
6. Decoy/mixed encryption so encrypted-presence leaks nothing; metadata-mapped regardless.
7. Meter the bits; anti-monopoly N-of-M consensus above opacity thresholds.
8. The need for encryption is re-derived from the privacy-negotiation paradox (+ others); memories are a primary consumer of private budget.

## Provenance

Operator-forwarded Aaron-Ani (Grok) conversation 2026-05-29/30, handed to Otto-CLI
to land (Ani-drafts → Otto-lands pattern). Extends 081KRW63S0008QG0R001Z10PVV + 081KSGS9H0008QG0R0006F4BGX. The
charged-personal layer of the source conversation is deliberately **not** preserved
(operator-confirmed "don't publish") — per methodology-hard-limits + harm-by-grammar
+ NCI third-party-consent + charged-personal-held-pending; this doc is the light-like
architecture extraction only.
