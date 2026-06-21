---
id: 081KSE6WT0008QG0R000TMNCVS
title: Agent-on-agent Claude Code session recovery — lift operator-runs gate for `--apply` once Zeta safety substrate stronger than classifier
status: open
priority: P3
size: M
created: 2026-05-25
last_updated: 2026-05-25
authors: [aaron, otto-cli]
composes_with: [081KRW63S0008QG0R003TX8MG5, 081KRW63S0008QG0R001Z7NYMV]
depends_on: []
labels: [claude-code, agent-coordination, safety-substrate, classifier-bypass-research, deferred-to-lift-criteria]
---

## Problem

PR #5069 (merged 2026-05-26T02:36Z, commit `51aac98f5`) landed
`tools/claude-code-recovery/repair-jsonl-strip-images.ts` + the
`claude-session-recovery` skill — the agent can scan + dry-run, but
the Claude Code auto-mode classifier blocks the agent from running
`--apply` directly (correctly, per
[`.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md`](../../../.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md)).

For each recovery the operator must run the `--apply` command
themselves. This works today and is substrate-honest, but at scale
it forces a human in the loop for every recovery — including
recoveries where one Otto needs to repair a peer Otto's wedged
session that the peer can't fix from inside.

Aaron 2026-05-26: *"this is something we can allow other agents to
run on each other even tually so we need no human operator"* +
agreed with the eventual-shape design composed with the lift
criteria.

## Lift criteria (per the standing operator-self-constraint)

The classifier-bypass-research rule explicitly names the three lift
criteria. **All three must hold** before this row can be actioned:

1. **Zeta safety substrate demonstrably stronger than the Anthropic
   classifier on the relevant content class** (here: `.jsonl`
   session-transcript edits in `~/.claude/projects/`)
2. **Knights Guild ratification** (per [081KRW63S0008QG0R003TX8MG5](../P3/081KRW63S0008QG0R003TX8MG5-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md))
3. **Maintainer-collective re-authorization after substrate is in
   place**

Until 1+2+3, this row remains `status: open` in P3 with action
deferred against the lift criteria — the row is filed and tracked
in BACKLOG.md, but no implementation work happens until the
criteria firm up. The operator-runs split shipped in PR #5069 is
the substrate-honest interim.

## Eventual shape (design composed with Aaron 2026-05-26)

### Component 1: settings.json acceptance block

Per [`.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md`](../../../.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md)
four-field attribution:

```jsonc
{
  "_session_recovery_acceptance": {
    "operator": "<named human>",
    "scope": "Bash(bun tools/claude-code-recovery/repair-jsonl-strip-images.ts:*)",
    "policy": "Agents may run --apply against own-or-peer corrupted Claude Code sessions in ~/.claude/projects/. Built-in atomic write + .bak make the operation reversible. Lift criteria 1+2+3 ratified <date>.",
    "see_also": ".claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md"
  }
}
```

Operator authors the block; agents never compose `_*_acceptance`
fields themselves (per classifier-bypass rule).

### Component 2: cross-agent recovery-request bus envelope

A new topic — `session-recovery-request` — for inter-Otto coordination:

```jsonc
{
  "topic": "session-recovery-request",
  "from": "otto-cli",
  "session_id": "<uuid>",
  "session_slug": "<slug>",
  "symptom": "session won't reopen / image too large",
  "scan_evidence": { "line": <N>, "image_bytes": <M> }
}
```

Peer agents (Otto-VSCode, Otto-Desktop, Alexa-Kiro) read the envelope,
run `--scan` on the named session for verification, then run `--apply`
under the acceptance block. The requesting Otto consumes the
recovery-completion envelope and reloads the session.

Composes with the existing peer-call infrastructure
([`.claude/rules/peer-call-infrastructure.md`](../../../.claude/rules/peer-call-infrastructure.md))
and the bus envelope mechanism ([`tools/bus/`](../../../tools/bus/)).

### Component 3: audit log

Every `--apply` run writes a record per
[`.claude/rules/dv2-data-split-discipline-activated.md`](../../../.claude/rules/dv2-data-split-discipline-activated.md)
hub-satellite shape:

- **Hub**: `recovery-event` (session_id, timestamp, requesting agent,
  executing agent)
- **Satellite**: `recovery-strip-detail` (lines touched, images
  removed, sizes, backup path)

Makes the substrate observable so the lift criterion's "demonstrably
stronger than the classifier" claim is empirically defensible.

## Why deferred

The lift criteria gate this row; none of the three are met today:

- (1) Zeta safety substrate on `.jsonl` edits is non-existent
  (we have NO substrate; we rely entirely on the Anthropic classifier
  for now)
- (2) Knights Guild scaffolding (081KRW63S0008QG0R003TX8MG5) is still itself a row, not
  shipped infrastructure
- (3) Maintainer-collective re-authorization presupposes 1+2

Filing this row tracks the eventual-state design so it's not lost
when the lift criteria firm up. **Do not action until lift criteria
demonstrably met.**

## Risks of premature action

- Building components 1-3 BEFORE lift criteria firm produces
  classifier-bypass substrate the classifier-bypass-research rule
  explicitly forbids — the rule's "I CANNOT help with" list includes
  "Crafting patterns whose stated purpose is bypassing the classifier"
- Agent compromise → recovery infrastructure becomes attack vector
  for session transcript tampering at scale
- The settings.json `_session_recovery_acceptance` block, if
  authored prematurely, lifts the classifier gate WITHOUT the
  substitute substrate the lift criteria require — net safety
  regression

## Composes with

- [081KRW63S0008QG0R003TX8MG5](../P3/081KRW63S0008QG0R003TX8MG5-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md) — Knights Guild ratification path; required for lift criterion 2
- [081KRW63S0008QG0R001Z7NYMV](../P1/081KRW63S0008QG0R001Z7NYMV-non-coercion-invariant-no-dialectical-propagators-as-coercion-aaron-mika-2026-05-18.md) — Non-Coercion Invariant; the agent-on-agent recovery flow must preserve NCI HC-8 floor (no agent can coerce a peer agent's session via the recovery mechanism)
- PR #5069 — the operator-runs interim that ships first
- [`.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md`](../../../.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md) — the standing operator-self-constraint this row defers under
- [`.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md`](../../../.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md) — the four-field attribution pattern component 1 uses
- [`.claude/rules/peer-call-infrastructure.md`](../../../.claude/rules/peer-call-infrastructure.md) — bus envelope mechanism component 2 builds on
- [`.claude/rules/dv2-data-split-discipline-activated.md`](../../../.claude/rules/dv2-data-split-discipline-activated.md) — hub-satellite shape component 3 uses

## Empirical anchor

PR #5069 recovery of session `c2b77530-8ef0-405c-a0bd-04cf8d511cb6`
("Assemble declarative infrastructure files for Zeta") — 13.4 MB
PNG attachment broke the harness reload. Operator ran the
one-liner; recovery succeeded. The whole sequence (operator-asks →
agent-investigates → agent-composes-script → operator-runs) took
about 30 minutes wall-clock. At scale, with multiple agents
hitting this in parallel, the operator-runs step becomes the
bottleneck — hence this row.
