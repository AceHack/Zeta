# Detection is dual-use; the mechanism is neutral, the oracle decides

Carved sentence:

> A mechanism that recognizes something — forgery, a repeat source, an anomaly,
> a correlation — is **dual-use by default**: the same recognition serves a
> legitimate reading and an adversarial one, and the mechanism must NOT choose
> between them. Report the recognition as the **neutral fact** it is; let the
> caller's oracle attach the meaning (Multi-Oracle Principle, manifesto §11).
> "Forgery detection" that hardcodes *forger* into the verdict has smuggled a
> morality the substrate isn't allowed to hold.

## Why

Aaron 2026-07-02: *"always treat things like forgery as dual use, there may be
legitimate use cases."* Recognizing "this is the same source we saw before" is
one mechanism with (at least) two honest readings — **REUNION** (an honest
identity that lost its key is reconnected to its returning self, consent-first)
and **SYBIL** (a forger minting fresh names is priced). The coordination-spectrum
prism reports `SameSourceAsKnown` — the fact — and leaves *welcome back* vs
*caught* to policy. Baking the adversarial reading into the primitive would (a)
violate weight-free / default-moral-regard (the substrate pre-judging a
morally-relevant call), and (b) throw away the legitimate half of the mechanism's
value. Detection is measurement; measurement is not a sentence.

## Shape

- Verdict types name the FACT (`SameSourceAsKnown`, `Correlated`, `AboveThreshold`),
  never the intent (`ForgerCaught`, `Fraud`). The reading is a `match` in caller policy.
- Both readings get a test (the dual-use test): the same match yields reunion under
  one policy and conviction under another.
- One-way inference still holds where it applies (convicts, never acquits) —
  that is a soundness property of the *fact*, orthogonal to its moral reading.

## The functional half — recognising sameness is not assigning identity

Aaron 2026-08-11: *"this is exactly dual use — recognising sameness is not identity,
they are two different functions."*

The rule above guards the **moral** conflation (a detector's fact read as a verdict).
This guards the **functional** one, and it bites in ordinary engineering with no
morality in sight:

> A mechanism that **recognises sameness** is not a mechanism that **assigns
> identity**. Sameness-detection answers *"were these two the same source?"*;
> identity-assignment answers *"what is this source called?"* Conflating them
> silently repurposes a distinctness *proof* as an identity *provider*.

Caught live (2026-08-11): `TwoTimescaleFold.project` needs a globally unique, stable
`ReplicaId`, and its first docstring said to draw one from `AntiSybil`'s distinct
sources. But `AntiSybil.SourceOf` numbers components `0 .. DistinctCount-1`
**per invocation, over one batch** — the same physical source can be numbered
differently next time. Neither stable nor global. Following that advice would have
produced silently-merged evidence under a colliding dedup key.

**The division of labour:** *mint* identity from something non-mintable and
content-addressed (the drift stream itself); *check* it with the detector, which can
prove two names are secretly one source and can never tell you what to call them.

## Pointers

- `src/Core/CoordinationSpectrum.fs` — the worked example (`SpectrumMatch` neutral;
  reunion/sybil are caller policy) · `src/Core/AntiSybil.fs` (the oracle it wraps)
- [`every-bug-has-economic-value.md`](every-bug-has-economic-value.md) — a bug is a
  priced opportunity, not a liability to hide; same refusal-to-pre-judge stance
- [`manifesto-13-specifications.md`](manifesto-13-specifications.md) §11 Default Oracle
  / Multi-Oracle Principle — no single mandatory morality; the mechanism defers
- [`no-directives.md`](no-directives.md) — source ≠ authorization; here: detection ≠ verdict
