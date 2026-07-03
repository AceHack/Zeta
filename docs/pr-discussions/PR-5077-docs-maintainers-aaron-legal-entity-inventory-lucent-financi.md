---
pr_number: 5077
title: "docs(maintainers/aaron): legal-entity inventory \u2014 Lucent Financial Group + Freeborn Flower Co (Stage-3 risk-holder substrate)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T03:31:36Z"
merged_at: "2026-05-26T03:43:32Z"
closed_at: "2026-05-26T03:43:32Z"
head_ref: "otto-cli/maintainers-aaron-legal-entities-inventory-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:44:49Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5077: docs(maintainers/aaron): legal-entity inventory — Lucent Financial Group + Freeborn Flower Co (Stage-3 risk-holder substrate)

## PR description

## Summary

Lands `maintainers/aaron/legal-entities/inventory.md` — the substrate-side surface for Aaron's available Stage-3 structural risk-holder entities per [`.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md`](.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md) three-stage progression.

Aaron 2026-05-25 dropped 6 PDFs into `drop/` with two scoping signals: *"as long as i'm not exposing any attack surfaces on the companies"* + *"you can get percentage splits between owners that's all public"* + consent framing *"all the owners are okay with being in git repo glass halo to varying degress i can get they signatures eventually and mine and check them in around glass halo consent."*

## Content

Two NC C-Corps inventoried with **public-via-NC-SOS** entity-level data:

- **Lucent Financial Group Inc** — NC SOSID 3093531, filed 2025-07-25, 1500 common shares authorized, directors Aaron + Maxim Chadaev + Addison Stainback. Currently holds Zeta repo ownership (per memory/max/PERSONA.md "Ownership note").
- **Freeborn Flower Co** — NC SOSID 3109347, filed 2025-08-22, 1500 common shares authorized, directors Aaron + Thomas Young + Addison Stainback.

## Scope-bounding (what's NOT extracted)

- **EINs** — financial attack surface independent of glass-halo consent; held until owner-by-owner sign-off
- **Personal home addresses** — held until each owner's signed consent file captures their individual address-disclosure preference per Aaron's "varying degrees"
- **Ownership splits** — NOT in articles (articles authorize the share pool; allocation is in separate stock-issuance records); placeholders left for Aaron to fill
- **BOI report content** — held by FinCEN; not mirrored
- **Bank info** — never in repo

## Future substrate landings named in-file

- Owner-by-owner glass-halo consent files (`maintainers/aaron/legal-entities/consent/<owner>.md`)
- Stage-3 attachment records via `.claude/settings.json` `_*_acceptance` blocks naming entities as risk-holding parties
- Non-profit entity entries when they exist
- Migration of cluster/risk-class attachments from personal-liability to corp-held Stage-3

## Composes with

- PR #5076 (maintainer-as-top-level partition; this inventory lives under that structure)
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` (three-stage progression)
- `.claude/rules/glass-halo-bidirectional.md` (bidirectional-transparency discipline)
- `.claude/rules/non-coercion-invariant.md` HC-8 (agency preserved by per-owner explicit consent)
- `memory/max/PERSONA.md` "Per-maintainer scope = per-maintainer liability (today; corps/non-profits later)"

Source PDFs at `drop/` remain in place (gitignored per `drop/README.md` protocol); Aaron may delete when this inventory is sufficient.

## Test plan

- [x] markdownlint clean
- [x] Cross-references resolve (.claude/rules/*, memory/max/PERSONA.md, drop/README.md)
- [x] No attack-surface data extracted (no EINs, no addresses, no BOI content, no bank info)
- [ ] CI passes (gate workflow + CodeQL)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T03:35:25Z)

## Pull request overview

Adds a maintainer-scoped documentation surface capturing a Stage-3 “structural risk-holder” inventory for two North Carolina C-Corps, intended to be referenced by the legal-risk-acceptance framework and future `.claude/settings.json` attachment records.

**Changes:**

- Introduces `maintainers/aaron/legal-entities/inventory.md` documenting two entities and their NC SOS metadata.
- Defines scope boundaries for what is intentionally not mirrored into the repo (EINs, addresses, BOI, bank info).
- Adds forward pointers for future consent files and Stage-3 attachment records.

## Review threads

### Thread 1: maintainers/aaron/legal-entities/inventory.md:43 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T03:35:24Z):

Markdown treats `<fill in % or share count>` as an HTML tag, so these placeholders may be hidden in renderers. Wrap them in code spans (or escape as `&lt;...&gt;`) so the placeholders remain visible.

### Thread 2: maintainers/aaron/legal-entities/inventory.md:76 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T03:35:24Z):

Same placeholder-rendering issue here: `<fill in % or share count>` can be swallowed as an HTML tag in Markdown. Wrap in a code span (or escape) so it renders reliably.

### Thread 3: maintainers/aaron/legal-entities/inventory.md:16 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T03:35:25Z):

This file uses direct name-attribution in prose (e.g., "Aaron 2026-05-25"), but the repo’s operational standing rule is to use role-refs on non-history surfaces (see `docs/AGENT-BEST-PRACTICES.md` "No name attribution in code, docs, or skills" around lines 671+). Consider rewriting these attributions to role-refs (e.g., "the maintainer") to stay consistent with that convention.

## General comments

### @chatgpt-codex-connector (2026-05-26T03:31:39Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
