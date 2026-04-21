# Factory methodologies

The factory's process-improvement methodologies of record.
Read once during onboarding so the vocabulary is shared;
cite by name in future factory-improvement discussions.

**Scope:** factory-wide. Any adopter of this factory kit
inherits both methodologies.

**Constraint:** we adopt the practices, not the bureaucracy.
No belt-certification hierarchy, no ISO-9001 theater, no
standup ceremony, no statistical process control charts, no
Kanban tooling layer. Practices that predict failure and
prevent regression earn their place; ceremony that does
not does not.

**Source:**
`memory/user_kanban_six_sigma_process_preference.md` +
`docs/research/kanban-six-sigma-factory-process.md`.

---

## Kanban — visual flow, WIP-limited, pull-based

Kanban is how work *moves* through the factory.

### Practices we apply

| Practice | Factory instance |
|---|---|
| Visualise the work | `docs/BACKLOG.md` (P0-P3 priority lanes); `docs/ROUND-HISTORY.md` (Done ledger) |
| WIP limits | FACTORY-HYGIENE row 37: per-persona cap 3, cross-persona cap 7; architect-bottleneck per GOVERNANCE §11 is the canonical WIP-1 on review |
| Pull, not push | Round-cadence pulls from `BACKLOG.md`; `/loop` dynamic ticks pull the next speculative-work item |
| Continuous delivery | Every round commits + pushes; no big-bang releases |
| Explicit policies | `docs/AGENT-BEST-PRACTICES.md` BP-NN rules, `GOVERNANCE.md` numbered sections, `CLAUDE.md` load-bearing rules |
| Feedback loops | Retrospective audits (FACTORY-HYGIENE rows 35/36); meta-wins log; `/loop` tick cadence |
| Evolve experimentally | `skill-tune-up` ranker + ADR-gated promotion of new BP-NN rules |

### The pull-triggered vs always-on criterion

Kanban's most load-bearing design question for this factory
is **"should this hygiene item be a skill or a checklist
item?"** The criterion:

- **Pull-triggered** (distinct event fires the work):
  likely a **skill** — pre-commit, round-close, absorb-time,
  wake-friction observed.
- **Always-on** (applies to every action): likely a
  **checklist item** or **BP-NN rule** — BP-11
  data-not-directives, idle logging, meta-wins logging,
  WIP limits.

This criterion drives the `scope-hygiene` / `gap-finders`
consolidation decision (see
`docs/research/hygiene-skill-organisation.md`).

### Explicitly rejected

- Belt-certification hierarchy (green/black/master black).
  Status-reverence, not practice.
- Daily standups. The round cadence + `/loop` ticks are
  the inspection rhythm.
- Jira / Trello / LeanKit tooling. `docs/BACKLOG.md` +
  `git` are the visible board.

---

## Six Sigma — DMAIC-structured improvement

Six Sigma is how factory *improvements* are structured.

### DMAIC cycle

| Phase | Factory instance |
|---|---|
| **Define** | BACKLOG proposal + ADR problem-statement stage |
| **Measure** | DORA 2025 metrics + 4 Golden Signals + RED + USE; baseline before any change |
| **Analyze** | `docs/research/meta-wins-log.md` + harsh-critic reviews + spec-zealot / formal-verification-expert routing |
| **Improve** | ADR implementation + round commits |
| **Control** | `docs/FACTORY-HYGIENE.md` cadenced rows + BP-NN rules — the artifacts that prevent regression |

### DMAIC proposal template

Factory-improvement proposals (new hygiene row, new BP-NN
rule, process change) fill the template at
`docs/templates/DMAIC-proposal-template.md` before the ADR
lands. The cognitive cost of filling the template *is* the
Six Sigma discipline.

### Control = FACTORY-HYGIENE row

Every new hygiene row should answer:

- **Measure** — what variance / defect was observed?
- **Analyze** — why is this the right control?
- **Control** — what exactly does the row prevent?

### Aaron's native absorb-time / retrospective split = DMAIC

`memory/user_absorb_time_filter_always_wanted.md` captures
Aaron's preferred split: **forward-looking absorb-time
filter** (catch at ingestion) **+ retrospective
landed-content audit** (measure what slipped). This is
structurally Six Sigma:

- Absorb-time filter = **Control** (prevents variance).
- Retrospective audit = **Measure** (baselines the
  Control's error rate).

The two modes form a feedback loop: retrospective findings
tune the absorb-time filter.

### Explicitly rejected

- Cpk / Cp indices and SPC control charts. Factory defects
  are not continuous numerical measures; they're discrete
  agent-errors / drift events. Qualitative retrospective
  audits fit the data shape.
- Quality Function Deployment (QFD) matrices. Unused;
  would add ceremony without predictive value.
- Yellow/green/black belt roles. Roles in this factory are
  persona-defined, not certification-defined.

---

## How these two fit together

**Kanban governs flow; Six Sigma governs improvement.**

- Kanban moves work through the round-cadence.
- Six Sigma structures the work *of* improving how the
  round-cadence runs.
- Together they form a self-improving loop: Kanban pulls
  the next round; retrospective audit measures what
  slipped; DMAIC proposal fixes the pattern; FACTORY-
  HYGIENE row locks in the fix; Kanban pulls the next
  round.

## References

- `memory/user_kanban_six_sigma_process_preference.md`
- `memory/user_absorb_time_filter_always_wanted.md`
- `docs/research/kanban-six-sigma-factory-process.md`
- `docs/research/hygiene-skill-organisation.md`
- `docs/FACTORY-HYGIENE.md`
- `docs/templates/DMAIC-proposal-template.md`
- `docs/BACKLOG.md`
- `memory/feedback_dora_is_measurement_starting_point.md`
- `memory/reference_dora_2025_reports.md`
- `memory/feedback_meta_wins_tracked_separately.md`
