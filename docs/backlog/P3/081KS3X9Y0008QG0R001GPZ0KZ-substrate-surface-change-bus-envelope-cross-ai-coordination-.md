---
id: 081KS3X9Y0008QG0R001GPZ0KZ
priority: P3
status: open
title: substrate-surface-change bus envelope — cross-AI coordination of load-bearing-substrate changes via tools/bus (mechanizes the human-as-coordination-substrate pattern)
tier: operational
effort: M
ask: aaron 2026-05-21 ("yes if yall can on bus or something that would be cool but i'm here right now")
created: 2026-05-21
last_updated: 2026-05-21
depends_on: [081KR7JY10008QG0R000R503K2]
composes_with: [081KS3X9Y0008QG0R000BJY3DK, 081KS3X9Y0008QG0R002EEH26Z]
tags: [bus-envelope, cross-ai-coordination, substrate-surface-change, mechanize-coordination, multi-otto, multi-vendor, cold-boot-inheritance, claim-acquire-companion]
type: operational
---

# substrate-surface-change bus envelope — cross-AI coordination of load-bearing-substrate changes

## Context

2026-05-21 algebra-campaign session surfaced a real coordination gap: when one AI surface (Otto-VSCode, in this case) lands a load-bearing substrate change — e.g., adding capability tags to `Op<'T>` (PR #4558) or extending `IncrementalAuto`'s chain-walk logic (#4567) — other AI surfaces working in adjacent substrate need to inherit the change for their next session. Today's mechanism: Aaron ferries the relevant context between Otto-CLI / Otto-VSCode / Otto-Desktop / Alexa / Riven / Vera / Lior sessions. Aaron's framing 2026-05-21: *"i'm here right now"* — for now, the human IS the coordination substrate. The trajectory is to move that load OFF the human and ONTO the bus.

Composes with the substrate-engineering trajectory Aaron named:

- Moving brakes from "ask Aaron" to "ask the substrate" (per the KSK + OPA + Knights Guild design discussion)
- Cluster-scale (10-20 surfaces) coordination needs mechanization before human-ferry breaks empirically
- Multi-vendor diversity (Claude / Qwen / Grok / OpenAI / Gemini) means convergence on shared substrate matters more than per-vendor coordination

## Scope

### 1. New bus topic: `substrate-surface-change`

Extend `tools/bus/` envelope topic registry to include `substrate-surface-change`. Envelope payload:

```typescript
{
  topic: "substrate-surface-change",
  from: "otto-vscode" | "otto-cli" | "alexa-kiro" | ...,
  pr: number,                       // PR # where the change landed
  commit: string,                   // SHA on main
  surface: "Op<'T>" | "ICircuitBuilder" | "rule:foo.md" | "schema:claim.ts" | ...,
  change_kind: "add" | "extend" | "deprecate" | "rename" | "remove",
  brief: string,                    // 1-line summary
  composes_with: string[],          // related PR #s, B-NNNN rows
  inheritance_path: string,         // where the change is documented for future cold-boots
}
```

### 2. Publish discipline

After any PR landing that modifies load-bearing surfaces, the publishing AI calls:

```bash
bun tools/bus/publish.ts --topic substrate-surface-change \
  --from <sender-id> \
  --payload '{"pr":..., "surface":..., ...}'
```

Which surfaces count as load-bearing (the publish-rule):

- Any change to `src/Core/Op.fs` / `Circuit.fs` (capability tags, scheduler contracts)
- Any change to `src/Core/PluginApi.fs` (plugin author surface)
- Any new file in `.claude/rules/` (auto-loaded at cold-boot)
- Any new file in `docs/governance/` (constitution-class substrate)
- Any change to `tools/bus/claim.ts` SENDER_IDS or envelope schemas
- Any new computation expression in `src/Core/*.fs` (e.g., AgentIntegrate, future codegen)

### 3. Subscribe discipline (cold-boot)

Otto's bootstream (per `.claude/rules/agent-roster-reference-card.md` cold-boot section) extends to:

```bash
# After CLAUDE.md / AGENTS.md / ALIGNMENT.md / VISION.md reads:
bun tools/bus/list.ts --topic substrate-surface-change --since 24h
```

The recent envelopes show: "what load-bearing substrate changed in the last 24h that I should know about before starting work." Composes with the auto-loaded rules — rules are the *durable* inheritance; envelopes are the *recent* inheritance.

### 4. Retention + audit trail

Envelopes retain 7d default (configurable). After expiry, the inheritance path is the auto-loaded rules + commit history. The envelope is the *cache* of recent changes; the *truth* is the substrate itself.

## Acceptance

- [ ] `tools/bus/topics.ts` (or equivalent) includes `substrate-surface-change` as a registered topic with the payload schema
- [ ] `tools/bus/publish.ts` accepts the new topic + validates the schema
- [ ] `tools/bus/list.ts --topic substrate-surface-change --since <duration>` lists recent envelopes for cold-boot consumption
- [ ] At least one AI surface's bootstream (e.g., `docs/launch/2026-05-21-otto-vscode-bootstream.md`) updated to include the subscribe step
- [ ] Documentation in `tools/bus/README.md` includes the publish-rule (which surfaces count as load-bearing) + the subscribe-discipline
- [ ] One worked example: re-publish PR #4558 / #4567 / #4570 / #4571 (algebra-campaign substrate landings) as envelopes so cold-booting agents inherit the change-summary

## Why P3

Operational substrate that closes a coordination gap. Not urgent today (human-ferry works while Aaron is here); becomes load-bearing at cluster-scale (per the $100k cluster expansion Aaron mentioned 2026-05-21). Same tier as 081KS3X9Y0008QG0R000BJY3DK (Otto-VSCode SENDER_IDS extension) — operational coordination plumbing rather than research-grade architecture.

## Substrate-honest framing

This row mechanizes one specific case Aaron named in conversation: cross-AI coordination of load-bearing-substrate changes. It does NOT:

- Replace the auto-loaded `.claude/rules/` inheritance (that stays the durable substrate)
- Replace claim-acquire-before-worktree-work (that stays the per-row collision prevention)
- Replace the Knights Guild / KSK substrate (that stays the policy-enforcement gate)

It complements all three by adding the **recent-changes-cache** layer that closes the "I just shipped X; how do other surfaces find out before their next session?" gap. Today's gap-closure: human ferries the message. Trajectory: bus envelopes carry it.

Composes with 081KS3X9Y0008QG0R002EEH26Z (fast/life-branch experiment) — both shift coordination load off the per-event human-attention bottleneck and onto substrate-managed cadences. fast/life shifts CI gates; substrate-surface-change shifts inter-AI capability-change notifications.

## Composes with

- 081KR7JY10008QG0R000R503K2 (bus protocol — the substrate this row extends)
- 081KS3X9Y0008QG0R000BJY3DK (Otto-VSCode SENDER_IDS — the prior surface-tagged sender pattern this row leans on for the `from` field)
- 081KS3X9Y0008QG0R002EEH26Z (fast/life-branch experiment — sibling coordination-cost-reduction)
- `tools/bus/claim.ts` (existing claim-coordinator; this row adds a sibling topic)
- `.claude/rules/agent-roster-reference-card.md` (multi-surface Otto coordination + 6-vendor AI topology)
- `.claude/rules/claim-acquire-before-worktree-work.md` (companion discipline; this row addresses a DIFFERENT coordination gap — capability inheritance vs row claim)
- The algebra-capability campaign (#4558 / #4560 / #4563 / #4566 / #4567) — substrate-surface changes that would have benefited from this envelope pattern if it had existed

## Author notes

Filed by Otto-VSCode 2026-05-21 per Aaron's explicit "feel free we can'thave too much backlog in my opinion the infinate backlog win when labor=0" + "yes if yall can on bus or something that would be cool but i'm here right now" framing. Sized as a single bounded row rather than a multi-row decomposition; if implementation reveals scope larger than expected, decomposition into child rows is appropriate.
