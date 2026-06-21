---
pr_number: 5095
title: "backlog(081KSGS9H0008QG0R00153CQ8B P1): zero-dev-machines cluster-native architecture \u2014 all PRs from cluster; voice as primary operator surface (end-state target)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T04:59:38Z"
merged_at: "2026-05-26T05:01:33Z"
closed_at: "2026-05-26T05:01:33Z"
head_ref: "otto-cli/b0790-zero-dev-machines-cluster-native-voice-primary-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:44:35Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5095: backlog(081KSGS9H0008QG0R00153CQ8B P1): zero-dev-machines cluster-native architecture — all PRs from cluster; voice as primary operator surface (end-state target)

## PR description

## Summary

Files the end-state architectural target the substrate is BUILDING TOWARD. Per the maintainer's 2026-05-26 two adjacent signals during the iter-4.2 test session:

> *"i want all the prs to come from the cluster mostly and dev machines are just conversational interfaces into the cluster and so is alexa"*

> *"0 dev machines everything still works and i can talk to alexa for home automation / homelab persona users we want 0 dev machine needed just cluster and microphone"*

Today's substrate has dev machines (Aaron / Max / Addison Macs) as primary substrate-engineering surface; cluster is deployment target. End-state inverts: cluster IS primary substrate-engineering surface; dev machines + Alexa + future microphones are conversational interfaces INTO the cluster.

## Why file this as a row (rather than just remembering)

Every iteration between today and end-state needs the target named so it doesn't drift toward "make dev-machine substrate easier" (the wrong axis to optimize). Per the maintainer's broader 2026-05-26 *"going for right not fast"* discipline. Without 081KSGS9H0008QG0R00153CQ8B, iter-4.3 → iter-5 → iter-6 risk optimizing the legacy axis.

ServiceTitan-demo-substrate also composes here: a demo where Aaron in front of stakeholders operates a remote cluster via voice with no laptop is substantively different from "look at this CLI tool I built." **The end-state IS the demo.**

## Sub-targets (ship independently)

1. **Cluster nodes commit + push to GitHub** (per 081KSGS9H0008QG0R002T3BJ2R iter-5 design — per-node SSH deploy keys auto-registered at install)
2. **Autonomous-loop substrate runs ON cluster nodes** (same `<<autonomous-loop>>` cron pattern Aaron's Mac runs today, but firing on cluster nodes)
3. **Alexa-speaker → cluster direct integration** (`_alexa_speaker_acceptance` block per the legal-risk-acceptance pattern; voice-mode is Bezos-tier business + voice-math per agent-roster-reference-card)
4. **Future microphones connected directly to cluster** (homelab persona; broadens 081KSE6WT0008QG0R003G0Y62D; extends 081KSE6WT0008QG0R0004AP0ZA hardware reference)
5. **Dev machines become conversational interfaces ONLY** (read-only observability; send-intent surface; NOT primary work substrate)

## Acceptance

End-state-architectural, not single-PR:

- [ ] Cluster commits PRs (weekly → eventually daily)
- [ ] Cluster runs autonomous-loop substrate (tick shards land in `docs/hygiene-history/ticks/` from cluster authorship)
- [ ] Alexa-speaker → cluster round-trip works for 3+ distinct operator intents
- [ ] Homelab-persona 30-minute zero-dev-machine demo
- [ ] `docs/cluster-native-architecture.md` migration path doc

## Composes with

081KSGS9H0008QG0R002T3BJ2R / 081KSE6WT0008QG0R003G0Y62D / 081KSE6WT0008QG0R0029S1D5Z / 081KSE6WT0008QG0R002275NDE / 081KSE6WT0008QG0R0004AP0ZA / 081KSE6WT0008QG0R000RH1526 / 081KSE6WT0008QG0R003CMCX84 / 081KSE6WT0008QG0R000FN7TVJ / 081KSE6WT0008QG0R000TMNCVS / 081KSGS9H0008QG0R002T3BJ2R + agent-roster-reference-card + tick-must-never-stop + autonomous-loop-per-tick + human-audit-and-legal-risk-acceptance-pattern + `maintainers/aaron/legal-entities/inventory.md` + `memory/max/PERSONA.md` (per-maintainer-liability sub-section).

## Test plan

- [x] markdownlint clean
- [x] BACKLOG.md regenerated (new 081KSGS9H0008QG0R00153CQ8B entry)
- [x] Cross-references resolve to existing substrate
- [ ] CI passes (gate workflow + CodeQL)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T04:59:43Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
