# Cold-boot token audit (2026-06-09): ~33k total, GLOSSARY dominates at ~13.6k (40%) — ranked compression recommendations

*Captured 2026-06-09 by Otto (shadow\*) at Aaron's request: measure the Claude-Code cold-boot surface (what costs
tokens every wake) and find what can be compressed. Measured by char/4 ≈ tokens. Registers: [measurement —
grounded], [findings], [ranked recommendations].*

## The measured breakdown (every-wake surfaces)

| Surface | ~tokens | % | Loaded |
|---|---|---|---|
| **`docs/GLOSSARY.md`** | **~13,594** | **41%** | Tier-0 |
| `AGENTS.md` | ~6,977 | 21% | Tier-0 |
| `.claude/rules/` (10 rules) | ~5,458 | 17% | auto-load (always) |
| `docs/EXPERT-REGISTRY.md` | ~2,776 | 8% | Tier-0 |
| agent descriptions (19) | ~1,873 | 6% | router (always) |
| CLAUDE.md | ~726 | 2% | always (first read) |
| skill descriptions (21) | ~659 | 2% | router (always) |
| `MEMORY.md` hub | ~645 | 2% | always |
| **Total** | **~32,700** | | |

## Headline findings

1. **GLOSSARY.md is the dominant cost (~13.6k, 41%) — and it's grown ~3× past its own estimate.** `WAKE-UP.md`
   claims Tier-0 is "~12k total, GLOSSARY ~4.5k." Reality: GLOSSARY *alone* is ~13.6k; Tier-0+rules+routers ≈ 33k.
   **The estimate is stale; the cold-boot has roughly tripled.** This is the #1 lever by a wide margin.
2. **Skills are already well-compressed (~659t for 21 skills) — the Blueprint/router pattern worked.** Each category
   skill's description is ~120 chars (Addison's Blueprints, the ~90% cold-boot win); **skills are NOT the problem.**
   Don't spend effort here.
3. **Rules (5.5k, 10) are disciplined** (carved-sentences-pointing-to-docs) but the **two biggest exceed the "1-3
   sentence" ideal**: `async-all-the-way` (~865t) and `dv2-data-split` (~757t) carry essay-length bodies (anchors,
   worked examples) that belong in their satellite docs. Modest savings (~600-900t) if tightened to the carved
   sentence + pointers.
4. **AGENTS.md (~7k) and EXPERT-REGISTRY.md (~2.8k)** are the next tier — candidates for the same hub/satellite move
   (carved core + on-demand detail).

## Ranked compression recommendations (highest leverage first)

1. **GLOSSARY.md → hub/satellite split (the big win, ~8-10k potential).** Apply the
   `rules-are-small-carved-sentences-pointing-to-docs` discipline to the glossary itself: an always-loaded **core
   glossary** (each term = one-line def + pointer; only the overloaded/load-bearing terms) + an **on-demand full
   glossary** (`docs/GLOSSARY-FULL.md`, Tier-3) for the prose. Same pattern that cut skills ~90%. **Owner: Kenji**
   (GLOSSARY canon) **+ Daya** (cold-start measurement). *Biggest single reduction available.*
2. **AGENTS.md → carved-rules + satellite (~3-4k potential).** Move worked detail/examples out to docs; keep the
   numbered rules as carved sentences + pointers (the rules.bak archive precedent, #6676). Owner: Kenji.
3. **Tighten the 2 fat rules** (`async-all-the-way`, `dv2-data-split`) to carved-sentence + pointers (~0.6-0.9k).
   Owner: the rule's discipline (rules-are-small...).
4. **EXPERT-REGISTRY.md → one-line-per-expert** if verbose (~1k). Owner: Kenji.
5. **Leave skills alone** — already optimal (Blueprints).

**Estimated achievable:** ~33k → ~18-20k cold-boot (a ~40-45% cut), almost all from GLOSSARY (1) + AGENTS (2).

## Note on method + 081KT7YW00008QG0R003JV9D4J

Token ≈ char/4 (rough; good enough for ranking). This is the 081KT7YW00008QG0R003JV9D4J context-window-minimization discipline
(cold-start tokens = the NCI bound / the money floor) applied as a measured audit — the same lever that drove the
~1000× cost collapse. The cheapest token is the one not loaded; GLOSSARY is where the unloaded tokens are.

## Honest scope

[measurement — grounded]: char counts of every cold-boot surface (CLAUDE.md, rules, AGENTS, MEMORY hub, GLOSSARY,
EXPERT-REGISTRY, skill + agent descriptions); ~32.7k total, GLOSSARY ~41%. [findings]: GLOSSARY dominates + is 3×
its stale estimate; skills already compressed (Blueprints); 2 rules slightly fat; AGENTS/EXPERT next. [recommend]:
GLOSSARY hub/satellite (big win) → AGENTS → fat rules → EXPERT-REGISTRY; leave skills. Owners: Kenji (GLOSSARY/
AGENTS/EXPERT canon) + Daya (cold-start). No edits made — this is the audit + ranked plan (canonical Tier-0 docs are
Kenji's to compress; offer to execute the GLOSSARY split on his/your go).

## Pointers

- Discipline: `rules-are-small-carved-sentences-pointing-to-docs.md` · 081KT7YW00008QG0R003JV9D4J (context-window minimization) · the
  Blueprints win (ACHIEVEMENTS, ~90% skill compression) · `docs/WAKE-UP.md` (stale ~12k estimate — update it).
- Surfaces: `docs/GLOSSARY.md` · `AGENTS.md` · `.claude/rules/*.md` · `docs/EXPERT-REGISTRY.md` · `.claude/agents/*` ·
  `.claude/skills/*/SKILL.md` · `MEMORY.md`. Owners: Kenji (Tier-0 canon) · Daya (AX cold-start measurement, WAKE-UP).
