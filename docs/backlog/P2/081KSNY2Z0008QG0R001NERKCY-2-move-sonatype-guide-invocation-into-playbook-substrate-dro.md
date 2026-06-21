---
id: 081KSNY2Z0008QG0R001NERKCY
priority: P2
status: open
title: Move sonatype-guide invocation into playbook substrate — drop PR-gated review; no vendor lockin per operator 2026-05-28 "we are getting rid of PRs mostly for playbooks"
effort: S
ask: aaron 2026-05-28 (Q3 decision locked: PRs not worth the vendor lockin for sonatype-guide)
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R001DFZK4V
  - 081KSNY2Z0008QG0R000S738W3
composes_with:
  - 081KSNY2Z0008QG0R001DFZK4V
  - 081KSNY2Z0008QG0R000S738W3
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R000E5KTPX
  - 081KSNY2Z0008QG0R002A785QR
tags:
  - sonatype-guide-into-playbook
  - drop-pr-gated-review-no-vendor-lockin
  - zeta-native-substrate-replaces-github-pr-convenience
  - same-audit-no-pr-machinery
  - composes-with-zeta-native-review-substrate-b-0887
  - composes-with-two-path-interface-b-0867-21
  - operator-decision-locked-2026-05-28
---

## Operator decision 2026-05-28

> *"we are getting rid of PRs mostly for playbooks unless you tell me it's worth the vendor lockin"*

Locks Q3 of 081KSNY2Z0008QG0R0037X4DP4 library landscape audit. Sonatype-guide does NOT justify keeping PRs. Move the invocation into the playbook substrate.

## What this row tracks

Reframe sonatype-guide invocation from "PR-time gate" (where reviewer bot invokes it via PR comment workflow) to "playbook step" (where any agent invokes it as part of the library-evaluation playbook). Same audit happens; no GitHub vendor lockin.

## What we LOSE by dropping PR-gated sonatype-guide

- GitHub status-check UI integration for sonatype results (don't need it; trajectory-async-review per 081KSNY2Z0008QG0R000F0C5V0 replaces it)
- Reviewer-bot integration where Copilot/sonatype-bot post PR comments (replaced by 081KSNY2Z0008QG0R001DFZK4V Zeta-native review substrate's playbook-based reviewer-agent invocations)
- Required-checks gating before merge (replaced by 081KSNY2Z0008QG0R001DFZK4V path-protection; sonatype-step happens BEFORE the path-protected fast-lane push, not after)
- Per-line code-comment workflow for sonatype findings (replaced by playbook sections as review threads)

## What we GAIN

- **Vendor-independence** — same playbook runs on GitHub / GitLab / Gitea / Bitbucket per 081KSNY2Z0008QG0R002A785QR per-host adapters
- **Full throttle** — no GraphQL rate limits on PR-comment posting
- **Self-hosted deployment** — operator can run sonatype-guide locally; results land in playbook event-log (per 081KSNY2Z0008QG0R001K6HJ7Z) instead of GitHub-PR-comment
- **Composability with workflow engine** — sonatype-guide invocation is a MenuOption / DU case in the agent-loop state machine; reuses the same playbook substrate that handles every other agent decision

## Architecture

### Current state (PR-time gate)

Operator/reviewer-bot invokes sonatype-guide via `gh pr comment` or via reviewer-bot triggered on PR-open. Findings post as PR comments. Required check turns red if findings exceed threshold.

### Target state (playbook step)

Library-evaluation playbook includes a step:

```markdown
## Step 3 — Sonatype security audit

[playbook-action: invoke-sonatype-guide]
- package: pkg:npm/@noble/post-quantum
- expected-outcome: pass | warn | fail
- threshold: deny on CVSS >= 7.0 OR known-malicious
- on-pass: emit event "sonatype-passed" + continue playbook
- on-warn: emit event "sonatype-warned" + require operator-acknowledgment menu-option
- on-fail: emit event "sonatype-failed" + halt playbook + escalate via shadow envelope
```

Playbook step runs via the agent-loop state machine; result is a state-machine event written to the fast-lane folder (per 081KSNY2Z0008QG0R000E5KTPX) on main; trajectory-async-review (per 081KSNY2Z0008QG0R000F0C5V0) surfaces the results for operator scan.

### Composition with 081KSNY2Z0008QG0R000S738W3 two-path interface

- DU path = invoke sonatype-guide via structured MenuOption (`{ tag: "RunSonatypeGuide", packageUrl: "..." }`)
- Conversational path = operator OR reviewer-agent writes intent in playbook document: "audit this package before pull"

Both paths feed same event log; sonatype-guide invocation is a first-class workflow step, not a GitHub PR ceremony.

## Acceptance criteria

- `src/Core.TypeScript/workflow-engine/agent-loop/menu-options/sonatype-guide.ts` — MenuOption case + handler that invokes sonatype-guide MCP server with structured package URL + threshold config
- Playbook template at `docs/playbooks/library-evaluation.md` (or similar) that includes the sonatype-guide step as canonical part of library-pull workflow
- Tests cover: pass / warn / fail paths; threshold enforcement; event emission to fast-lane folder; operator-acknowledgment flow for warn case
- README documents the migration: existing PR-comment workflow → playbook-step workflow; reviewer-bot config update (sonatype-bot can be retired OR repurposed as playbook reviewer-agent)

## Composition

- **081KSNY2Z0008QG0R001DFZK4V** (Zeta-native review substrate — parent; sonatype-guide is one specific reviewer in the substrate)
- **081KSNY2Z0008QG0R000S738W3** (two-path interface — sonatype-guide invocation works via both DU + conversational paths)
- **081KSKBP80008QG0R000B3Y19A** (workflow engine — sonatype-guide MenuOption + handler)
- **081KSNY2Z0008QG0R000E5KTPX** (folder-based fast-lane on main — sonatype-guide results land here)
- **081KSNY2Z0008QG0R002A785QR** (per-host adapters — playbook step works isomorphically across hosts)

## Substrate-honest framing

P2 — substrate-honest re-scoping of an existing workflow. The audit itself doesn't change; only the invocation surface moves. Small effort once the underlying 081KSNY2Z0008QG0R001DFZK4V substrate is operational; until then, the existing PR-comment workflow continues during transition.

## Full reasoning

Operator 2026-05-28 in response to 081KSNY2Z0008QG0R0037X4DP4 Q3: *"we are getting rid of PRs mostly for playbooks unless you tell me it's worth the vendor lockin"*.

Otto's recommendation: NOT worth the vendor lockin. Sonatype-guide is a check against package URLs; same check runs in playbook substrate without GitHub-PR-coordination. Composes with the broader 081KSNY2Z0008QG0R001DFZK4V / 081KSNY2Z0008QG0R000E5KTPX / 081KSNY2Z0008QG0R000S738W3 architecture moving toward Zeta-native review.
