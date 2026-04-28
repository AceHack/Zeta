---
name: Operational cost ordering — free > cheap > expensive; prefer free substrates, justify anything paid
description: 2026-04-20 — Aaron: "free is better than cheap, cheap is better than expensive." Stated right after the pluggable-factory + git-static-pages deployment discussion. Drives recommendation priority for any factory-surface infrastructure choice (persistence, deployment, hosting, tooling). When multiple options exist for the same job, rank by cost tier: free first (GitHub, GitHub Pages, git substrate, CC-licensed docs), cheap second (per-seat SaaS under ~$10/user/month, free-tier cloud), expensive last and only if a real use case demands it. Opt-in plugin architecture is the vehicle: free by default, expensive only where a user explicitly brings a real need.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Free beats cheap beats expensive

## Rule

When recommending any factory-surface infrastructure choice —
persistence, deployment, hosting, external tooling, plugin
backends, CI runner classes, observability stacks — rank
options by cost tier in this strict order:

1. **Free** — no dollars, no per-seat fees, no usage-based
   charges at the scale the factory operates. GitHub + git
   + GitHub Pages + GitHub Actions public-repo minutes +
   CC-licensed docs substrate. **Default recommendation
   tier.**
2. **Cheap** — small per-seat or per-usage fees that a
   solo developer can absorb, typically under ~$10 / user /
   month and with generous free tiers. Justify over free.
3. **Expensive** — anything with enterprise-tier pricing,
   per-user fees above ~$10 / month, or opaque
   usage-billing that can surprise a small team. Only when
   a real use case explicitly brings the need.

This ordering holds for the **default** recommendation.
Pluggable alternatives (per the pluggable-factory design —
see `project_factory_is_pluggable_deployment_piggybacks.md`)
can be any tier; the tier matters for the default, not for
the set of available plugins.

## Aaron's verbatim statement (2026-04-20)

> "free is better than cheap, cheap is better than
> expensive"

Stated as a terse ordering right after the earlier
discussion of GitHub Pages (free static hosting) and the
pluggable-factory rationale ("pull in extra things that
really help or explicitly are wanted to get into an
existing eco system").

## Why:

- **Solo-dev / small-team adoption** — the factory is
  designed to run cheaply enough that a solo developer
  can adopt it on a side project without a budget line.
  Cost is a conversion blocker at exactly the "simple
  project" end of the
  `project_factory_reuse_beyond_zeta_constraint.md`
  spectrum.
- **Experiment-first posture** — Zeta is a pre-v1
  experiment (`AGENTS.md` §Pre-v1). Paid infra during
  the experiment phase is premature.
- **Vendor-lock-in asymmetry** — a paid vendor's
  end-of-life or pricing-change is a bigger blast
  radius than a free-tier service walking away. Free
  tiers are frequently backed by open-source
  primitives (git, nginx, static hosting) that survive
  the vendor.
- **Composes cleanly with pluggable architecture** —
  "free-by-default, expensive-as-plugin-on-real-use-case"
  is the same shape as "git-by-default, Jira-as-plugin-
  on-real-use-case" from
  `project_git_is_factory_persistence.md`. Two angles
  on the same design stance.

## How to apply:

- **When evaluating a new tool / service / vendor** for
  any factory role:
  1. Enumerate the free options first. If a free option
     covers ≥ 80% of the use case, recommend it.
  2. If a cheap option is materially better, state the
     delta and the cost-per-seat explicitly. Don't hide
     price.
  3. An expensive option is the recommendation only if
     a specific, named use case demands it — and even
     then, scope it as an opt-in plugin, not a default.
- **When writing an ADR** that picks a tool: include a
  "Cost tier" line (`Free / Cheap / Expensive`) and a
  one-sentence justification for picking that tier
  over the tier below it (i.e. if you recommend cheap,
  explain why the free option doesn't cover the case).
- **When discussing deployment**: GitHub Pages is the
  free default for static hosting. Paid deployment is
  a real-use-case-driven plugin, not a default.
- **When evaluating agent / LLM substrates**: the
  Claude substrate is already an unavoidable dependency
  for this experiment (see
  `project_git_is_factory_persistence.md` exceptions).
  But agent-infrastructure choices *around* that (CI
  runner classes, cold-start cache services,
  observability backends) still rank free first.
- **When a consumer team wants an expensive plugin**
  (Jira, proprietary ES tool, enterprise SSO): build
  the plugin as opt-in, do not adopt it as the factory
  default, and ensure the free-tier path remains
  first-class.

## What this rule does NOT do

- It does NOT forbid paid infra. If a real use case
  demands a paid tool, use it — via an opt-in plugin
  with the cost explicitly called out in the ADR.
- It does NOT mean "free is always better quality." A
  cheap paid service may be materially better than a
  janky free one. In that case, state the quality delta
  and let the user decide; present the free option
  first as the baseline.
- It does NOT mean "never buy anything." When the
  factory serves a team with budget and a real need,
  paid plugins are legitimate. This is about the
  *default* recommendation, not about refusing paid
  tooling.

## Related memories

- `project_git_is_factory_persistence.md` — free
  substrate for persistence (git).
- `project_factory_is_pluggable_deployment_piggybacks.md`
  — free substrate for deployment (GitHub Pages /
  piggy-back on product's existing pipeline).
- `project_factory_reuse_beyond_zeta_constraint.md` —
  the reuse constraint this cost-ordering serves.
- `feedback_simple_security_until_proven_otherwise.md`
  — same "don't pay for complexity until forced"
  shape, at the security layer.
