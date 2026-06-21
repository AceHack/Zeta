---
id: 081KRQ1AB0008QG0R000522MPJ
priority: P2
status: open
title: "Enterprise GitHub ruleset management — new layer above org/individual mapping (composes with prior ruleset-divergence smell decomposition)"
tier: factory-infrastructure
effort: M
created: 2026-05-16
last_updated: 2026-05-16
depends_on: []
composes_with: [081KRFA460008QG0R000VKJF0H, 081KRQ1AB0008QG0R000GZEMCR]
tags: [github, rulesets, enterprise, governance, policy-as-code, dv2-smell]
type: feature
---

# Enterprise GitHub ruleset management

## Origin

Aaron 2026-05-16, immediately after creating a "light default" enterprise-level ruleset at <https://github.com/enterprises/lucent-financial-group/settings/policies/code/16490134>:

> *"we should backlog enterpirse ruleselt managment now we had started decomposing those too for our repo split later, they were smell we have backlog around this. but now enterpirse too not just individiual and team github mapping"*

Two reframings here:

1. **Surface expansion**: previously, ruleset management lived at two layers (individual repo settings + team/org level). Enterprise tier (newly active 2026-05-16 via the 30-day trial — see 081KRQ1AB0008QG0R000GZEMCR) adds a THIRD layer that cascades down to all member orgs. The light default Aaron just created is the enterprise-level baseline.

2. **DV2.0 ruleset-divergence smell composes here**: per `.claude/rules/dv2-data-split-discipline-activated.md`, ruleset divergence across the repo-split (081KRFA460008QG0R000VKJF0H) was already a known smell. The Enterprise layer multiplies the surface: now we have (individual repo) × (org) × (enterprise) potential divergence.

## What

A tracked work-stream for managing GitHub rulesets coherently across the three layers, with the Enterprise tier as the new top-level governance surface. Specifically:

1. **Inventory current rulesets** across all three layers:
   - Enterprise-level rulesets (just `16490134` — the light default Aaron created)
   - LFG org-level rulesets
   - Per-repo rulesets (Zeta repo, any others under LFG)
2. **Identify divergence smells** — places where layer-rules contradict, duplicate, or shadow each other
3. **Define authoritative-source policy**: which rule belongs at which layer? Default heuristic: enterprise = baseline floor; org = additions for LFG-specific needs; repo = exceptions where genuinely needed
4. **Codify as data** (long-term): the rulesets themselves should ideally live in repo (policy-as-code) and be applied via API rather than UI-clickthrough, so divergence becomes diffable and auditable

## Acceptance criteria

- [ ] Tool `tools/github/list-rulesets.ts` — enumerates rulesets at all 3 layers (enterprise / LFG / Zeta repo) via REST API; outputs structured JSON for diffing
- [ ] Tool `tools/github/audit-ruleset-divergence.ts` — compares rules across layers; flags duplicates, contradictions, shadowing
- [ ] `docs/governance/RULESETS.md` (or similar) — documents the layered policy + which rules belong at which layer
- [ ] Optional: `tools/github/apply-rulesets.ts` — applies rulesets from a YAML/JSON spec (policy-as-code; requires `admin:enterprise` scope for enterprise-layer writes)
- [ ] Composes with 081KRFA460008QG0R000VKJF0H (repo-split axis 3 — code/English smell test) — ruleset divergence is one face of that smell

## Why now

- Enterprise tier just landed (2026-05-16) — fresh-state opportunity to design the layered governance BEFORE the rulesets sprawl
- Aaron created the first enterprise-level ruleset (`16490134`); future rulesets will follow; without coherent management policy, each addition risks divergence
- Per `dv2-data-split-discipline-activated.md`: this is exactly the kind of partition-by-change-rate question DV2.0 catches — enterprise rules change rarely (hubs), org rules change occasionally (links), per-repo rules change often (satellites)

## Composes with

- 081KRFA460008QG0R000VKJF0H (axis 3 — Code/English with ruleset-divergence smell test; DV2.0 informs the smell)
- 081KRQ1AB0008QG0R000GZEMCR (LFG GitHub tier decision — Enterprise trial that created the new ruleset layer)
- `.claude/rules/dv2-data-split-discipline-activated.md` (the smell-detection framework this is downstream of)
- `.claude/rules/lfg-acehack-topology.md` (force-push blocked by non_fast_forward ruleset — concrete example of a layer-level rule)
- `.claude/rules/methodology-hard-limits.md` (rulesets ARE the policy-as-code substrate for governance hard-limits)

## Substrate-honest caveats

- This is a backlog row, not implementation. Concrete work starts when someone (Otto or human) picks it up
- Enterprise-layer write operations require `admin:enterprise` scope (current local PAT lacks it; would need refresh per `gh auth refresh -h github.com -s admin:enterprise`)
- The "policy-as-code" framing is aspirational; current state is UI-clickthrough at all 3 layers
- The light default ruleset Aaron created (`16490134`) is the starting point; we don't yet know what's IN it — Slice 1 (inventory) is the first concrete next step
- Tooling work depends on someone with admin:enterprise scope OR human-in-the-loop UI interaction

## Decomposition into implementation slices

| Slice | Description | Effort | Status |
|-------|-------------|--------|--------|
| 1 | `tools/github/list-rulesets.ts` — REST enumeration at all 3 layers | S | open |
| 2 | Manual audit: what's in `16490134`? + any LFG org rulesets? + Zeta repo rulesets? | S | open |
| 3 | `tools/github/audit-ruleset-divergence.ts` — diff layers, flag conflicts | M | open |
| 4 | `docs/governance/RULESETS.md` — authoritative policy doc | S | open |
| 5 | Optional: `tools/github/apply-rulesets.ts` — policy-as-code apply | L | open (deferred) |

## Open questions

1. **What's in ruleset `16490134`?** — Aaron's "light default" needs inventory before we design anything
2. **Are there other enterprise-level rulesets?** — and is `16490134` the only enterprise ruleset, or one of many?
3. **LFG org-level rulesets** — do any exist? The `lfg-acehack-topology.md` rule mentions `non_fast_forward` rule (host-enforced); is that org-level or repo-level on LFG?
4. **AceHack repo rulesets** — AceHack has its own rulesets (bypass-actor config per `mirror-sync` skill); separate from LFG. Out of scope here but worth noting
5. **Authority gradient**: at which layer should "no force-push to main" live? Enterprise (applies to all orgs) vs LFG-org (applies to all LFG repos) vs Zeta-repo (applies to Zeta only)
6. **Policy-as-code adoption**: when's the right time to move from UI-clickthrough to spec-driven? Probably after Slice 1+2 reveal the actual surface area

## Pre-start checklist

- [x] Prior-art search: `tools/github/` for any existing ruleset tooling (none expected; backlog row authoring time)
- [x] Dependency proof: no blockers; this is a fresh feature area
- [x] Layer-context confirmed via Aaron's 2026-05-16 framing + the `16490134` ruleset he created

## First-discovery — Slice 1+2 done ad-hoc (2026-05-16)

After Aaron granted `admin:enterprise` scope this session, the work for Slices 1 + 2 became immediately doable from the command line:

```bash
# Slice 1 (enumeration) — proven trivially
$ gh api enterprises/lucent-financial-group/rulesets --jq '[.[] | {id, name, target}]'
[{"id":16490134,"name":"Default","target":"branch"}]

# Slice 2 (audit) — full ruleset content
$ gh api enterprises/lucent-financial-group/rulesets/16490134
{
  "id": 16490134, "name": "Default", "target": "branch",
  "source_type": "Enterprise", "source": "lucent-financial-group",
  "enforcement": "active",
  "conditions": {"repository_name": {"include": ["~ALL"]}},
  "rules": [
    {"type": "deletion"},
    {"type": "non_fast_forward"},
    {"type": "copilot_code_review", "parameters": {
      "review_on_push": true, "review_draft_pull_requests": true
    }}
  ]
}
```

**Translated** — across all repos under LFG enterprise (`~ALL`):

1. **`deletion`** — block branch deletion (deletion of branches via API/UI is refused)
2. **`non_fast_forward`** — block force-push. Same content as the rule referenced in `.claude/rules/lfg-acehack-topology.md`, **but now this rule lives at the enterprise tier, cascading to all member orgs/repos.** Worth a tiny substrate update in `lfg-acehack-topology.md` clarifying the layer-of-residence.
3. **`copilot_code_review` with `review_on_push: true, review_draft_pull_requests: true`** — every push fires a Copilot code review; every draft PR gets one. Each review consumes a Copilot premium request, which means cost compounds with push frequency.

### Cost-composition note (load-bearing for Enterprise trial)

The `copilot_code_review` rule will consume Copilot premium requests on every push. Composes-cleanly with the Enterprise-trial spending-limit work:

- Enterprise rule enables Copilot reviewing → fires on every push (potentially many during active development)
- Spending limit set to `$0` for Copilot premium requests → fail-closes once included credits exhaust
- Net effect: reviews happen freely within included credits; stop cleanly when the budget hits zero; no surprise overage

The composition is healthy IFF the spending limit is set BEFORE the included Copilot budget exhausts. Aaron is setting `$0` limits via the billing UI (UI-only — the GitHub billing API redesign doesn't expose write endpoints for spending limits, even with `manage_billing:enterprise` scope).

### Why the ad-hoc work doesn't replace Slices 1+2 implementation

The command-line discoveries above answered the immediate audit questions but did NOT create reproducible tooling. The slices remain open because:

- Future-Otto needs to re-enumerate after any ruleset addition; the script needs to exist as substrate
- The audit table format needs to be machine-parseable for cross-layer diff (Slice 3)
- Policy-as-code apply (Slice 5) needs the read-side to inform the write-side schema

Slices 1+2 implementation is now well-understood (one `gh api` call each); coding them up is small follow-on work.

### Updated answers to Open questions

| Open Q | Answer (2026-05-16 first-discovery) |
|---|---|
| 1. What's in `16490134`? | See JSON above — 3 rules: deletion, non_fast_forward, copilot_code_review |
| 2. Other enterprise rulesets? | NO — `16490134` is the only one currently |
| 3. LFG org-level rulesets? | (Still open — needs separate `gh api orgs/Lucent-Financial-Group/rulesets` call) |
| 4. AceHack rulesets | Out of scope; documented in `mirror-sync` skill |
| 5. Authority gradient for `non_fast_forward` | EMPIRICALLY at enterprise tier (`16490134`). Cascades to all member orgs/repos. |
| 6. Policy-as-code adoption | Still deferred to Slice 5; UI-clickthrough is the current surface for enterprise rulesets (read API works; write API surface for some operations may still need investigation) |
