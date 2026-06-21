---
pr_number: 5409
title: "docs(inventory): Addison hardware audit draft 2026-05-27 \u2014 operator caveat on miner counts (Aaron-forwarded)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T06:44:00Z"
merged_at: "2026-05-27T06:49:23Z"
closed_at: "2026-05-27T06:49:24Z"
head_ref: "docs/addison-hardware-inventory-draft-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:25:22Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5409: docs(inventory): Addison hardware audit draft 2026-05-27 — operator caveat on miner counts (Aaron-forwarded)

## PR description

## Summary

Operator-forwarded Addison hardware audit draft 2026-05-27. Two files:

- `docs/inventory/README.md` — new directory convention; composes with 081KSGS9H0008QG0R001VVEZQ9 + sibling `tools/inventory/amazon-orders-extract.ts`
- `docs/inventory/hardware-2026-05-27-addison-draft.md` — Addison's draft list: Devices / Computers / GPUs / iPhones / GL.iNet / Networking / Docking / Power / Storage / Wallets / Plugs / Miners / Other

**Operator caveat preserved**: bitcoin miner counts under-represented; promotes to canonical `hardware.md` after Addison + operator reconcile.

## Composes with

- **081KSGS9H0008QG0R001VVEZQ9** — hardware-inventory-vs-cluster reconciliation; Addison's substrate IS the inventory side
- **081KSGS9H0008QG0R0037H3W4T** — iter-5.4.1 self-registration; cluster side of the diff
- `tools/inventory/amazon-orders-extract.ts` — sibling extractor (operator-local outputs at `~/.local/share/zeta-inventory/amazon/<year>/`; not in repo)

No PII; hardware list only.

## Test plan

- [ ] `docs/inventory/` directory created cleanly
- [ ] Markdownlint passes (single blank lines + fenced-code-language)
- [ ] No accidental commit of `~/.local/share/zeta-inventory/` Amazon data

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T06:47:17Z)

## Pull request overview

Adds a new `docs/inventory/` directory containing a README that defines the directory's purpose and conventions, plus a draft hardware audit forwarded from Addison via the operator. The draft preserves the explicit caveat that bitcoin miner counts are under-represented and will be reconciled into a canonical `hardware.md` after operator + Addison alignment. This composes with 081KSGS9H0008QG0R001VVEZQ9 (hardware-inventory-vs-cluster reconciliation) and the sibling `tools/inventory/amazon-orders-extract.ts` extractor.

**Changes:**
- New `docs/inventory/README.md` describing the directory's scope, what belongs (draft snapshots), and what does not (Amazon order history, cluster-side node registrations, hardware-wallet contents).
- New `docs/inventory/hardware-2026-05-27-addison-draft.md` containing a categorized hardware list with provenance and reconciliation notes.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/inventory/README.md | Defines `docs/inventory/` conventions, draft→canonical promotion, and out-of-scope items |
| docs/inventory/hardware-2026-05-27-addison-draft.md | Addison's draft hardware list grouped by category, with operator caveat on miner counts |

## General comments

### @chatgpt-codex-connector (2026-05-27T06:44:05Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
