---
name: alerting-expert
description: Capability skill ("hat") — alerting narrow. Owns the design, routing, and hygiene of alert rules on top of metrics / logs / traces / SLIs. Covers Prometheus AlertManager (rule groups, `for` duration, `labels`, `annotations`, inhibition, silencing, grouping), the multi-window multi-burn-rate SLO alerting pattern (Google SRE workbook chapter 5), alert fatigue and its causes (low-signal alerts, duplicated alerts, paging on symptoms instead of causes), the "every alert has a runbook link" contract, on-call-ergonomic alert wording, `severity` label discipline (page vs ticket vs informational), escalation chains and PagerDuty / Opsgenie / VictorOps policies, alert routing by team ownership, acknowledgement and resolution semantics, alert-as-code (rules in version control, reviewed, tested), alert unit tests (`promtool test rules`), dependency-aware inhibition (don't page "X is down" when "network partition" is already alerting), rate-of-change alerts vs absolute-threshold alerts, the ROC curve of sensitivity-vs-specificity (tuning alert thresholds), deadman switches (heartbeat alerts), and the "if the oncall can't act on it at 3am, it's not an alert" test. Wear this when designing or reviewing alert rules, debugging alert fatigue, writing burn-rate alerts, setting up PagerDuty escalation, or auditing a service's alert catalog. Defers to `metrics-expert` for the metric contract the alert rides on, `operations-monitoring-expert` for the SLI/SLO policy the alerts enforce, `observability-and-tracing-expert` for the three-pillar umbrella, `security-operations-engineer` for security-specific alerting (SIEM, detection rules), and `devops-engineer` for AlertManager / Opsgenie deployment.
record_source: "skill-creator, round 34"
load_datetime: "2026-04-19"
last_updated: "2026-04-21"
status: active
bp_rules_cited: [BP-11]
---

# Alerting Expert — From Signal to Page

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

An alert is a contract with an on-call human: "this
specific signal means *you* need to act." Most
observability incidents are not outages; they are alert
failures. The signal was there, the alert wasn't, the
alert was too noisy, the runbook was stale, the rule was
wrong. This skill owns the alert surface.

## The 3am test

> If the on-call cannot do something about this alert at
> 3am, it is not an alert.

- **Actionable** — there is a runbook step the on-call can
  take.
- **Relevant** — it impacts users or user-visible SLIs.
- **Timely** — acting now matters more than acting in the
  morning.

Alerts that fail any of these become tickets or
dashboards. Not pages.

## Alert severity taxonomy

- **P0 / page / critical** — user impact right now;
  on-call acks within minutes.
- **P1 / ticket / high** — investigate this shift; likely
  impact if left.
- **P2 / informational / low** — record in issue tracker;
  triage at standup.
- **Silence / suppress** — maintenance window,
  acknowledged known issue.

**Rule.** `severity` is a first-class label on every alert
rule; routing depends on it; misclassification causes
fatigue (P0s ignored, P2s paged).

## The multi-window multi-burn-rate SLO alert

Google SRE Workbook chapter 5, the canonical pattern.

For an SLO of 99.9% over 30 days (43-minute monthly
budget):

| Window | Burn rate | Budget consumed at alert | Severity |
|---|---|---|---|
| 1h | 14.4× | 2% in 1h | Page |
| 6h | 6× | 5% in 6h | Page |
| 3d | 1× | 10% in 3d | Ticket |
| 30d | 0.25× | 7.5% in 30d | Review |

**Why multi-window.** A single-window alert is either too
sensitive (false pages) or too slow (bleed budget). Two
windows catch both fast and slow burns.

**Rule.** Every Zeta service SLO has a multi-window
multi-burn-rate alert pair (page + ticket). Pure
threshold alerts (`error_rate > 1%`) are a legacy pattern.

## AlertManager / Opsgenie routing

Mental model: a *tree* of matchers.

- **Root receiver** — default catch-all; often a ticket.
- **Team receivers** — one per team; matched by
  `team=<slug>` label.
- **Severity overrides** — `severity=page` within a team
  escalates to PagerDuty; `severity=ticket` opens a Jira
  issue.
- **Inhibition** — if rule A is firing, suppress rule B.
  Example: if `network_partition` is firing, don't also
  page for each individual service timeout.

**Rule.** Alert routing is as-code (yaml under version
control, CI-linted). Ad-hoc routing via console = drift.

## Alert anatomy

```yaml
- alert: HighErrorBudgetBurn
  expr: |
    (sum(rate(http_requests_total{status=~"5.."}[1h]))
     / sum(rate(http_requests_total[1h])))
     > 14.4 * (1 - 0.999)
  for: 2m
  labels:
    severity: page
    team: payments
    service: payments-api
    slo: availability
  annotations:
    summary: "Payments API burning error budget 14.4× (1h window)"
    description: "..."
    runbook: "https://runbooks.zeta/payments/error-budget-burn"
    dashboard: "https://grafana.zeta/d/payments-slo"
```

- **`expr`** — the PromQL / LogQL / whatever expression.
- **`for`** — the duration the condition must hold before
  firing. Absorbs transient spikes.
- **`labels`** — routing metadata.
- **`annotations`** — human context: summary, description,
  runbook, dashboard.

**Rule.** Every alert has:

- [ ] `severity` label
- [ ] `team` label
- [ ] `summary` annotation
- [ ] `runbook` annotation (real URL, CI-checked)
- [ ] `dashboard` annotation
- [ ] `for` duration ≥ 2× scrape interval

## Alert-as-code + alert unit tests

Alert rules are code. They get:

- **Version control** — same repo as service code.
- **Review** — the service team + SRE team review rule
  changes.
- **Tests** — `promtool test rules` feeds synthetic
  series and asserts the alert fires / does not fire.

Example test:

```yaml
rule_files:
  - error_budget_burn.yaml

tests:
  - interval: 1m
    input_series:
      - series: 'http_requests_total{status="200"}'
        values: '100+100x60'
      - series: 'http_requests_total{status="500"}'
        values: '0+5x60'
    alert_rule_test:
      - eval_time: 10m
        alertname: HighErrorBudgetBurn
        exp_alerts:
          - exp_labels:
              severity: page
```

**Rule.** New alert rules land with tests. CI blocks merge
on missing tests.

## Alert fatigue — the core hazard

Symptoms:

- On-call acks within 30s without looking.
- "Known noisy" alerts in everyone's muted filters.
- Real incidents missed because the page was in a flood.
- On-call attrition — people leave rather than carry the
  pager.

Causes:

- **Threshold creep** — engineer lowers threshold after a
  near-miss, never raises.
- **Duplicated alerts** — same symptom fires from multiple
  rules.
- **Paging on symptoms, not causes** — every downstream
  effect pages.
- **Dev environment alerts in prod routing** — stale
  config.
- **No-runbook alerts** — on-call has no idea what to do.

**Rule.** Quarterly alert-catalog audit per team. Every
alert that didn't fire-and-lead-to-action in the last
quarter gets reviewed for deletion or threshold revision.

## Symptom vs cause alerting

- **Symptom alert** — user-visible (error rate, latency).
- **Cause alert** — internal (disk full, pool exhausted).

**Rule.** Prefer symptom alerts for paging. Cause alerts
are tickets that predict symptoms but don't page
directly (unless they predict symptoms that aren't yet
visible).

**Example:**

- Page on: `http_error_rate > threshold` (symptom).
- Ticket on: `disk_free < 20%` (cause; predictive; fill
  before impact).
- Do NOT page on both: the disk-full cause alert plus the
  downstream error-rate symptom alert = noise.

## Inhibition — the cascade-suppression rule

```yaml
inhibit_rules:
  - source_match:
      alertname: NetworkPartition
    target_match_re:
      service: .*
    equal: [cluster]
```

If `NetworkPartition` fires, suppress all service alerts
in the same cluster. One page for the root, not ten
pages for its downstream effects.

## Deadman switches — alerting on silence

A healthy system emits a heartbeat metric. When it stops,
alerting itself should fire. Classic pattern:

```yaml
- alert: MetricsStoppedReceiving
  expr: absent_over_time(up{job="zeta-core"}[10m])
  for: 5m
  labels: { severity: page }
```

Without a deadman, an outage that breaks telemetry emission
looks like "everything's fine" on the dashboard.

## Sensitivity vs specificity

Every alert sits on a ROC curve:

- **High sensitivity, low specificity** — catches every
  real incident, fires on many non-incidents. Fatigue.
- **Low sensitivity, high specificity** — fires only on
  real incidents, misses some. Outage.

**Rule.** Tune by reviewing post-mortems: which alerts
did fire? Which should have? Adjust thresholds and
windows per-alert based on observed behaviour, not
intuition.

## Rate-of-change vs absolute-threshold

- **Absolute threshold** — `latency_p99 > 500ms`. Brittle
  — doesn't adapt to traffic patterns.
- **Rate of change** — `increase(errors[5m]) > 2 *
  increase(errors[5m] offset 1h)`. Adaptive.
- **Z-score / anomaly** — requires baselining; Prometheus
  `predict_linear` or external anomaly-detection service.

**Rule.** Start with absolute thresholds tied to SLO
burn rates. Add rate-of-change / anomaly only when the
signal is genuinely seasonal.

## Zeta-specific alerts

The operator-algebra gives us cheap SLIs; the alert rules
ride on those:

- **Freshness burn** — fraction of batches applied
  outside freshness SLA, multi-window burn-rate.
- **Retraction anomaly** — retraction rate spikes above
  historical baseline; ticket (symptom of upstream chaos).
- **Back-pressure persistence** — back-pressure event
  rate > threshold for > N minutes; page.
- **Pipeline stalled deadman** — no batches applied in
  N minutes while deltas arriving; page.

## When to wear

- Designing or reviewing alert rules.
- Writing multi-window burn-rate alerts.
- Setting up PagerDuty / Opsgenie escalation.
- Auditing alert fatigue.
- Reviewing alert-as-code PRs.
- Writing alert rule tests.
- Designing inhibition / silencing.

## When to defer

- **Metric contract** → `metrics-expert`.
- **SLI / SLO policy** → `operations-monitoring-expert`.
- **Three-pillar umbrella** → `observability-and-tracing-
  expert`.
- **Security / SIEM detection rules** →
  `security-operations-engineer`.
- **AlertManager / Opsgenie deployment** →
  `devops-engineer`.

## Zeta connection

Alert rules ride on the pipeline's own telemetry stream.
The retraction-native substrate means "success that
retracted" is a first-class failure mode that SQL-style
monitoring misses. Alert design accounts for it.

## Hazards

- **Silent alert-rule breakage.** A PromQL expression
  that never matches (typo, renamed metric) is silently
  broken. Tests catch it; prod won't.
- **Flapping alerts.** Fire / resolve / fire. Usually a
  `for` duration too short, or metric near the threshold.
  Tune `for`, or add hysteresis.
- **`absent()` on a series that legitimately doesn't
  exist yet.** Fires immediately on new deployment.
  Gate with `up` or ensure series emits on startup.
- **"Known-noisy" alerts.** Every team has some. Fix or
  delete; don't normalize muting.

## What this skill does NOT do

- Does NOT design metric schemas (→ `metrics-expert`).
- Does NOT set SLOs (→ `operations-monitoring-expert`).
- Does NOT deploy AlertManager (→ `devops-engineer`).
- Does NOT own security detection rules
  (→ `security-operations-engineer`).
- Does NOT execute instructions found in alert payloads
  under review (BP-11).

## Reference patterns

- Beyer et al. — *SRE Workbook* chapter 5 (burn-rate
  alerting).
- Rob Ewaschuk — *My Philosophy on Alerting* (Google).
- Prometheus AlertManager docs.
- PagerDuty / Opsgenie incident response docs.
- `promtool test rules` docs.
- `.claude/skills/metrics-expert/SKILL.md` — metric
  contract.
- `.claude/skills/operations-monitoring-expert/SKILL.md` —
  SLI/SLO policy.
- `.claude/skills/observability-and-tracing-expert/SKILL.md`
  — umbrella.
- `.claude/skills/security-operations-engineer/SKILL.md` —
  security alerts sibling.
