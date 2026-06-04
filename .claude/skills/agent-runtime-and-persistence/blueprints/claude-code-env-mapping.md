---
name: claude-code-env-mapping
description: "Claude Code environment — skills, commands, hooks, agents, slash commands, peer-call, capability-map pointer."
record_source: "claude-code-env-mapping landing, PR #1702"
load_datetime: "2026-05-05"
last_updated: "2026-05-05"
status: active
bp_rules_cited: [BP-11]
---

# Claude Code Environment Mapping — Carved Sentences

Capability skill. No persona lives here. Thin pointer; not a duplicate of the canonical capability map.

> **Authoring-workflow note (PR #1702 review):** This skill landed via direct authoring rather than the canonical `skill-creator` workflow (GOVERNANCE §4). Re-running the canonical draft → prompt-protector review → dry-run → commit workflow over this skill is captured as follow-up against B-0206 (acceptance criterion 1).

## The canonical map

The authoritative env-mapping is `docs/research/claude-cli-capability-map.md`. Refresh-on-cadence applies — Anthropic ships docs at high frequency. Current version-pin and revision date live in that doc's "Status" section header (plain Markdown — no YAML frontmatter on this doc today).

Cross-harness peer-call companions in `docs/research/`:

- `docs/research/claude-cli-capability-map.md` — Claude Code (canonical for the harness this skill runs in)
- `docs/research/codex-cli-first-class-2026-04-23.md` — OpenAI Codex
- `docs/research/grok-cli-capability-map.md` — Grok via cursor-agent
- `docs/research/gemini-cli-capability-map.md` — Gemini

## Zeta-specific extensions

Substrate beyond the upstream-canonical map:

**`/btw` extension** at `.claude/commands/btw.md`. The built-in `/btw` is single-response-no-tools-no-followups (March 2026 release; consult capability map for current behavior). The Zeta extension adds verbatim-preservation + classification (context-add / framing-queued / etc.) + durability-escalation rules (TodoWrite → .btw-queue.md → BACKLOG.md → memory/*.md). Backlog rows B-0019 + B-0020 cover the git-native durability gap and harness-integration scope.

**Custom commands** at `.claude/commands/<name>.md`. Existing: `.claude/commands/btw.md`, `.claude/commands/opsx/{explore,archive,apply,propose}.md`.

**Custom skills** at `.claude/skills/<name>/SKILL.md`. Authored via skill-creator workflow per GOVERNANCE §4.

**Persona agents** at `.claude/agents/<name>.md` carry the persona ("who"); skills carry the capability ("how").

**Hooks** at `.claude/hooks/`. Existing: `verify-branch-pretooluse.ts` (PreToolUse). DST justifies TS-over-bash; harness hooks suffice; no git hooks per `memory/feedback_dst_justifies_ts_quality_over_bash_and_harness_hooks_suffice_no_git_hooks_aaron_2026_05_03.md`.

**Settings** at `.claude/settings.json` — defines enabled plugins.

**Peer-call infrastructure** at `tools/peer-call/` (PR #1677): cross-harness invocation scripts. Default-yes-self-carry vs scout-and-delegate per PR #1701.

## The carved-sentence operational rules

**Search-first-authority** (search-first-authority memory + PR #1701): before claiming something does not exist in the env, grep `.claude/` + `docs/` + `tools/` + `memory/` first. WebSearch upstream documentation second. Ask the human maintainer last.

**Prior-art-grep-FIRST-before-substrate-landing** (PR #1701): when about to write a memory file or research file or skill, grep `memory/` + `docs/amara-full-conversation/` + `docs/backlog/` + `docs/research/` first. Surface duplications BEFORE landing. The capability map IS prior-art for env-mapping work.

**Substrate-or-it-didn't-happen at promise-keeping scope** (PR #1701): ephemeral shards cannot keep promises across compactions. Substrate or it did not happen.

**Scout-and-delegate to right pitcher**: peer-call infrastructure available. Big-context tasks delegate via `tools/peer-call/codex.ts`; the agent preserves own context for plot-keeping.

**Verbatim preservation through the human maintainer's channel** (`memory/feedback_aaron_channel_verbatim_preservation_anything_through_this_channel_2026_04_29.md`): anything coming through the human-maintainer channel records close to verbatim. Paraphrasing loses signal.

**Refresh-on-cadence per doc change-rate**: capability maps for time-sensitive upstream tooling refresh on a cadence calibrated to observed change-rate. Different docs warrant different cadences.

## Operational triggers

Wear this skill when:

- About to claim a Claude Code feature exists or does not exist (search-first per the search-first-authority memory)
- Authoring a custom command or custom skill (use the right path + workflow)
- Invoking peer-call infrastructure (right pitcher + capability map)
- Configuring hooks (harness hooks suffice; no git hooks)
- Cold-boot: the agent reads this skill alongside CLAUDE.md and the canonical capability map

## Defers to

- **`docs/research/claude-cli-capability-map.md`** — canonical CLI surface (this skill is a pointer, not a duplicate)
- **skill-creator workflow** (GOVERNANCE §4) for new skill authoring
- **`.claude/commands/<name>.md`** authoring pattern for new custom commands
- **The capability-map cluster** (claude-cli + codex-cli + grok-cli + gemini-cli capability-maps) for cross-harness specifics
- **`memory/feedback_otto_holds_synthesis_weight_prior_art_grep_first_before_substrate_landing_aaron_made_concise_formulations_at_high_mental_cost_aaron_2026_05_05.md`** (PR #1701) for the synthesis-weight + prior-art-grep + scout-and-delegate discipline this skill encodes at env-layer
- **`memory/feedback_aaron_channel_verbatim_preservation_anything_through_this_channel_2026_04_29.md`** for verbatim-preservation discipline
- **B-0019 + B-0020** (P3 backlog) for /btw git-native durability gap and harness-integration scope
