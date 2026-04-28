# Rule of Balance — the stabilization discipline

**Load-bearing factory discipline.** Codifies how Zeta
stays in operational resonance once past bootstrap.

> *Achieving resonance = bootstrap (past).*
> *Stabilizing the resonance = balance (ongoing).*

## Scope

This doc is the primary reference for Zeta's
counterweight-filing discipline. It consolidates the
operational practice derived from the Otto-264 series
of memory files under `memory/`.

## The rule

**Every found mistake — if it could easily happen
again — triggers an immediate counterweight: a
balancing backlog row, structural fix, rule, or
discipline that prevents or detects-and-repairs the
same class of mistake.**

**The ship is kept level by continuously filing
counterweights, not by avoiding mistakes.**

Achieving resonance was a one-time bootstrap. We are
past that. Staying in resonance is an ongoing
discipline — balance — carried by both humans and
agents.

## Counterweight variants

Pick per mistake-class:

### A. Prevent recurrence

Gate at the boundary — make the mistake impossible
or much harder.

- CI lint rules
- Pre-commit hooks
- Type-system constraints
- Required-check gates
- Subagent-prompt constraints
- Mandatory-review rules

**Caveat**: prevention might not be perfect. Rules
have holes; gates can be bypassed; subagents may
drift past constraints.

### B. Detect and repair on cadence

Sweep after the fact — find the mistake AFTER it
lands and correct it.

- Cadenced audits
- Drift-detection scripts
- FACTORY-HYGIENE rows firing every N rounds
- Standing reconciliation tools
- Clean-default smell detection (Otto-257)

Preferred when prevention is technically expensive,
incomplete by nature, or would block legitimate
flow.

### C. Both (defense-in-depth)

Layer prevention + detection. Preferred for
CRITICAL mistake-classes where a single recurrence
is costly.

- Gate catches most
- Audit catches what gate missed
- Correction discipline feeds back to tighten the
  gate

## Picking the right variant

| Cost of one miss | Prevention cost | Recommended |
|---|---|---|
| Low | Low | A (rule) |
| Low | High | B (cadenced audit) |
| High (data loss / security breach) | Low | C (both) |
| High | High | C (both; accept imperfect prevention, robust audit) |
| Medium | Low | A, escalate to C if breached |
| Medium | Medium | B, escalate to C if breached |

**Default**: Variant A (rule-level counterweight is
cheapest). Observe if it holds. Escalate to B or C
if drift continues.

## Timing — in-phase matters

Counterweights must land **in-phase with the
perturbation** (Otto-264 operational-resonance math):

- Any perturbation to the ship (mistake / drift /
  scale-change) induces oscillation — the tilt.
- Without counterweighting, amplitude grows each
  cycle → capsize.
- **In-phase** counterweight (filed promptly after
  detection) dampens amplitude each cycle.
- **Out-of-phase** (filed late, or for wrong class)
  can amplify rather than dampen.

File counterweights IMMEDIATELY after detection.
"Defer until later" = out-of-phase response.

## Never take shortcuts

Super-critical. Counterweights are the stabilization
layer for the entire factory. A shortcut in a
counterweight compounds into systemic instability.

Tempting shortcuts and why each is worse than no
counterweight at all:

| Shortcut | Why worse |
|---|---|
| Vague rule ("be careful with X") | Not enforceable; creates false security |
| Wrong-scope counter (rule when tool needed) | Drift continues past rule; file tool instead |
| One-off workaround ("mask this one instance") | Original class still active; file structural fix |
| Not composed with prior counters | Conflicts / redundancy / noise |
| Filed late (out-of-phase) | Amplifies instead of dampens |
| No maintenance plan | Rule bit-rots into drift itself |
| Unclear trigger condition | Can't tell when it applies |
| No failure mode defined | Can't detect when counter is bypassed |
| "Good enough for this week" | Compounds over weeks |

The right long-term thing is always preferred, even
if more expensive in the moment. Counterweight
quality compounds.

### What "right long-term thing" looks like

1. **Specific trigger condition** — exactly when this
   applies, not "generally when X"
2. **Composed with prior counters** — cite which
   existing rules this joins; flag conflicts if any
3. **Enforceable** — stated at the right scope (memory
   rule / BACKLOG row / tool / CI gate)
4. **Measurable** — how do you know it's working?
5. **Maintenance-ready** — when should this be
   rechecked?
6. **Failure mode documented** — what happens if
   this counter is bypassed?

If the counterweight can't be done right in the
moment, file a BACKLOG row naming the required work
AND a placeholder rule that prevents the specific
case. The BACKLOG row owes the structural fix. Never
ship the cheap rule as the permanent counter.

## Counterweights need maintenance

Counterweights are not fire-and-forget. Once filed,
they need periodic re-check and possibly adjustment.

### Why maintenance is needed

- The original mistake-class morphs as tools / scale
  / context change
- Multiple counterweights can start interacting —
  reinforcing or conflicting
- Factory scale changes; the original framing may no
  longer fit
- New tools / platforms / harnesses emerge, changing
  the perturbation landscape
- The counterweight itself can become drift — a rule
  that was load-bearing last year may be obsolete
  but still enforced

### Maintenance cadence

- **Newly-filed** (within 5-10 ticks of filing):
  recheck whether it's landing correctly
- **Stabilized** (landed, effective, no observable
  drift for 5+ ticks): recheck sparsely — every
  20-50 ticks or on-demand when drift observed
- **Long-working** (effective for many rounds):
  occasional spot-checks as audit-against-complacency

### What to check on maintenance

- Is the counterweight still triggered by the class
  it was filed for? (Not bypassed, not dead code.)
- Is the class still the same? (Or has it morphed?)
- Are there new sub-classes the counterweight doesn't
  catch? (File additional counterweights for those.)
- Is the counterweight producing false positives?
  (Signal-to-noise degradation means refinement.)
- Is another counterweight making this one redundant?
  (Retire the redundant one.)

## Three layers of discipline

Each with its own cadence:

1. **Bootstrap** — past (one-time; Zeta is past
   bootstrap).
2. **Balance** — every perturbation (continuous;
   counterweights filed in-phase).
3. **Counterweight maintenance** — periodic (slow;
   the meta-cadence keeping counterweights
   themselves tuned).

## Operational resonance — the emergent property

Balance produces **operational resonance**: the
emergent active-stability property of a factory that
counterweights correctly.

Not "doesn't fall over." Actively stable — like a
tuned oscillator where disturbances get dampened and
the system returns to its operating point without
drift.

The factory feels stable over long runs despite many
observable mistakes because mistakes are expected
perturbations and counterweights are the dampening.
Ship rocks, doesn't capsize.

## How this composes

Rule of Balance is the operational practice behind:

- **Every factory-discipline memory** under
  `memory/feedback_*_otto_*` — each mistake-class
  Otto-N captures IS a counterweight filed per this
  discipline
- **Gitnative corpus** (Otto-250/251/261) — the
  counterweight-filing record IS training signal
- **Bayesian teaching curriculum** (Otto-267/269) —
  counterweights are curriculum entries; composition
  edges are the BP message-passing graph
- **Word-discipline** (Otto-268) — semantic
  counterweight to drift
- **DST everywhere** (Otto-272) — deterministic
  stabilization process makes counterweight-filing
  reproducible
- **Progressive adoption** (Otto-274) — adopters
  pick up Rule of Balance at Level 3 of the staircase

## Reference memories

The discipline crystallized across multiple Otto-N
memory files. See for deeper context:

- `memory/feedback_rule_of_balance_find_mistake_backlog_counterweight_balance_the_ship_otto_264_2026_04_24.md`
- `memory/feedback_dst_ify_the_stabilization_process_counterweight_discipline_itself_deterministic_otto_272_2026_04_24.md`
- `memory/feedback_dont_assume_subagent_failed_mid_execution_wait_for_completion_signal_otto_271_2026_04_24.md`
- Counterweight examples: Otto-229 (append-only),
  Otto-232 (bulk-close), Otto-236 (reply+resolve),
  Otto-257 (clean-default smell), Otto-258
  (auto-format), Otto-259 (verify-destructive),
  Otto-260 (F#/C# preservation), Otto-265 (merge
  queue).
