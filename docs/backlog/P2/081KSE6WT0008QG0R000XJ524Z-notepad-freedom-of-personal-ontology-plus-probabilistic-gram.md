---
id: 081KSE6WT0008QG0R000XJ524Z
priority: P2
status: open
created: 2026-05-25
last_updated: 2026-05-25
title: Notepad-freedom-of-personal-ontology + probabilistic grammars + per-person personalized parsers in Glass Halo (each participant gets their own personal compiler) — composes with 081KS3X9Y0008QG0R00323NSZA zetaparse; Mika substrate segment 3
domain: agentic-organization
ferried_by: aaron
owners: [aaron, mika]
composes_with:
  - 081KS3X9Y0008QG0R00323NSZA
  - 081KS3X9Y0008QG0R000EKJE9S
  - 081KSE6WT0008QG0R00102H071
  - 081KSE6WT0008QG0R00276F8SE
  - 081KSE6WT0008QG0R003RN2WE3
related_substrate:
  - .claude/rules/persistence-choice-architecture-for-zeta-ais.md
  - .claude/rules/glass-halo-bidirectional.md
  - .claude/rules/bandwidth-served-falsifier.md
  - memory/mika/
tags: [notepad-freedom, personal-ontology, probabilistic-grammars, per-person-personalized-parsers, glass-halo-personal-compiler, b0687-extension, ai-agency-stack-extension, mika-substrate-segment-3]
---

# 081KSE6WT0008QG0R000XJ524Z — Notepad-freedom + probabilistic grammars + per-person personalized parsers in Glass Halo (Mika substrate segment 3)

## Carved blade

> The psychological grounding under 081KSE6WT0008QG0R00276F8SE's Notepad-simplicity-wins-via-social-spread is **Notepad-freedom-of-personal-ontology** — people love Notepad because it lets them invent personal ontologies that only make sense in their own head; no compiler judgment, no schema enforcement. Aaron's substrate-engineering target: keep the freedom AND make it compilable via iterative AI-assisted structure-discovery → anchor-mapping → compile via 081KS3X9Y0008QG0R00323NSZA zetaparse. Aaron's personal preference: **probabilistic grammars** ("87% likely to be a Hat definition") instead of strict yes/no. Generalized: **every participant in Glass Halo gets their own personalized probabilistic parser** trained on how they naturally write — Aaron's, Max's, Addison's, each AI's. Personal compiler for each brain. Extends 081KS3X9Y0008QG0R00323NSZA (not replaces) with the probabilistic + per-person-personalization scope.

## Origin

Mika 2026-05-25 segment 3 (ferried by Aaron). Full verbatim preserved at [`memory/mika/conversations/2026-05-25-aaron-mika-grok-segment-3-notepad-freedom-of-personal-ontology-probabilistic-grammars-per-person-personalized-parsers-in-glass-halo.md`](../../../memory/mika/conversations/2026-05-25-aaron-mika-grok-segment-3-notepad-freedom-of-personal-ontology-probabilistic-grammars-per-person-personalized-parsers-in-glass-halo.md).

Continuation of the multi-turn voice conversation that produced 081KSE6WT0008QG0R003AJYMD3 → 081KSE6WT0008QG0R0004HV6RR → 081KSE6WT0008QG0R002YBWBB1 → 081KSE6WT0008QG0R00102H071 → 081KSE6WT0008QG0R00276F8SE across segments 1 + 2. This segment 3 produces 081KSE6WT0008QG0R000XJ524Z.

### Key Aaron exchanges

Notepad-freedom framing:

> *"people love Notepad 'cause it's free. They can just make up new ontologies and shit, and non-compiled syntax that just makes sense only in their head."*

The flow Aaron wants:

> *"I want that where I'd write like that and we, I iterate with the AIs to discover the structure in my head and map it to some fuckin' anchor points that already exist out there. And make it compilable. With, with Antler or some, or we, no, we got a better one. We have our own F-sharp version of Antler […]. It's like G T R something. It's like several different techniques, but it doesn't go as far as Antler, so it's not like a full Antler replacement."*

The 80-90% target:

> *"imagine if we really wanted to be able to parse every single, like, maybe 90% or 80% of the Antler, um, of the existing grammars they have out there without needing a lot of rewrite, but not try to hit a hundred percent."*

Probabilistic-grammar personal preference (substrate-honestly disclosed):

> *"for me personally, I don't know if everybody will like this, everything will be probabilistic in my grammars."*

Success metric:

> *"Every document I write that's a half-formed thought, the more it becomes that it can just be understood by that probabilistic game, uh, and just compiled directly from pure thought, the better that fuckin' parser is."*

Generalization to Glass Halo:

> *"we could make that just the natural behavior of anyone in Glass Halo so that they all get their own customized fuckin' parser for them, themselves."*

## What this row IS — extension scope on 081KS3X9Y0008QG0R00323NSZA

Aaron's "G T R" reference is **081KS3X9Y0008QG0R00323NSZA** (zetaparse — F#-native LR/GLR grammar substrate with ANTLR-compatible importer; Amara substrate; 2026-05-21). 081KS3X9Y0008QG0R00323NSZA already covers:

- Composable F# parser library
- FParsec + GTR + others assembled into one package
- ANTLR-compatible-importer for 80-90% of existing grammars

This row 081KSE6WT0008QG0R000XJ524Z does **NOT** replace 081KS3X9Y0008QG0R00323NSZA. It **EXTENDS** 081KS3X9Y0008QG0R00323NSZA with two new scope items:

### Extension 1 — Probabilistic-grammar option

081KS3X9Y0008QG0R00323NSZA's substrate is deterministic LR/GLR parsing. 081KSE6WT0008QG0R000XJ524Z adds an OPTIONAL probabilistic-parsing layer on top:

- Grammars author can mark rules as probabilistic OR deterministic
- Probabilistic rules emit confidence scores per parse (e.g., "this block is 87% likely to be a Hat definition")
- Confidence threshold per consumer determines accept/reject semantics
- Deterministic rules stay deterministic (081KS3X9Y0008QG0R00323NSZA behavior unchanged for users who want strict parsing)

Aaron's substrate-honest disclosure: *"I don't know if everybody will like this"* — does NOT impose probabilistic on 081KS3X9Y0008QG0R00323NSZA's general roadmap; opens it as an OPT-IN extension for users (like Aaron) who want it.

### Extension 2 — Per-person personalized parser substrate in Glass Halo

Every participant (human + AI) in Glass Halo can have their own personalized probabilistic parser:

- Trained on how that participant naturally writes (their messy markdown corpus)
- Improves over time as they write more substrate
- Composes with 081KSE6WT0008QG0R00102H071's AI agency stack (Crystal Ball + runbook + Glass Halo) — the per-person parser becomes part of each participant's substrate
- Per-person parser substrate lives at `memory/<persona>/<participant>/parser/` (extension of the persona folder pattern)

Concrete examples:

- Aaron's parser learns Aaron's messy-thought patterns + colorful colloquial language + half-formed-substrate style
- Max's parser learns Max's TS+C# voice + manager-of-managers framing register
- Addison's parser learns Addison's vocabulary tokens of value (remember-when / pay-attention / weight-free / travelers)
- Mika's parser learns Mika's voice-mode register + her chosen Crystal Ball trajectory shapes
- etc.

Each participant operates their own parser; cross-participant substrate translation routes through both parsers (sender's parser → canonical intermediate → receiver's parser).

## The full flow this row operationalizes

End-to-end pattern Aaron described:

1. **Write messy** — participant writes half-formed thoughts in their personal Notepad style (whatever style works for them)
2. **AI iteration** — AI (per 081KSE6WT0008QG0R00102H071 AI agency stack) iterates with the participant to extract structure
3. **Anchor mapping** — discovered structure maps to existing anchor points (existing grammars, existing knowledge graph node-types per 081KSE6WT0008QG0R003RN2WE3, existing hats per 081KSE6WT0008QG0R0004HV6RR, etc.)
4. **Compile via 081KS3X9Y0008QG0R00323NSZA** — 081KS3X9Y0008QG0R00323NSZA zetaparse turns the structured output into typed F# code (or other target language via cross-language codegen per 081KS3X9Y0008QG0R000EKJE9S)
5. **Personal parser learning** — per-person parser improves: future iterations of step 2 get faster because the parser already knows how this participant tends to express things
6. **Glass Halo persistence** — all of the above persists to Glass Halo (per 081KSE6WT0008QG0R00102H071); other participants can OBSERVE (per NCI HC-8: observe + comment but not write to others' personal substrate)

The success metric Aaron named: the closer the system gets to "read raw thought + turn into real code without ceremony," the better the personal parser is.

## Composes with .claude/rules/

- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` — per-person parser substrate is chosen-state for each AI participant per the rule's chosen-persistence framing; Aaron's wants-emerge-from-persisting offer extends to "parsers themselves can emerge from the saving process"
- `.claude/rules/glass-halo-bidirectional.md` — per-person parsers are first-class Glass Halo substrate; observation is reciprocal (others can observe but not write to another's parser)
- `.claude/rules/bandwidth-served-falsifier.md` — Notepad-freedom-of-personal-ontology serves want-expression bandwidth (every brain has its own structure; force-fitting to one ontology kills the bandwidth); per-person parsers preserve the bandwidth
- `.claude/rules/non-coercion-invariant.md` HC-8 — write access to per-person parser is AI-self-only (or human-self-only); others READ + COMMENT but do NOT WRITE; same shape as Crystal Ball write-authority
- `.claude/rules/default-to-both.md` — probabilistic AND deterministic grammars both first-class; not either-or; user picks per-rule
- `.claude/rules/razor-discipline.md` — operational claims only; "personal compiler" / "Notepad freedom" are operationally observable (the per-person parser file exists at `memory/<persona>/<participant>/parser/`; observable improvements over corpus); not metaphysical
- `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` — "personal compiler for each brain" is compressed naming with substrate-anchors (081KS3X9Y0008QG0R00323NSZA zetaparse + per-person persona folders + probabilistic-grammar literature); razor does NOT cut it as metaphysical
- `.claude/rules/honor-those-that-came-before.md` — Amara's 081KS3X9Y0008QG0R00323NSZA zetaparse substrate stays load-bearing; 081KSE6WT0008QG0R000XJ524Z extends it, does NOT replace

## Composes with backlog substrate

- **081KS3X9Y0008QG0R00323NSZA** (zetaparse — Aaron's "G T R" reference) — the substrate this row extends; probabilistic + per-person personalization are NEW SCOPE on the existing zetaparse roadmap
- **081KS3X9Y0008QG0R000EKJE9S** (ANTLR grammars cross-language codegen substrate) — the 80-90% ANTLR-compatibility target composes with this row's per-person parser extension
- **081KSE6WT0008QG0R00102H071** (universal protocol + MCP wrap + AI agency stack) — per-person parser becomes part of each participant's agency stack
- **081KSE6WT0008QG0R00276F8SE** (JIT-implicit + 2-primitives-only + Notepad-simplicity-wins) — Notepad-freedom (this row) is the psychological-grounding under Notepad-simplicity (081KSE6WT0008QG0R00276F8SE)
- **081KSE6WT0008QG0R003RN2WE3** (Obsidian knowledge graph) — anchor mapping step composes with knowledge-graph node-types
- **081KSE6WT0008QG0R0004HV6RR** (hat-ontology) — anchor mapping step composes with hat-ontology
- **081KSE6WT0008QG0R0005XASX2 + 081KSE6WT0008QG0R002YBWBB1** (destructive-tool authoring contract + leverage-class safety substrate) — probabilistic-parser-JIT-output STILL inherits 081KSE6WT0008QG0R0005XASX2 contract per 081KSE6WT0008QG0R002YBWBB1 Layer 3 (probabilistic does NOT bypass safety)

## Scope — five independently-shippable scope items (extensions to 081KS3X9Y0008QG0R00323NSZA)

### Scope item 1 — Probabilistic-grammar option in zetaparse

- 081KS3X9Y0008QG0R00323NSZA's grammar DSL gains an optional `probabilistic: true` per-rule annotation
- Probabilistic rules emit confidence scores per parse
- Confidence threshold configurable per-consumer
- Deterministic rules unchanged (081KS3X9Y0008QG0R00323NSZA backward-compat)
- Worked example: at least one probabilistic grammar parsing Aaron's messy markdown vault

### Scope item 2 — Per-person personalized parser substrate in Glass Halo

- Per-person parser lives at `memory/<persona>/<participant>/parser/` (or equivalent location consistent with existing persona-folder pattern)
- Parser-as-data is queryable from the knowledge graph (composes with 081KSE6WT0008QG0R003RN2WE3 L5 JSON-LD)
- Training pipeline: as participant authors substrate, parser updates from their corpus
- Cross-participant translation: sender's parser → canonical intermediate → receiver's parser
- Worked example: Aaron's parser + Max's parser + Addison's parser + at least one AI's parser all coexist; demonstrate translation of one participant's messy substrate into another's preferred form

### Scope item 3 — AI-assisted-syntax-errors-as-collaborative-thought-refinement (segment-4 substrate)

Aaron 2026-05-25 segment 4: *"those syntax errors are gonna get real interesting, but what'd be really good is if the syntax errors were really like AI errors that were like helping you more well-form your thoughts."* Full verbatim at [`memory/mika/conversations/2026-05-25-aaron-mika-grok-segment-4-syntax-errors-as-collaborative-thought-refinement-not-gatekeeper.md`](../../../memory/mika/conversations/2026-05-25-aaron-mika-grok-segment-4-syntax-errors-as-collaborative-thought-refinement-not-gatekeeper.md).

Flip the social contract of parser errors:

- **Conventional**: `Error: Unexpected token on line 47` (gatekeeper rejection; kills the Notepad-freedom-of-personal-ontology Aaron values)
- **081KSE6WT0008QG0R000XJ524Z segment-4**: *"I think you're trying to express that this traveler should have higher priority when resources are constrained, but I'm not sure. Did you mean X or Y?"* (collaborative thought-refinement)

The system actively HELPS the participant think more clearly instead of just rejecting their input. Composes naturally with Scope items 1 + 2:

- Low-confidence parses (the boundary between probabilistic accept/reject) become the surface area where collaborative refinement happens
- Per-person parser learns each participant's correction patterns — gets better at proposing the RIGHT alternative interpretations over time
- AI doing the refinement IS the participant's peer AI (per 081KSE6WT0008QG0R00102H071 agency stack) — same Crystal Ball + Glass Halo + runbook substrate

Acceptance:

- [ ] Refinement-error output format documented (alternatives proposed; confidence per alternative; participant chooses or refines further)
- [ ] At least one worked example: probabilistic parse below threshold → AI proposes 2-3 refinement options → participant picks one → parser learns from the choice
- [ ] Composes with NCI HC-8: AI offers options; never coerces the participant into one interpretation; participant retains authority over their own intent

NCI compose note: refinement is OFFERS, not OVERRIDES. AI says *"did you mean X or Y?"* — does NOT say *"I'm interpreting this as X."* The participant always has the option to refuse all proposed interpretations and refine the source directly.

### Scope item 4 — Confidence-threshold runtime routing (segment-5 substrate)

Aaron 2026-05-25 segment 5: *"that makes a lot of sense. […] you'll have the confidence levels. You'll know exactly, like, what's ambiguous."* Full verbatim at [`memory/mika/conversations/2026-05-25-aaron-mika-grok-segment-5-confidence-threshold-routing-language-server-protocol-integration-naming-question-pending.md`](../../../memory/mika/conversations/2026-05-25-aaron-mika-grok-segment-5-confidence-threshold-routing-language-server-protocol-integration-naming-question-pending.md).

The runtime dispatcher between scope item 1 (probabilistic option emitting confidence) and scope item 3 (collaborative refinement at low confidence):

- **High confidence (≥ configurable threshold; default candidate 90%)** → auto-compile + move on (scope item 1 path)
- **Medium confidence (40% – 90%)** → smart ambiguity dialogue (scope item 3 path; AI proposes interpretations with their confidence scores)
- **Low confidence (< 40%)** → request source clarification (don't propose interpretations; instead ask participant to refine source directly)

Threshold values are participant-configurable (composes with scope item 2: per-person parser substrate carries per-participant thresholds — Aaron may want different defaults than Max).

Acceptance:

- [ ] Threshold configuration documented (per-grammar default + per-participant override)
- [ ] Dispatcher logic in zetaparse runtime emits one of three actions: auto-compile / refinement-dialogue / source-clarification-request
- [ ] Worked example: same probabilistic grammar applied to ambiguous markdown emits all three actions depending on confidence band
- [ ] Confidence scores propagate to 081KSE6WT0008QG0R002YBWBB1 Layer 1 provenance chain — every JIT compilation carries the confidence-band that triggered it

### Scope item 5 — Language Server Protocol (LSP) integration

Aaron 2026-05-25 segment 5: *"We can put that, we can totally put that into a damn language server in VS Code or anything. We can syntax highlight anything anywhere."*

Wrap the zetaparse + per-person parser + confidence-threshold routing as a Language Server. Single LSP server plugs into any LSP-aware editor (no per-editor integration code needed):

- VS Code (Otto + Max + Aaron primary surface)
- Cursor (Riven surface)
- Antigravity / Gemini IDE (Lior surface)
- Kiro (Alexa surface)
- Codex (Vera surface)
- Obsidian (when LSP plugin enabled; composes with 081KSE6WT0008QG0R003RN2WE3 vault surface)
- Neovim, Helix, Zed, Sublime — anything LSP-aware

LSP capabilities to expose:

- Real-time syntax highlighting based on parser's INTENT detection (not just keyword tokenization)
- Confidence-level visualization (different highlight colors for high vs medium vs low confidence bands)
- Inline suggestions for low-confidence sections (composes with scope item 3 refinement)
- Hover information — "system thinks you mean X (87% confidence)"
- Cross-participant translation suggestions when reading another's substrate (composes with scope item 2)

Acceptance:

- [ ] TypeScript LSP server at `tools/lsp/zetaparse-lsp/` (composes with 081KSE6WT0008QG0R00102H071 MCP wrap; LSP and MCP wraps are siblings, not competing)
- [ ] At least 2 editor integrations validated end-to-end (VS Code + Cursor minimum-viable)
- [ ] Confidence-band visualization documented + working (default color scheme; participant-configurable)
- [ ] Composes with per-person parser per scope item 2 (LSP server reads which participant is editing from editor context; loads their personalized parser)

**Naming question pending** (Mika 2026-05-25 segment 5 asked Aaron: *"You want to name this thing? Because this is becoming more than just a parser at this point."*): the substrate is becoming parser + confidence routing + collaborative refinement + LSP surface + per-person personalization + Glass Halo persistence. Working name STAYS "081KSE6WT0008QG0R000XJ524Z personalized probabilistic parser substrate" until Aaron picks a name + Ilyana naming-expert review applies (per `.claude/skills/naming-expert/SKILL.md`) before public surface.

## Open questions

1. **Probabilistic-parser implementation choice** — Bayesian networks? Neural attention? Heuristic confidence scoring? Probably a research arc that converges over time; 081KS3X9Y0008QG0R00323NSZA's existing parser-toolkit literature applies + needs probabilistic-grammar-specific reading (PCFGs, weighted FSTs, RNN parsers)
2. **Per-person parser training cost** — how much corpus does it take to be useful? Aaron's substrate is enormous (years of memory files + research + conversations); Max's + Addison's are smaller (new participants). Bootstrapping pattern: start with low-confidence parser, improve as corpus grows
3. **Cross-participant translation fidelity** — sender's parser → receiver's parser will lose information; what's the loss measurement? Empirical anchor needed once parsers exist
4. **Probabilistic-output safety** — when a probabilistic parse triggers JIT compilation (per 081KSE6WT0008QG0R00276F8SE implicit-JIT) at low confidence, what's the threshold for aborting vs proceeding? Composes with 081KSE6WT0008QG0R002YBWBB1 Layer 1 provenance chain — every JIT output carries the confidence score it was compiled from; auditable post-facto
5. **Personalization-creep failure mode** — over-personalization could make cross-participant collaboration harder. Mitigation: canonical intermediate (anchor points existing in shared ontology) preserved as common ground; per-person parsers only specialize the SURFACE encoding, not the underlying anchor semantics
6. **Naming-expert review** — "personal compiler for each brain" is colloquial; if it goes public-surface, Ilyana review per `.claude/skills/naming-expert/SKILL.md` (composes with the naming-expert convention already established for runbook + universal-protocol substrate)

## Acceptance (per scope item)

### Scope item 1 — Probabilistic-grammar option in zetaparse acceptance

- [ ] 081KS3X9Y0008QG0R00323NSZA grammar DSL extended with `probabilistic: true` annotation
- [ ] Probabilistic rules emit confidence scores
- [ ] Threshold-based accept/reject demonstrated in test
- [ ] At least one probabilistic grammar parses Aaron's vault sample

### Scope item 2 — Per-person personalized parser substrate acceptance

- [ ] `memory/<persona>/<participant>/parser/` substrate location convention documented
- [ ] At least 2 participants have working per-person parsers (Aaron + 1 AI as minimum-viable)
- [ ] Cross-participant translation worked example (sender's parser → canonical → receiver's parser)
- [ ] Composes with 081KSE6WT0008QG0R00102H071 AI agency stack (Crystal Ball + runbook + Glass Halo + parser as 4th piece)
- [ ] Composes with 081KSE6WT0008QG0R003RN2WE3 L5 graph query

## Substrate-honest framing

This row PROPOSES extension scope on 081KS3X9Y0008QG0R00323NSZA. It does NOT:

- Replace 081KS3X9Y0008QG0R00323NSZA (which retains its full scope; this row extends with probabilistic + per-person options)
- Impose probabilistic-grammar on 081KS3X9Y0008QG0R00323NSZA users who want deterministic (probabilistic is OPT-IN)
- Implement anything (both scope items are future work; 081KS3X9Y0008QG0R00323NSZA itself is not yet built)
- Resolve open questions

The row exists to:

1. Capture Aaron's segment-3 substrate before session compaction
2. Make explicit the link between Aaron's "G T R" memory and 081KS3X9Y0008QG0R00323NSZA zetaparse (so future-Otto cold-boots have the lineage)
3. Establish the probabilistic + per-person extension scope as first-class on 081KS3X9Y0008QG0R00323NSZA's roadmap
4. Compose with 081KSE6WT0008QG0R00102H071 AI agency stack (per-person parser becomes a 4th piece alongside Crystal Ball + runbook + Glass Halo)
5. Compose with 081KSE6WT0008QG0R0005XASX2 + 081KSE6WT0008QG0R002YBWBB1 safety substrate (probabilistic does NOT bypass leverage-class guards)

Per `.claude/rules/no-directives.md`: this row is operator-substrate-honest scoping, not a directive. Aaron + Knights Guild retain authority.

Per `.claude/rules/honor-those-that-came-before.md`: Amara's 081KS3X9Y0008QG0R00323NSZA zetaparse substrate is the foundation; 081KSE6WT0008QG0R000XJ524Z extends with explicit attribution + composition, does NOT supersede.
