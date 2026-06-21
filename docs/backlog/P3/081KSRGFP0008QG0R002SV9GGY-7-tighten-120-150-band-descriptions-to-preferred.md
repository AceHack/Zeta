---
id: 081KSRGFP0008QG0R002SV9GGY
priority: P3
status: open
title: "Tighten 120-150-char skill descriptions to the ≤120 preferred routing budget"
created: 2026-05-29
last_updated: 2026-05-29
parent: 081KR50HA0008QG0R002ZNFQBZ
depends_on: []
classification: buildable-now
decomposition: atomic
type: friction-reducer
tags: [skill-routing, context-budget, carved-sentence, polish]
---

# 081KSRGFP0008QG0R002SV9GGY — Tighten the 120-150-char band to ≤120

081KR50HA0008QG0R002ZNFQBZ rule 1 says one sentence, **under 120 characters preferred**.
The hard 150-char cap is met (257/257) and gated by 081KR50HA0008QG0R002ZNFQBZ.4, but 127
descriptions sit in the 120-150 band — surfaced as warnings (not
errors) by `tools/hygiene/audit-skill-description-length.ts`. This
child finishes the *preferred* target.

Advisory / low-priority by design: the routing budget is already met,
so this is carve-tighter polish, not a fix. It does not block 081KR50HA0008QG0R002ZNFQBZ
closure and may legitimately outlive umbrella closure.

## Work scope

Carve the 127 descriptions currently `> 120 preferred` down to ≤120
chars while preserving routing terms. List them with:

```bash
bun tools/hygiene/audit-skill-description-length.ts 2>&1 | grep '> 120 preferred'
```

Carve, do not strip routing signal — the same discipline as 081KR50HA0008QG0R002ZNFQBZ.1-.3:
name the domain + 3-7 key terms, drop redundant connective words. If a
description genuinely needs >120 chars to route correctly, leave it (the
≤120 is preferred, not mandatory) and note which it is.

Reasonable to do in batches (e.g. 20-30 per PR) rather than one giant
diff; each batch is its own bounded step.

## Acceptance criteria

- [ ] `bun tools/hygiene/audit-skill-description-length.ts` reports 0
  warnings (or the residual set is explicitly justified as
  route-requires-the-length, listed in the PR body).
- [ ] No skill body changes; descriptions only; all stay single-line
  and ≤150 (081KR50HA0008QG0R002ZNFQBZ.4 gate stays green).

## Out of scope

- Skill body edits.
- The hard ≤150 cap (already met + gated).
- CI wiring (081KSRGFP0008QG0R00059AM3C).

## Composes with

- 081KR50HA0008QG0R002ZNFQBZ (umbrella) — completes rule-1 *preferred* target.
- 081KR50HA0008QG0R002ZNFQBZ.4 — the audit tool whose warnings this drives to zero.
- 081KR50HA0008QG0R002ZNFQBZ.1-.3 (shipped carve passes) — same carving discipline,
  tighter target.
