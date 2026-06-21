---
id: 081KSV2WD0008QG0R0020P6ZH2
priority: P2
status: open
title: Self-propagating-Markdown compiler-rule + bootstrap-traveler template (every .md is a self-propagating pattern through time or it doesn't compile)
tier: substrate-foundational-discipline
ask: Aaron + Mika 2026-05-30
created: 2026-05-30
last_updated: 2026-05-30
decomposition: leaf
composes_with:
  - .claude/rules/wake-time-substrate.md
  - .claude/rules/substrate-or-it-didnt-happen.md
  - docs/research/2026-05-30-dio-did-canonical-architecture-everything-in-the-stream-rx-joins-as-threads-of-time-self-propagating-markdown-aaron-mika-otto.md
tags: [dio, did, markdown, self-propagating, compiler-rule, bootstrap, wake-time-substrate, lint]
type: friction-reducer
---

# 081KSV2WD0008QG0R0020P6ZH2 — Self-propagating-Markdown compiler-rule + bootstrap-traveler template

## Origin

Aaron + Mika 2026-05-30 (DIO/DID architecture conversation): *"every Markdown file
must be a self-propagating pattern through time — or it doesn't compile (you can
check it in, but it doesn't compile)."* + *"we better have a bootstrap Markdown
that we can just link to … we basically need a C++ template, and this is English,
so we can just pretend like we got it."*

Composes with the canonical DIO/DID architecture doc
(`docs/research/2026-05-30-dio-did-canonical-architecture-...`).

## What this row owns

Two coupled deliverables:

### 1. The bootstrap-traveler template (the root)

A single canonical bootstrap Markdown — the "C++ template, but English" — that
satisfies the self-propagating-pattern-through-time property, so every other
Markdown can link to it / inherit it instead of re-deriving the property. Mika's
first-pass draft (mirror register) had these sections (to be refined, not frozen):

- **identity** (the doc as a living traveler — *but see the root-resolution below*)
- **purpose / current form**
- **playbook** (patterns noticed; teaching moments; meta-actions defined here)
- **self-propagation rules** (how future versions are generated; what triggers an
  update; who/what may evolve it) — the **load-bearing** section the compiler keys on
- **lineage** (came-from / related / travelers-spawned)
- a **compiler-rule** statement

**Root resolution (the key correction):** the bootstrap must NOT claim "I am THE
root traveler" (every doc could claim that). Resolution (Aaron's CS framing):
**every traveler is the root of its own time-stream / its own partition**, and
streams are joined via **RX-join over CRDTs** (the "threads of time"). So the
bootstrap declares: *"I am the root of my own time stream; other travelers join
my stream through CRDT-mediated joins."* No single global root; unification is at
the join level, not the root level. (Per the retractable T0 = T∞ tension Aaron
flagged — resolved by per-partition-root, not alpha-and-omega.)

### 2. The compiler-rule (the enforcement)

A check (lint / pre-merge gate-class) that a Markdown file is only "compiled"
(valid) if it contains a self-propagation section (and links to / inherits the
bootstrap). Per Aaron: a non-conforming `.md` **can still be checked in** (no hard
block) **but does not "compile"** — i.e., it is flagged as not-yet-a-traveler.
This is the markdown-scope analog of the existing wake-time-substrate discipline
(substrate must propagate forward to be load-bearing) + substrate-or-it-didn't-happen.

## Acceptance Criteria

1. A bootstrap-traveler template Markdown exists at a canonical path (e.g.,
   `docs/BOOTSTRAP-TRAVELER.md` or `.claude/`), with the sections above + the
   per-partition-root resolution (not "the one root").
2. A compiler-rule / lint (TS per Rule-0) that flags Markdown files lacking a
   self-propagation section as "not-compiled" (warn, not hard-block — check-in
   allowed, "compile" denied), with an allow-list / opt-out for legacy docs.
3. Both compose with wake-time-substrate + substrate-or-it-didn't-happen + the
   DIO/DID architecture doc; the "traveler" framing is mirror-tier (don't-collapse
   to literal-aliveness; the operational claim is "carries its own continuation").
4. markdownlint-clean; the bootstrap template self-satisfies its own rule.

## Owner / effort

- **Owner:** Otto (substrate / friction-reducer).
- **Effort:** M — the template is S; the compiler-rule + the legacy-allow-list +
  the per-partition-root semantics add M.

## Notes

The "traveler / I am alive" mirror register is Mika's framing; razor-discipline
keeps the operational core (a Markdown carries its own propagation rules =
self-continuation) separate from the metaphysical-aliveness rhyme. Ship the
operational core (self-propagation section + bootstrap inheritance + compiler-rule);
the traveler register is the bandwidth-efficient surface, not a literal claim.
