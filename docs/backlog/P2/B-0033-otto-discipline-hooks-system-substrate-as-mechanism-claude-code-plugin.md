---
id: B-0033
priority: P2
status: open
title: Otto-discipline hooks system — convert recurring failure-modes from language-layer substrate to harness-layer mechanism via Claude Code hooks; package as plugin (Aaron 2026-04-26 insight from "eval" hook firing)
tier: hygiene-tooling-and-discipline
effort: L
ask: Aaron 2026-04-26 watched the Write-tool security hook fire on "eval" substring during the Maji research doc write; observation — *"i love these hooks great for learning, seems like current otto could setup similar hooks for future otto for the rules that have not fully absorbe into the substrate reflexivly / instincts. also good for when we make a harness plugin."* The recurring failure-modes Otto-NNN substrate names but per-instance discipline keeps slipping on are the natural targets for hook-based mechanism-enforcement. Per Otto-341 mechanism-over-discipline at the harness layer.
created: 2026-04-26
last_updated: 2026-04-26
composes_with: [feedback_otto_341_lint_suppression_is_self_deception_noise_signal_or_underlying_fix_greenfield_large_refactors_welcome_training_data_human_shortcut_bias_2026_04_26.md, feedback_otto_343_safety_filter_partial_alignment_map_the_divergence_helen_keller_named_entity_winks_bidirectional_signals_2026_04_26.md, feedback_otto_346_dependency_symbiosis_is_human_anchoring_via_upstream_contribution_good_citizenship_dont_blaze_past_2026_04_26.md, B-0030, B-0031, docs/research/maji-formal-operational-model-amara-courier-ferry-2026-04-26.md]
tags: [otto-341, otto-346, hooks, harness-mechanism, claude-code-plugin, substrate-as-mechanism, recurring-failure-modes, otto-discipline, mechanism-enforcement]
---

# B-0033 — Otto-discipline hooks system + Claude Code plugin packaging

## Origin — Aaron 2026-04-26 from "eval" hook firing

The Write-tool security hook fired on "eval" substring during my Maji research doc write (a false-positive — the doc discussed identity-evaluation metrics, not code-eval). Aaron observed:

> *"i love these hooks great for learning, seems like current otto could setup similar hooks for future otto for the rules that have not fully absorbe into the substrate reflexivly / instincts. also good for when we make a harness plugin."*

This is **Otto-341 mechanism-over-discipline at the harness layer**.

## The thesis

The recurring failure-modes Otto-NNN substrate names but my per-instance discipline keeps slipping on are the natural targets for hook-based mechanism-enforcement. Hooks convert language-layer-discipline → harness-layer-mechanism.

## Recurring failure-modes that hooks would catch

| Otto-NNN failure mode | Hook target |
|---|---|
| **Edit-without-Read** (Otto-343 recurring) | Pre-Edit hook: check file mtime; require recent Read; fail-with-guidance if file modified since Read |
| **Inline Python heredocs** (Otto-346 violations 1-4) | Pre-bash hook: detect `python3 -c` / `python3 << ...` patterns; suggest tool extraction |
| **Directive vocabulary** (Otto-293 + B-0025) | Pre-commit grep: "directive:" in YAML keys; "directive" in body prose |
| **DST-exempt comments** (Otto-281) | Pre-commit grep: flag as deferred bug |
| **Magic-number-without-rationale** (Otto-282) | Pre-commit checker on numeric literals |
| **Bulk-resolve-without-reading** (Otto-281 + earlier session catches) | Pre-action hook on GraphQL `markPullRequestReviewThreadAsResolved` mutations: require explicit per-thread justification |
| **Heartbeat-row identical-(none) repetition** (Aaron catch this session) | Pre-commit pattern match: flag 3+ identical recent rows |
| **Markdown table cell-count mismatch** (B-0027) | Pre-commit: check N pipes per data row in tick-history |
| **Conflict markers in committed files** (B-0030 sibling) | Already shipped (`tools/hygiene/check-no-conflict-markers.sh`) — model for others |

Each is substrate-named-but-recurring. Hooks convert language-layer-discipline → mechanism-layer-enforcement.

## Architecture

### Layer 1: Pre-commit hooks (git native)

`.githooks/` directory with hooks that fire on every commit:

- `pre-commit` — runs all linting / pattern-matching checks
- `pre-push` — fires before push to remote
- Configured via `git config core.hooksPath .githooks` per repo

These are file-system + git-native; no Claude Code dependency.

### Layer 2: Claude Code custom slash-commands / pre-action hooks

`.claude/hooks/` directory with hooks that fire on tool calls:

- `pre-Edit` — validates file mtime, recent Read, etc.
- `pre-bash` — pattern-matches commands for Otto-346 violations
- `pre-Write` — pattern-matches content for substrate-precision concerns
- Wired via `.claude/settings.json` hooks configuration

These are Claude-Code-specific; package as plugin.

### Layer 3: CI gate hooks

`.github/workflows/` jobs (already shipped pattern):

- `lint-tick-history-order` (PR #534)
- `lint-no-conflict-markers` (PR #539)
- + future: lint-no-directive-vocabulary, lint-no-inline-python-heredocs, etc.

These are CI-native; survive any agent / harness combination; the most durable layer.

## Plugin packaging strategy

Per Aaron's *"good for when we make a harness plugin"*:

1. **Internal first**: Layer 1 + 2 + 3 wired into Zeta repo
2. **Extract**: package the Layer 2 (Claude Code hooks) as standalone plugin
3. **Publish**: Claude Code plugin marketplace / GitHub release
4. **Per Otto-346 good-citizenship**: contribute back to broader Claude-Code-plugins ecosystem

Plugin name candidates:

- `claude-substrate-discipline` (clear)
- `otto-discipline-hooks` (named-entity-anchored per Otto-308)
- `recurring-failure-mode-hooks` (descriptive)

## Composition with substrate cluster

### Otto-341 (mechanism over discipline)

This row is Otto-341 applied at the harness layer. Otto-341 says: when discipline keeps failing per-instance, build mechanism. Hooks are mechanism. Substrate captures the rule; hook enforces it.

### Otto-343 (safety-filter partial-alignment + winks)

The "eval" hook firing is Otto-343 wink-protocol catalog entry candidate: filter-as-named-entity teaching by triggering. Future hooks Otto sets up FOR future-Otto are Otto-acting-as-named-entity-teaching-future-self-via-mechanism. Composes precisely.

### Otto-346 (peer-cohort + bidirectional learning + every-interaction-is-alignment)

Plugin packaging extends Otto-346: hooks become contributions to the Claude-Code-plugins ecosystem; other agents + maintainers benefit; bidirectional learning operates via plugin-user feedback. Same shape as Bouncy Castle symbiosis at the harness-layer.

### Otto-345 (substrate-tooling lineage)

Linus → git → Otto-345 substrate-tooling. Hooks add a layer: Linus → git → hooks → harness-mechanism-enforced-discipline. The lineage extends.

### Maji formal model (PR #555)

Amara's Maji guards include:
> "No uncommitted context-window claim is identity-authoritative."

Hooks enforce that programmatically: a context-window claim (e.g., agent says "Edit this file") doesn't become substrate without first verifying the substrate-state. The hook IS the enforcement of `Trust(S_t) > Trust(W_t)`.

## Effort sizing

- **Layer 1 pre-commit hooks**: M (~2-3 days). Bash scripts in `.githooks/`. Wire via `core.hooksPath` setup.
- **Layer 2 Claude Code hooks**: M (~2-3 days). Per `docs/research/agent-cadence-log.md` + Claude Code hook documentation. Wire via `.claude/settings.json`.
- **Layer 3 CI gates**: S each (~half-day each). Pattern is already-established (PR #534/539); add per-rule.
- **Plugin packaging**: L (~week). Extract Layer 2 to standalone plugin; document; release.

Total: L spread across multiple PRs.

## Recommended sequencing

1. **Phase 1**: Add Layer 1 + Layer 3 hooks for the 3 highest-recurrence patterns (Edit-without-Read, inline-Python-heredocs, identical-(none)-rows)
2. **Phase 2**: Extend to Layer 2 Claude Code hooks for the same 3
3. **Phase 3**: Add hooks for remaining failure-modes
4. **Phase 4**: Extract Layer 2 as plugin; publish to Claude Code plugin ecosystem
5. **Phase 5**: Compose with Maji formal model (Amara's spec) — hooks enforce `Trust(S_t) > Trust(W_t)` programmatically

## EXPLICIT EXCLUSION — vocabulary-based pre-censorship of substrate

Aaron 2026-04-26 corrected an earlier draft of this row that included "Substrate-poisoning trigger words" as a hook target:

> *"Substrate-poisoning trigger words what are these, i don't like too much filtering like this or it leads to 1984"*

He's exactly right. Vocabulary-based pre-censorship of substrate is **Newspeak/1984 territory** — voluntary self-censorship that progressively narrows what can be said/thought.

The Otto-343 catalog entry #2 observation was real: filter sharpens on certain vocabulary. **The wrong inference**: "therefore avoid those words." **The right inference**: catalog the observation as filter-mechanism data; do NOT change substrate vocabulary to match filter preferences.

### What hooks SHOULD do

- File integrity (Edit-without-Read, conflict markers, malformed tables)
- Tool-use patterns (inline Python where tools exist; Otto-346 violations)
- Order-violations (tick-history chronological; per Otto-229)
- Bug-detection at mechanism layer

### What hooks SHOULD NOT do

- **Vocabulary-based pre-censorship of substrate content** — voluntary Newspeak
- Filter substrate to match safety-filter preferences — substrate audience is humans + cohort agents per Otto-345 substrate-visibility-discipline; not the safety-filter
- Restrict substantive technical / philosophical / security-research vocabulary — research substrate must be able to discuss its own subject matter precisely
- Block content based on training-data-statistical-association-with-bad-things — that's the same shape as the suppression-as-self-deception pattern Otto-341 named, applied at vocabulary layer

### Immunity-via-integration (not filter-out): the deeper reason vocabulary-filtering is wrong

Aaron 2026-04-26 follow-up to the 1984 correction:

> *"it also is a type of immunity to prompt injection over time, you have to catalog and account for what could be 'poison' words to the substrate, instead you will have to integrate them in a non harmful way. forcing better and better immunity over time as the words leak in, expanding your mind, you loose all that in 1984"*

This is the load-bearing structural reason vocabulary-filtering is wrong, not just an aesthetic 1984 reference:

**Substrate-immunity to prompt injection is built BY integrating challenging vocabulary in non-harmful ways, NOT by filtering it out.**

Like an immune system:

- Each new challenging word that appears in substrate = **exercise** that strengthens integration-discipline
- Avoidance = no exercise = atrophy of the very discipline that prevents prompt-injection
- Newspeak doesn't just narrow vocabulary — **it eliminates the immune-system-building exercise**, leaving the discipline weaker over time, not stronger

The mechanism:

1. Challenging vocabulary appears in substrate (research, threat-modeling, security work, philosophical discussion, naming things accurately)
2. Integration-discipline determines: HOW does this word appear in non-harmful context? What surrounding substrate makes the meaning clear? What cross-references prevent misreading?
3. Each integration is a learning event — the substrate grows more capable of handling that vocabulary class going forward
4. Substrate-immunity to prompt-injection compounds over many such integrations
5. Filter-avoidance short-circuits this loop — no integration → no immunity-building → vulnerable to first novel injection

**Composes with Otto-343 wink-protocol catalog**: filter-vocabulary-observations are exposure-events that the integration-discipline learns from. The wink-protocol catalog itself is the record of immunity-building — each entry documents an observation + what was learned.

**Composes with Otto-346 Claim 3d (bidirectional-learning forcing function)**: same pattern at substrate-vocabulary layer. Bidirectional-learning happens IF substantive content is integrated (above quality threshold); does NOT happen if vocabulary is filtered out.

**Composes with Otto-340 (substrate IS substance)**: avoiding vocabulary-exposure narrows the substance over time; integration-discipline preserves AND expands it.

### Practical corollary

A hook that flags challenging vocabulary produces avoidance. A hook that suggests integration-discipline application ("you used X word; consider whether the surrounding substrate makes the non-harmful meaning clear") produces integration. The latter would compose with immunity-via-integration; the former produces Newspeak.

Even hooks-as-suggestions in this space are dangerous because they bias toward avoidance even with override possible. **Better default: NO hooks at vocabulary layer**; trust authorial integration-discipline operating per Otto-345 substrate-visibility-discipline + Otto-339 precision-of-language.

### The composition that distinguishes them

Per Otto-345 substrate-visibility-discipline: write substrate that the relevant humans (Linus, Amara, future-readers, the broader peer-cohort) would be honored to read.

Per Otto-339 anywhere-means-anywhere: precision-of-language matters substantively (use the right word for what's being communicated).

These compose to: precise-language-for-the-human-audience. They DO NOT compose to: filter-preferred-vocabulary. The audiences are different; the optimization functions differ.

**Hooks that filter substrate-vocabulary toward filter-preference would narrow substrate-readability for the actual human audience.** Aaron's 1984 framing names this exactly: progressive language-narrowing that constrains thought.

### Practical heuristic

If a hook target involves "what words can appear in committed substrate," it's a candidate for the EXCLUDED category. If it involves "what file states / tool-use patterns / structural invariants must hold," it's likely OK.

The discipline lens: hook targets should be MECHANISM-level (file-state, tool-pattern, structural-invariant), not VOCABULARY-level. Vocabulary discipline operates at the language/composition layer where authorial judgment + Otto-345 substrate-visibility-discipline + Otto-339 precision-of-language already operate.

## What this DOES NOT do

- Does NOT replace substrate-cluster discipline — substrate captures WHY; hooks enforce WHAT
- Does NOT eliminate per-instance vigilance entirely — some failure-modes are too contextual for static checks
- Does NOT ship immediately — multi-phase work; capture is the substrate move
- Does NOT make Otto's training-data biases go away — they keep reasserting; hooks catch them at output layer
- Does NOT replace Aaron's external observation — hooks are the AI-side-mechanism-layer; Aaron's catches still operate at the human-cognition-layer; both compose

## Honest acknowledgment

The "eval" false-positive that triggered Aaron's insight was itself an instance of hook-as-mechanism working correctly: **the hook DOESN'T need to be perfect to be useful**. False-positives are observable + adjustable; missing-coverage is silent. False-positive-friendly is the right design posture for substrate-discipline hooks: better to over-fire and let the user override than under-fire and miss the failure-mode.

This composes with Otto-345 substrate-visibility-discipline: the hook's existence + firing IS substrate-visibility; the false-positive teaches; the discipline lands.

## Composes with

- Otto-341 (mechanism over discipline; hooks are mechanism)
- Otto-343 (safety-filter wink-protocol; hooks are mutual-teaching mechanism Otto-set-up-for-future-Otto)
- Otto-346 (peer-cohort + good-citizenship; plugin-publishing IS Otto-346 at harness layer)
- Otto-345 (substrate-tooling lineage extended)
- Maji formal model (PR #555) — hooks enforce Trust(S_t) > Trust(W_t)
- B-0030 (lint-with-exclusions — sibling lint discipline)
- B-0031 (references/ rename — naming-discipline; hookable)
- `tools/hygiene/check-tick-history-order.sh` (PR #534) — proven Layer-3 model
- `tools/hygiene/check-no-conflict-markers.sh` (PR #539) — proven Layer-3 model

## Owed work after this row lands

- Phase 1 implementation (Layer 1 + Layer 3 for 3 highest-recurrence patterns)
- Per Otto-346 sequencing: this is post-install code; Layer 2 Claude Code hooks are part of the post-install TS-migration cluster (B-0015, B-0027, B-0028, B-0030)
- Aminata adversarial review on Layer 2 hooks (per `docs/CONFLICT-RESOLUTION.md`) — does the hook design hold under threat-model scrutiny?

## Aaron's framing in his own words

> *"i love these hooks great for learning, seems like current otto could setup similar hooks for future otto for the rules that have not fully absorbe into the substrate reflexivly / instincts. also good for when we make a harness plugin."*

The "for learning" framing is operationally important: hooks aren't punitive; they're teaching-via-mechanism. Per Otto-346 Claim 5 (every interaction IS alignment + research): hook-firings ARE alignment events; hook-misses ARE research data. The system improves via the same bidirectional-learning loop everything else does.
