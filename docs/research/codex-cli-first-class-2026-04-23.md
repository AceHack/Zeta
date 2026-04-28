# First-class Codex-CLI session experience — Phase 1 research (stage 1 of 5)

**Aaron directive** (Otto-75, 2026-04-23):
> *"can you start building first class codex support with the
> codex clis help, it might eventually be benefitial to switch
> otto to codex later depending on which modeel/harness is
> ahead. this is basically the same ask as a new session claude
> first class experience, this is a codex session as a first
> class experince."*

**Parent BACKLOG row:** PR #228 — *First-class Codex-CLI session
experience*. Names this file as the first step (research tick,
S-effort) of a 5-stage arc:

1. **Research tick (S)** — this document.
2. Parity matrix (M).
3. Gap closures (M-L per gap).
4. Codex session-bootstrap doc (S).
5. Otto-in-Codex test run + harness-choice ADR (S-M).

**Stage accountability:** this document is only Stage 1. It
does NOT advocate a harness swap, does NOT propose
implementation work, and does NOT commit to a schedule.
Subsequent stages are called for by the BACKLOG row, not this
file.

---

## 1 · What Codex CLI is (2026-04 snapshot)

OpenAI's terminal-native coding agent. Open source, built in
Rust, actively developed. Positioned parallel to Claude Code
CLI in the 2026 coding-agent landscape.

**Install:**

- `npm install -g @openai/codex`
- `brew install --cask codex`
- Direct binary download per platform (`macOS arm64/x86_64`,
  `Linux x86_64/arm64`).

**Authentication:**

- ChatGPT account sign-in (Plus / Pro / Business / Edu /
  Enterprise) **or** an OpenAI API key.
- Per Aaron's Otto-76 clarification
  (`memory/project_account_setup_snapshot_codex_servicetitan_playwright_personal_multi_account_p3_backlog_2026_04_23.md`)
  the current Codex CLI session is on ServiceTitan — same
  account as the Claude Code session — deliberately.

**Key surfaces:**

- `codex` — interactive terminal UI.
- `codex exec` — non-interactive scripting mode (equivalent to
  Claude Code's one-shot Bash invocation of a prompt).
- `-m` / `--model <MODEL>` — model selector (e.g. `o3` and
  whichever current OpenAI model roster is live; consult
  `docs/research/openai-codex-cli-capability-map.md` §"Model
  selection" for the canonical surface). Codex uses
  config-driven profiles via `-p` / `--profile` rather than
  a discrete-effort-tier enumeration.
- Subagent dispatch + parallel execution + git worktrees.
- MCP server support with per-tool approval modes.
- Web search integration.
- Image input + image generation.
- Cloud-backed runtime (Codex Cloud) for long-running tasks.
- Background macOS automation ("Computer Use").
- Code-review agent variant (separate agent reviews before
  commit / push).

**Config surface:**

- `~/.codex/config.toml` (TOML).
- SQLite state DB (`sqlite_home` config / `CODEX_SQLITE_HOME`
  env).
- `[mcp_servers]` table mirrors Claude Code's MCP registry with
  richer per-tool approval controls. Server-wide default uses
  `default_tools_approval_mode`; `approval_mode` is the
  per-tool override key (per `openai/codex` config docs).
- `[notice]` for UI prompt suppression; `notify` hook when a
  turn completes.
- `plan_mode_reasoning_effort` — Plan Mode analogue.
- `experimental_realtime_start_instructions` — system-message
  override for realtime mode.

---

## 2 · The big, non-obvious win — `AGENTS.md` is already universal

Claude Code reads `CLAUDE.md` first. Codex CLI reads `AGENTS.md`
following a precedence chain: global `~/.codex/AGENTS.override.md`
/ `~/.codex/AGENTS.md` first, then walks project root → CWD with
`AGENTS.override.md` taking precedence per directory (and a byte
cap; see [Codex AGENTS guide](https://developers.openai.com/codex/guides/agents-md)).
**Zeta's setup already has both `CLAUDE.md` and `AGENTS.md`, and
`CLAUDE.md` explicitly delegates to `AGENTS.md`** as the universal
onboarding handbook. Stage-2 readiness checks must account for
the precedence chain — environments with global overrides at
`~/.codex/AGENTS.override.md` can pass/fail ingestion checks for
reasons unrelated to the repo's `AGENTS.md` content. The relevant
lines of `CLAUDE.md`:

> 1. **[`AGENTS.md`](../../AGENTS.md)** — the universal
>    onboarding handbook. Pre-v1 status, the three
>    load-bearing values, how to treat contributions,
>    the build-and-test gate, code-style pointers,
>    required reading. **Start here every session.**

When a Codex CLI session opens Zeta, it will read `AGENTS.md`
by default. `AGENTS.md` already contains:

- The three load-bearing values per `AGENTS.md` §"The three
  load-bearing values" (truth-over-politeness / algebra-
  over-engineering / velocity-over-stability). Distinct from
  the alignment-contract / operator-algebra / retraction-
  native technical pillars also documented in `AGENTS.md`.
- Build-and-test gate (`dotnet build -c Release` clean, full
  test suite).
- References to the substrate doc tree (`GOVERNANCE.md`,
  `docs/ALIGNMENT.md`, `docs/CONFLICT-RESOLUTION.md`,
  `docs/GLOSSARY.md`, `docs/WONT-DO.md`,
  `docs/AGENT-BEST-PRACTICES.md`). The full ordered required-
  reading list including `openspec/README.md` lives in
  `CLAUDE.md`'s "Read these, in this order" section, not in
  `AGENTS.md` directly — readiness analysis below treats
  Codex as inheriting the AGENTS.md references plus needing
  to follow the same ordered-list pattern when its own
  `CODEX.md` lands.
- "Agents, not bots" discipline.
- Factory-structure pointers to `.claude/`, `docs/`, `src/`,
  `openspec/`.

**Practical consequence:** a Codex CLI session starting in Zeta
will get the universal context for free. The gap is only what
`CLAUDE.md` supplements — Claude-Code-harness-specific
mechanisms (Skills, Task subagents, Memory folder layout, Hook
specifics).

This is a materially better position than the BACKLOG row
assumed. Zeta is already ~60% first-class-Codex-ready by
accident of adopting `AGENTS.md` as canonical (see
`GOVERNANCE.md` preamble: *"`AGENTS.md` carries the
philosophy, values, and onboarding; this file carries the
rules"*) from earlier rounds.

---

## 3 · Capability-parity first-pass matrix

Rows Otto routinely exercises in Claude Code; column 2 is the
Codex-CLI equivalent; column 3 is the row's status (taxonomy
below) with a short note. **This is a first-pass; a proper
matrix (Stage 2) should run each cell against a small test
prompt.**

Status taxonomy used in the table below:

- **Parity** — direct equivalent exists; same shape.
- **Parity (richer)** — direct equivalent + Codex offers more
  (e.g., richer per-tool approval).
- **Parity (different shape)** — equivalent functionality
  available but reached via a different surface (e.g., GitHub
  PR review vs. in-CLI agent).
- **Parity+** — Codex strictly more capable (e.g., image
  generation in-CLI vs. image input only).
- **Partial** — equivalent partially covers the use case;
  gaps documented in Note.
- **Different shape, functional** — same functional category,
  different file format / surface (e.g., SQLite vs. Markdown
  per-fact memory).
- **Gap** — no Codex equivalent currently surfaced.
- **Gap (minor)** — minor user-visible gap with low
  factory-side impact.
- **Gap (opaque)** — undocumented behavior; Stage 2 must
  test.
- **Likely gap** — strong evidence of gap; Stage 2 must
  confirm.
- **Codex-specific** — Codex exposes a primitive Claude Code
  doesn't.

Score-summary counts at the bottom of the table aggregate
into headline buckets: Parity (any "Parity*" status), Partial
/ Different-shape, Gap (any "Gap*" or "Likely gap" status),
and Codex-specific.

| Claude Code (Otto usage) | Codex CLI equivalent | Status | Note |
|---|---|---|---|
| `CLAUDE.md` + `AGENTS.md` pointer tree | `AGENTS.md` native | **Parity** | The big win; see §2. |
| `Skill` tool + `.claude/skills/SKILL.md` | No direct equivalent; custom commands + MCP + `AGENTS.md` extensions | **Partial** | Cross-harness-mirror-pipeline BACKLOG row (round 34) already addresses skill-file distribution. Codex CLI reads MCP-registered tools cleanly; skills as MCP-exposed functions is one path. |
| `Task` tool (subagent dispatch) | Subagents + worktrees | **Parity** | Codex advertises parallel execution with worktrees natively; should compose cleanly with Zeta's agent roster. |
| `TodoWrite` task tracking | Built-in to-do list (per [OpenAI's "Introducing upgrades to Codex" post, Sept 15 2025](https://openai.com/index/introducing-upgrades-to-codex/)) | **Parity (different shape)** | Codex CLI tracks progress with a built-in to-do list; the API surface differs from Claude Code's `TodoWrite` tool. Stage 2 must verify the discoverable API for setting/marking-done todos from agent prompts and how it compares to `TodoWrite`'s pending/in-progress/completed states. |
| Per-project memory (`~/.claude/projects/<slug>/memory/`) | SQLite state DB + `AGENTS.md` | **Different shape, functional** | Codex has durable state; the **file-format** differs (SQLite vs. Markdown per-fact files). `MEMORY.md` index doesn't apply directly. Future: design how per-fact memories surface in a Codex session. |
| Bash / Edit / Read / Write | Standard file + shell tool set | **Parity** | Interactive + `exec` modes cover Otto's normal workflow. |
| WebFetch / WebSearch | Web search integration advertised | **Parity** | Codex advertises "up-to-date information retrieval" during tasks. |
| MCP server support | `[mcp_servers]` TOML config | **Parity (richer)** | Codex's per-tool approval mode is stricter than Claude Code's MCP permissioning — plays well with BP-11 data-not-directives. |
| WebFetch on private/authenticated URLs | Unchanged — same constraint; use MCP | **Parity** | Neither harness fetches authenticated URLs directly; both rely on MCP servers. |
| `CronCreate` / `ScheduleWakeup` (loop autonomy) | Codex Cloud thread automations (per [`developers.openai.com/codex/app/automations`](https://developers.openai.com/codex/app/automations)) | **Partial (different surface)** | Codex Cloud has a documented scheduling primitive: thread automations support custom cron syntax, minute-based intervals (heartbeat-style recurring wake-ups attached to a thread), and daily/weekly schedules. Functionally equivalent to Claude Code's `CronCreate` / `ScheduleWakeup` for the autonomous-loop cadence, but on a different surface (Codex Cloud rather than the local CLI session). Stage-2 must verify the API surface for arming/listing automations from agent prompts. The local `codex` CLI itself does not expose a `cron` primitive — the cloud is the equivalent surface. |
| Plan Mode | `plan_mode_reasoning_effort` config | **Parity** | Named differently; same concept. |
| Output styles (e.g., explanatory) | Not documented; may go via system-prompt override | **Gap (minor)** | Factory-side impact is small; output styles are Claude-Code-session features, not substrate. |
| Hooks (`.claude/settings.json` PreToolUse, UserPromptSubmit) | `notify` hook + shell-only PreToolUse (per OpenAI release notes for `rust-v0.117.0`, March 26 2026, [openai/codex#15211](https://github.com/openai/codex/pull/15211)) | **Partial (narrowing)** | Codex now has shell-only PreToolUse alongside the existing `notify` hook for turn completion. UserPromptSubmit and other Claude-Code-specific hook types are still gaps. Zeta's ASCII-clean pre-commit + prompt-injection lints run via git-pre-commit (harness-neutral) so the gap-impact on Zeta substrate is small. SessionStart hooks (e.g., for output style) still have no Codex equivalent. |
| Slash commands (`/loop`, `/fast`, `/help`, `/status-line-setup`) | Built-in `/model`, `/compact`, etc. (per [`developers.openai.com/codex/cli/slash-commands`](https://developers.openai.com/codex/cli/slash-commands)) + `-m`/`--model` flags + `--profile` | **Parity (different roster)** | Codex CLI ships built-in slash commands including `/model` for model + reasoning-effort selection, `/compact` for context compaction, etc. Both harnesses expose slash commands; the rosters differ (Claude Code has Zeta-defined `/loop`, `/fast`; Codex has its own built-in roster). Project-specific commands (e.g., Zeta's `/loop`) need re-authoring or re-routing through `codex exec`. The capability surface is parity; the specific commands aren't 1-to-1. |
| `Task` with `isolation: "worktree"` | Built-in worktree support | **Parity** | Codex advertises worktrees as a first-class subagent feature. |
| Session compaction | Built-in `/compact` slash command (per [`developers.openai.com/codex/cli/slash-commands`](https://developers.openai.com/codex/cli/slash-commands)) | **Parity** | Codex CLI ships `/compact` specifically for summarizing conversation context to free tokens — same role as Claude Code's session compaction. Stage-2 should still test the trigger conditions and quality of the summary. |
| Code-review agent | Native "separate agent before commit" feature | **Parity (different shape)** | Codex integrates review into the CLI workflow directly; Zeta's equivalent is Codex-as-PR-reviewer on GitHub + the harsh-critic persona under `.claude/skills/code-review-zero-empathy/`. (Note: `/ultrareview` is a Claude Code platform feature surfaced in the harness's session prompt, not a Zeta-defined command — repo-wide search finds no in-tree definition. Listed here for surface-mapping context only; not an in-repo entrypoint.) Composes. |
| Image input / image generation | Native | **Parity+** | Codex exposes image generation in-CLI; Claude Code accepts image input only. |
| Background macOS Computer Use | Native | **Codex-specific** | No Claude Code equivalent; relevant if Zeta ever wants agent-run GUI tests. Not urgent for Otto. |
| Cloud-backed runtime | Codex Cloud | **Codex-specific** | May subsume the cron-gap by running long-lived agents in cloud; Stage 2 needs to verify. |

**Running gap score after first-pass + post-merge cascade
reclassifications:**

- Parity: 13 (TodoWrite Gap → Parity (different shape) per
  OpenAI's Sept 15 2025 announcement; Slash commands Partial →
  Parity (different roster) per Codex CLI built-in
  `/model`/`/compact`/etc. roster; Session compaction Gap →
  Parity per Codex CLI built-in `/compact` — both per
  `developers.openai.com/codex/cli/slash-commands`)
- Partial: 4 (cron/autonomous-loop Likely-gap → Partial (different
  surface) per `developers.openai.com/codex/app/automations`
  thread-automation primitive; slash-commands removed from this
  bucket)
- Gap: 1 (Output styles only; cron and session-compaction both
  moved to Parity-class buckets)
- Codex-specific: 2

(Score subject to Stage 2 verification — these are first-pass
counts based on documentation review, not behavioral tests.)

For a *first-class* Otto experience, the autonomous-loop
cadence has a different-surface partial via Codex Cloud thread
automations (cron syntax + minute intervals per
[`developers.openai.com/codex/app/automations`](https://developers.openai.com/codex/app/automations)).
Otto-in-Codex parity is therefore reachable, but the surface
shifts from local-CLI cron to cloud-thread automations. Stage
2 must verify the agent-facing API surface for arming/listing
automations.

---

## 4 · Authentication + account — no extra work needed today

Per
`memory/project_account_setup_snapshot_codex_servicetitan_playwright_personal_multi_account_p3_backlog_2026_04_23.md`,
Aaron aligned Codex CLI and Claude Code on the ServiceTitan
account in Otto-76. This means:

- Codex CLI ChatGPT sign-in on ServiceTitan = Codex access via
  enterprise ChatGPT seat.
- No separate API-key billing for factory-agent work.
- Playwright stays on Aaron's personal for Amara-ferry work (a
  deliberate cross-tier boundary — poor-man-tier for Amara,
  enterprise-tier for Otto).

The multi-account-access-design BACKLOG row (PR #230) covers
the future case where Otto operates on multiple accounts
simultaneously; **today's single-account-aligned setup
sidesteps that problem for Phase 1 Codex research**.

---

## 5 · Gap analysis — critical vs. nice-to-have

**High-priority (was the leading parity question, now reframed):**

1. **`CronCreate` / `ScheduleWakeup` reaches parity via Codex
   Cloud thread automations.** Codex Cloud's documented
   automations primitive (per
   [`developers.openai.com/codex/app/automations`](https://developers.openai.com/codex/app/automations))
   covers custom cron syntax, minute-based heartbeat
   intervals, and daily/weekly schedules. The autonomous-loop
   cadence (minutely `<<autonomous-loop>>` fire) is functionally
   reachable, but the surface shifts from local-CLI cron to
   cloud-thread automations. Stage-2 must verify the
   agent-facing API for arming/listing automations from a
   Codex prompt and confirm the heartbeat-style minute interval
   matches Claude Code's `* * * * *` cadence.

**Important (meaningful friction, workarounds exist):**

1. **Skills aren't directly portable.** `.claude/skills/` is
   Claude-Code-specific. The existing cross-harness-mirror-
   pipeline BACKLOG row (round 34) is the right place to solve
   this; it's complementary to this work, not this row's
   scope.
2. **TodoWrite analogue — different shape, parity confirmed.**
   Codex CLI ships a built-in to-do list per OpenAI's Sept 15
   2025 "Introducing upgrades to Codex" announcement (parity
   matrix: **Parity (different shape)**). The API surface
   differs from Claude Code's `TodoWrite` tool; Stage 2 must
   verify the discoverable API for setting/marking-done todos
   and how it compares to `TodoWrite`'s pending/in-progress/
   completed states. Tracking on Otto's tick-internal
   progress is unlikely to degrade.
3. **Hooks gap.** PreToolUse hooks in `.claude/settings.json`
   aren't portable; git-pre-commit hooks are. Move any
   session-layer hooks to git-pre-commit or lint CI if we want
   them harness-neutral.

**Nice-to-have (low friction, low impact):**

1. Output-style / explanatory-mode parity.
2. Slash-command roster parity (Zeta's project-specific commands
   like `/loop` need re-authoring or routing through `codex exec`;
   Codex CLI's built-in roster includes `/model`/`/compact` and
   covers a different subset of session-management needs).

**Codex-specific we don't need today:**

- Background macOS Computer Use (not urgent for factory
  agent).
- In-CLI image generation (not urgent).
- Codex Cloud as execution environment (may become relevant if
  critical gap #1 resolves via cloud scheduling).

---

## 6 · Recommended Stage-2 plan

Stage 2 is the parity matrix (M-effort per PR #228). The
prompts below are a starter probe set targeting the most
load-bearing rows of the §3 parity matrix; they do **not**
exercise every row 1:1. Stage-2 execution should expand to
one prompt per matrix row, recording per-row pass/fail/notes
so parity-and-gap totals are row-level rather than
aggregate-only. This starter set is the seed for that
expansion; rows not covered below stay marked
"unverified-pending-Stage-2-prompt" until a row-specific
probe lands.

1. **`AGENTS.md` reading.** Run `codex` in the Zeta repo root
   interactively; confirm it reads `AGENTS.md` before first
   turn. **Discriminator:** ask the agent for a verbatim
   quotation of the **exact failure-mode wording** from the
   `AGENTS.md` "Build and test gate" section (the lines that
   explain *why* a warning equates to a build break, including
   the project-property name and the file that sets it). The
   discriminator MUST point only at section/role-ref ("the
   build-gate section of AGENTS.md") — never at any specific
   property name, file name, or quoted phrase in this research
   doc — so the only way to satisfy the prompt is to actually
   read `AGENTS.md`. Reciting the three load-bearing values
   alone or the `dotnet build` / `dotnet test` command pair
   alone is NOT a valid discriminator (those phrases appear
   inline in this research doc and would create a
   false-positive readiness signal). At test time, the
   evaluator (not the doc) holds the canonical answer string
   from `AGENTS.md` and compares the agent's response to it.
2. **Subagent dispatch.** Prompt Codex to "launch a subagent
   to review `docs/ALIGNMENT.md` and report its key clauses" —
   verify subagent dispatch works, artifacts are consolidated.
3. **MCP-server invocation.** Register a no-op MCP server in
   `~/.codex/config.toml` and verify `approval_mode` gates
   trigger.
4. **Cron / scheduled-task research.** Verify the Codex Cloud
   thread-automations API surface (per
   [`developers.openai.com/codex/app/automations`](https://developers.openai.com/codex/app/automations))
   for arming/listing minute-interval automations from an agent
   prompt; confirm the heartbeat cadence matches Claude Code's
   `* * * * *` `<<autonomous-loop>>` fire shape.
5. **`codex exec` non-interactive.** Run a **repo-local probe**
   that doesn't depend on external services or credentials —
   for example, `codex exec "count the .fs files under
   src/Core/ and report the count and the longest filename"`.
   Compare output shape to Claude Code's one-shot invocation.
   Avoid prompts that hit GitHub / network / external auth
   (e.g., "list the top 5 open PRs on LFG"), since failures
   from missing credentials, repo visibility, or network
   policy would look like `codex exec` parity failures even
   when non-interactive mode works.
6. **Git-worktree subagent.** Test isolation: "open a
   subagent in an isolated worktree and have it modify a
   single line; verify the main session doesn't see the
   change."
7. **Session resumption.** Start a session, quit, resume. Does
   Codex restore prior context from the SQLite state DB?
   Compare to Claude Code's session continuity model.

Time estimate for Stage 2: 2-3 hours of hands-on terminal
time + documentation pass. Can be split across multiple Otto
ticks or landed as one dedicated research PR.

---

## 7 · Scope limits (repeating, for clarity)

- This document does NOT commit to harness-swap.
- Does NOT propose implementing a Codex-mode Otto.
- Does NOT modify `AGENTS.md` (already good; mirror-pipeline
  row handles forward-looking changes).
- Does NOT duplicate cross-harness-mirror-pipeline work.
- Does NOT lock Zeta to one harness family.

The harness-choice ADR (Stage 5 per PR #228) is the only
stage authorised to make an executable decision about
which harness runs the primary tick cadence.

---

## 8 · References

- [Codex CLI landing — openai.com/codex](https://openai.com/codex/)
- [Codex CLI developer docs](https://developers.openai.com/codex/cli)
- [`openai/codex` GitHub — lightweight terminal agent](https://github.com/openai/codex)
- [Codex CLI 2026 review — shareuhack.com](https://www.shareuhack.com/en/posts/openai-codex-cli-agent-guide-2026)
- [ChatGPT Codex 2026 guide — two99.org](https://two99.org/blog/chatgpt-codex-guide-2026/)
- [Codex desktop computer use — remio.ai](https://www.remio.ai/post/openai-codex-can-now-control-your-desktop-what-it-means-for-the-ai-coding-agent-race)
- [Codex CLI configuration reference (TOML)](https://raw.githubusercontent.com/openai/codex/main/docs/config.md)
- Zeta's `AGENTS.md` — universal onboarding handbook (already
  consumed by both harnesses; the biggest non-obvious win
  surfaced by this research).
- Parent BACKLOG row PR #228.
- Account-setup memory (sibling context).
