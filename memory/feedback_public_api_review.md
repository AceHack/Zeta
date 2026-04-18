---
name: Public API changes go through the public-api-designer
description: Every internal→public flip, new public member, signature change, or member removal on Zeta's published libraries requires public-api-designer review before landing
type: feedback
originSessionId: 2ac0e518-3eeb-45c2-a5dc-da0e168fe9c4
---
Every change that affects the *public* surface of one of
Zeta's three published libraries (`Zeta.Core`,
`Zeta.Core.CSharp`, `Zeta.Bayesian`) goes through the
public-api-designer (persona: Ilyana) before it lands. This
includes:

- `internal` / `private` → `public` flips
- New public types, modules, methods, properties, fields,
  extension methods
- Signature changes on existing public members
- Removal of public members
- Namespace / assembly-name changes on published libraries
- `[<Obsolete>]` / `[Obsolete]` application or removal

Not in scope: tests, benchmarks, sample code, internal-only
refactors, doc-only changes.

**Why:** Aaron round-25, 2026-04-18, after watching two
`internal → public` flips (`Stream<'T>.Op`,
`Circuit.RegisterStream`) land in a single session without
any design review:
> "it scared me how easily you flipped those internal
> methods public, I don't even know if that was a good
> change, you got to be very very very careful about what
> we make public, it should have gone through a review with
> the public api design agent."

Every public member is a contract Zeta commits to maintain
for consumers we may not yet have. Breaking it later costs
everyone — docs, migration guides, reputation. Landing the
right shape the first time is cheaper than regret.

**How to apply:**
- Before flipping visibility or adding public surface, fill
  out the review template in
  `.claude/skills/public-api-designer/SKILL.md` (why public?
  alternative considered? commitment cost? test coverage?).
- Dispatch Ilyana as a subagent with the template filled in;
  get her verdict (ACCEPT / ACCEPT_WITH_CONDITIONS / REJECT).
- On REJECT, apply the proposed alternative or escalate to
  the human maintainer. Do not ship a rejected flip.
- On ACCEPT_WITH_CONDITIONS, land the change with the
  conditions applied in the same turn.
- Her verdicts log to `memory/persona/ilyana.md`
  (newest-first). The architect's integrator's-notes go on
  the same entry so the history of public-surface decisions
  is traceable.
- `InternalsVisibleTo` is not a workaround for skipping the
  review. "The test needs it" is a legitimate reason to add
  to the InternalsVisibleTo list (tests / benchmarks / the
  tightly-coupled C# shim only, per GOVERNANCE.md §19); it is
  not a reason to make a production member public.
- The rule is stricter once v1 ships. Pre-v1 breaking changes
  cost docs-and-refactor; post-v1 they cost consumer trust.
  Use the pre-v1 window to land the right shape, not to ship
  wrong ones cheaply.
