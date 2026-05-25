---
pr_number: 4985
title: "docs: define agentic organization v0 architecture"
author: "maximdolphin"
state: "MERGED"
created_at: "2026-05-25T19:56:47Z"
merged_at: "2026-05-25T19:59:20Z"
closed_at: "2026-05-25T19:59:20Z"
head_ref: "codex/agentic-org-package-ca-clean"
base_ref: "main"
archived_at: "2026-05-25T22:02:21Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4985: docs: define agentic organization v0 architecture

## PR description

## Summary

- Adds V0 executable, schema/command, and policy/runtime-boundary contracts for Agentic Organization.
- Adds a package-first Technical CA for a TypeScript/NestJS modular monolith built from reusable `@agentic-org/*` packages.
- Grounds the architecture in `full-ai-cluster`: CockroachDB, NATS JetStream, Temporal, Dapr, Hermes, Hindsight, OZ/OpenZiti, hat-system, Cilium/SPIRE/Vault/ESO, ArgoCD, and observability.
- Makes the Organization OS event-driven: state transitions emit outbox/NATS events that trigger rule evaluation, reaction plans, and normal follow-up commands for review, QA, release, blocker escalation, and runtime incidents.

## Scope hygiene

This PR was rebuilt from current `origin/main` and only changes `agentic-organization/docs/*` files for the Agentic Organization architecture docs.

## Validation

- `git diff --check origin/main...HEAD`
- `git diff --name-status origin/main...HEAD`
- `rg -n "Technical CA|Event-to-Automation Contract|V0 Executable Contract|Native `full-ai-cluster` Binding|agentic-org\.\*|hermes-org|@hermes-org" agentic-organization/docs`

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T19:58:57Z)

Copilot encountered an error and was unable to review this pull request. You can try again by re-requesting a review.

## General comments

### @chatgpt-codex-connector (2026-05-25T19:56:50Z)

Codex usage limits have been reached for code reviews. Please check with the admins of this repo to increase the limits by adding credits.
Credits must be used to enable repository wide code reviews.
