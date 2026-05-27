---
pr_number: 5051
title: "backlog(B-0765 P1): ServiceTitan route \u2014 plug into existing control interfaces; ontology negotiation at standards layer"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T00:20:16Z"
merged_at: "2026-05-26T00:21:49Z"
closed_at: "2026-05-26T00:21:49Z"
head_ref: "otto-cli/b0765-service-titan-route-standards-layer-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:46:41Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5051: backlog(B-0765 P1): ServiceTitan route — plug into existing control interfaces; ontology negotiation at standards layer

## PR description

Aaron 2026-05-25 named the ServiceTitan strategic principle as substrate-engineering policy: every cluster-install substrate decision filters through 'are we inventing or adopting?'. Prefer adopting existing standards (k8s CRDs, OAM Components, Crossplane Compositions, Helm 3 OCI, ArgoCD, Flux, OpenTelemetry, OPA Rego, DAPR Components, NixOS) over inventing parallel substrate. Sharpens (not retracts) B-0763 + B-0764. Ontology negotiation at the STANDARDS LAYER (not per-project) is the load-bearing leverage point.

P1 because it's the strategic filter shape every future cluster-install row should pass through. Composes with B-0741 / B-0744 / B-0747 / B-0748 / B-0749 / B-0754 / B-0759 / B-0761 / B-0762 / B-0763 / B-0764.

## General comments

### @chatgpt-codex-connector (2026-05-26T00:20:21Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
