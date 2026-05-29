# ADR: Standardize streamlined MADR template for architectural decisions

**Status:** Accepted
**Date:** 2026-05-29
**Backlog:** (none — meta-process ADR; no in-tree backlog row)

## Context & Problem Statement

We need to decide how to structure Architectural Decision Records (ADRs) across the Zeta repository to maximize architectural rigor while maintaining high agent velocity.

Zeta is a vibe-coded repository where every line of code is agent-authored, meaning the ADR creation process must be highly optimized for LLMs. If a decision-record structure is too loose (e.g., the classic Nygard template), agents omit explicit comparisons of alternative hypotheses. However, if a structure is too rigid (e.g., standard MADR templates with YAML frontmatter and complex Markdown tables), agents frequently produce minor formatting syntax bugs. These bugs trigger automated `markdownlint` warnings (e.g., blank-line and trailing-whitespace rules), clogging the CI/PR validation queue.

We need a structured, agent-friendly template that enforces explicit pros/cons reasoning without causing reviewer friction.

## Considered Options

* **Option 1: Classic Nygard/Zeta Template** — Flat status/date lines followed by Context, Decision, Consequences.
* **Option 2: Rigid MADR / YAML Template** — Markdown Architectural Decision Records utilizing YAML frontmatter and complex Markdown comparison tables.
* **Option 3: Streamlined Flat MADR Template** — Flat bold status lines and simplified lists that compare options and document pros/cons without YAML formatting or tables.

## Pros & Cons of the Options

### Option 1: Classic Nygard/Zeta Template

* **Pros:** Highly readable, with low exposure to linter and spacing errors.
* **Cons:** Lacks a strict schema or forcing-function to compare alternative options, allowing agents to skip documenting rejected hypotheses.

### Option 2: Rigid MADR / YAML Template

* **Pros:** Highly structured, machine-readable frontmatter metadata, and rigorous comparison grids.
* **Cons:** High linter friction. LLMs frequently mess up spacing in YAML frontmatter and table cell-padding, causing automated reviewers (Copilot, Rune) to fail the gate.

### Option 3: Streamlined Flat MADR Template

* **Pros:** Highly agent-friendly. Uses standard flat Markdown headings and simple bullet lists that minimize common linter/spacing failures. Formally forces agents to document alternative options and explicitly compare pros/cons.
* **Cons:** Slightly less machine-parseable than raw structured JSON/YAML frontmatter (mitigated by predictable flat bold line markers).

## Decision Outcome

* **Chosen Option:** Option 3: Streamlined Flat MADR Template, because it balances technical decision rigor with agent velocity, reducing reviewer linter friction while ensuring robust options analysis.
* **Consequences:**
  * **Positive:** All future architectural decisions will use a standardized, easy-to-write comparison format that reduces common markdownlint failures in agent decision records.
  * **Negative/Costs:** Requires checking in a template file at `docs/templates/ADR-TEMPLATE.md`.
