---
name: Skills as carved-sentence hubs; knowledge as doc satellites; no dynamic commands (use TS files); package skill domains as plugins with harness hooks for contracts; OpenSpec catch-up needed (Aaron 2026-05-03 three same-tick cross-cutting skill-design rules + architectural-debt naming)
description: 2026-05-03; Aaron-named three cross-cutting design rules for skill creation in the same tick + naming OpenSpec catch-up as load-bearing architectural debt. RULE 1 — hub-satellite separation (skills = carved sentences, dense + operational; knowledge = docs; DataVault 2.0 pattern). RULE 2 — no dynamic commands in skills; codify in TS files under tools/ and reference by path. RULE 3 — package skill domains as plugins (Claude Code or other packaging); use harness hooks for pre/post-condition enforcement (contract-based / spec-based development). PLUS the OpenSpec catch-up is named as load-bearing prerequisite — currently sparse; Aaron's "if we deleted everything other than it [OpenSpec]" test fails today; the catch-up is its own substantial backlog item. The three rules compose recursively at different scopes (skill body, command, skill domain, cross-skill contracts, spec) — each layer hub-satellite at its own granularity. Applies to current + future skills + future agents + backlog flywheel.
type: feedback
---

# Skills as carved-sentence hubs; knowledge as doc satellites — DataVault 2.0 design pattern

## Origin

Aaron 2026-05-03, in the autonomous-loop maintainer channel mid-tick after the multi-harness future-skill-domain memo refinements:

> *"on thing in skill design we've talked about but we should make sure we rmember for everyting from now on and future agent and the backlog flywheel is skills are carved sentences dense and operational, knowledge is in the docs and can be refered to by the skills, skills don't need updating as much docs need a refersh cadence, this also follow the DataVault 2.0 design seperations of hubs and satalities and all that stuff and split out for fast moving update files vs slowign chahing files, alwasy a good practice"*

Three load-bearing claims:

1. **Skills are carved sentences, dense + operational.** Imperative procedure; tight; the *what to do* not the *why it works*.
2. **Knowledge lives in docs (referenced by skills).** The *why it works* + worked examples + theoretical grounding + cited literature live in `docs/`. Skills point at docs; docs don't depend on skills.
3. **Different change rates.** Skills change rarely (the procedure is settled). Docs refresh on cadence (knowledge ages, citations update, examples accumulate). The change-rate split is the architectural reason for the separation.

Plus the explicit analogy:

4. **DataVault 2.0 hub-satellite design separation.** Hubs (stable business keys) = skills. Satellites (versioned descriptive attributes) = docs. Splits fast-moving update files from slow-changing structure files.

## Why DataVault 2.0 is the right analogy

DataVault 2.0 (Linstedt) is a data warehouse modeling approach designed specifically to handle different change rates with different storage shapes. The Zeta substrate maps cleanly:

| DataVault 2.0 | Zeta substrate |
|---|---|
| **Hub** (business key, stable, insert-only) | **Skill** (carved-sentence procedure; stable; rare updates) |
| **Satellite** (versioned descriptive attributes; tracks change over time) | **Doc** (knowledge content; refreshes on cadence; versioned via git history) |
| **Link** (relationship between hubs) | **Cross-skill reference** (skill A `composes_with` skill B) |
| **Same-as link** (alternative business keys for the same hub) | **Skill aliases / harness-specific names** (e.g., `effort-router` is the Claude-Code-specific name for the cross-harness `compute-tier-router`) |
| **Driving key** (which key drives the relationship) | **Skill-router trigger keyword** (description-keyword that determines when the skill fires) |
| **Load date** (when the row was loaded) | **Skill creation date / commit date** |
| **Insert-only history** (no updates, only new versions) | **Git history** (immutable; append-only) |
| **Reference data** (small, slow-changing, broadly referenced) | **Best-practices / glossary / vocabulary docs** (BP-NN rules; `docs/GLOSSARY.md`) |

The pattern: **separate fast-moving content (knowledge) from slow-changing structure (procedure)** so each can evolve at its natural rate without coupling.

## What this rule means operationally

### For current skills

**Skill bodies (`.claude/skills/<name>/SKILL.md`) should contain:**

- Carved-sentence rules (the procedure)
- Decision-tree logic (what to do when X)
- Anti-patterns the skill teaches against
- Pointers to docs/research/, docs/DECISIONS/, memory/feedback_*.md (the satellites)

**Skill bodies should NOT contain:**

- Embedded worked examples (those go in docs/research/)
- Long theoretical grounding (those go in docs/ proper)
- Verbatim citations of papers (those go in references)
- Anything that changes when the *knowledge* changes but the *procedure* doesn't

### For future skills (081KQJZR90008QG0R002D6XYHB, the multi-harness skills, the backlog flywheel skills)

When skill-creator authors a SKILL.md:

1. **Test:** *would this paragraph change if a worked example was added or a citation refreshed?* If yes, it's satellite content — move to `docs/research/` or `docs/<topic>/`. If no, it's hub content — keeps in SKILL.md.
2. **Test:** *is this a procedure step or a knowledge claim?* Procedure steps are hub. Knowledge claims are satellite.
3. **Test:** *does this content age?* Aging content is satellite; timeless procedure is hub.

### For docs that exist as satellites

`docs/` files should:

- **Refresh on cadence** — docs get reviewed periodically; stale knowledge gets updated; new evidence gets cited
- **Carry their own metadata** — last_updated, source citations, supersession markers (the SUPERSEDE pattern in CURRENT-aaron.md is a satellite-version-marker in DataVault terms)
- **Be referenced by skills, not embedded** — the skill says *"see `docs/research/<topic>.md`"*; readers follow the link
- **Compose with one or more skills** — a satellite can be referenced by multiple hubs (a `docs/research/` artifact can serve multiple skills)

### For backlog flywheel design

The flywheel mechanizes the consume → expand cycle. Per the change-rate split:

- **Hub content for the flywheel:** the discipline ("at-creation: search backlog for prerequisites"), the closure-pass meta-observation procedure, the depends_on graph traversal logic — these are skill-shaped
- **Satellite content for the flywheel:** the actual rows that exist; the tags assigned; the `composes_with` cross-references; per-tick closure outputs — these are doc-shaped (the backlog itself is a satellite cluster)

The mechanizing tool (`tools/backlog/expand-from-closure.ts` — proposed, not yet built; named in `feedback_skill_flywheel_*` as Phase-1b candidate) is **hub-shaped** (the mechanism would stay stable once shipped); its **outputs** would be satellite-shaped (per-PR closure analyses).

## Composes with existing substrate

This rule doesn't supersede; it makes explicit a separation that's already partially honored:

- **BP-13** (`docs/AGENT-BEST-PRACTICES.md` — *"stable knowledge in skill, volatile retrieved at runtime"*) names the same insight at the runtime layer. This rule extends it to the authoring layer: *stable procedure in skill, volatile knowledge in doc*. Same separation, different stage.
- **`memory/README.md`** "keep entries terse" rule applies to the MEMORY.md *index* (hub-shaped); the memo *bodies* (satellite-shaped) can be longer with full context.
- **`docs/research/` placement convention** — research artifacts already live here as satellite content; this rule names the architectural reason.
- **`memory/feedback_*` files** — these are satellite-shaped substrate that future skills will reference. Renaming to make this explicit isn't necessary; the directory + filename convention already does the work.
- **The two future-skill-domain memos** (`feedback_git_native_backlog_management_long_arc_future_skill_domain_*` + `feedback_multi_harness_alignment_convergence_design_future_skill_domain_*`) — both already follow this shape implicitly: the memos enumerate skill candidates (hubs) + tooling (links/hubs) but defer the per-skill SKILL.md authoring (hub) to skill-creator after worked examples (satellites) land.
- **Decision-archaeology 081KQJZR90008QG0R002D6XYHB** — Aarav's hybrid (b)+(c) routing recommendation already implies this rule: 2-3 worked examples in `docs/research/` (satellites) BEFORE skill-creator authors SKILL.md (hub).
- **Karpathy edge-runner framing** + Aaron's *"specs over plans"* validation — specs ARE hub-shaped (carved imperatives); plans are satellite-shaped (per-execution detail).

## What "we should make sure we remember for everything from now on" means

Aaron's "for everyting from now on and future agent and the backlog flywheel" framing scopes this rule broadly:

1. **Current skill creations** — skill-creator workflow should test the hub-vs-satellite distinction before authoring; if procedure embeds knowledge, refactor to extract knowledge to a doc
2. **Existing skills** — when touched for any reason, audit hub-vs-satellite content; move satellite content out
3. **Future agents** — onboarding substrate should teach this distinction explicitly
4. **Backlog flywheel** — the mechanism + its outputs follow the same separation
5. **Future skill domains** — the git-native-backlog domain + multi-harness domain (both currently future-state per Aaron's "down pat" criteria) will be authored under this rule

## Same-tick refinement: no dynamic commands in skills (Aaron 2026-05-03)

> *"no dynamic commands in skills either, make sure we have ts files for it"*

Companion rule: skills must NOT embed dynamic shell commands (multi-flag invocations, piped commands, jq parsing chains, conditional logic) inline. Instead, **codify the command in a TypeScript file under `tools/`** and have the skill reference the TS file by path.

This composes structurally with the hub-satellite separation:

- **Inline dynamic bash in a skill = satellite-content embedded in hub-shaped substrate.** The flags, the pipe pattern, the jq query — these change as the underlying tool API changes. Embedding them in SKILL.md couples skill-edit cadence to tool-version cadence.
- **TS file in `tools/` = its own hub.** The script encapsulates the implementation; skill references it; tool-API changes update the TS file (one place); skill body stays stable.

This generalizes the existing rule from `memory/feedback_prefer_ts_scripts_over_dynamic_bash_for_conversation_ux_dst_in_ts_aaron_2026_05_01.md` (which named the discipline for chat-loop substrate) to **all skill bodies, not just chat-loop interactions**.

### Threshold (when to wrap in TS vs leave as bash)

- **Simple read-only invocations** (`git status`, `ls dir`, `pwd`) — bash OK in skill body
- **Anything with multi-flag arguments + parsing** (`git blame -w -C -C -C <file>`, `gh api ... | jq ...`, multi-step pipelines) — wrap in TS file
- **Anything with conditional logic** (if/then on output, fallback chains) — wrap in TS file
- **Anything called repeatedly across skills** — wrap in TS file (deduplication)
- **Anything that would need updating when an upstream tool's API changes** (e.g., GitHub API surface) — wrap in TS file (centralizes the version-coupling)

### Worked example: decision-archaeology procedure

The decision-archaeology skill body (081KQJZR90008QG0R002D6XYHB future SKILL.md) has 11 procedure layers. Under this rule:

| Layer | Currently bash example | Should become |
|---|---|---|
| 2 | `git blame -w -C -C -C <file>` | `bun tools/decision-archaeology/blame.ts <file>` (wraps with sensible defaults) |
| 3 | `git show <sha>` | OK as bash (simple read-only) |
| 4 | `git log -S "<string>" -- memory/ CLAUDE.md` | `bun tools/decision-archaeology/string-archaeology.ts "<string>"` |
| 5 | `git log -L :func:file` | `bun tools/decision-archaeology/function-archaeology.ts <func> <file>` |
| 6 | `grep -rlnE "<pattern>" docs/hygiene-history/ticks/` | `bun tools/decision-archaeology/shard-search.ts <pattern>` |
| 7 | ADR-filename search by regex pattern (canonical command shown in code block below the table — pipe in table cells is awkward; the right shape is `ls docs/DECISIONS/` piped through `grep -iE`, which searches **filenames**; do NOT substitute `grep -ilrE PATTERN docs/DECISIONS/` since `-r` searches **file contents** instead) | `bun tools/decision-archaeology/adr-search.ts <pattern>` |
| 8-11 | Various searches | TS-wrapped where they involve multi-flag patterns |

Layer-7 canonical command (filename search; intentionally pulled out of the table cell because pipe-in-cell breaks markdown rendering):

```bash
ls docs/DECISIONS/ | grep -iE "<pattern>"
```

Each TS file is small (often <100 lines), single-purpose, type-checked, and re-runnable. Skill body becomes carved-sentence pointers ("invoke `bun tools/decision-archaeology/blame.ts`") rather than embedded bash.

### What's already correct under this rule

The factory's existing pattern is already moving this direction:

- `bun tools/github/poll-pr-gate.ts` + `poll-pr-gate-batch.ts` — replaced inline `gh api ... | jq` chains across skills + autonomous-loop substrate (per `memory/feedback_prefer_ts_scripts_over_dynamic_bash_for_conversation_ux_dst_in_ts_aaron_2026_05_01.md`)
- `tools/backlog/generate-index.sh` — actually bash, but single-purpose + non-dynamic; OK under the threshold
- `tools/setup/install.sh` — bash + invocations, but architecturally a single-purpose orchestrator; OK
- `/tmp/backfill-depends-on.sh` (used in PR #1246) — bash, one-shot use; should harden into `tools/backlog/backfill-depends-on.ts` per Aaron 2026-05-03 ("make sure we have ts files for it") **AND** per the future-skill-domain memo's tooling-list (already named `tools/backlog/backfill-depends-on.sh` as "should be moved into tools/backlog/" in that memo; this rule sharpens to "should be moved AND converted to TS")

## Same-tick second refinement: package skill domains; use harness hooks for contracts (Aaron 2026-05-03)

> *"also look at packaking skill domains a plugins or other packagin so we can take advantage of hooks in harnesses, this feature is great for reminding yourself to do the right thing the pre conditions and post condtions in contract based development or spec based development like openspec which we are way behind on, that's suppsed to be our source of truth lol, if we were to delete everyting other than it."*

Three substantive points:

1. **Package skill domains as plugins (or other packaging mechanisms).** Claude Code supports plugins (`.claude/plugins/`), which carry their own skills + commands + hooks. When a skill domain is mature, packaging it as a plugin lets the whole domain ship as one unit — including its hooks.

2. **Harness hooks enable contract-based development.** Hooks fire at well-defined points (pre-tool-use, post-tool-use, session-start, etc.) — the natural place to enforce **pre-conditions** and **post-conditions** on a procedure. This is contract-based development (Meyer, Eiffel) / Design-by-Contract / spec-based development (OpenSpec).

3. **OpenSpec is supposed to be the source of truth — and we're way behind on it.** Aaron's verbatim *"if we were to delete everything other than it"* names OpenSpec as the canonical source-of-truth substrate. Currently most of the project's discipline lives in memos / CLAUDE.md / GOVERNANCE.md instead of OpenSpec capabilities. This is technical debt at the architectural layer.

### How this composes with the hub-satellite + no-dynamic-commands rules

The architecture layers stack:

| Layer | Hub | Satellite | Rule from this memo |
|---|---|---|---|
| Skill body | Carved sentences (procedure) | Worked examples + citations + theoretical grounding | Rule 1 |
| Command | TS file under `tools/` | Per-invocation outputs | Rule 2 |
| Skill domain | Plugin package | Per-tick state + closures | Rule 3a (this section) |
| Cross-skill contracts | Hooks (pre/post conditions) | Per-invocation observations | Rule 3b |
| Spec | OpenSpec capability (canonical truth) | Implementation evidence (tests, code, behavioral docs) | Rule 3c |

**Each layer is hub-satellite at its own scope.** The pattern is recursive — and that recursion IS the architectural separation Aaron's been naming for two days across multiple memos.

### What "OpenSpec is supposed to be the source of truth" means operationally

Per `openspec/README.md` (already in-repo), OpenSpec is Zeta's modified-fork of the OpenSpec workflow — capabilities defined under `openspec/specs/**` carry behavioral specs that the code is supposed to satisfy. **The intended state:** specs are canonical; code + skills + memos + docs all derive from / serve / reference the specs.

**Current state (Aaron's *"way behind on"* framing):** specs are sparse; most discipline lives outside specs; the *"if we deleted everything but openspec, the project would be lost"* test fails today.

This is its own substantial backlog item — not for this memo to land, but to file as a separate row. The discipline this memo names (Rule 3) **depends on** OpenSpec being current; current state is that the OpenSpec catch-up is a prerequisite.

### Hooks as pre/post-condition enforcement (worked examples)

Pre-conditions a hook could enforce:

- Before `gh pr merge --auto`: verify all required threads resolved (per BLOCKED-with-green-CI rule)
- Before committing to MEMORY.md: verify newest-first index entry isn't a duplicate (per the dedupe lint we already have, but pre-commit instead of CI-late)
- Before opening a PR with new memo: verify the at-creation-time backlog-search discipline ran

Post-conditions:

- After PR merge: trigger `expand-from-closure.ts` (per the backlog-flywheel-mechanizer skill from `feedback_skill_flywheel_*`)
- After tick close: verify shard density (per the `tools/hygiene/check-no-op-cadence-pattern.ts` script; could move to a hook)
- After skill creation: verify hub-vs-satellite + no-dynamic-commands rules from this memo

The hooks ARE the enforcement layer for the carved-sentence rules. Rule 1 says "skills should be hubs"; the hook checks at skill-creation time whether the skill has satellite content; rejects if so.

### Backlog rows this rule produces

Filing as separate rows (per the at-creation-time prereq-search discipline; existing backlog has none of these specifically):

1. **OpenSpec catch-up** — get specs current so they actually serve as source-of-truth. Aaron's *"way behind"* framing makes this load-bearing for everything Rule 3 implies.
2. **Skill-domain plugin packaging** — once skill domains mature (per the future-skill-domain memos' promotion-trigger criteria), package them as Claude Code plugins.
3. **Hook authoring for skill-creation contracts** — hooks that enforce hub-vs-satellite + no-dynamic-commands at skill-creation time.

These will get their B-NNNN rows in follow-up ticks; this memo names them so the at-creation-time search returns positive results next time.

## Failure modes the rule prevents

- **Skill bloat:** worked examples + citations + theoretical grounding all in SKILL.md → 2000-line skill bodies that can't evolve cleanly. Per BP-03 (≤300 lines, one purpose).
- **Knowledge drift:** facts in skills go stale because skills don't get refresh-cadence; docs do.
- **Update friction:** every knowledge update requires skill-edit (which requires skill-creator workflow). Splitting lets knowledge updates land via routine doc-edit.
- **Coupling:** skill A depends on a fact in skill B's body → cross-skill rewrites for routine knowledge updates. Doc-as-satellite breaks the coupling; multiple skills can reference the same doc.

## Carved sentences (refined, two rules combined)

**Rule 1 (hub-satellite separation):** *"Skills are carved-sentence hubs — dense, operational, imperative procedure that changes rarely. Knowledge lives in doc satellites — referenced by skills, refreshed on cadence, versioned via git history. The DataVault 2.0 hub-satellite design pattern names the separation: split fast-moving update files from slow-changing structure files. Applies to current skills, future agents, the backlog flywheel, and every skill domain we promote — current or future. Test for hub-vs-satellite at authoring time: would this paragraph change if a worked example was added or a citation refreshed? If yes → satellite (move to doc). If no → hub (keep in skill)."*

**Rule 2 (no dynamic commands in skills):** *"Skills must not embed dynamic shell commands. Multi-flag invocations, piped commands, jq parsing chains, conditional logic — all live in TypeScript files under `tools/`, referenced by path from the skill. Generalizes the existing TS-script-preference rule (Aaron 2026-05-01) from chat-loop substrate to all skill bodies. Threshold: simple read-only commands stay bash; anything with multi-flag args + parsing + conditional logic + cross-skill reuse + upstream-API-coupling becomes a TS file."*

**Composition:** dynamic bash in a skill IS satellite-content embedded in hub-shaped substrate (Rule 1's failure mode). TS-wrapping the command moves the satellite content to its proper hub (the TS file). Both rules enforce the same architectural separation at different syntactic scopes: knowledge → docs (Rule 1); commands → TS files (Rule 2).
