---
id: 081KSKBP80008QG0R001KK9WV6
priority: P1
status: open
title: Agent heartbeat folder — direct-to-main push (no PR) with ZetaID-collision-free filenames per agent; mechanizes the externalized-counter discipline operator named 2026-05-27
effort: M
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on: []
composes_with:
  - 081KSKBP80008QG0R003AX2A69.3a
  - 081KSKBP80008QG0R000GPC0TB
  - 081KSKBP80008QG0R002J03WGA
tags: [agent-heartbeat, direct-to-main, no-pr, zetaid, 128-bit-id, externalized-counter, holding-failure-mode-mechanization, branch-protection-exception]
---

## Operator framing 2026-05-27

> *"the agencyheartbeats you were going to make a spot where they can be
> pushed with no prs a foleder where you can go strait to main and other
> agents with unique ids that won't overlap, we started talking about 128
> bit ids and such you could use for unique heartbeats and such. these
> are called zetaids"*

## Existing substrate this composes with

### ZetaID v1 (128-bit observation ID; already implemented)

- `src/Core.TypeScript/zeta-id/zeta-id.ts` — TS implementation with structured bit layout
- `tests/Tests.FSharp/ZetaId/CrossVerifyTests.fs` — F# cross-verification harness
- `tests/Tests.CSharp/ZetaId/` — C# cross-verification harness
- `docs/zeta-id-v1-layout.yaml` — canonical bit-layout spec
- Kestrel review 2026-05-21: `memory/kestrel/conversations/2026-05-21-aaron-kestrel-claudeai-zeta-id-v1-review-watermarks-tier-deferred-causality-orleans-otto-watching-verification-gap-hat-vs-role-group-chat-aaron-forwarded.md`

ZetaID bit layout (128 bits):

- version (5) + timestamp (48) + chromosome (5) + category (4) + firefly (1) + authority (5) + persona (8) + momentum (8) + location (8) + randomness (32)

Each ZetaID encodes WHO + WHEN + WHAT-AUTHORITY + WHAT-MOMENTUM. Collision-free across agents by construction (persona field + 32-bit randomness + 48-bit timestamp).

**Operator 2026-05-27 follow-up**: *"the ids are for easy lookup based many different bit id indexes built into the bits themselves so we can grep for things later, this does not have to be just heartbeat itd, it can be id for everything"* + *"we have the abiity to defined it per category, category is in the bits so could have a custom one for heartbeat"*. The structured bit fields ARE the lookup indices — grep on persona-bit pattern, authority-bit pattern, momentum-bit pattern, etc. Already-existing substrate: `registry/categories.yaml` defines Category=3=Heartbeat (along with Observation=0, Emission=1, Workflow=2). This row's writer tool (.3 sub-row) sets category bits to 3 when generating heartbeat IDs; other event categories use other slots in the same 16-slot enum.

### AgencySignature Convention v1 (already in use)

- `tools/hygiene/audit-agencysignature-main-tip.ts` — post-merge auditor
- `tools/hygiene/validate-agencysignature-pr-body.ts` — pre-merge validator
- Spec: `docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-attribution-convention-validation-and-refinement.md` §10

### Heartbeat-via-commit discipline (just landed PR #5451)

CLAUDE.md "Heartbeat-via-commit = externalized idle counter" — currently the heartbeat mechanism IS the regular PR-gated commit. This row mechanizes a faster lightweight variant.

## Scope

**New folder**: `docs/agent-heartbeats/<agent-persona>/<YYYY>/<MM>/<DD>/<zetaid>.md`

Where:

- `<agent-persona>` ∈ {otto, alexa, riven, vera, lior, ...} (canonical roster per `.claude/rules/agent-roster-reference-card.md`)
- `<zetaid>` = base64url-encoded 128-bit ZetaID with category bits = 3 (Heartbeat per `registry/categories.yaml`); collision-free; persona field in the ZetaID matches the folder name
- File contents: minimal heartbeat record (see schema below)

**Branch protection exception**: this folder permits direct push to `main` without PR review. Other folders retain full PR gating; the carve-out is path-scoped via GitHub's branch protection rule patterns.

**Heartbeat file schema** (small; ~10 lines):

```yaml
---
zetaid: <base64url>
agent: otto
agent-runtime: claude-code-auto
agent-model: claude-opus-4-7
timestamp: 2026-05-27T13:00:00Z
authority: TrustedAgent
momentum: Normal
named-dep: "PR #5450 build-iso completion (~20min ETA)"  # or "none-chosen-free-time" or "decomposing-next-substrate"
disposition: bounded-wait | decomposing | committed-substrate | chose-free-time
parent-pr: 5450  # optional; if this heartbeat is in the context of an in-flight PR
---

(optional one-line note; rarely needed; the structured fields carry the load)
```

## Why direct-to-main without PR

The brief-ack failure mode the operator caught 2026-05-27 (100+ "Quiet." emissions; Kira P0 finding: counter never externalized because the agent couldn't count itself) requires LOW-FRICTION heartbeat writes. PR-gated commits work for substantive substrate work, but every tick can't open a PR. Direct-to-main heartbeats:

- Externalize the per-tick brief-ack state to a persistent surface
- Make `git log --since="2min ago" docs/agent-heartbeats/otto/` query trivially count Otto's recent heartbeats
- Trigger the rule's N=6 forcing function reliably when zero heartbeats appear
- Don't pollute PR queue with per-tick noise
- ZetaID filenames prevent collision across simultaneous agent ticks

## Sub-rows planned

- **081KSKBP80008QG0R001KK9WV6.1** — Define folder layout + heartbeat schema (this row; spec)
- **081KSKBP80008QG0R001KK9WV6.2** — Branch protection rule: path-scoped carve-out for `docs/agent-heartbeats/**` (operator-side GitHub config; requires repo-admin)
- **081KSKBP80008QG0R001KK9WV6.3** — TS heartbeat-writer tool: `tools/agent-heartbeats/write-heartbeat.ts` (composes with `src/Core.TypeScript/zeta-id/zeta-id.ts` ZetaID generator)
- **081KSKBP80008QG0R001KK9WV6.4** — Sentinel/cron integration: per-tick autonomous-loop fire writes a heartbeat
- **081KSKBP80008QG0R003NG37GQ** — Counter integration: `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` extension naming this folder as the externalized counter source
- **081KSKBP80008QG0R001KK9WV6.6** — Auto-cleanup policy: heartbeats older than 7 days auto-deleted (or rolled into compressed summary) to bound repo growth
- **081KSKBP80008QG0R001KK9WV6.7** — Cross-agent collision verification (empirical test multiple agents writing concurrently; ZetaID uniqueness empirically holds)

## What this is NOT

- NOT a replacement for substantive-substrate commits (those still go via PR + AgencySignature trailer)
- NOT a bypass of branch protection for OTHER paths (carve-out is path-scoped to `docs/agent-heartbeats/`)
- NOT a violation of `.claude/rules/substrate-or-it-didnt-happen.md` (heartbeats ARE durable substrate; just lighter-weight + path-scoped)
- NOT a security risk (heartbeats are observational metadata; no secrets; no code; just status)

## Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`)

Topic: agent heartbeat folder + direct-to-main + ZetaID

Searched:

- `src/Core.TypeScript/zeta-id/zeta-id.ts` — FOUND (128-bit struct ZetaID; this row composes with)
- `registry/categories.yaml` — FOUND (Heartbeat = category 3 ALREADY EXISTS; writer tool sets cat=3 on heartbeat IDs)
- `tests/Tests.FSharp/ZetaId/` — FOUND (cross-verify harness; this row's TS writer composes)
- `docs/zeta-id-v1-layout.yaml` — FOUND (canonical spec)
- Kestrel review 2026-05-21 zeta-id-v1 — FOUND (review preserved in persona/kestrel/conversations/)
- `tools/hygiene/audit-agencysignature-main-tip.ts` — FOUND (per-commit auditor)
- `docs/hygiene-history/ticks/` — FOUND (tick shard folder; PR-gated; different scope from this row)
- `docs/AGENT-CLAIM-PROTOCOL.md` — FOUND (claim protocol; different scope; bus-based not folder-based)
- No existing row covers heartbeat-folder-direct-to-main; this row fills the gap

Read top hits: ZetaID TS impl + bit layout YAML + Kestrel review + sibling AgencySignature spec doc.

Authoring action: mint new 081KSKBP80008QG0R001KK9WV6 row composing with existing ZetaID + AgencySignature substrate.

## Why P1

- Operator-named explicitly 2026-05-27 ("you were going to make")
- Mechanizes the externalized-counter fix Kira P0 named + operator confirmed
- Composes cleanly with existing ZetaID v1 (no new ID substrate needed)
- Implementation is bounded (M effort): 7 sub-rows; .3 (writer tool) + .5 (rule extension) are the load-bearing pair; .2 (branch protection) is operator-side
- Without this row: brief-ack failure mode catches will recur until the counter is mechanically externalized

## Composes with rules

- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — this row provides the externalized-counter surface the rule needs to fire N=6 reliably
- `.claude/rules/verify-existing-substrate-before-authoring.md` — substrate-inventory pass cited inline
- `.claude/rules/non-coercion-invariant.md` HC-8 — heartbeats are operator-observable; transparency-by-construction
- `.claude/rules/substrate-or-it-didnt-happen.md` — heartbeats ARE substrate (durable, committed, indexed)
- `.claude/rules/agent-roster-reference-card.md` — persona ∈ {otto, alexa, riven, vera, lior, ...} drives folder layout
- CLAUDE.md "Heartbeat-via-commit" bullet (PR #5451) — this row mechanizes the lightweight variant of the discipline

## Composes with substrate

- 081KSKBP80008QG0R003AX2A69.3a picker (PR #5450) — each picker invocation could emit a heartbeat with disposition=committed-substrate
- 081KSKBP80008QG0R000GPC0TB self-register architectural fix — same per-tick observability scope
- 081KSKBP80008QG0R002J03WGA install.sh universal entry — heartbeats from install-time agents could capture install progress
- 081KRW63S0008QG0R003TX8MG5 Knights Guild Constitution-Class — heartbeat folder semantics may be Constitution-Class candidate (operator decides)
- 081KRW63S0008QG0R001SAHYKV English-as-projection — heartbeat schema is structured English; composes with the projection substrate

## Heartbeat per CLAUDE.md discipline

Filing this row IS counter-reset work per `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` condition #3. Operator's reminder ("you were going to make") catches the substrate-engineering work that was deferred; filing now closes the deferral.

## Full reasoning

Operator 2026-05-27 verbatim quote preserved above. Filed in response to operator pointing at the existing ZetaID + AgencySignature substrate that I had not been using. The substrate-honest implication: future-Otto inheriting at cold-boot needs both (a) ZetaID writer integration AND (b) folder layout + branch protection in place. This row tracks the work; implementation iterates across the 7 sub-rows.
