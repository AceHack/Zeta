# Guess #002 — 081KQNJ500008QG0R001VGMS5G skill-domain-plugin-packaging

## Target

`docs/backlog/P2/081KQNJ500008QG0R001VGMS5G-skill-domain-plugin-packaging-aaron-2026-05-03.md`

The architectural choice: Aaron filed 081KQNJ500008QG0R001VGMS5G for "skill-domain plugin packaging." The question this guess answers: **why package skills as plugins (specifically) — vs alternatives like cross-skill imports, skill-namespace prefixes, or shared-substrate-via-symlink?**

## Read state at guess time (2026-05-03 ~02:55Z)

Otto has already read:

- 081KQNJ500008QG0R001VGMS5G ROW NAME ONLY (from `ls docs/backlog/P2/`)
- The skill-design-rules memo (`feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md`) — Rule 3: package skill domains as plugins, use harness hooks for pre/post-condition enforcement (contract-based development)
- The decision-graph memo's composition section: "081KQNJ500008QG0R001VGMS5G (skill-domain plugin packaging) — plugins are sub-graph bundles; the canonical bundle format documents which nodes + edges to include" and "graph **subgraph packaging** (plugins package skill-domain subgraphs; hooks enforce contract edges between subgraphs)"
- 081KQNJ500008QG0R003ZC6PK8 (hook-authoring) ground truth — composes_with [081KQNJ500008QG0R001VGMS5G]; depends_on [081KQNJ500008QG0R003SCWBDV, 081KQNJ500008QG0R001N94412]
- Generic Claude Code knowledge: plugins are deployable packages (e.g., a plugin with skills + commands + agents in `.claude/`)
- The fact that Aaron uses Claude Code's plugin system (claude-ai/Atlassian, claude-ai/Figma, plugin-microsoft-docs, etc. visible in MCP list)

## Research deliberately AVOIDED

Otto has NOT read:

- 081KQNJ500008QG0R001VGMS5G's row body text
- Any commits referencing 081KQNJ500008QG0R001VGMS5G
- Any `.claude-plugin/plugin.json` example in this repo
- Any prior conversation about Claude Code plugin packaging architecture

## Otto's in-the-moment guess

### Architectural intent (medium-high confidence)

Aaron's primary architectural intent for plugin-packaging-as-the-mechanism: **skill domains are coherent functional clusters, and Claude Code's plugin system is the natural distribution + isolation + composition unit for them.**

Specifically:

1. **Distribution-as-unit** — a skill-domain (e.g., "git-native-backlog-management" containing decision-archaeology + substrate-claim-checker + future graph tools) is what other harnesses + projects need to consume. Per Aaron's earlier framing about skills-not-just-for-claude (memory mentions sharing skills across harnesses), plugin-packaging is the distribution mechanism
2. **Isolation-as-namespace** — plugins create namespace isolation (`plugin-name:skill-name`); this prevents skill-naming collisions across plugins from different sources
3. **Composition-as-contracts** — plugins can declare dependencies on other plugins (e.g., skill-creator plugin → prompt-protector plugin); this is the cross-skill version of 081KQNJ500008QG0R003ZC6PK8's pre/post-condition hooks
4. **Versioning-as-lineage** — plugins have versions; this gives skill-domain evolution a concrete artifact (vs the current "edit SKILL.md in place" approach which has no versioning)

The deeper architectural reason — plugin-packaging instantiates the **hub-satellite separation** (skill-design rule 1) at the domain level: each plugin is a hub-satellite cluster (a skill domain hub + its supporting docs / specs / TS tools as satellites); cross-plugin references are graph-edges per DataVault 2.0.

### Substrate-content intent (medium confidence)

The backlog row likely covers:

- Plugin packaging FORMAT (e.g., `.claude-plugin/plugin.json` manifest at top of each packaged skill-domain directory)
- Plugin location (per the recent "081KQNJ500008QG0R001VGMS5G plugin location" path-correction in PR #1262: `~/.claude/plugins/cache/<plugin-name>/` is the install location; manifest path is `.claude-plugin/plugin.json` inside the plugin)
- Migration plan: which existing skill-domains should be packaged as plugins (decision-archaeology + substrate-claim-checker + OpenSpec-tooling forms one cluster)
- Cross-plugin dependency declaration mechanism (how plugin-A declares it depends on plugin-B's skills)
- Distribution: how plugins are published/shared (GitHub repo? local-only first?)

### Specific implementation intent (lower confidence)

The implementation will probably:

- Use Claude Code's plugin manifest format (`.claude-plugin/plugin.json` per recent path correction)
- Plugin format: directory tree with `.claude-plugin/plugin.json` + `skills/` + `commands/` + `agents/` + `hooks/`
- Plugin discovery: Claude Code reads `~/.claude/plugins/cache/<plugin-name>/` directories at session start
- Dependencies: `dependencies: ["plugin-name@version"]` in the manifest (analogue of npm's package.json)
- The 081KQNJ500008QG0R001VGMS5G row scope is probably "package the existing decision-archaeology + substrate-claim-checker into a plugin called something like `git-native-backlog-management`" — concrete first packaging exercise

### Cross-row composition (medium confidence)

081KQNJ500008QG0R001VGMS5G likely composes_with:

- 081KQJZR90008QG0R002D6XYHB (decision-archaeology skill) — packaged as part of the first plugin
- 081KQNJ500008QG0R003SCWBDV (substrate-claim-checker tool) — packaged tooling within the plugin
- 081KQNJ500008QG0R001N94412 (OpenSpec catch-up) — plugin specs live in OpenSpec; OpenSpec catch-up is a depends_on (plugins reference specs)
- 081KQNJ500008QG0R003ZC6PK8 (hook-authoring) — composes_with already confirmed; plugins ship with their hooks

depends_on guess: probably **081KQNJ500008QG0R001N94412** (OpenSpec specs exist before plugins package them) but maybe NOT 081KQJZR90008QG0R002D6XYHB/081KQNJ500008QG0R003SCWBDV/081KQNJ500008QG0R003ZC6PK8 directly — those are the contents being packaged, not gating dependencies.

## Confidence levels

| Layer | Confidence | Reasoning |
|---|---|---|
| Architectural — "plugins-as-distribution-+-isolation-+-composition-units for skill domains" | **Medium-High** | Composes naturally with skill-design rule 3 (already first-party-confirmed) + Claude Code plugin system is the natural fit + Aaron's multi-harness framing |
| Substrate-content — "plugin manifest format + first packaging is decision-archaeology + substrate-claim-checker cluster" | **Medium** | Decision-graph memo mentioned plugin format briefly + recent path corrections (#1262) showed `.claude-plugin/plugin.json` is the convention |
| Specific implementation — "directory tree + dependencies declaration + GitHub-publishable" | **Low** | Standard Claude Code plugin pattern but I haven't confirmed which specific clusters get packaged first or how dependencies declare |
| Cross-row composition | **Medium** | Confident on 081KQJZR90008QG0R002D6XYHB/081KQNJ500008QG0R003SCWBDV/081KQNJ500008QG0R003ZC6PK8 composition; less confident on 081KQNJ500008QG0R001N94412 as depends_on vs composes_with |

## Pre-recovery prediction (calibration self-test)

Based on guess #001's pattern (principle-strong + specific-weak), I predict:

- **Architectural layer**: PARTIAL-MATCH — likely got the principles (distribution + isolation + composition + versioning) but probably missed at least one Aaron-named-frame (e.g., maybe contract-based-development extends here? or some specific multi-harness framing I haven't seen?)
- **Substrate-content layer**: MIXED — likely got the manifest format and packaging-existing-tools idea; probably missed specific scope choices Aaron made
- **Specific implementation layer**: probably MOSTLY-OFF — I'm guessing about packaging-format conventions without having read the actual row

This pre-prediction itself is calibration data: how well does Otto predict its own accuracy BEFORE seeing the answer?

## Ground truth (recovered 2026-05-03 ~03:00Z via direct read of 081KQNJ500008QG0R001VGMS5G)

Read source: `docs/backlog/P2/081KQNJ500008QG0R001VGMS5G-skill-domain-plugin-packaging-aaron-2026-05-03.md` (full body) — protocol-permitted only after the guess commit landed (guess committed under 4a3d583 on the guess branch; merged into main eventually via PR #1283's chained-rebase-merge — PR #1282, which originally hosted the guess commit alone, was closed as superseded after #1283 absorbed both guess + recovery commits; the binding marker is the guess COMMIT TIMESTAMP, not the merge timestamp).

### Architectural intent (Aaron's verbatim — refined via direct first-party query 2026-05-03)

**From 081KQNJ500008QG0R001VGMS5G row body** (initial recovery source):

> *"look at packaking skill domains a plugins or other packagin so we can take advantage of hooks in harnesses"*

**From Aaron 2026-05-03 chat clarification (direct first-party query, after recovery commit landed)**:

> *"why package skills as plugins (specifically) i care about the hooks the most and then 2nd going to the devloper / vibe coder where they are already without much hassle."*

**Two architectural motivations, ranked**:

1. **PRIMARY: Hooks** — *"i care about the hooks the most"*. Plugin packaging exists to ship hooks. Without hooks, plugin packaging is "bare-skill-grouping" (the row's own characterization). The composition with 081KQNJ500008QG0R003ZC6PK8 is depends_on (load-bearing), not just composes_with
2. **SECONDARY: Meet developers where they already are** — *"going to the devloper / vibe coder where they are already without much hassle"*. Plugin packaging meets contributors in the harness they already use (Claude Code plugin system; Codex equivalent; Cursor; etc.) without forcing them to install separately. Distribution-as-low-friction is the secondary motivation

The secondary motivation was NOT in the 081KQNJ500008QG0R001VGMS5G row body verbatim. Aaron's direct chat input added it as load-bearing first-party data.

**Promotion-trigger gate**: row is P2 not P1 because no skill domain has yet met the promotion-trigger criteria (3+ worked examples per skill candidate + 1+ judgment-disagreement per expert candidate). When a domain matures, this row becomes the implementation work.

### Substrate-content intent

- `.claude-plugin/plugin.json` manifest with **minimal fields** (name + description + author per the upstream Claude Code spec — NOT semver/dependencies/etc.)
- Bundle contents: `skills/<skill>/SKILL.md` + `agents/<agent>.md` + hooks (per 081KQNJ500008QG0R003ZC6PK8) + `tools/` (TS files per rule 2) + OpenSpec capability references (per 081KQNJ500008QG0R001N94412)
- **Codex equivalent uses `.codex-plugin/plugin.json` with richer fields** (semver + interface block + URLs + category) — different shape from Claude Code's
- **Cross-harness portability**: canonical "skill-domain bundle" format (harness-agnostic) + per-harness packaging adapters that emit harness-specific package formats

### Specific implementation intent

- Install location: `~/.claude/plugins/cache/<plugin-name>/` (Claude Code convention)
- Manifest path inside the bundle: `.claude-plugin/plugin.json` (per recent #1262 path corrections)
- 081KQJZR90008QG0R002D6XYHB (decision-archaeology) named as "likely first skill packaged once mature" but row scope is generic — packaging happens when promotion-trigger fires, not "package this specific cluster now"

### Cross-row composition

- depends_on: **[081KQNJ500008QG0R001N94412, 081KQNJ500008QG0R003ZC6PK8]** (NOT just 081KQNJ500008QG0R001N94412)
- composes_with: [081KQJZR90008QG0R002D6XYHB, 081KQNJ500008QG0R003SCWBDV]

## Calibration delta

### Architectural layer — PARTIAL-MATCH (6/10) — SCORE UNCHANGED but motivation-ranking now first-party-confirmed

| What I got | What I missed |
|---|---|
| Distribution-as-unit (partial match for Aaron's secondary "meet developers where they are") | **PRIMARY motivation: hooks** — Aaron's direct chat input *"i care about the hooks the most"* — I had hooks as point #2 of 4, not as primary |
| Hub-satellite at domain level (principle-shaped — but wasn't named by Aaron as motivation; valid as architectural pattern) | **SECONDARY motivation: meeting developers where they are** — Aaron's chat *"going to the devloper / vibe coder where they are already without much hassle"*. NOT in the row body verbatim; first-party clarification post-recovery added it |
| | **Promotion-trigger maturity-gate** — row is P2 specifically because the trigger hasn't fired; I didn't anticipate the maturity-gate-before-packaging design at all |
| | **Composition-as-contracts** — I generated this as point #3 of 4 motivations; Aaron did NOT name it as motivation. Inferred-from-principles, not load-bearing |
| | **Versioning-as-lineage** — I generated this as point #4; Aaron did NOT name it. Row says "minimal fields" — no semver in the manifest |
| | **Isolation-as-namespace** — I generated this; Aaron did NOT name it. Inferred-from-principles, not load-bearing |

**Refined analysis (post-Aaron-direct-input 2026-05-03)**: Aaron has TWO explicitly-ranked motivations, not the four I generalized to:

1. **Primary: hooks** — I had this as point #2 of 4. The ranking miss is significant — hooks IS the primary, not just an enabler
2. **Secondary: developer/vibe-coder distribution** — I had "distribution-as-unit" but framed it as content-distribution rather than developer-meeting

My "isolation-as-namespace" + "versioning-as-lineage" + "composition-as-contracts" are inferred-from-principles motivations Aaron did NOT name. They may still be true benefits but are NOT load-bearing motivations.

**Pattern**: I tend to **proliferate inferred motivations** beyond what's first-party. Aaron's two explicit motivations (hooks primary, developer-friction-reduction secondary) are simpler than my four. This is over-inference at the architectural layer — proposing more "reasons why" than the first-party agent actually has. Future-Otto: when listing architectural motivations, mark which are first-party (verbatim from row / chat) vs inferred (from principles); rank them only when first-party data permits.

**The promotion-trigger maturity-gate miss**: I didn't anticipate that packaging is gated on skill-domain maturity (3+ worked examples per skill + 1+ judgment-disagreement per expert). This is a DESIGN-by-Aaron choice, not derivable from principles.

### Substrate-content layer — MIXED (6/10)

| What I got | What I missed |
|---|---|
| `.claude-plugin/plugin.json` path (correct; cited from #1262 path-correction context) | **Codex equivalent format** with richer fields (semver + interface block + URLs + category) — completely missed |
| Plugin install location `~/.claude/plugins/cache/<plugin-name>/` (correct) | **Cross-harness portability via canonical-bundle-format + per-harness adapters** — significant architectural element; row's design is to ship a harness-agnostic substrate format |
| Bundle contents (skills/, agents/, hooks/) (correct, kind of — also tools/ and OpenSpec references) | (closeish on contents) |
| First packaging = decision-archaeology cluster (correct — 081KQJZR90008QG0R002D6XYHB named as "likely first") | (no miss here) |

**Analysis**: I correctly inferred the Claude-Code-side path/format/install-location (recent specific-context from PR #1262 boosted accuracy). But missed the Codex equivalent + cross-harness adapter design entirely. The cross-harness piece is load-bearing for Aaron's "skills are for everyone and even other agent harnesses" framing.

### Specific implementation layer — MOSTLY-MATCH (7/10)

| What I got | What I missed |
|---|---|
| Plugin format: directory tree with manifest + skills/ + agents/ + hooks/ (correct) | **Tools/ subdirectory** — I didn't list this explicitly |
| Plugin install location (correct) | (no miss) |
| Manifest path (correct via #1262 context) | (no miss) |
| Dependencies declaration mechanism (incorrect — I guessed `dependencies: ["plugin-name@version"]`; row says "minimal fields") | The row says minimal fields — no dependencies in the Claude Code manifest. (Codex has more.) |

**Analysis**: This layer was substantially stronger than guess #001's specific-implementation layer. The reason: **recent specific-context from PR #1262 path correction** taught me the actual manifest path + install location. When prior specific-context exists, specific-implementation accuracy is much higher.

**This is a useful finding** about when the principle-strong + specific-weak pattern breaks: it breaks when prior specific-context is present.

### Cross-row composition layer — MOSTLY-MATCH (7/10)

| What I got | What I missed |
|---|---|
| depends_on 081KQNJ500008QG0R001N94412 (correct) | **depends_on 081KQNJ500008QG0R003ZC6PK8 (NOT composes_with)** — I categorized 081KQNJ500008QG0R003ZC6PK8 as composes_with; actual is depends_on. Architectural reason: hooks shipping inside the plugin is the primary value |
| composes_with 081KQJZR90008QG0R002D6XYHB (correct) | (no miss) |
| composes_with 081KQNJ500008QG0R003SCWBDV (correct) | (no miss) |
| | (no major miss) |

**Analysis**: Right rows; one categorization error (081KQNJ500008QG0R003ZC6PK8 depends_on vs composes_with). The depends_on 081KQNJ500008QG0R003ZC6PK8 reflects that "without hooks, packaging is bare-skill-grouping" — packaging-without-hooks is meaningless, so hooks must precede plugin packaging.

## Pre-recovery prediction validation

I predicted before research:

| Layer | Predicted | Actual | Match? |
|---|---|---|---|
| Architectural | PARTIAL-MATCH | PARTIAL-MATCH (6/10) | ✓ |
| Substrate-content | MIXED | MIXED (6/10) | ✓ |
| Specific implementation | MOSTLY-OFF | MOSTLY-MATCH (7/10) | ✗ — over-predicted weakness |
| Cross-row composition | (no prediction) | MOSTLY-MATCH (7/10) | n/a |

**Pre-prediction accuracy: 2/3 = 67%**. The pattern (principle-strong + specific-weak) held for architectural + substrate-content layers, but specific-implementation was actually stronger than expected because recent specific-context (PR #1262) was present.

**Updated pattern observation**:
- The principle-strong + specific-weak pattern holds **when no prior specific-context is present**
- Recent specific-context (e.g., recent PR fixes, recent doc reads, recent commit context) substantially boosts specific-implementation accuracy
- Pre-recovery self-prediction is reliable for architectural + substrate-content layers but unreliable for specific-implementation (Otto under-predicts its own ability when specific-context exists)

## Summary

**Score (informal):**

| Layer | Score | Pattern |
|---|---|---|
| Architectural intent | **6/10** | Principle-strong; missed Aaron's "hooks-shipping" frame + promotion-trigger maturity-gate |
| Substrate-content | **6/10** | Got Claude-Code-side; missed Codex equivalent + cross-harness adapter design |
| Specific implementation | **7/10** | **Stronger than expected** — recent specific-context (PR #1262) boosted accuracy |
| Cross-row composition | **7/10** | Right rows; one mis-categorization (081KQNJ500008QG0R003ZC6PK8 depends_on vs composes_with) |

**Overall**: 26/40 = **65%** — significantly higher than guess #001's 48%. The improvement came from specific-implementation + cross-row layers, both boosted by prior context.

**Key new finding**: the principle-strong + specific-weak pattern is **context-dependent** — when specific-context exists, the gap narrows. This refines the original pattern observation.

---

**Guess timestamp:** 2026-05-03 ~02:55Z (committed under 4a3d583 on the guess branch; merged into main via PR #1283's chained-rebase-merge — PR #1282, the original guess-only PR, was closed as superseded since #1283 absorbed both guess + recovery commits)
**Ground-truth recovery timestamp:** 2026-05-03 ~03:00Z
**Author:** Otto autonomous (architect hat)
**Protocol:** in-the-moment guess + ground-truth recovery per
`memory/feedback_guess_then_verify_architectural_intent_calibration_protocol_aaron_2026_05_03.md`
**Recovery method:** direct read of `docs/backlog/P2/081KQNJ500008QG0R001VGMS5G-skill-domain-plugin-packaging-aaron-2026-05-03.md` body
**Series:** Guess #002 in calibration series; #001 scored 48%, #002 scored 65% — improvement attributed to recent specific-context (PR #1262) boosting specific-implementation layer
