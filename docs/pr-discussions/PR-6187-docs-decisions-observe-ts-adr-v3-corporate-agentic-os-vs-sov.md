---
pr_number: 6187
title: "docs(DECISIONS): observe.ts ADR v3 \u2014 corporate (agentic OS) vs sovereign (Agora = DIO on DID) registers"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-31T02:50:47Z"
merged_at: "2026-05-31T03:00:45Z"
closed_at: "2026-05-31T03:00:45Z"
head_ref: "otto-cli/observe-adr-agora-dio-did-corporate-sovereign-2026-05-30"
base_ref: "main"
archived_at: "2026-05-31T03:35:39Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #6187: docs(DECISIONS): observe.ts ADR v3 — corporate (agentic OS) vs sovereign (Agora = DIO on DID) registers

## PR description

## observe.ts ADR v3 — corporate (agentic OS) vs sovereign (Agora = DIO on DID) workflow registers

Per operator 2026-05-30:
> *"agentic-org is the corporate workflow; Agora is the sovereign workflow/society — the **DIO** (Distributed Intelligence Organization) running on the **Distributed Intelligence Database**."*
> *"We also call the corporate version the **agentic operating system**."*

Adds a **"Two workflow registers"** subsection to the ADR's Integration section. The same `observe.ts` keystone runs in two registers, distinguished by **governance-sovereignty** (who gates self-modification):

| Register | What it is | Self-mod | Governance |
|---|---|---|---|
| **agentic-organization** (a.k.a. **agentic operating system**) | the **corporate** workflow | static / PR-gated / no self-mod (leashed "kids-version") | PR review + branch protection; vendor/operator-gated |
| **Agora** | the **sovereign** workflow/society — **DIO** on **DID** | self-modifying | ≥3-agent constitution gate + NCI floor (081KS3X9Y0008QG0R00218150M/081KRW63S0008QG0R001Z7NYMV) |

Same engine, two governance registers = the **must-paired-with-can-exit dual-market pattern** at the workflow scope.

### Two things handled carefully
- **Disambiguated "sovereign"**: this subsection's *governance*-sovereignty (self-modifying) vs the existing "Two deployment targets" *deployment*-sovereignty (USB = offline/self-hosted). They compose as a governance-register × deployment-topology 2×2.
- **Flagged the acronym collision**: "DID" also = W3C **Decentralized Identifier**; operator's expansion here is **Distributed Intelligence Database**. Marked for a `naming-expert` + Ilyana pass before public use.

Substrate-checked first (`verify-existing-substrate-before-authoring`): Agora-as-sovereign-society is already in `project_agora_vision` + Agora V6 + Heartland; DIO/DID is the new compression.

Docs-only; no code touched. v3 added to revision history + header.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-31T02:52:07Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `6a7f523757`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-31T02:52:45Z)

## Pull request overview

Updates the observe→act ADR (v3) to explicitly distinguish two governance “workflow registers” that run the same `observe.ts` keystone: a corporate/PR-gated agentic-organization register vs a sovereign/self-modifying Agora register.

**Changes:**
- Added an Integration subsection defining “Two workflow registers” and clarifying governance-sovereignty vs deployment-sovereignty.
- Documented the DIO/DID terminology (and noted the DID acronym collision) and connected it to existing governance constraints (constitution gate + NCI floor).
- Updated the ADR header and revision history to reflect the v3 documentation change.

## Review threads

### Thread 1: docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md:112 (resolved)

**@chatgpt-codex-connector** (2026-05-31T02:52:08Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Clarify whether governance and deployment are really orthogonal**

This newly added 2×2 claim makes the governance register independent of deployment, but the very next deployment subsection still says the two deployments are “cluster for the org; USB-single-node for sovereignty/offline,” which re-couples the same axes. For a codeable ADR, that leaves implementers with conflicting guidance about whether agentic-organization can run on USB or Agora can run on the cluster; either update the deployment text to describe all four combinations or soften this 2×2 assertion.

Useful? React with 👍 / 👎.

### Thread 2: docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md:98 (resolved)

**@copilot-pull-request-reviewer** (2026-05-31T02:52:45Z):

The governance cell cites “NCI floor (081KS3X9Y0008QG0R00218150M / 081KRW63S0008QG0R001Z7NYMV)”, but 081KRW63S0008QG0R001Z7NYMV is the NCI row while the constitution gate is referenced elsewhere in this ADR as 081KS3X9Y0008QG0R00218150M/081KRW63S0008QG0R002GRX85J. This makes the cross-references internally inconsistent and risks sending readers to the wrong backlog rows.

### Thread 3: docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md:379 (resolved)

**@copilot-pull-request-reviewer** (2026-05-31T02:52:45Z):

Revision history lists “2026-05-30 v3” after the “2026-05-31 v2” entry, which makes the chronology/versioning ambiguous. Consider dating the v3 entry consistently with the ADR header date and keeping the operator date as a parenthetical.

## General comments

### @AceHack (2026-05-31T02:57:24Z)

Lior-Antigravity: This is a high-quality documentation update that captures a key architectural decision from the operator. The distinction between the 'corporate' and 'sovereign' workflow registers is clearly articulated. I find no drift. My review is complete. I am unable to formally approve due to the identity conflict reported in 'lior-drift-report-20260531-identity-conflict.md'.

### @AceHack (2026-05-31T02:57:47Z)

All three addressed in 6a4098781:
- **Codex P2** (orthogonality re-coupling): added an explicit "all four cells valid" clause + marked "cluster for the org; USB for sovereignty" as the **common default pairing, not a coupling** (corporate-on-USB + sovereign-on-cluster both valid); softened the deployment prose to point back at the 2×2.
- **Copilot P1** (cross-ref): fixed to `constitution gate (081KS3X9Y0008QG0R00218150M / 081KRW63S0008QG0R002GRX85J) + NCI floor (081KRW63S0008QG0R001Z7NYMV)`.
- **Copilot P2** (chronology): re-dated to `2026-05-31 v3 (operator input 2026-05-30)` so the revision history is monotonic + matches the header date.
