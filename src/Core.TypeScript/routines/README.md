# `tools/routines/` — git-tracked Claude Desktop routines

Canonical source for Claude Desktop scheduled tasks (the "Routines" panel in
the Desktop sidebar; same substrate as the `scheduled-tasks` MCP server).
Each routine is a directory under `tools/routines/<id>/`:

- `SKILL.md` — **required** — prompt body + YAML frontmatter (`name`, `description`)
- `schedule.json` — **optional** — cron expression + task metadata (cronExpression, notifyOnCompletion) for Desktop routines. Omit for ad-hoc routines.
- `cloud-schedule.json` — **optional** — configuration for running as an Anthropic Cloud Routine (trigger, repos, connectors). See `cloud-schedule.schema.json`.

The runtime stores routines at `~/.claude/scheduled-tasks/<id>/SKILL.md`;
this directory is the **canonical source** and the runtime location is
generated from it via `bun tools/routines/install.ts`.

## Two-layer architecture

| Layer | Path | Authority |
|---|---|---|
| **Canonical** (this directory) | `tools/routines/<id>/` | git-tracked, PR-reviewed, diffable, shareable across maintainer machines |
| **Runtime** | `~/.claude/scheduled-tasks/<id>/` | what the Desktop "Routines" panel + MCP server read at fire time |

Edit canonical; sync to runtime. Never edit runtime directly without mirroring
back — runtime drift is the failure mode this two-layer split prevents.

## Authoring a new routine

1. Create `tools/routines/<id>/SKILL.md`:

   ```markdown
   ---
   name: <id>
   description: <one-line description for sidebar + skill router>
   ---

   <prompt body — fully self-contained, no prior conversation context.
    Each fire is a fresh Claude session cold-boot.>
   ```

2. (Optional) Create `tools/routines/<id>/schedule.json` for cron-scheduled routines:

   ```json
   {
     "taskId": "<id>",
     "cronExpression": "0 */2 * * *",
     "description": "<same as SKILL.md description>",
     "notifyOnCompletion": true
   }
   ```

   Skip this file for ad-hoc routines (those registered manually via the
   MCP API rather than fired on a cron cadence). The installer will sync
   the SKILL.md and report `(no schedule.json — ad-hoc routine, register manually)`.

3. Run `bun tools/routines/install.ts` — copies SKILL.md to runtime path.

4. Register the cron expression with the runtime by invoking
   `create_scheduled_task(taskId, cronExpression, prompt, description)`
   via the `scheduled-tasks` MCP — either from an interactive Claude session
   or via a direct MCP API call. The approval dialog is the consent step.
   After registration, the routine fires on its cron cadence.

## Why two layers, not just direct MCP calls

The MCP server is in-memory + writes SKILL.md files but does not version-control
the cron schedules. Without git-tracking we'd have:

- No diffability when prompt bodies evolve across maintainer rounds
- No shareability across maintainer machines (each maintainer would re-author)
- No retraction-native history of which routine variants we tried
- Runtime drift undetectable (someone edits SKILL.md via UI; canonical drifts silently)

Two layers + an installer gives us substrate-honest discipline: the repo is the
source of truth, the runtime is generated, divergence is detectable.

## CLI vs Desktop tick — when to use which

| Surface | Mechanism | Cadence sweet-spot | Cost per fire | Persistence |
|---|---|---|---|---|
| **CLI Claude Code** | `CronCreate` sentinel `<<autonomous-loop>>` | `* * * * *` (every minute) | Cheap — re-prompts same session | Session-only, dies on exit, 7-day auto-expire |
| **Desktop Claude** | These routines | `0 */2 * * *` (every 2hr) or hourly | Full cold-boot per fire | Persistent on disk, survives app restart |

Both can run in parallel — they're complementary, not competing. The CLI cron
is the primary every-minute tick; the Desktop routine is the every-2-hour
backup that fires even if the CLI session has died.

## Project-knowledge dependency

Routines that reference the canonical bootstream
(`docs/research/2026-05-12-otto-canonical-bootstream-multi-foreground-surface-orchestrator-ifs-format.md`
— filename is historical-surface substrate per the §33 archive header)
require the bootstream to be uploaded as project knowledge in the Desktop
project that runs the routine. Without it, the prompt's cold-boot pointer
won't resolve and the fresh session will lack the substrate it expects.

## Composes with

- [.claude/rules/tick-must-never-stop.md](../../.claude/rules/tick-must-never-stop.md) — catch-43 tick discipline
- [.claude/rules/holding-without-named-dependency-is-standing-by-failure.md](../../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md) — Standing-by failure mode prevention
- [docs/AUTONOMOUS-LOOP.md](../../docs/AUTONOMOUS-LOOP.md) — canonical tick procedure
- [tools/setup/](../setup/) — install-graph pattern (rule 0: `.sh` files are restricted to under `tools/setup/`; other formats also live there)
- [.claude/rules/rule-0-no-sh-files.md](../../.claude/rules/rule-0-no-sh-files.md) — TS for everything outside `tools/setup/`
