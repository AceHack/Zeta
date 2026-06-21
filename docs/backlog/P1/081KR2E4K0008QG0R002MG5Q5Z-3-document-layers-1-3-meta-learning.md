---
id: 081KR2E4K0008QG0R002MG5Q5Z
priority: P1
status: closed
title: "Layers 1-3: document meta-learning pattern adapted for Zeta"
created: 2026-05-08
last_updated: 2026-05-08
depends_on: []
parent: 081KQGDBJ0008QG0R001JC9HCJ
classification: buildable-now
type: friction-reducer
---

# 081KR2E4K0008QG0R002MG5Q5Z — Layers 1-3: document meta-learning pattern adapted for Zeta

**Slice of:** [081KQGDBJ0008QG0R001JC9HCJ](081KQGDBJ0008QG0R001JC9HCJ-port-meta-learning-4-layer-pattern-from-stcrm-aaron-2026-05-01.md)

## What

Document the 3 meta-learning layers adapted for Zeta's surfaces:

- **Layer 1** — Fix the bot's findings. Reply with reasoning, resolve.
- **Layer 2** — Every bot comment is a joint learning opportunity. Land the
  doc update in the SAME PR as the comment. Two paths: real-bug encodes in
  code-author substrate; off-base encodes in reviewer-instructions.
- **Layer 3** — Encode the class of error, not the instance. Test: imagine
  the next 3 PRs that could hit a similar bug; would the encoding catch
  all 3?

Landing surface: `docs/AGENT-BEST-PRACTICES.md` (new BP-NN rules) or a
dedicated `docs/META-LEARNING.md` with AGENTS.md pointer.

## Depends on

Independent of 081KR2E4K0008QG0R001N1PPHP/081KR2E4K0008QG0R0005GS263 (Layer 4 attribution). Can be done in
parallel.
