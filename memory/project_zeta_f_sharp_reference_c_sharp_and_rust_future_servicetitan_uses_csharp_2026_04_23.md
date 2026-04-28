---
name: Zeta's F# is the reference spec for correctness; C# and Rust versions are future; ServiceTitan uses C# backend (zero F#) so ST-facing artifacts should consider C# to reduce friction
description: Aaron's 2026-04-23 language-context disclosure. F# is chosen for Zeta because "it looks a lot more like math than C#" — theorems are easier to express and prove. F# is the reference / spec. C# and possibly Rust versions of the Zeta database are anticipated. ServiceTitan has zero F# and uses C# for most backend work; F# is not automatically disqualifying at ST but requires good argumentation that the factory's own "looks like math" reason is NOT. ST-facing demo artifacts should consider C# to reduce adoption friction.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Zeta language posture + ServiceTitan C# context

## Verbatim (2026-04-23)

> also service titan uses c# for a lot of thier backend, they
> have 0 f# but whould not be opposed to it based on good
> arumentation, this is not good argumentatino for service
> titan, but between me and you i chose f# becace it looks a
> lot more like math than c# so our theorms would be easeir
> to write down and prove, i do think we will have a c#
> version and maybe even a rush version of zeta dtabase in the
> future, not just f# but f# is the reference, the spec, the
> one that is easy to validate the correctness.

## Rule

**F# is the reference implementation.** Theorems are easier to
write down and prove in F# because F# code looks closer to
math than C# code. The F# implementation is the spec by
behaviour — when another language implementation of Zeta
exists, F# is the one that answers "is the algebra correct?"

**C# and possibly Rust versions are anticipated.** Not shipped,
not committed-to-round, but on the long horizon. The Zeta
algebra is language-agnostic; alternative implementations can
exist once the F# reference is stable and well-tested.

**Aaron's math-proximity reason is for between-us use only.**
Aaron explicitly says: *"this is not good argumentatino for
service titan."* When pitching F# to ST audiences, the
math-proximity reason does not land — it would read as
developer-aesthetics rather than business-value. Good ST
argumentation for F# would be around .NET stack compatibility,
AOT readiness, interop with C#, or other pragmatic axes. Even
then, it is optional.

**ServiceTitan context is C# with zero F#.** *"service titan
uses c# for a lot of thier backend, they have 0 f#."* They
are not hostile to F# — *"whould not be opposed to it based on
good arumentation"* — but F# is a friction for them. F#
requires some justification; C# has zero friction.

## Implications for the factory's output

The factory's own reference implementation stays F# —
non-negotiable, per the "F# is the reference, the spec"
framing. But factory OUTPUT (samples, demos, integration
artifacts) can be in the language that minimises friction for
the target audience.

This means:

- **Internal factory work:** F# is the default. Zeta library,
  tests, verification, algebraic core. No change.
- **Public-API surface:** F# with a C# façade (already done —
  see `src/Core.CSharp/`). No change.
- **ServiceTitan-facing sample code:** C# reduces adoption
  friction. The ST factory-demo would land better in C# than
  F# for the audience's read-and-adopt workflow.
- **ServiceTitan-facing demo runtime:** language-neutral (the
  frontend is some UI, the backend is a JSON API; both can be
  C# or F# and ST won't see a difference at runtime).

## How to apply — the just-built F# API

`samples/ServiceTitanFactoryApi/` (PR #146) was built in F# this
session. Given the ST-uses-C# context:

- **For the RUNTIME of the demo** — F# is fine. ST evaluates the
  running demo by clicking through, not by reading the F# code.
- **For ST adoption workflow** — if ST engineers want to READ
  the API code to understand what the factory produces, F#
  introduces a friction they don't have to tolerate. A C#
  companion (or replacement) reduces that friction to zero.

Right move: leave the F# API as-is (it's a working artifact,
not wasted work) and add a **C# companion** in a follow-up PR.
Both land as factory-output examples. The demo can run either
one. ST engineers evaluating adoption see a language they
already know. Factory agents evaluating the algebra see the
F# reference.

This **also demonstrates a factory capability**: "the factory
produced both F# and C# versions of the same API from the same
spec." That's a mini-pitch moment for the factory itself.

## What this is NOT

- Not a directive to rewrite existing F# code in C#. Existing
  F# code stays F#. The Zeta library's F# reference is the
  spec.
- Not a claim that ST will reject F# — they won't, but F#
  costs them something C# doesn't, and the demo should
  minimise that cost.
- Not authorisation to market to ST on the basis of C#
  language choice. "We made it in C# because you like C#" is
  weak. "The factory can produce code in your stack" is
  stronger.
- Not a commitment to a full C# port of Zeta. The future-C#
  and future-Rust versions are Aaron's long-horizon plan, not
  a round-commitment.
- Not breaking the "F# is the reference" rule. Alternative-
  language ports must match the F# reference's behaviour; the
  reference is authoritative on "what Zeta means."
- Not applicable to Aurora. Aurora's implementation language
  is a separate decision per Amara's transfer report
  guidance.

## Composes with

- `memory/feedback_servicetitan_demo_sells_software_factory_not_zeta_database_2026_04_23.md`
  (ST-facing demo framing — language choice is part of this)
- `memory/project_aaron_servicetitan_crm_team_role_demo_scope_narrowing_2026_04_22.md`
  (ST context)
- `docs/plans/servicetitan-crm-ui-scope.md` (scope doc —
  should reflect the C#-companion plan)
- `docs/NAMING.md` / `docs/ARCHITECTURE.md` (Zeta architecture
  docs — F# reference framing already implicit there)
