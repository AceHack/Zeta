# Guess #001 — 081KQNJ500008QG0R003ZC6PK8 hook-authoring-for-skill-creation-contracts

## Target

`docs/backlog/P1/081KQNJ500008QG0R003ZC6PK8-hook-authoring-for-skill-creation-contracts-aaron-2026-05-03.md`

The architectural choice: Aaron filed 081KQNJ500008QG0R003ZC6PK8 for a "hook-authoring"
backlog row in the context of skill-creation contracts. The question
this guess answers: **what is Aaron's architectural intent for using
hooks (specifically) — vs alternatives like CI workflows, manual
review, or in-skill-body validation?**

## Read state at guess time (2026-05-03 ~02:42Z)

Otto has already read (in this session or via prior ticks):

- The 081KQNJ500008QG0R003ZC6PK8 ROW NAME ONLY (from `ls docs/backlog/P1/`)
- The skill-design-rules memo
  (`feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md`)
  — Aaron's skill-design rule 2: no dynamic commands in skills, use TS
  files under tools/ and reference by path; rule 3: package skill
  domains as plugins, use harness hooks for pre/post-condition
  enforcement (contract-based development)
- The decision-graph emergent property memo
  (`feedback_decision_graph_emergent_from_archaeologies_and_flywheel_aaron_2026_05_03.md`)
  — names 081KQNJ500008QG0R003ZC6PK8 as "edge-property checks at commit / merge time" + as
  "edge-implementation discipline"
- The substrate-claim-checker (081KQNJ500008QG0R003SCWBDV, shipped) — which is the kind of
  TS tool Aaron's rule 2 wants

## Research deliberately AVOIDED

Otto has NOT read:

- The 081KQNJ500008QG0R003ZC6PK8 row body text (only the title from `ls`)
- Any commits referencing 081KQNJ500008QG0R003ZC6PK8
- Any persona notebooks discussing hook-authoring
- Any prior conversation about Claude Code hooks specifically

## Otto's in-the-moment guess

### Architectural intent (high confidence)

Aaron's primary architectural intent for hooks-as-the-mechanism:
**hooks are local-fast-feedback enforcement at the commit boundary,
which is where skill-creation iteration happens.**

Specifically:

1. **Local enforcement vs CI workflows** — CI workflows fire after PR
   push; hooks fire at `git commit` time. For skill-creation iteration,
   the agent authoring the skill needs immediate feedback (was the
   skill body well-formed? did it break the carved-sentence
   discipline?). CI delay = bad iteration UX
2. **Harness-native enforcement** — Claude Code has hook machinery
   (pre-commit hooks, settings hooks, etc.). Aaron's skill-design rule 3
   names "use harness hooks for pre/post-condition enforcement
   (contract-based development)" — hooks compose with the harness's
   native event model
3. **Separation of concerns** — the skill body says WHAT the skill
   does; the hook enforces IS THIS SKILL VALID. Two different
   responsibilities; two different surfaces. The skill body shouldn't
   carry its own validator (that violates rule 2's no-dynamic-commands
   direction)

### Substrate-content intent (medium confidence)

The hook will likely be:

- A pre-commit hook that fires when `.claude/skills/*/SKILL.md` files
  are staged
- TS-implemented (per rule 2: no dynamic commands; TS files under
  tools/) — concretely something like `tools/git/hooks/skill-creation-contract-check.ts`
  (NOTE: I'm guessing the path here; the decision-graph memo cited
  `tools/git/hooks/` so I'm using that)
- Composes with substrate-claim-checker (081KQNJ500008QG0R003SCWBDV) — runs the same
  count-drift / existence-drift / etc. checks on the skill body that
  the standalone CLI tool would
- May also enforce: carved-sentence presence, frontmatter completeness,
  hub-satellite-pattern markers, no-cargo-cult-references, etc.

### Specific implementation intent (lower confidence)

The hook will probably:

- Use Claude Code's `.claude/settings.json` `hooks` field to register
  itself
- Take input via stdin per Claude Code's hook protocol (the hook
  payload includes file paths + event type)
- Output structured result (block-or-allow + reason) per Claude Code's
  hook contract
- Provide override path for emergency commits (no false-positive lock)

## Confidence levels

| Layer | Confidence | Reasoning |
|---|---|---|
| Architectural — "hooks because local-fast-feedback" | **High** | Composes naturally with Aaron's skill-design rule 3 (already first-party-confirmed) + the iteration-UX argument is self-evident |
| Substrate-content — "TS file under tools/git/hooks/" | **Medium** | Decision-graph memo cited the path; rule 2 forces TS; but the specific filename + scope is inferred not confirmed |
| Specific — "Claude Code settings.json + stdin protocol" | **Low** | Standard Claude Code hook shape but I haven't confirmed the specific event names or payload schema for this hook type |

## Ground truth (recovered 2026-05-03 ~02:50Z via direct read of 081KQNJ500008QG0R003ZC6PK8)

Read source: `docs/backlog/P1/081KQNJ500008QG0R003ZC6PK8-hook-authoring-for-skill-creation-contracts-aaron-2026-05-03.md` (full body) — protocol-permitted only after the guess commit landed (PR #1279 merged onto main).

### Architectural intent (Aaron's verbatim)

> *"this feature is great for reminding yourself to do the right thing the pre conditions and post condtions in contract based development or spec based development like openspec"*

**Primary frame**: contract-based development (Meyer, Eiffel) / Design-by-Contract / spec-based development (OpenSpec). Hooks fire at well-defined points (pre-tool-use, post-tool-use, session-start, pre-commit, commit-msg) — **the natural place to enforce pre-conditions and post-conditions on procedures**.

### Substrate-content intent (CORRECTED 2026-05-03 — Aaron clarified harness-hooks-only after initial recovery)

**Initial recovery (PR #1280) was wrong.** The 081KQNJ500008QG0R003ZC6PK8 row body lists 3 hook integrations including 2 git hooks; my recovery section reproduced that. **Aaron 2026-05-03 clarification** (see `memory/feedback_dst_justifies_ts_quality_over_bash_and_harness_hooks_suffice_no_git_hooks_aaron_2026_05_03.md`): vibe-coders always have a harness; harness hooks suffice; git hooks are antipattern in this scope. **Corrected scope is harness hooks + CI only, NOT git hooks.**

**Two hook integrations** (CORRECTED, NOT three) — actual deliverables of 081KQNJ500008QG0R003ZC6PK8 going forward:

1. **Harness hooks** *(proposed; new in correction)* — Claude Code's `.claude/settings.json` hooks FIELD (the file `.claude/settings.json` itself already exists on main with an `enabledPlugins` field, but the `hooks` field is not yet present/defined — adding the field is part of 081KQNJ500008QG0R003ZC6PK8 deliverables), with parallel mechanisms for Codex / Cursor / etc.; called via the harness's runtime; TS-canonical
2. **`.github/workflows/substrate-claim-checker.yml`** *(proposed)* — CI check on PR descriptions (host-authored; runs on PR creation)

**Removed from scope** (the original recovery had these as "proposed" too; Aaron's clarification removes them entirely):

- ~~`tools/git/hooks/pre-commit`~~ — Harness fires on pre-tool-use (Edit/Write) before content lands; covers the same use case
- ~~`tools/git/hooks/commit-msg`~~ — Harness fires on pre-Bash-tool-use when command is `git commit`; covers the same use case

As of correction time (2026-05-03), the `hooks` field in `.claude/settings.json` is not yet populated, and `.github/workflows/substrate-claim-checker.yml` does not exist on main. Both are 081KQNJ500008QG0R003ZC6PK8 row deliverables. **Do NOT implement git hooks for 081KQNJ500008QG0R003ZC6PK8** — that's the wrong shape per Aaron's clarification.

depends_on: **[081KQNJ500008QG0R003SCWBDV (substrate-claim-checker tool) + 081KQNJ500008QG0R001N94412 (OpenSpec catch-up — contracts live in specs)]**

### Specific implementation intent (CORRECTED)

- **Harness hooks** (per Claude Code's `.claude/settings.json` hooks field), NOT git hooks. Same goes for Codex / Cursor equivalents
- TS-canonical (per Aaron's skill-design rule 2 + DST justification): `bun tools/substrate-claim-checker/check-counts.ts <staged-files>` is invoked directly by the harness
- Strict vs warn mode via `SUBSTRATE_CLAIM_CHECKER_MODE` env var (warn for v0.x rollout; strict once mature) — env var **not yet recognized** by `tools/substrate-claim-checker/check-counts.ts` v0.4.4 OR v0.5; would be added as part of 081KQNJ500008QG0R003ZC6PK8 implementation
- Per-check-type opt-out via comment markers: `<!-- substrate-claim-checker: skip-count-drift -->` — markers **not yet recognized** by v0.5; would be added as part of 081KQNJ500008QG0R003ZC6PK8 implementation (or 081KQNJ500008QG0R003SCWBDV v1+)
- Performance target: <2 seconds per pre-tool-use trigger

## Calibration delta

### Architectural layer — PARTIAL-MATCH

| What I got | What I missed |
|---|---|
| harness-native enforcement (correct) | The **contract-based development / Design-by-Contract / OpenSpec** primary frame — Aaron's load-bearing motivating frame |
| local-fast-feedback at commit boundary (correct) | The pre/post-condition framing as the *primary* purpose, not just a benefit |
| separation of concerns (skill body = WHAT, hook = VALID) (correct) | (no miss here) |
| composes with skill-design rule 3 (correct, was already first-party-confirmed) | (no miss here) |

**Analysis**: I touched the surface (separation of concerns / harness-native) but didn't surface the deeper architectural framing — Aaron is using hooks to operationalize contract-based development / DbC / spec-based development, not just to provide validation. The Design-by-Contract / Eiffel / OpenSpec lineage is load-bearing for understanding why hooks are the right primitive, and I missed it.

### Substrate-content layer — MIXED

| What I got | What I missed |
|---|---|
| `tools/git/hooks/` path (correct; cited from decision-graph memo) | **Multi-hook architecture** — three hooks (pre-commit + commit-msg + CI workflow), not one |
| pre-commit hook fires on staged content (correct) | **commit-msg hook** is its own surface (commit message text validation; pre-commit can't see this) |
| TS implementation (close — TS is the underlying tool; hooks are bash wrapping TS) | **CI workflow on PR descriptions** — host-authored content; different timing from git hooks |
| Composes with substrate-claim-checker (081KQNJ500008QG0R003SCWBDV) (correct) | (no miss here) |
| | **Hook scope** — validates ALL staged content (memos, docs, config), not just `.claude/skills/*/SKILL.md` |

**Analysis**: My substrate-content guess was too narrow. I assumed one hook focused on skill-files; ground truth has three hooks covering staged content / commit message / PR description. The fact-claim surface has three timing windows; each needs its own hook. I missed the multi-hook architecture entirely.

### Specific implementation layer — MOSTLY-OFF

| What I got | What I missed |
|---|---|
| Structured exit contract (exit code blocks vs allows) | **git hooks vs Claude Code hooks** — I guessed `.claude/settings.json` Claude Code hooks; actual is git hooks (`tools/git/hooks/`). Significantly different mechanisms |
| Override path for edge cases | **Per-check-type opt-out via comment markers** — more granular than my "emergency-commit override" guess |
| | **Strict vs warn mode via env var** — I didn't anticipate the rollout-mode-switch design |
| | **Performance target** (<2 seconds) — I didn't think about this |
| | **Bash wrapping TS** — I guessed pure TS; actual is bash invoking bun |

**Analysis**: My specific-implementation guess was the weakest layer (which I correctly self-rated as "low confidence"). The git-hooks-vs-Claude-Code-hooks confusion is the biggest error — fundamentally different mechanisms. Both are called "hooks" but git hooks fire on git events, Claude Code hooks fire on Claude Code tool-use events.

### Cross-row composition layer — MISSED

| What I got | What I missed |
|---|---|
| Composition with 081KQNJ500008QG0R003SCWBDV (substrate-claim-checker) — implicit in my guess | **081KQNJ500008QG0R001N94412 (OpenSpec catch-up) as depends_on** — Aaron explicitly named OpenSpec as the contract source (*"hooks enforce contracts; contracts live in OpenSpec capabilities"*) |
| | I knew 081KQNJ500008QG0R001N94412 existed as a sibling but didn't see it as the load-bearing contract source |

**Analysis**: I had the substrate-content piece (substrate-claim-checker integration) but missed the spec-source piece (OpenSpec). Without specs, hooks have no contracts to enforce — that's the architectural reason for 081KQNJ500008QG0R003ZC6PK8's depends_on 081KQNJ500008QG0R001N94412. My guess implicitly assumed substrate-claim-checker provides the contracts, but actually substrate-claim-checker is the **enforcement engine** while OpenSpec provides the **contracts being enforced**. Two different layers.

## Summary

**Score (informal):**

| Layer | Score | Notes |
|---|---|---|
| Architectural intent | **6/10** | Got periphery (separation, harness-native); missed primary DbC/OpenSpec frame |
| Substrate-content | **5/10** | Got 1 of 3 hooks; right path; missed multi-hook architecture |
| Specific implementation | **3/10** | Wrong hook system; missed mode-switch + opt-out granularity |
| Cross-row composition | **5/10** | Got 081KQNJ500008QG0R003SCWBDV implicit; missed 081KQNJ500008QG0R001N94412 explicit |

**Overall**: Inference was strong on **principles** (separation of concerns; harness-native; composition) and weak on **specifics** (which hook system; which timing windows; which contract source). My self-reported confidence was well-calibrated — high-confidence layer scored highest; low-confidence layer scored lowest.

**Pattern observation**: My inference defaults to *generalization-from-principle* rather than *specific-mechanism-recall*. For substrate-content + implementation specifics, principle-based inference is unreliable; specific-mechanism-research is needed.

**Useful for cross-model retroactive replay**: this calibration data point is now reproducible — give another model 081KQNJ500008QG0R003ZC6PK8's row title only + the same prior-substrate context, see how their guess compares. The fact that I missed the contract-based-development frame is a genuine inference-failure that other models can be tested against.

---

**Guess timestamp:** 2026-05-03 ~02:42Z (committed under cf1dc7b on the guess branch; landed to main via PR #1279)
**Ground-truth recovery timestamp:** 2026-05-03 ~02:50Z
**Author:** Otto autonomous (architect hat)
**Protocol:** in-the-moment guess + ground-truth recovery per
`memory/feedback_guess_then_verify_architectural_intent_calibration_protocol_aaron_2026_05_03.md`
**Recovery method:** direct read of `docs/backlog/P1/081KQNJ500008QG0R003ZC6PK8-hook-authoring-for-skill-creation-contracts-aaron-2026-05-03.md` body
