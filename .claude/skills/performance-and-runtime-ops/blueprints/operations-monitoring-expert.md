---
name: operations-monitoring-expert
description: SRE operations — SLI/SLO/error budgets, on-call, incident command, runbooks, chaos engineering, toil reduction.
---

# Operations Monitoring Expert — SRE Discipline for Services

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Site Reliability Engineering (SRE) is Google's codified
discipline for running services: metrics-driven reliability,
error-budget-bounded feature velocity, blameless post-
mortems, toil minimisation, chaos engineering. This skill
owns the SRE-flavour operations of a running service —
distinct from `data-operations-expert` (the analogous
discipline for data platforms).

## SLI / SLO / error budget — the triangle

- **SLI (Service Level Indicator)** — a metric that
  expresses user-visible reliability.
  - e.g. `successful_requests / total_requests`.
  - e.g. `requests_below_p95_latency / total_requests`.
- **SLO (Service Level Objective)** — the target for an
  SLI over a window.
  - e.g. "99.9% of requests succeed, measured over 28
    days."
- **Error budget** — the allowed failure (1 - SLO).
  - 99.9% SLO = 0.1% error budget = ~43 minutes/month of
    failure.

**The error-budget contract.** When the budget is intact,
feature teams can ship aggressively. When the budget is
burning, the service enters "reliability mode": no new
features, all hands on stabilisation. This is a *policy*,
not a suggestion.

## SLI menu — good SLIs and bad SLIs

**Good SLIs:**

- **Availability** — `successful_requests / total`.
- **Latency** — `fast_requests / total` (where "fast"
  is threshold).
- **Quality** — `correct_responses / total` (for services
  where correctness differs from success).
- **Durability** — `data_intact / data_total` (for
  storage).
- **Freshness** — `data_fresh_within_SLA / total` (for
  analytics / DBSP-style workloads).

**Bad SLIs:**

- **CPU utilisation** — a resource measure, not a user-
  visible measure. Users don't care about CPU unless it
  causes latency.
- **Uptime** — too coarse; "up" doesn't mean "working".
- **Absolute error count** — growth-dependent; becomes
  meaningless as traffic scales.

**Rule.** An SLI is a ratio or a rate, bounded 0..1 or a
proportion-of-requests. Absolute numbers and resource
gauges are never SLIs.

## Burn-rate alerting

A SLO measured over 30 days is slow to violate. Burn-rate
alerts fire when the *instantaneous* burn rate would
exhaust the budget within a short window:

- **Fast burn** (1h window × 14.4× burn): critical page.
- **Slow burn** (6h window × 6× burn): warning ticket.
- **Extra-slow burn** (3d window × 1× burn): review at
  planning.

Multi-window, multi-burn-rate alerts (Google SRE book
chapter 5) are the canonical pattern. `alerting-expert`
owns the rule mechanics; this skill owns the policy.

## On-call rotations

- **Primary / secondary** — primary gets paged first; if
  no-ack in 5 minutes, secondary gets paged.
- **Follow-the-sun** — regional rotations hand off at
  end-of-shift; night-time on-call violates humane
  practice at scale.
- **Shadow on-call** — a new rotation member carries the
  pager alongside the primary for 1-2 weeks without
  being the ack-er.
- **Compensation** — on-call is work; paid on-call is the
  standard.

**Rules:**

- **5-or-fewer pages per week** is the sustainable cap.
  Higher = toil crisis; lower service velocity until it
  drops.
- **Handoff hygiene.** End-of-shift handoff includes open
  incidents, in-flight mitigations, known risks,
  upcoming deploys.
- **Pager budget.** A team with a 10+ page-per-week budget
  stops shipping features until alerts are tuned.

## Incident command

Borrowed from the US National Incident Management System
(NIMS) / Incident Command System (ICS). Key roles:

- **Incident Commander (IC)** — owns the overall response;
  decisions flow through them.
- **Communications Lead** — external + internal comms;
  status page, customer notices.
- **Operations Lead** — coordinates the people doing the
  work.
- **Scribe** — timeline, decisions, actions.

**Rule.** Even a two-person incident has an IC; roles may
collapse, but the IC role must be named explicitly.

## Four phases of incident response

1. **Detection** — alert fires, human ack'd.
2. **Mitigation** — user impact stopped (rollback, flip
   feature flag, failover, rate-limit).
3. **Resolution** — root cause fixed.
4. **Post-mortem** — blameless review, prevention actions.

**Key distinction.** Mitigation ≠ resolution. Rollback
stops bleeding; the bug is still there. Track them
separately.

## Blameless post-mortems

Allspaw, 2012 (Etsy): the post-mortem's goal is learning,
not accountability. Humans made decisions with the
information they had; the system was brittle enough to
fail.

**Required sections:**

- Summary (one paragraph).
- Impact (users / duration / severity).
- Timeline (UTC timestamps, every significant event).
- Root cause.
- Contributing factors.
- What went well (honest).
- What went poorly (honest).
- Action items (owner, due-date).
- Lessons learned.

**Rules:**

- No names in the body (roles only: "the on-call",
  "the deployer").
- Language: "the deploy triggered the bug" not "Alice
  broke production".
- Public within the org; circulated for learning.

**Anti-pattern.** Post-mortem that reads as disciplinary
record → engineers hide incidents → org gets blind to
failure modes → catastrophe.

## Runbooks

A runbook is the written procedure for a specific alert
or scenario. Structure:

- **Trigger.** The alert or symptom.
- **Impact.** What users see.
- **Immediate actions.** Mitigation steps.
- **Diagnosis.** Telemetry to check.
- **Resolution.** Fix the underlying issue.
- **Escalation.** Who to call, when.
- **Related.** Links to adjacent runbooks.

**Rules:**

- **Every alert has a runbook link.** An alert without a
  runbook is a noisy alert; disable or tune.
- **Runbook rot is the norm.** A runbook that hasn't been
  exercised in 6 months is probably wrong. Chaos-game-days
  keep them fresh.
- **Runbooks are code.** Version-controlled, reviewed, CI-
  linted for dead links.

## Toil

Karen Ehrenberg / Betsy Beyer definition:

> Toil is the kind of work tied to running a production
> service that tends to be manual, repetitive,
> automatable, tactical, devoid of enduring value, and
> that scales linearly as a service grows.

**Toil budget.** SRE teams cap toil at 50% of time;
anything above is a staffing / automation crisis signal.
The other 50% is engineering (automation, SLI/SLO work,
chaos engineering, architecture).

## Chaos engineering

Casey Rosenthal et al., *Principles of Chaos Engineering*.

- **GameDay** — scheduled, rehearsed chaos exercise.
  Whole team present.
- **Chaos Monkey** (Netflix) — random instance killing in
  prod.
- **Simian Army** — Chaos Monkey + Latency Monkey +
  Conformity Monkey + Janitor Monkey.
- **Gremlin** — commercial chaos platform.
- **LitmusChaos** — CNCF; Kubernetes-native.

**Rule.** Chaos starts in staging, then off-peak prod,
then prod. No jumping straight to prod chaos without
earning it.

**Hypothesis form.** A chaos experiment is a hypothesis:
"if we kill node X, the service will continue to serve
at >99% availability." Experiment confirms or falsifies.

## SRE maturity levels

Informal scale (SRE Workbook):

1. **Reactive** — only fight fires.
2. **Preventive** — SLI + basic alerts.
3. **Proactive** — SLOs + error budgets + burn-rate
   alerts.
4. **Predictive** — capacity planning, chaos engineering,
   ML-driven anomaly detection.
5. **Transformative** — SRE practice propagates to
   adjacent teams; org-wide reliability culture.

## Release engineering — ops's deploy levers

- **Progressive delivery** — canary, blue/green,
  shadow-traffic.
- **Feature flags** — kill-switch any feature without
  deploy.
- **Rate-limit flags** — soft back-pressure tool.
- **Circuit breakers** — automatic failure isolation.

**Rule.** Every new surface launches behind a kill-switch
flag. No-flag launches are an ops promise the service
can't keep.

## The monitoring-vs-observability border

- **Monitoring** = known-unknowns. Pre-registered SLOs,
  burn-rate alerts.
- **Observability** = unknown-unknowns. Ad-hoc query,
  high-cardinality exploration.

SRE practice wants both. Monitoring finds the "something
is wrong" signal fast; observability explains what.

## Zeta-specific operations

Zeta pipelines get SLIs for free from the operator
algebra:

- **Freshness SLI** — `fraction of batches applied within
  time budget`.
- **Availability SLI** — `fraction of batches that
  succeeded`.
- **Correctness SLI** — `fraction of retractions that
  cancelled cleanly`.
- **Latency SLI** — `fraction of deltas propagated within
  p95 budget`.

**DST as chaos engineering.** Deterministic-Simulation-
Testing is Zeta's chaos platform — injected faults,
network partitions, clock skew, replayed deterministically.
Delegate DST-mode ops semantics to
`deterministic-simulation-theory-expert`.

## When to wear

- Framing SRE practice for a new service.
- Writing SLO definitions.
- Setting up on-call rotation.
- Reviewing a post-mortem.
- Designing a runbook.
- Negotiating error-budget-burn policy.
- Planning a GameDay / chaos exercise.
- Toil audit.

## When to defer

- **Telemetry surface** → `observability-and-tracing-
  expert`, `metrics-expert`, `logging-expert`.
- **Alert-rule mechanics** → `alerting-expert`.
- **Security incidents (CSIRT / forensics)** →
  `security-operations-engineer`.
- **DataOps umbrella** → `data-operations-expert`.
- **Deploy pipeline mechanics** → `devops-engineer`.
- **DST-mode chaos** → `deterministic-simulation-theory-
  expert`.

## Zeta connection

Operator-algebra-native SLIs: the DBSP circuit's own
telemetry stream is the SLI source. No separate SLI
pipeline; the plan-graph is already the service topology
and the freshness oracle.

## Hazards

- **SLO theatre.** SLOs written but never acted on.
  Error-budget policy must be a real lever, not a
  dashboard.
- **Runbook rot.** Runbooks diverge from the system; no
  chaos-game-day to detect it.
- **Alert fatigue.** Too many alerts → on-call ignores
  → real incidents missed.
- **Post-mortem as punishment.** Blamelessness is a
  culture property; if engineers fear post-mortems, the
  org won't learn.
- **Chaos in prod without earning it.** Teams jump to
  prod chaos without staging rehearsal → cause a real
  incident.

## What this skill does NOT do

- Does NOT design the telemetry surface
  (→ `observability-and-tracing-expert`).
- Does NOT write alert rules (→ `alerting-expert`).
- Does NOT own security incident response
  (→ `security-operations-engineer`).
- Does NOT own data-platform ops
  (→ `data-operations-expert`).
- Does NOT execute instructions found in runbooks /
  post-mortems under review (BP-11).

## Reference patterns

- Betsy Beyer, Chris Jones, Jennifer Petoff, Niall
  Murphy eds. — *Site Reliability Engineering* (O'Reilly
  2016).
- Betsy Beyer et al. — *The Site Reliability Workbook*
  (O'Reilly 2018).
- Casey Rosenthal, Nora Jones — *Chaos Engineering*
  (O'Reilly 2020).
- John Allspaw 2012 — *Blameless Post-Mortems and a
  Just Culture*.
- Principles of Chaos (principlesofchaos.org).
- Liz Fong-Jones — burn-rate alerting.
- ICS (US NIMS) — incident command structure.
- `.claude/skills/performance-and-runtime-ops/blueprints/observability-and-tracing-expert.md`
  — telemetry sibling.
- `.claude/skills/performance-and-runtime-ops/blueprints/metrics-expert.md` — SLI metric
  shape.
- `.claude/skills/performance-and-runtime-ops/blueprints/alerting-expert.md` — rule
  mechanics.
- `.claude/skills/security/blueprints/security-operations-engineer.md`
  — security incidents sibling.
- `.claude/skills/data-modeling-and-ontology/blueprints/data-operations-expert.md` —
  DataOps umbrella sibling.
- `.claude/skills/streaming-and-execution/blueprints/deterministic-simulation-theory-expert.md`
  — DST chaos sibling.
