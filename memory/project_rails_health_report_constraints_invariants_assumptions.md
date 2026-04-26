---
name: Rails health report — aggregate across all project areas showing assumptions / constraints / invariants and how well they're holding
description: Aaron's forward-looking direction (2026-04-20, no rush). Because Zeta encodes invariants / constraints across many substrates (TLA+, Lean, Z3, FsCheck, Alloy, types, eslint, GOVERNANCE.md, ADRs, expert-skill BP-NN rules), we should eventually be able to emit a single "rails health" report — a health dashboard showing which rails exist, which are currently intact, and where drift is starting. A consumer of the software factory should be able to look at this report and quickly know whether things are going as expected. Includes a new category: ASSUMPTIONS (today buried in ADR prose; promote to first-class).
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**PRIORITY — low, moves slowly:** Aaron confirmed
2026-04-20: *"against this project wide invariant
system is low priority and can move slowly there is
not a rush here"*. Do not sprint on this. Do not
sequence rounds around it. Do capture opportunistic
forward motion as ADRs land (each new ADR can sketch
its own assumptions in registry-compatible form, no
cost to the round). Backlog tier is **P3**. The
rails *registry* is the low-priority construct —
the individual rules it would contain (latest-
version, ASCII-clean, etc.) are active today and do
not wait on the registry.

**The idea** (Aaron 2026-04-20, pasted intact):

> *"what's cool about having the constraints and
> invariants evewhere it should be easy to run a
> report eventually across all areas of our project
> and see the assumptions (we should probably encode
> these too in case they end up being wrong)
> constrainsts invariants as basically the rails of
> the system and how good they are holding and
> moving things forward it would be baisclly like a
> health report for everyitng, no rush on this but
> could build high confidence in the future of
> anyone using the software factory that things are
> going the way they expect, I'm trying to think of
> my user experience and how i know easying and
> quickly and things are going as expected and our
> invariants and asumptions are not causing things
> to go off the rails"*

**The framing — rails, not tests:**

Constraints / invariants / assumptions are "the rails
of the system." A rail is a structural element the
system rides on. Rails don't pass or fail like tests
do — they're intact, under load, or visibly bent. The
right UI is a *health report*, not a red/green board.

**Three categories — one new:**

| category | today's encoding | where it lives | first-class? |
|----------|------------------|----------------|--------------|
| **Invariants** | TLA+ specs, Lean proofs, Z3 SMT, FsCheck properties, Alloy models, runtime `assert` / `Debug.Assert` | `tools/tla/specs/**`, `tools/lean4/**`, `tools/Z3Verify/**`, FsCheck test files | yes — tally.ts already counts |
| **Constraints** | F# discriminated unions, C# nullable ref types, `TreatWarningsAsErrors`, tsconfig strict flags, eslint rules, `GOVERNANCE.md §N`, OpenSpec behaviour specs | type system + `GOVERNANCE.md` + `openspec/specs/**` + `eslint.config.ts` | partial — no cross-substrate view |
| **Assumptions** | ADR prose in `docs/DECISIONS/**`, inline comments, README narrative, expert-skill `Why:` lines in memory | prose only, not machine-readable | **no — new category to add** |

The new work is promoting assumptions to first-class:
each one gets a tag (id), a statement ("we assume
bun runs `.ts` directly without JS emit"), an owner
(who signs up to revisit when it breaks), a probe
(what query or check would falsify it?), and a
revisit trigger (calendar cadence or event
condition). The watchlist section already written
into `docs/DECISIONS/2026-04-20-tools-scripting-language.md`
is exactly this shape — it was called a "watchlist"
but it is really an assumption encoding.

**What the report looks like — sketch:**

```
# Rails Health Report — round N

## Inventory (substrates)
Total rails registered: 847
  Invariants:   312  (formal: 127 / runtime: 185)
  Constraints:  426  (types: 205 / rules: 144 / specs: 77)
  Assumptions:  109  (encoded: 34 / prose-only: 75)

## Intact vs degraded vs unknown
Intact (last-checked < 7d + passing):   701  (82.8%)
Degraded (check behind schedule):        89  (10.5%)
Unknown (no check defined):              57  (6.7%)

## Top concerns this round
1. AssumptionID ADR-2026-04-20-TOOLS-A3 — "bun runs .ts
   without JS emit" — never probed since landing.
2. Invariant Delta/retraction-closure — last Lean check
   was 14 days ago; rail is load-bearing.
3. Constraint tsconfig erasableSyntaxOnly — no test
   that would break if someone disabled it.

## Drift indicators
- 3 invariants loosened in the last 30 rounds
  (exact list, with reasons from ADRs).
- 2 assumptions promoted to constraints
  (strengthened — good direction).
- 1 constraint retired (see WONT-DO.md).
```

**Existing toeholds to build on:**

- **`tools/invariant-substrates/tally.ts`** —
  already counts substrate usage. This is the
  *inventory* half.
- **`docs/INVARIANT-SUBSTRATES.md`** — narrative
  glue explaining what each substrate is for.
- **`docs/AGENT-BEST-PRACTICES.md`** BP-NN rules —
  the skill-layer invariants. Already numbered and
  stable.
- **`docs/CONFLICT-RESOLUTION.md`** — the conference
  protocol that routes to the right invariant
  category.
- **The DORA 2025 + Four Golden Signals + RED + USE
  framing** (memory:
  `feedback_runtime_observability_starting_points.md`,
  `feedback_dora_is_measurement_starting_point.md`)
  — the *runtime* health half of the measurement
  spine. Rails health is the *structural* half.
  Both land in the same dashboard.
- **The verification-drift-auditor skill** (memory:
  `project_verification_drift_auditor.md`) — audits
  drift between Lean/TLA+/Z3/FsCheck and paper
  claims. This IS rails-health for the formal
  invariants sub-set. Generalize.
- **`.claude/skills/skill-tune-up/SKILL.md`** —
  tracks best-practice drift. This IS rails-health
  for the skill-layer constraints sub-set.
- **`.claude/skills/verification-drift-auditor/`** —
  the nascent general-purpose rails-health skill.

**What needs to happen — rough shape:**

1. **Assumption encoding DSL.** Minimal markdown
   frontmatter for each assumption: id, statement,
   owner, probe, revisit, confidence (low/med/high).
   Lives in `docs/ASSUMPTIONS.md` or
   `docs/assumptions/*.md`. Rides the same format
   as the skill BP-NN rules.
2. **Assumption sweep of existing ADRs.** Every
   ADR under `docs/DECISIONS/**` gets a pass
   extracting implicit assumptions into the
   encoding DSL. The bun+TS ADR already has a
   watchlist section — lowest-friction pilot.
3. **Unified tally** — extend
   `tools/invariant-substrates/tally.ts` (or
   add a sibling) to count all three categories
   across all substrates.
4. **Health check** — for each rail, a "still
   intact?" check (probe). For formal invariants,
   the probe is "did this prove re-verify in the
   last N rounds?" For constraints, "does this
   rule still fire?" For assumptions, "has the
   revisit-trigger fired?"
5. **Report generator** — emit the inventory +
   health + drift + concerns output shown in the
   sketch above. Could be a markdown file
   regenerated each round into
   `docs/RAILS-HEALTH.md`, OR a UI widget when
   Zeta has a UI (per memory:
   `project_ui_canonical_reference_bun_ts_backend_cutting_edge_asymmetry.md`).

**The user experience Aaron is solving for:**

> *"how i know easying and quickly and things are
> going as expected and our invariants and
> asumptions are not causing things to go off the
> rails"*

His UX as maintainer is the first customer, but the
report is a **factory-level product feature** — any
future consumer of a Zeta-built system should be
able to glance at its rails-health report and know
whether the rails are holding. This is the
"consumer trust" half of factory reuse (memory:
`project_factory_reuse_beyond_zeta_constraint.md`).

**How to apply:**

- **No immediate round-scope.** Aaron said "no rush."
  Don't try to ship a dashboard this round. Do
  capture assumption-encoding opportunities as they
  come up (the bun+TS ADR is a natural first sample).
- **When writing new ADRs**, explicitly section
  out "Assumptions" with the minimal DSL (id,
  statement, probe, revisit). This back-fills the
  corpus without a dedicated round.
- **When extending `tally.ts`**, leave a hook for
  counting assumptions alongside invariants /
  constraints.
- **Treat `docs/RAILS-HEALTH.md` as a future target,
  not a deliverable** — mention it in the BACKLOG
  at P3.
- **Don't force-retrofit.** If an ADR's assumption
  is genuinely "we believe this is right; no cheap
  probe exists today" — encode that truthfully
  (probe: "none defined"). Honesty beats false
  confidence.

**Sibling threads:**

- `feedback_runtime_observability_starting_points.md`
  — RED + USE + Four Golden Signals for the runtime
  half.
- `feedback_dora_is_measurement_starting_point.md`
  — DORA 2025 for the delivery-outcome half.
- `project_factory_reuse_beyond_zeta_constraint.md`
  — this is the generic-by-default case in action.
- `user_invariant_based_programming_in_head.md`
  — the premise that invariants-in-head are real
  and externalization is the project job.
- `project_vibe_citation_to_auditable_graph_first_class.md`
  — same elevation pattern (prose → structured
  graph → audit).
- `project_verification_drift_auditor.md` — the
  formal-invariants-only specialization of this
  pattern; the generalization is rails-health.
