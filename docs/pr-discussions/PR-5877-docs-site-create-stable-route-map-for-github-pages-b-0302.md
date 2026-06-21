---
pr_number: 5877
title: "docs(site): Create stable route map for GitHub Pages (081KR2E4K0008QG0R000WYVJAF)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-28T16:50:58Z"
merged_at: "2026-05-28T17:08:06Z"
closed_at: "2026-05-28T17:08:06Z"
head_ref: "lior/081KR2E4K0008QG0R000WYVJAF-pages-routes"
base_ref: "main"
archived_at: "2026-05-28T17:40:42Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5877: docs(site): Create stable route map for GitHub Pages (081KR2E4K0008QG0R000WYVJAF)

## PR description

This PR implements backlog item 081KR2E4K0008QG0R000WYVJAF by creating the stable URL route map for the GitHub Pages site. This file defines the URL structure before indexing begins.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T16:53:44Z)

## Pull request overview

This PR adds a single new documentation file, `docs/site/routes.md`, establishing the frozen URL route map for the planned Zeta GitHub Pages site per backlog item 081KR2E4K0008QG0R000WYVJAF. It defines five core public routes (root, vision, alignment, glossary, contributing) mapped to existing source documents, calls out the future `/research/` route as deferred to 081KR2E4K0008QG0R001B503RK, and states the URL scheme is frozen before indexing without an accompanying redirect strategy.

**Changes:**
- Adds a new `docs/site/routes.md` route-map document with policy preamble, core routes table, and deferred-routes table.
- Establishes pre-indexing URL freeze policy with explicit redirect-required clause for any future changes.
- Calls out `/research/` as deferred and tied to 081KR2E4K0008QG0R001B503RK as prerequisite.

## General comments

### @chatgpt-codex-connector (2026-05-28T16:51:02Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
