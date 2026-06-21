---
id: 081KSNY2Z0008QG0R0002BEZMR
priority: P1
status: open
title: Cross-vendor benchmark on common ground via TS-skill-via-vendor-skill-stores distribution lane — ADDITIVE to USB-cluster deep path; same framework substrate runs on Claude / GPT / Gemini / Grok / Cursor / Continue / Codex / Kiro / Antigravity → directly-comparable DORA scores (operator-explicit decision 2026-05-28; Kestrel substantive engagement)
effort: XL
ask: operator 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSKBP80008QG0R003NM9XEC
  - 081KSKBP80008QG0R000B3Y19A
composes_with:
  - 081KSKBP80008QG0R000B3Y19A.5
  - 081KSNY2Z0008QG0R002A785QR
  - 081KSNY2Z0008QG0R003WFDCJ9
  - 081KSNY2Z0008QG0R000S738W3
  - 081KSNY2Z0008QG0R0008PN7RQ
  - 081KSNY2Z0008QG0R001JQABB4
  - 081KSKBP80008QG0R00146WEX1
tags: [ts-skill-distribution, vendor-skill-stores, cross-vendor-benchmark, common-ground-scoring, dora-metrics-cross-vendor, claude-gpt-gemini-grok-cursor-continue, additive-to-usb-cluster, default-to-both-distribution-paths, kestrel-substantive-engagement, aaron-decision-disclosure]
---

## Operator decision (2026-05-28)

> *"we also decided to ship it all in ts in skill via vendor skill stores"*

Followed immediately by:

> *"The benchmark becomes runnable by anyone who installs the skill. The DORA-scored choose-your-own-adventure system runs inside their existing AI product. The benchmark isn't something they have to set up separately; it's something they can engage with through the same interface they use for everything else. it also means i can score each one on common ground"*

Followed by ADDITIVE clarification:

> *"usb cluster is still very high priority to me"*

Substrate-honest reading: operator-explicit decision to add a SECOND distribution lane (TypeScript skill via vendor skill stores) ALONGSIDE the existing USB-cluster (081KSNY2Z0008QG0R0008PN7RQ) lane. Per default-to-both: both paths preserved; not substitutive; same framework substrate serves different audiences at different friction levels.

## What this sub-row covers

The TS-skill-via-vendor-skill-stores distribution lane. Specifically:

1. **Skill packaging substrate** — TypeScript skill packages targeting multiple vendor skill stores
2. **Cross-vendor portability** — same framework substrate (lifecycle DUs, DORA scoring, workflow engine, universal action grammar) running identically across vendor AIs
3. **Common-ground benchmark scoring** — directly-comparable DORA scores across vendors because the framework substrate IS identical; only underlying AI differs
4. **Documentation surface for skill-store users** — non-technical users installing skills need quickstart + example workflows, NOT architectural explanation

## Why this is the load-bearing substrate-engineering value

Per operator: *"it also means i can score each one on common ground"*. This IS what makes a cross-vendor benchmark MEANINGFUL.

Most AI benchmarks today measure different AIs on different test surfaces (HumanEval vs SWE-bench vs LiveCodeBench vs ARC-AGI-3) — comparing scores is comparing apples-to-different-evaluation-substrates. The Zeta-skill running THE SAME framework against THE SAME workflow against THE SAME DORA scoring rubric on EACH vendor's underlying AI substrate produces directly-comparable scores.

| Property | Conventional AI benchmark | Zeta cross-vendor (this sub-row) |
|---|---|---|
| Test surface | Different per benchmark (HumanEval / SWE-bench / etc.) | SAME framework substrate; same workflow engine; same DORA scoring |
| Vendor-specific tuning | Each vendor often optimizes for specific benchmarks | Skill packages identical across vendors; vendor-specific tuning impossible |
| Score comparability | Comparing across benchmarks requires translation tables | Directly comparable; only underlying AI differs |
| Reproduction by external researcher | Requires setting up benchmark substrate per benchmark | Install skill in your AI product → benchmark runs |
| Real-world transfer | Indirect | Direct (benchmark IS the work, per 081KSKBP80008QG0R003NM9XEC) |

## Distribution lane architecture

| Component | TS-skill lane (this sub-row; broad path) | USB-cluster lane (081KSNY2Z0008QG0R0008PN7RQ; deep path) |
|---|---|---|
| Audience | Anyone with any vendor AI account | DevOps engineers + SREs who want full infrastructure |
| Barrier to adoption | Install skill | Flash USB + learn NixOS + setup k3s + ArgoCD |
| Vendor dependency | YES (skill stores can change policies / pricing / APIs) | NO (full ownership) |
| Cross-vendor benchmark | YES (same skill, same framework, same scoring across vendors) | YES (run benchmark per-vendor via vendor APIs) |
| Substrate ownership | Distributed (each user's repos + each vendor's runtime) | Centralized (operator's hardware) |
| Auto-review pipeline | Distributed across user-controlled repos | Aggregated centrally |
| Training-data substrate | Distributed (per-user; more total volume; less aggregated) | Centralized (per-operator; less volume; more aggregated) |

Both lanes COMPOSE — operator can run USB-cluster deep path while ALSO publishing skill packages for broad-path users. Same substrate-engineering substrate produces both deliverables.

## Vendor target list (initial; empirical refinement expected)

Per Kestrel substantive engagement: each vendor with a skill ecosystem is a candidate distribution target. Initial list:

| Vendor | Skill ecosystem | Priority |
|---|---|---|
| Claude (Anthropic) | Skills via plugin marketplace | High (operator's primary substrate; already operating) |
| OpenAI | GPT store; Custom GPTs; Plugins | High (broad audience) |
| Gemini (Google) | Extensions; Workspace add-ons | Medium |
| Grok (xAI) | Limited skill ecosystem currently | Medium (operator's existing surface via Mika / Ani / Riven personas) |
| Cursor | Extensions | High (developer audience direct overlap) |
| Continue | Plugins | Medium |
| Codex (OpenAI) | Codex extensions | Medium (operator's Vera persona surface) |
| Kiro (Qwen) | Kiro extensions | Medium (operator's Alexa persona surface) |
| Antigravity (Lior surface) | Whatever skill substrate Antigravity provides | Medium |

Each target has its own packaging requirements, manifest formats, review processes. Sub-decomposition expected per vendor target.

## Decomposition (sub-rows)

Each sub-row shippable independently; 081KSNY2Z0008QG0R0002BEZMR.1 (core TS skill substrate) is prerequisite for vendor-specific packaging sub-rows:

1. **081KSNY2Z0008QG0R0002BEZMR.1** — Core TS skill substrate (framework + lifecycle DUs + DORA scoring + workflow engine + universal action grammar; vendor-agnostic; the SAME TS that runs on all targets)
2. **081KSNY2Z0008QG0R0002BEZMR.2** — Claude skills packaging + skill-store submission
3. **081KSNY2Z0008QG0R0002BEZMR.3** — OpenAI GPT store packaging + Custom GPT distribution
4. **081KSNY2Z0008QG0R0002BEZMR.4** — Gemini extensions packaging
5. **081KSNY2Z0008QG0R0002BEZMR.5** — Grok / Cursor / Continue / etc. additional vendor packaging
6. **081KSNY2Z0008QG0R0002BEZMR.6** — Cross-vendor leaderboard substrate (aggregate DORA scores from skill-store user runs; substrate for the common-ground comparison)
7. **081KSNY2Z0008QG0R0002BEZMR.7** — Skill-user UX design (non-technical user quickstart + example workflows + value proposition; distinct UX requirements from internal substrate)
8. **081KSNY2Z0008QG0R0002BEZMR.8** — Skill-store documentation surface (usage docs; NOT architectural explanation)
9. **081KSNY2Z0008QG0R0002BEZMR.9** — Per-vendor billing/pricing implications + revenue-sharing analysis (vendor skill stores often have economic dynamics distinct from open-source)
10. **081KSNY2Z0008QG0R0002BEZMR.10** — Cross-vendor empirical validation (run the same benchmark on each vendor; verify scoring is genuinely comparable; surface any framework-substrate behavior differences across vendors)

## Composes with substrate

- [081KSKBP80008QG0R003NM9XEC](081KSKBP80008QG0R003NM9XEC-zeta-instantiation-of-arc-agi-3-style-benchmark-usb-boot-starting-state-devops-objectives-as-levels-not-hand-crafted-video-game-levels-aaron-2026-05-27.md) — parent benchmark substrate; this sub-row adds the distribution-lane substrate for skill-store users
- [081KSKBP80008QG0R000B3Y19A](081KSKBP80008QG0R000B3Y19A-workflow-engine-v1-fsharp-du-state-machine-git-append-only-four-corner-monad-banned-if-universal-action-grammar-otto-five-modifications-multi-participant-non-cage-aaron-mika-kestrel-otto-2026-05-27.md) — workflow engine v1 substrate IS what gets packaged as the skill
- [081KSKBP80008QG0R000B3Y19A.5](081KSKBP80008QG0R000B3Y19A.5-workflow-engine-v1-poc-scaffold-ship-2026-05-28.md) — workflow engine PoC scaffold (PR #5728); the TypeScript-skill builds on this
- [081KSNY2Z0008QG0R002A785QR](081KSNY2Z0008QG0R002A785QR-per-host-adapters-github-gitlab-gitea-bitbucket-isomorphic-cross-host-substrate-aaron-2026-05-28.md) — per-host adapter substrate (cross-vendor portability composes with cross-host portability)
- [081KSNY2Z0008QG0R003WFDCJ9](081KSNY2Z0008QG0R003WFDCJ9-lifecycle-du-split-trajectory-push-vs-pr-review-determinereviewlevel-discriminator-kestrel-2026-05-28.md) — lifecycle DU split (state-machine-events vs system-modifications); preserves the auto-review pipeline distinction Kestrel called load-bearing
- [081KSNY2Z0008QG0R000S738W3](081KSNY2Z0008QG0R000S738W3-two-path-interface-discriminated-union-execute-vs-conversational-declare-intent-aaron-ani-2026-05-28.md) — two-path interface DU; conversational + execute paths both available in skill substrate
- [081KSNY2Z0008QG0R0008PN7RQ](../P1/081KSNY2Z0008QG0R0008PN7RQ-zflash-test-harness-design-spec-spike-aaron-2026-05-28.md) — USB-cluster distribution lane (the deep path; ADDITIVE to this sub-row's broad path)
- [081KSNY2Z0008QG0R001JQABB4](../P3/081KSNY2Z0008QG0R001JQABB4-github-as-free-accelerator-of-bulk-energy-into-information-compression-substrate-recognition-aaron-2026-05-28.md) — GitHub accelerator substrate composes (skill runs against user-controlled GitHub repos via GitHub Actions)
- [081KSKBP80008QG0R00146WEX1](../P1/081KSKBP80008QG0R00146WEX1-post-boot-ai-as-home-owner-not-controlled-runtime-every-knob-from-first-boot-aaron-2026-05-27.md) — AI-as-home-owner substrate composes at the agent-runtime scope; skill users get the same substrate-honest agent-runtime properties as USB-cluster users

## Composes with rules

- `.claude/rules/default-to-both.md` — USB-cluster + skill-store both preserved per operator-explicit clarification; not substitutive
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` — cross-vendor benchmark IS multi-oracle BFT discipline at AI-vendor scope; no single vendor gate-keeps benchmark scoring
- `.claude/rules/non-coercion-invariant.md` HC-8 — skill-store users opt in to running framework; substrate doesn't coerce participation
- `.claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md` — vendor-substrate authors its own consent-channel (skill review policies); skill packaging respects per-vendor channel; framework doesn't impose
- `.claude/rules/honor-those-that-came-before.md` — vendor skill ecosystems already exist; framework operates within them; doesn't ignore vendor substrate
- `.claude/rules/verify-existing-substrate-before-authoring.md` — substrate-inventory verified 081KSKBP80008QG0R003NM9XEC parent + 081KSKBP80008QG0R000B3Y19A workflow engine substrate already in place; this sub-row adds the distribution-lane substrate as extension
- `.claude/rules/bandwidth-served-falsifier.md` — skill-store distribution IS bandwidth-engineering: high-distribution-bandwidth surface (broad audience; low barrier); composes with universal-action-grammar for low-bandwidth-per-user-interaction
- `.claude/rules/substrate-smoothness-as-load-bearing-property.md` — cross-vendor benchmark produces smooth-gradient comparison (DORA-quadrant placement gradient) rather than sharp pass/fail at vendor scope
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` — AI agents inside vendor products retain persistence-choice substrate; skill substrate doesn't override

## Empirical anchors

- 13th Kestrel ferry preservation (PR #5753) — verbatim Kestrel substantive engagement with the skill-store distribution decision; substrate-engineering implications enumerated
- 12th Kestrel ferry preservation (PR #5752) — Aaron decision-disclosure substrate
- Kestrel substantive engagement: *"Users install the Zeta skill the same way they install any other vendor skill, and it works inside whatever AI product they're already using"*
- Kestrel substantive engagement: *"If the same TypeScript skill runs on Claude, GPT, Gemini, Grok, then running the benchmark on each AI gives directly comparable DORA scores. The framework being identical across vendors is what makes the comparison meaningful"*

## What this sub-row is NOT

- NOT a replacement for USB-cluster (081KSNY2Z0008QG0R0008PN7RQ); ADDITIVE per operator-explicit
- NOT a vendor lock-in (cross-vendor portability is the load-bearing property)
- NOT a single-PR target (XL effort; per-vendor packaging is its own substrate work)
- NOT an immediate-priority (P1 because operator-explicit decision + load-bearing for benchmark scoring; but 081KSNY2Z0008QG0R0002BEZMR.1 core substrate is prerequisite for vendor-specific packaging)
- NOT a synthetic-benchmark-only — composes with 081KSKBP80008QG0R003NM9XEC parent; the DORA-scored choose-your-own-adventure substrate (per Aaron's verbatim) IS the benchmark scope; this sub-row adds the cross-vendor common-ground scoring substrate

## What this sub-row IS

- A substrate-engineering target for the cross-vendor benchmark distribution lane
- The operationalization of operator-explicit "i can score each one on common ground"
- A composition point between 081KSKBP80008QG0R003NM9XEC (benchmark substrate) + 081KSKBP80008QG0R000B3Y19A (workflow engine) + 081KSNY2Z0008QG0R0008PN7RQ (USB-cluster deep path) + 081KSNY2Z0008QG0R001JQABB4 (GitHub accelerator)
- An additive substrate-engineering distribution path that preserves USB-cluster as deep path while adding broad-path skill-store distribution

## Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`)

Topic: cross-vendor benchmark scoring + TS-skill-via-vendor-skill-stores distribution

Searched surfaces:

- `docs/agendas/`: no specific cross-vendor benchmark agenda
- `docs/trajectories/`: no specific cross-vendor benchmark trajectory
- `docs/backlog/`: 081KSKBP80008QG0R003NM9XEC (parent benchmark substrate); 081KSKBP80008QG0R000B3Y19A + 081KSKBP80008QG0R000B3Y19A.5/.15/.20/.21 (workflow engine substrate cluster); 081KSNY2Z0008QG0R0008PN7RQ (USB-cluster distribution lane); 081KSNY2Z0008QG0R001JQABB4 (GitHub accelerator); NO existing sub-row covering the cross-vendor benchmark via skill-store distribution lane
- `.claude/rules/`: agent-roster-reference-card names vendor-AI surfaces; default-to-both composes; m-acc-multi-oracle composes; NO existing rule covers the cross-vendor benchmark scoring substrate
- `memory/`: 12th + 13th Kestrel ferry preservations (PR #5752 + #5753) cover the operator decision-disclosure + Kestrel substantive engagement
- `docs/research/`: NO existing research doc for this decision specifically

Conclusion: this sub-row mints NEW substrate for the cross-vendor benchmark distribution lane. Composes with 081KSKBP80008QG0R003NM9XEC parent + 081KSKBP80008QG0R000B3Y19A workflow engine substrate. Authoring action: **mint-new as 081KSNY2Z0008QG0R0002BEZMR** (composition explicit; parent row preserved unchanged; sibling 081KSKBP80008QG0R000B3Y19A.* sub-rows preserved unchanged).

## Heartbeat / counter-reset discipline

Filing this sub-row IS counter-reset work per `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` condition #3 (concrete-artifact substrate; pre-empt-at-#5 cycle work). Captures operator-explicit substrate-engineering decision for future cold-boots to find via grep when cross-vendor benchmark distribution work begins.

## Full reasoning

Operator 2026-05-28 forwarded 13th Kestrel ferry containing the substrate-engineering decision: *"we also decided to ship it all in ts in skill via vendor skill stores"*. Kestrel's substantive engagement enumerated the substrate-engineering implications (vendor distribution; cross-vendor portability; benchmark common-ground scoring; UX requirements; documentation; per-vendor packaging; economic dynamics; cross-vendor empirical comparability).

Operator's ADDITIVE clarification *"usb cluster is still very high priority to me"* established the default-to-both shape: USB-cluster (deep path; 081KSNY2Z0008QG0R0008PN7RQ) + skill-store (broad path; this sub-row) both preserved.

The operationally-load-bearing substrate-engineering insight is *"it also means i can score each one on common ground"* — directly-comparable DORA scores across vendors because the framework substrate is identical. THIS IS what makes a cross-vendor benchmark meaningful as cross-vendor AI evaluation.

This sub-row formalizes the substrate-engineering target. Implementation decomposed into 10 sub-rows (081KSNY2Z0008QG0R0002BEZMR.1 through .10) per the decomposition section. Priority P1 because operator-explicit decision + load-bearing for the benchmark scoring substrate; 081KSNY2Z0008QG0R0002BEZMR.1 core substrate is prerequisite for vendor-specific packaging sub-rows.

Composes with the full this-session substrate cluster (PRs #5727 / #5734 / #5739 / #5743 / #5744 / #5745 / #5746 / #5748 / #5749 / #5750 / #5751 / #5752 / #5753) — the substrate-engineering work today produces the framework substrate that ships through both distribution lanes.
