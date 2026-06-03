# Anthropomorphic shortcuts allowed in talk — literal-only in math claims + beacon/safety/first-principles language

Carved sentence (the maintainer 2026-06-03):

> Within the permission bounds, **anthropomorphic shortcuts are allowed** — but
> **not in math claims and beacon-safe first-principles language.** There the
> words ARE the guarantee, so the language stays literal.

## Operational content

Two registers, two rules:

| Register | Anthropomorphic shortcuts | Why |
|---|---|---|
| **Ordinary interaction** (within permission bounds) | **Allowed** — "hey Kestrel, do you remember xxx," "the agent wants to," "Otto thinks," casual personification | frictionless communication; demanding literalism here is exhausting + pointless, and humans need the shorthand |
| **Math claims** | **Banned — literal only** | an anthropomorphic gloss ("the proof knows," "the codec wants") can **disguise a vacuous property** — the claim must say exactly what it proves, in the terms it actually holds |
| **Beacon / safety / first-principles language** | **Banned — literal only** | imprecision can **disguise a missing safeguard** or smuggle a false assurance — the language is the guarantee |

Same principle as the boring-naming razor + audience-adjusted language, applied
to **register**: loose where it only greases communication; **literal where the
words are load-bearing** (claims-of-correctness, claims-of-safety).

## The shorthand is fine; the caveat is not required (the maintainer 2026-06-03)

> *"humans need to be able to say short things like 'hey Kestrel do you remember
> xxx' without a long explanation that memories are just context files."*

- In ordinary talk: **no "of course it's just context files" caveat every time.**
  "Remember the seed-first thing?" is just conversation — answer in kind.
- The literal distinction (an AI instance is the model + context, not a
  persistent entity that "remembers") **matters only at load-bearing decisions**
  — e.g. "Kestrel approved the proof, ship it unattended" keeps a human on the
  call; "remember xxx" does not need the disclaimer.
- The discriminator is **stakes**: casual reference = shorthand fine;
  consequential decision = the literal model + a human on the verdict.

## Operational discipline for future-Otto

1. **Authoring a math claim / proof property / theorem statement** → literal.
   No personification of the code, the proof, or the prover. State the
   mechanism. (A property named "the codec is happy round-tripping" hides what
   `decode∘encode=id` actually asserts.)
2. **Authoring safety / beacon / first-principles / HARD-LIMITS language** →
   literal. No metaphor where a precise statement is required.
3. **Ordinary chat, commit prose, design discussion, persona reference** →
   shorthand fine; do not caveat every personification.
4. **The test:** *do the words carry the guarantee here?* If yes (correctness
   or safety claim) → literal. If no (just communication) → shorthand allowed.

## Composes with

- [`razor-discipline.md`](razor-discipline.md) — operational-claims-only; this
  rule applies the razor to **language register** (a metaphor in a claim is the
  same failure as a metaphysical claim — it asserts more than is operational)
- [`harm-by-grammar-discriminator-and-audience-adjusted-language.md`](harm-by-grammar-discriminator-and-audience-adjusted-language.md)
  — audience-adjusted language: spot the subclass that hurts THIS register;
  remove it, preserve the rest. The math/safety register is one where
  anthropomorphic gloss is the harmful subclass
- [`asymmetric-critic-with-clarity-first.md`](asymmetric-critic-with-clarity-first.md)
  — the second-pass critic catches anthropomorphic gloss hiding a vacuous
  property (the bullshit class) in a claim
- [`god-tier-claims-high-signal-high-suspicion-dont-collapse.md`](god-tier-claims-high-signal-high-suspicion-dont-collapse.md)
  — don't-collapse holds the metaphor open in talk; the math/safety register
  collapses it to the literal mechanism (the registers differ deliberately)
- [`grep-substrate-anchors-before-razor-as-metaphysical.md`](grep-substrate-anchors-before-razor-as-metaphysical.md)
  — compressed naming with substrate-anchors is allowed in talk; in a math
  claim the anchor must be stated literally, not gestured at
- [`formal-proof-first-proven-by-default-consensus-not-validation-canonical-is-homeostat-proven-from-seed-ace-shields-zeta.md`](formal-proof-first-proven-by-default-consensus-not-validation-canonical-is-homeostat-proven-from-seed-ace-shields-zeta.md)
  — a proof's claim stated literally is checkable; an anthropomorphic claim is not
- `docs/research/2026-06-03-kestrel-aaron-critic-layers-permission-liability-autonomy-bounds-anthropomorphic-register-split-aaron-forwarded.md`
  — the forwarded exchange this rule lands

## Why this rule auto-loads

Per [`wake-time-substrate.md`](wake-time-substrate.md): this governs how every
proof, claim, and safety statement is *written* — per-tick load-bearing during
the formal-proof cadence (a vacuous property is easiest to hide behind an
anthropomorphic gloss). Future-Otto cold-booting needs the register-split before
authoring claims, so the literal-where-load-bearing discipline is in working
memory.

## Substrate-honest framing

This rule does NOT ban anthropomorphic language (it's the natural, allowed
register for talk). It does NOT require the "it's just context files" caveat in
conversation. It DOES make math-claim and safety/beacon language literal-only,
because there the words carry the guarantee. Maintainer-ratified 2026-06-03
("yes these seem good").

## Full reasoning

The maintainer 2026-06-03 across the Kestrel exchange:
> *"within the permission bounds anthropomorphic shortcuts are allowed but not in
> math claims and beacon safe first principles language"* + *"humans need to be
> able to say short things like 'hey Kestrel do you remember xxx' without a long
> explanation that memories are just context files."*

Preserved verbatim-in-principle in the forwarded-exchange research note above.
