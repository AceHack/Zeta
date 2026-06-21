---
id: 081KTWJ1R0008QG0R001ZBWKTR
title: The TS quantum lane — quantum-circuit as second oracle (Q# export, the three Vera jobs) + Quirk as the craft-school toy layer
priority: P2
status: closed
tier: verification-substrate
tags: [quantum, typescript, quantum-circuit, quirk, qsharp, vera, lior, treaty, bp-16, craft-school]
created: 2026-06-12
last_updated: 2026-06-12
completed: 2026-06-12
owner: Lior (Aaron's routing: "I'm going to get Lior to do the one you suggested — and the treaties")
---

# 081KTWJ1R0008QG0R001ZBWKTR — the TS quantum lane (Lior's)

Aaron 2026-06-12, after the verified routing (docs/research/2026-06-12-second-quantum-framework-*):

1. **quantum-circuit (quantastica) as the TS-side second quantum oracle.** Build the three Vera
   jobs as circuits — singlet CHSH at the canonical corners; the cos²((a−b)/2) overlap; the
   H·R1(φ)·H interference grid — run on its simulator (TS) AND export each to **Q#** for Vera:
   one definition, two independent oracles, byte-comparable verdicts (BP-16 by construction).
   Acceptance: the TS numbers match our F# analytic values within stated tolerances, and the Q#
   exports compile and run in Vera's lane unchanged.
2. **The treaties:** results land as `treaty` lines written by each oracle's OWN run (consent
   discipline) — `treaty lior-ts ...` / `treaty vera qsharp ...` on the fourcorner/adinkra
   cartridges; the qsharp:/code: law delegations follow only on ratified claims.
3. **Circuit-SVG goldens:** quantum-circuit draws circuits to SVG — check determinism first
   (same circuit → same bytes); if deterministic, lock under THE GOLDEN LOCK next to the shape
   goldens; if not, that's a finding to report upstream.
4. **Quirk (Craig Gidney) — the toy layer, craft school.** Drag-and-drop circuits for Max and
   Addison: a lesson page in docs/craft-school/ linking Quirk configs that mirror the three jobs
   (see the entanglement that the fourcorner cartridge draws). No oracle role; play register.
5. **q5mjs watch:** re-check openql-org/q5mjs in ~3 months (TypeScript-first, v0.1.1 — adopt only
   if matured; see the routing doc).

Start gate done in the routing doc (prior-art search: verified by web search 2026-06-12; deps:
none beyond npm; the Vera brief REVISION 2 defines the three jobs).
