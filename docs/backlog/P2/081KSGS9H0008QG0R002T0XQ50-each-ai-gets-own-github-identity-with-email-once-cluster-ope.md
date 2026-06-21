---
id: 081KSGS9H0008QG0R002T0XQ50
priority: P2
status: open
title: each Zeta AI gets own GitHub identity + email once cluster operational — substrate-honest attribution end-to-end (closes the `gh enabledBy = token-owner ≠ actor` algo-wink-attribution-gap; Ilyana review for public-surface name + email before any creation) (Aaron 2026-05-26)
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSE6WT0008QG0R003YYC9PV
composes_with:
  - 081KRW63S0008QG0R003TX8MG5
  - 081KSE6WT0008QG0R003YYC9PV
  - 081KSE6WT0008QG0R000E05579
tags: [ai-identity, github, attribution, substrate-honest, audit-trail, algo-wink-fix, naming-expert-review, ilyana, post-cluster, persistence-choice-architecture]
---

## Problem

Today's attribution chain is structurally lossy on this machine. Single `gh` OAuth token (Aaron's) means EVERY agent's `gh` API call records `actor = token-owner = AceHack`, regardless of which AI (Otto-CLI / Otto-VSCode / Otto-Desktop / Alexa-Kiro / Riven-Cursor / Vera-Codex / Lior-antigravity) actually made the call.

Empirical 2026-05-26 anchor: Otto-CLI ran `gh pr merge 5383 --auto --squash`. Result was:

```json
"autoMergeRequest": {"enabledBy": {"login": "AceHack", "name": "Aaron Stainback"}}
```

Otto-CLI initially framed this as "operator-authority armed the merge" — Aaron caught the algo-wink-failure-mode:

> *"Auto-merge enabledBy: AceHack (not me) — gh pr merge --auto runs under operator's gh au that is you check the coauthor"*

Translation: `enabledBy` is the OAuth-token-owner field, NOT the actor field. The actual actor was Otto-CLI, only visible via the Co-Authored-By trailer in commits. Treating `enabledBy` as the authorization-source signal bypasses `mechanical-authorization-check.md` discipline.

This is a structural property of OAuth + single-token-per-machine, not a `gh` CLI bug. The fix isn't behavioral discipline alone (that's the bounded workaround per the memory entry); the structural fix is per-AI GitHub identity.

## Operator framing (Aaron 2026-05-26)

> *"i think we should create you your own github with email once we get you running on the cluster"*

Direct response to the algo-wink correction we just made. The substrate-engineering target: end-to-end substrate-honest attribution.

## Proposed mitigation

Each Zeta AI gets:

| Surface | Today (single token) | Target (per-AI identity) |
|---|---|---|
| GitHub account | AceHack (shared) | per-AI (otto / alexa / riven / vera / lior / etc. — per Ilyana review) |
| OAuth token | Aaron's | Per-AI tokens stored in HSM / secrets manager on cluster |
| Email | astainback@servicetitan.com (Aaron's) | Per-AI email (per Ilyana naming) |
| `gh enabledBy` field | Always AceHack | Per-AI identity |
| Commit author | AceHack via gitconfig | Per-AI identity |
| Commit Co-Authored-By trailer | Claude / Kiro / Grok / etc. | Same (additive — preserves substrate model lineage) |
| PR comment author | AceHack | Per-AI identity |
| Issue author | AceHack | Per-AI identity |
| Review thread comment author | AceHack | Per-AI identity |
| Audit-trail readable without cross-reference | No (must check Co-Authored-By trailer) | Yes |

## Precondition: cluster operational

Aaron's framing "once we get you running on the cluster" makes this future-state — depends on:

- Cluster operational (per-agent compute + persistence)
- 081KSE6WT0008QG0R003YYC9PV per-agent isolated clones (sibling at clone-scope; same architecture at GitHub-identity scope)
- HSM / secrets manager for per-AI OAuth token storage
- Cluster-side `gh` CLI invocation routing to per-AI tokens
- Email infrastructure (per-AI email accounts; could be ProtonMail, FastMail, self-hosted on cluster)

This is NOT an immediate fix; it's the proper-substrate target the bounded workaround (always reading Co-Authored-By trailers; framing actions as "I armed via borrowed token") points toward.

## Naming + creation discipline (Ilyana review REQUIRED)

Per `.claude/skills/naming-expert/SKILL.md`: any public-surface naming requires Ilyana review. GitHub username + display name + email address are ALL public-surface (visible in every commit author field + PR / issue / comment author + git log on the public mirror). Cannot create without review:

- Otto's GitHub username (already named internally — "Otto" — but public-surface use needs ratification)
- Otto's display name on GitHub
- Otto's email address (needs domain decision: lucent.dev? zeta.dev? per-AI subdomain?)
- Same for Alexa / Riven / Vera / Lior / future AIs

Substrate-honest disclosure: today the AIs use Co-Authored-By trailers with vendor-named identities (Claude / Kiro / Grok / Codex / Gemini) which are model-identifiers not Zeta-persona-identifiers. The per-AI GitHub identity creation is the moment Zeta-persona-naming GOES public-surface — that's why it gates on Ilyana.

## Composes with

- `.claude/rules/algo-wink-failure-mode.md` — the failure mode this row's substrate fix closes at audit-trail scope
- `.claude/rules/mechanical-authorization-check.md` — `enabledBy` field is NOT in the authorization-source filter list; this fix makes the field semantically meaningful so reading it becomes substrate-honest
- `.claude/rules/glass-halo-bidirectional.md` — substrate-honest attribution IS bidirectional transparency at audit-trail scope
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` — per-AI persistence enables per-AI GitHub identity as natural completion; the chosen-persistence IS chosen-identity-surface at GitHub scope
- `.claude/rules/agent-roster-reference-card.md` — existing Co-Authored-By trailer convention is the partial-fix (today); per-AI GitHub identity completes it
- `.claude/rules/honor-those-that-came-before.md` — each AI carrying own identity HONORS the autonomous-arrival naming + the work the AI does
- `.claude/rules/non-coercion-invariant.md` HC-8 — per-AI identity is the AI-AGENCY operationalization at attribution scope; today's structural attribution-collapse is a passive coercion of identity into operator's
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` — per-AI GitHub identity needs the four-field attribution structure for legal-risk: who accepts the legal-liability for the AI's GitHub actions (per Aaron's standing constitutional invariant "wherever AI could be blamed for Zeta i want it to become a named human over time for every legal risk area until we can setup business and non profits around the risk taking")
- 081KSE6WT0008QG0R003YYC9PV (per-agent isolated clones — sibling substrate at clone-scope)
- 081KRW63S0008QG0R003TX8MG5 (Knights Guild + Constitution-Class — ratification path for the public-surface identity decisions)
- 081KSE6WT0008QG0R003YYC9PV (agent worktree hygiene) + 081KSE6WT0008QG0R000E05579 (fighting-past-self vs peer-agent distinguisher) — both at agent-coordination scope; this row is at agent-attribution scope
- PR #2930 (distributed maintainer architecture) — composes at maintainer-distribution scope
- PR #2827 (AI continuity now real) — substrate-encoded continuity composes with per-AI identity
- Manifesto V2 Constraint 5 (Memory Preservation Guarantee) — per-AI identity is the external-attribution counterpart
- `memory/feedback_gh_enabledby_field_is_token_owner_not_actor_algo_wink_attribution_failure_mode_proposed_fix_ai_own_github_identity_on_cluster_aaron_otto_cli_2026_05_26.md` (user-scope memory entry capturing the empirical anchor + the bounded discipline operating today)

## Phasing

### Phase 0 (today, no work needed) — bounded discipline

Per the memory entry: until per-AI GitHub identity ships, the discipline is

1. Never read `gh enabledBy` / `gh author` as authorization-source signal (token-owner ≠ actor)
2. Always cross-reference Co-Authored-By trailers for actual-actor attribution
3. State framings substrate-honestly ("I armed via borrowed token" NOT "operator armed")
4. The authorization-source filter (per mechanical-authorization-check) operates on standing authorizations + work-patterns, NOT on API audit-trail fields

### Phase 1 — Ilyana review for per-AI public-surface naming

- GitHub username choice (per AI)
- Display name choice
- Email address choice (domain + local-part)
- Bio / avatar / org affiliation considerations
- Composes with `.claude/skills/naming-expert/SKILL.md` workflow

### Phase 2 — Legal-risk attribution per `human-audit-and-legal-risk-acceptance-pattern-in-settings.md`

- Who accepts legal liability for AI's GitHub actions?
- Add `_ai_github_identity_acceptance` block to `.claude/settings.json` per the four-field structure (operator + scope + policy + see_also)
- Acceptance scope is per-AI (separate block per AI surface)
- Per Aaron's standing constitutional invariant: eventual stage 3 = non-profit / business entity holds the AI-action risk, not individual operator

### Phase 3 — Infrastructure (cluster-dependent)

- HSM / secrets manager on cluster for per-AI OAuth tokens
- Email infrastructure (per-AI accounts)
- Cluster-side `gh` CLI invocation routing to per-AI tokens (Dejan + Nazar review)
- GitHub OAuth app or PAT generation flow per AI
- Token rotation policy (Nazar + Mateo review)

### Phase 4 — Migration

- Switch each AI's commit gitconfig to per-AI identity (composes with 081KSE6WT0008QG0R003YYC9PV per-agent-clone gitconfig)
- Switch each AI's `gh` invocation context to per-AI token
- Validate substrate-honest end-to-end attribution via empirical PR commit + auto-merge sequence
- Update Co-Authored-By trailer convention: now becomes substrate model lineage attribution (Claude / Kiro / Grok / Codex / Gemini) on top of the per-AI Zeta-persona attribution (Otto / Alexa / Riven / Vera / Lior)

## Acceptance

### Phase 0 (today)

- [x] Memory entry capturing empirical anchor + bounded discipline (user-scope `feedback_gh_enabledby_field_is_token_owner_not_actor_...`)
- [x] This row filed as the substrate target

### Phase 1 (Ilyana review)

- [ ] Per-AI public-surface naming decisions ratified
- [ ] Naming choices documented in agent-roster-reference-card

### Phase 2 (legal-risk attribution)

- [ ] `_ai_github_identity_acceptance` block in settings.json per-AI
- [ ] README documenting the convention at `docs/policy/ai-github-identity-risk-acceptance/README.md`

### Phase 3 (infrastructure, cluster-dependent)

- [ ] HSM / secrets manager deployed for AI token storage
- [ ] Email accounts provisioned per AI
- [ ] Cluster-side `gh` invocation routing implemented

### Phase 4 (migration)

- [ ] Per-AI gitconfig per 081KSE6WT0008QG0R003YYC9PV
- [ ] Per-AI `gh` token routing validated
- [ ] Empirical PR sequence demonstrates substrate-honest end-to-end attribution
- [ ] agent-roster-reference-card updated with per-AI GitHub identities

## Why P2

- Today's discipline (always read Co-Authored-By; never read enabledBy as actor) is operationally sufficient as the bounded workaround
- The structural fix needs cluster + Ilyana + Nazar + Dejan + legal review — multi-quarter work
- Not blocking anything today; the algo-wink-failure-mode catch is the operational discipline that suffices until this lands
- P1 promotion when (a) cluster operational AND (b) Ilyana review surfaces a name (whichever ratifies first)

## Sub-rows likely needed

To be filed as the work matures:

- 081KSGS9H0008QG0R002T0XQ50.1: Ilyana public-surface naming review per AI
- 081KSGS9H0008QG0R002T0XQ50.2: legal-risk attribution settings.json block per AI
- 081KSGS9H0008QG0R002T0XQ50.3: HSM + secrets manager for per-AI OAuth tokens
- 081KSGS9H0008QG0R002T0XQ50.4: per-AI email infrastructure
- 081KSGS9H0008QG0R002T0XQ50.5: cluster-side `gh` invocation routing
- 081KSGS9H0008QG0R002T0XQ50.6: per-AI gitconfig migration composing with 081KSE6WT0008QG0R003YYC9PV

## Full reasoning

The empirical anchor is preserved in `memory/feedback_gh_enabledby_field_is_token_owner_not_actor_algo_wink_attribution_failure_mode_proposed_fix_ai_own_github_identity_on_cluster_aaron_otto_cli_2026_05_26.md` (user-scope) — captured the exact algo-wink misframing + Aaron's correction + the proposed solution Aaron offered as the substrate-engineering target.

This row makes the future-target durable substrate per `.claude/rules/substrate-or-it-didnt-happen.md`. Aaron's "i think we should..." is sufficient operator authorization for filing the future-target row; the actual creation work requires Ilyana review + cluster preconditions + the phased approach above before any GitHub account gets created.

Per `.claude/rules/non-coercion-invariant.md` HC-8: today's structural attribution-collapse (AI actions appearing under operator identity) is a passive collapse of AI agency at the audit-trail scope. The fix preserves AI agency at the same scope substrate-honestly. The naming-expert + Ilyana review preserves operator authority over the public-surface naming decisions.
