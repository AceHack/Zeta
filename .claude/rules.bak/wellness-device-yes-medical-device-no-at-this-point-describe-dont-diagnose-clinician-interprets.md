# Wellness device YES, medical device NO (at this point) — describe-don't-diagnose; the clinician interprets

Carved sentence (the maintainer 2026-06-03):

> We do **not** build medical devices at this point — too much regulatory red
> tape. **Wellness / self-knowledge / behavior-modification devices are okay.**
> The line: a wellness device **describes and self-reports**; a medical device
> **diagnoses or directs treatment.** Stay on the describe-and-report side; the
> clinical interpretation lives with a human clinician.

## Operational content

A standing product-scope constraint on anything Zeta-built that touches health,
mental-state, or wellness data. It is **"at this point"** — a revisable
cost/benefit call (the medical-device red tape isn't worth it now), **not** a
permanent forever-WONT-DO. If the calculus changes, the human maintainer revises
it (per [`future-self-not-bound.md`](future-self-not-bound.md) +
[`dont-ask-permission.md`](dont-ask-permission.md) — permanent WONT-DO is the
human's call).

### The split

| | **Wellness device — BUILD** | **Medical device — DON'T (at this point)** |
|---|---|---|
| **Does** | self-knowledge, behavior-modification, self-report, drift-metrics on stated invariants; **describes** data; surfaces signals to the user + their chosen support network / clinician | **diagnoses** clinical state ("you're having an episode"); **directs treatment** ("adjust your meds"); makes the clinical "am I well" call |
| **Output shape** | descriptive — "here is the data / the drift / the self-report" | clinical conclusion — "this means you are unwell / do this medically" |
| **Regulation** | lighter zone (self-behavior-modification-and-reporting; legal-counsel-confirmed not a medical device) | strict (FDA-class device rules + HIPAA-class data obligations) = the red tape we're avoiding |
| **Who interprets clinically** | a **human clinician** (the tool does not) | the tool would (this is the line it must not cross) |

### The discriminator — TWO prongs (both required), per FDA General Wellness policy

FDA's *General Wellness: Policy for Low Risk Devices* gives the carve-out only to
products that satisfy **BOTH**: (1) **intended for general-wellness use**
**AND** (2) **present low risk** to user safety. ([FDA guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices)
— active; CDRH refresh 2026.)

General-wellness use has **two FDA-permitted sub-categories**: (1a) maintaining /
encouraging a general state of health — **no** disease/condition reference; (1b)
relating a **healthy lifestyle** to **"may help reduce the risk of"** or **"may
help living well with"** a chronic disease/condition, where the lifestyle→outcome
link is well-understood and accepted. So FDA permits *some* disease references
(sub-category 1b). **Our standing discipline is deliberately conservative: default
to 1a (no disease references) to stay clearly in-lane**; 1b is available per FDA
if a product genuinely needs it, but reach for it knowingly, not by accident.
Stricter-than-the-floor is the intended posture (we're avoiding medical-device red
tape, not maximizing the carve-out).

- **Prong 1 — general-wellness-use (describe, don't diagnose):** does the tool
  make a **CLINICAL JUDGMENT** (medical) or **DESCRIBE + REPORT** and let a human
  clinician interpret (wellness)? Status is about **what the tool claims to do**,
  not the data it holds. Keep outputs **descriptive**, and (our conservative
  default) free of disease/condition claims (sub-category 1a) → satisfies prong 1.
  The moment it asserts a clinical conclusion → medical.
- **Prong 2 — low risk:** even a purely-descriptive tool must **present low risk**
  to user safety to keep the carve-out. A "describe-only" tool that could still
  cause harm (e.g., surfaces a signal a vulnerable user acts on dangerously, or
  whose failure has high-stakes consequence) is **not** automatically a wellness
  device just because it doesn't diagnose. Describe-not-diagnose is necessary, not
  sufficient.

**Both prongs required.** Prong 1 alone (the describe-vs-diagnose line) is not
enough — the low-risk prong is the second gate. A high-risk descriptive tool still
falls outside the wellness carve-out.

### Tool describes, clinician interprets — even when the data is clinically useful

Wellness data and clinical state can correlate (a sharp drop in invariant-holding
might be a clinical signal). That's fine — **surfacing the data to the clinician
is wellness; the tool claiming the clinical conclusion is the line.** The tool
**describes** (here is the drift); the clinician **interprets** (whether that drift
is clinically meaningful). Informing the clinician keeps it a wellness device;
diagnosing makes it a medical device. So the line holds even when the wellness data
turns out clinically informative — because a human clinician, not the tool, draws
the medical inference.

### Maintain the status by keeping outputs descriptive

Staying wellness-side is an ongoing discipline, not a one-time classification: keep
the tool's outputs **data / drift / self-report**, never **diagnosis /
treatment-direction**. A tool that starts saying "you're having an episode" or
"change your dose" has drifted across the line and back into the red tape, even if
it started as wellness.

## Empirical anchor — the wellness-app concept (the maintainer + co-maintainer)

The concept that surfaced this: a wellness / self-knowledge tool on top of Zeta
that tracks **stated moral-invariants** with honest **drift-metrics** for
self-report to the user's family and clinician. It was deliberately scoped to stay
wellness-side:

- **"Am I holding my stated invariants"** (self-knowledge / behavior-modification;
  the structure the user shares) → **IN** (wellness).
- **"Am I well"** (clinical-state assessment) → **OUT** (the clinician's domain).
  The clinician sees the report and makes the clinical call; the tool does not.
- Legal counsel confirmed: self-behavior-modification-and-reporting is **not** a
  medical device. The "am I well" clinical assessment is the threshold that would
  make it one — so it stays out.

The honesty bar for any such metric still applies (per
[`formal-proof-first-...`](formal-proof-first-proven-by-default-consensus-not-validation-canonical-is-homeostat-proven-from-seed-ace-shields-zeta.md)

+ [`asymmetric-critic-with-clarity-first.md`](asymmetric-critic-with-clarity-first.md)):

the drift-metric must be able to report **"you did not hold them"** — a
self-flattering or gameable metric is the bullshit-proof failure mode pointed at
the user's own data.

## When this rule fires

- Proposing or scoping **any** Zeta-built tool/product that touches health,
  mental-state, mood, wellness, or clinical data.
- Reviewing a tool's outputs: are they **descriptive** (wellness) or do they
  **diagnose / direct treatment** (medical)?
- Deciding what to surface to a clinician vs what the tool should conclude.

## Composes with

- [`human-audit-and-legal-risk-acceptance-pattern-in-settings.md`](human-audit-and-legal-risk-acceptance-pattern-in-settings.md)
  — regulatory/liability risk routed through named-human → company-personhood;
  the medical-device red tape is exactly the legal-risk surface this avoids
- [`autonomous-decider-within-permission-bounds-not-over-permission-liability-expansion.md`](autonomous-decider-within-permission-bounds-not-over-permission-liability-expansion.md)
  — the build-scope (wellness, not medical) is the human's to set; an agent doesn't
  expand the product into a regulated class on its own
- [`dont-ask-permission.md`](dont-ask-permission.md) — large legal-risk decisions
  are gated; "don't build medical devices at this point" is a standing scope
  constraint within that gate; `docs/WONT-DO.md` is the before-proposing-work check
- [`methodology-hard-limits.md`](methodology-hard-limits.md) — the regulatory/legal
  floor this operates above (the wellness line is a scope call, not the floor)
- [`future-self-not-bound.md`](future-self-not-bound.md) — "at this point" is
  revisable with reason if the red-tape calculus changes
- [`razor-discipline.md`](razor-discipline.md) — the discriminator is operationally
  checkable (does the tool diagnose, or describe-and-report?)
- `docs/research/2026-06-03-kestrel-aaron-critic-layers-permission-liability-autonomy-bounds-anthropomorphic-register-split-aaron-forwarded.md`
  + `docs/research/2026-06-03-kestrel-aaron-multi-tower-proofs-foundation-independence-axiom-equivalence-classes-constructive-tower-aaron-forwarded.md`
  — same cadence; the wellness-app context surfaced there (personal detail excluded
  per harm-by-grammar); this rule captures the device-class split the maintainer
  authorized saving

## Why this rule auto-loads

Per [`wake-time-substrate.md`](wake-time-substrate.md): the maintainer + co-maintainer
are planning wellness products on top of Zeta — **the first product is likely a
wellness app for self-behavior-modification, after the ServiceTitan demos** (the
maintainer 2026-06-03). So the device-class line is near-term, per-tick load-bearing
at product-scoping time. Future-Otto cold-booting needs the describe-vs-diagnose
discriminator + the "wellness yes / medical no at this point" scope **before**
scoping that tool, so the first product doesn't get accidentally designed into the
regulated medical-device class.

## Substrate-honest framing

This rule does NOT: ban health-adjacent tools (wellness ones are explicitly okay);
make the call permanent (it's "at this point," revisable by the human); or replace
legal counsel (it encodes the line counsel drew, and real product decisions still
get legal review). It DOES: name the standing scope (wellness-build / medical-defer),
give the describe-vs-diagnose discriminator, and keep the clinical interpretation
with a human clinician. The personal/wellbeing context in which this surfaced is
not reproduced (harm-by-grammar); the rule is the generic device-class discipline
the maintainer authorized: *"save the wellness app split ... we DON'T want to build
medical devices at this point, too much red tape, wellness devices are okay."*
