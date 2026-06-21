---
id: 081KT5CF90008QG0R00112FSD7
priority: P2
status: open
title: "Responsible-disclosure DORA gate — split-clock metric (minimize discovery→sent, follow coordinated sent→public), hard-stop feature dev on slip, kid-floor escalation (unamendable, authorities/NCMEC, predetermined legal human-routed path) (Aaron 2026-06-03)"
tier: safety-governance
effort: L
created: 2026-06-03
last_updated: 2026-06-03
depends_on: []
composes_with: [081KSRGFP0008QG0R00091PP56]
tags: [security, responsible-disclosure, dora, safety-floor, kid-safety, coordinated-disclosure, governance, aaron]
type: design
---

# Responsible-disclosure DORA gate — split-clock + hard-stop + kid-floor escalation

## Origin (Aaron 2026-06-03, forwarded Kestrel × maintainer session)

Preserved engineering substrate: `docs/research/2026-06-03-kestrel-aaron-open-source-ethic-floor-governance-jurisdiction-relative-opa-federation-nexus-meta-jurisdiction-conflict-resolution-aaron-forwarded.md` §2.
The *discipline* lands as a rule (`.claude/rules/responsible-disclosure-private-window-prompt-to-vendor-never-hoard-kid-floor-escalation`); this row is the **gate implementation**.

## What to build

A metric + gate around found-but-unreported vulnerabilities and their disclosure
reports, enforcing prompt responsible disclosure (never hoard).

### Split clock (the load-bearing distinction)

- **discovery → sent-to-vendor** — minimize hard; DORA-style metric (mean-time-to-disclosure);
  **hard-stop feature development if it ages** past threshold (mechanical floor with teeth so
  disclosure can't be deprioritized under feature pressure). This is the asymmetric-advantage-and-danger window.
- **sent-to-vendor → public** — do NOT minimize; follow coordinated-disclosure timing
  (vendor patch window / standard timeout). Rushing this is the reckless-early-publish danger.

### Arming + honesty

Found vulnerability → **logged immediately** (an unlogged exploit never trips the metric) →
clock starts → gate armed. The private window is correct (per the disclosure rule); it must be
**in a pipeline moving toward sent**, not found-and-shelved.

### Kid-floor escalation (composes with 081KSRGFP0008QG0R00091PP56)

An unreported exploit on the child-safety surface is a **floor matter** → strongest rails:

- gate is **unamendable** (fixed thresholds, non-removable hard-stop);
- discovery→sent clock **tighter**;
- disclosure may route to **authorities / NCMEC**, not just the vendor (mandatory-reporting
  obligations ordinary vulns lack);
- escalation path **predetermined + legally-vetted + human-routed**, fired automatically on
  categorization, not improvised per-incident. **Legal counsel defines the path.**

## Acceptance

- [ ] disclosure-tracking surface (log on discovery; per-item stage + clocks)
- [ ] discovery→sent metric + hard-stop integration (feature dev halts on slip)
- [ ] coordinated sent→public timing tracked (not minimized)
- [ ] kid-floor categorization → unamendable gate + predetermined legal/authority escalation path (with counsel)
- [ ] wellbeing/legal review of the kid-floor path before any real use

## Composes with

- 081KSRGFP0008QG0R00091PP56 (constitutional kid-safety floor) — the kid-floor escalation inherits floor properties
- `.claude/rules/methodology-hard-limits.md` (the floor this operates above)
- `.claude/rules/responsible-disclosure-private-window-prompt-to-vendor-never-hoard-kid-floor-escalation` (the discipline; rule landing this row implements)
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` (named-human legal routing)
