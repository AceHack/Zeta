---
id: 081KTWJ1R0008QG0R000JJDPFZ
title: Evaluate @microsoft/quantum-viz.js for circuit-diagram rendering in our TS apps
priority: P3
status: open
tier: verification-substrate
tags: [quantum, typescript, visualization, microsoft, quantum-viz, evaluation]
created: 2026-06-12
owner: open (pairs naturally with 081KTWJ1R0008QG0R001ZBWKTR / Lior)
---

# 081KTWJ1R0008QG0R000JJDPFZ — quantum-viz.js: any good? (Aaron's question, filed honestly)

Aaron 2026-06-12: "@microsoft/quantum-viz.js — any good?"

What we know (verified 2026-06-12): real, Microsoft's, renders quantum circuits in pure HTML
(no canvas/WebGL — text-adjacent, which suits our no-script/diffable discipline better than most);
shipped via the Q# dev blog; repo active-status UNCONFIRMED — the eval must check last-commit
recency and whether the qsharp-lang reorg superseded it.

Eval criteria (an afternoon, not a project):

1. Maintenance: last release/commit; open-issue triage; superseded-by status.
2. Output discipline: is the rendered HTML/SVG deterministic (same circuit → same bytes)? If yes
   it can golden-lock; if no, quantum-circuit's own SVG export (081KTWJ1R0008QG0R001ZBWKTR item 3) wins by default.
3. Input format: does it consume the circuit JSON quantum-circuit emits, or Q#'s trace format?
   (If the latter, it pairs with Vera's lane instead — also fine.)
4. Verdict lands here as a status update: adopt for diagrams / superseded / decline-with-why.

Relation: 081KTWJ1R0008QG0R001ZBWKTR owns the SIMULATION lane; this is only the DIAGRAM lane. If quantum-circuit's
built-in SVG is deterministic and sufficient, the honest verdict may be "decline — one tool fewer."
