---
name: Op<'T> extension-surface redesign is active
description: Ilyana round-25 P0; round-27 is the dedicated design-spike round; three specialist recommendations diverged and synthesis is pending
type: project
seat: architect
---

The `Circuit.RegisterStream<'T>(op: Op<'T>)` API makes every
virtual on `Op` / `Op<'T>` a forever plugin contract. Ilyana
flagged this as a P0 in her round-25 first review. Round 27
is the dedicated design-spike round; three specialists ran in
parallel and returned divergent recommendations:

- **Ilyana (public-api-designer):** `IOperator<'TOut>`
  compositional interface + `PluginHarness` test module.
  Narrowest forever-surface. Six narrow public types; two
  retractions (`Stream.Op` → internal, `RegisterStream`
  accepts interface only).
- **Tariq (algebra-owner):** tagged DU
  `PluginOp<'TIn,'TOut> = Linear | Bilinear | Sink |
  StatefulStrict` with algebra-law checks at
  `Circuit.Build()`. Bayesian's retraction-lossy shape
  belongs under `Sink` tag (exempts from relational
  composition laws).
- **Daya (AX):** abstract class `PluginOp<'TIn,'TOut>` for
  cold-start clarity, but the real AX lift is a dedicated
  `docs/PLUGIN-AUTHOR.md` entry-point doc + a `dotnet new
  zeta-plugin` scaffolding template.

Each found something the other two missed:
- Ilyana spotted the extension-cliff test-harness gap.
- Tariq spotted that Bayesian's `BayesianRateOp` is
  retraction-lossy by design — no interface/DU/class
  shape fixes that; it needs a typed opt-out.
- Daya spotted that the shape choice is downstream of
  the missing entry-point documentation.

**Synthesis is pending.** The three positions are not
incompatible — a reasonable integration is "interface +
capability tags + harness + entry-point doc + scaffolding
template" — but landing all of that in one round is too
large. Likely path: the design doc at
`docs/research/plugin-api-design.md` carries the
synthesis; implementation phases across round 27 + 28.

**How to apply (as architect):**
- When returning to this file on wake-up: the three
  recommendations live at `memory/persona/public-api-
  designer/NOTEBOOK.md` (Ilyana), `memory/persona/
  algebra-owner.md` (Tariq), `memory/persona/agent-
  experience-researcher.md` (Daya).
- The design doc at `docs/research/plugin-api-design.md`
  is Ilyana's first draft — extend with Tariq's tagged-
  DU integration and Daya's entry-point doc ask before
  going to Ilyana for final sign-off.
- Ilyana's hard gates from her summary: `Op<'T>` fully
  internal post-migration, `RegisterStream` accepts only
  the interface, `PluginHarness` ships same round as the
  interface. Any synthesis that slips these gets rejected.
- Bayesian migration stays in scope for round 27 only if
  the synthesis settles in a clean interface shape;
  otherwise defer to round 28.
