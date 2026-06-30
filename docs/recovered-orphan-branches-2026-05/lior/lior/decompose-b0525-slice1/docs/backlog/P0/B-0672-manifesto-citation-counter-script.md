---
id: B-0672
priority: P0
status: open
title: "Manifesto citation counter script"
tier: tool
effort: S
created: 2026-05-19
last_updated: 2026-05-19
depends_on: []
composes_with: []
parent: B-0525
tags: [manifesto, tool, citation-counter]
type: tool
---

# Manifesto citation counter script

## Origin

Decomposed from B-0525 (Manifesto constitutional-promotion readiness tracking) as step 1.

## Goal

Define **mechanical adoption signals** — create a TS script that counts manifesto citations across the repo. This is the first step towards measuring critical-mass adoption for constitutional promotion.

## Concrete steps

1. Write a TS script (e.g., `tools/hygiene/audit-manifesto-citations.ts`) that scans `.md` and `.ts` files for references to the manifesto.
2. Integrate this tool into the CI/CD pipeline or the standard loop tick to track the citation count.
3. Validate that the script correctly parses cross-references and outputs a structured count.
