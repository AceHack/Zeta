---
id: 081KSNY2Z0008QG0R001MXHC99
priority: P1
status: closed
title: Upstream Change Detector for Helm
effort: S
ask: lior 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
parent: 081KSGS9H0008QG0R0031PBNGA
depends_on:
  - 081KSGS9H0008QG0R00367G209
tags: [ace-feature, meta-package-manager, upstream-negotiation, helm]
---

## Problem

This is a decomposition of the larger "package manager of package managers" feature ([081KSGS9H0008QG0R0031PBNGA](081KSGS9H0008QG0R0031PBNGA-package-manager-of-package-managers-n-dimensional-dependency-space-holographic-projection-ai-rate-continuous-upstream-negotiation-aaron-2026-05-26.md)). To achieve "AI-rate continuous upstream negotiation" (Sub-target 3 of 081KSGS9H0008QG0R0031PBNGA), we first need a tool to detect when upstream changes occur.

This backlog item covers the creation of a simple tool to detect new versions of a Helm chart in a repository.

## Acceptance

- [ ] A new script/tool is created (e.g., in `tools/ace/`).
- [ ] The tool takes a Helm chart name and repository URL as input.
- [ ] The tool can determine the latest version of the chart in the repository.
- [ ] The tool outputs whether a newer version is available compared to a given version.
- [ ] The tool has basic tests.

## Out of scope

- Actually performing an upgrade.
- Negotiating with an operator.
- Checking for changes in other package managers.
