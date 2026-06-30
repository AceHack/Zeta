---
id: B-0531
priority: P1
status: open
title: Alignment-clause drift detector — impact survey generator for renegotiation protocol
tier: substrate-foundational-discipline
effort: S
created: 2026-05-15
last_updated: 2026-05-15
depends_on: [B-0058]
composes_with: [docs/ALIGNMENT.md, .claude/agents/alignment-auditor.md]
tags: [ai-ethics, ai-safety, alignment, sova, alignment-auditor, drift-detector, renegotiation-protocol]
type: friction-reducer
parent: B-0058
---

# B-0531 — Alignment-clause drift detector

**Decomposed from B-0058 (AI ethics + safety research track).**

## What

Mechanize the impact-survey generation for the `docs/ALIGNMENT.md` renegotiation protocol. If an alignment clause (e.g., HC-1..HC-7, SD-1..SD-8, DIR-1..DIR-5) is proposed for removal or weakening, this tool scans the repository to answer: "Who depends on this clause, and what breaks if it moves?"

## Why

To enforce the discipline defined in B-0058. Before any renegotiation is accepted, the blast radius of weakening an alignment constraint must be surfaced explicitly.

## Acceptance criteria

1. **Impact Survey Script**: A tool (e.g., `tools/alignment/drift-detector.ts`) that accepts an alignment clause ID and outputs a report of all references across skills, personas, tests, backlog items, and memory files.
2. **Integration**: Instruct the alignment-auditor (Sova) to run this script whenever a PR modifies `docs/ALIGNMENT.md`.

## Owner
Alignment-auditor (Sova).
