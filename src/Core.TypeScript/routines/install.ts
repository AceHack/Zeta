#!/usr/bin/env bun
/**
 * tools/routines/install.ts
 *
 * Syncs canonical routine sources (tools/routines/<id>/SKILL.md) to the
 * Claude Desktop runtime location (~/.claude/scheduled-tasks/<id>/SKILL.md).
 *
 * Idempotent: writes are no-op if file content already matches.
 *
 * Does NOT register cron schedules with the MCP server — that requires an
 * active Claude session with the `scheduled-tasks` MCP server. After running
 * this installer, invoke `create_scheduled_task` from an interactive Claude
 * session (or via direct MCP API call) for any routines whose schedule.json
 * lists a cronExpression not yet registered. The approval dialog is the
 * consent step.
 *
 * Pure functions (listRoutines, readSchedule, syncRoutine, main) are exported
 * and accept directory parameters so tests can drive them deterministically
 * without touching the real `homedir()` or `import.meta.dir`.
 *
 * Composes with tools/setup/ install-graph pattern; obeys rule-0 (`.sh` files
 * are restricted to tools/setup/; other formats also live there).
 */

import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

export const DEFAULT_REPO_ROUTINES_DIR = resolve(import.meta.dir);
export const DEFAULT_RUNTIME_TASKS_DIR = join(homedir(), ".claude", "scheduled-tasks");

export type Action = "created" | "updated" | "skipped-unchanged" | "skipped-missing-skill";

export interface SyncResult {
  taskId: string;
  action: Action;
  runtimePath: string;
  cronExpression?: string;
  scheduleMissing?: boolean;
  scheduleParseError?: string;
  cloudSchedule?: CloudScheduleResult;
}

export type CloudTrigger =
  | { type: "scheduled"; cronExpression: string }
  | { type: "github_event"; event: string; repos: string[] }
  | { type: "api" };

export interface CloudScheduleResult {
  trigger?: CloudTrigger;
  missing: boolean;
  parseError?: string;
}

export interface ScheduleResult {
  cronExpression?: string;
  missing: boolean;
  parseError?: string;
}

function readFileOrUndefined(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    // Surface non-ENOENT errors (permission, IO, etc.) — these are NOT
    // "missing file" and should fail the installer loudly per
    // .claude/rules/dont-refuse-engagement.md (silent-failure prevention).
    throw err;
  }
}

export function listRoutines(repoRoutinesDir: string): string[] {
  try {
    return readdirSync(repoRoutinesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    // Surface non-ENOENT errors (permission, IO, etc.) — same silent-failure
    // prevention discipline as readFileOrUndefined above.
    throw err;
  }
}

export function readSchedule(srcDir: string): ScheduleResult {
  const path = join(srcDir, "schedule.json");
  const content = readFileOrUndefined(path);
  if (content === undefined) return { missing: true };
  try {
    const parsed = JSON.parse(content) as { cronExpression?: unknown };
    if (typeof parsed.cronExpression === "string" && parsed.cronExpression.trim().length > 0) {
      return { cronExpression: parsed.cronExpression, missing: false };
    }
    if (typeof parsed.cronExpression === "string") {
      return {
        missing: false,
        parseError: "cronExpression must be a non-empty string",
      };
    }
    if (parsed.cronExpression !== undefined) {
      return {
        missing: false,
        parseError: `cronExpression must be a string; got ${typeof parsed.cronExpression}`,
      };
    }
    return {
      missing: false,
      parseError: "schedule.json is missing required field: cronExpression",
    };
  } catch (err) {
    return {
      missing: false,
      parseError: err instanceof Error ? err.message : String(err),
    };
  }
}

export function readCloudSchedule(srcDir: string): CloudScheduleResult {
  const path = join(srcDir, "cloud-schedule.json");
  const content = readFileOrUndefined(path);
  if (content === undefined) return { missing: true };
  let parsed: { trigger?: unknown };
  try {
    parsed = JSON.parse(content) as { trigger?: unknown };
  } catch (err) {
    return {
      missing: false,
      parseError: err instanceof Error ? err.message : String(err),
    };
  }
  if (parsed.trigger === undefined || parsed.trigger === null || typeof parsed.trigger !== "object") {
    return {
      missing: false,
      parseError: "cloud-schedule.json is missing required field: trigger",
    };
  }
  const trigger = parsed.trigger as { type?: unknown };
  if (typeof trigger.type !== "string") {
    return {
      missing: false,
      parseError: "cloud-schedule.json trigger.type must be a string",
    };
  }
  // Strict schema validation per tools/routines/cloud-schedule.schema.json:
  // each trigger.type has its own required fields. A trigger that names a
  // type but omits the type-specific required fields is malformed and must
  // fail loudly — silent acceptance would mean a routine whose cron never
  // fires, or whose github_event listens on nothing, gets installed.
  switch (trigger.type) {
    case "scheduled": {
      const t = trigger as { type: "scheduled"; cronExpression?: unknown };
      if (typeof t.cronExpression !== "string" || t.cronExpression.trim().length === 0) {
        return {
          missing: false,
          parseError: "cloud-schedule.json trigger.scheduled missing required field: cronExpression (non-empty string)",
        };
      }
      return { trigger: { type: "scheduled", cronExpression: t.cronExpression }, missing: false };
    }
    case "github_event": {
      const t = trigger as { type: "github_event"; event?: unknown; repos?: unknown };
      if (typeof t.event !== "string" || t.event.trim().length === 0) {
        return {
          missing: false,
          parseError: "cloud-schedule.json trigger.github_event missing required field: event (non-empty string)",
        };
      }
      if (!Array.isArray(t.repos) || t.repos.length === 0 || !t.repos.every((r) => typeof r === "string")) {
        return {
          missing: false,
          parseError: "cloud-schedule.json trigger.github_event missing required field: repos (non-empty string array)",
        };
      }
      return { trigger: { type: "github_event", event: t.event, repos: t.repos }, missing: false };
    }
    case "api":
      return { trigger: { type: "api" }, missing: false };
    default:
      return {
        missing: false,
        parseError: `cloud-schedule.json trigger.type "${trigger.type}" is not recognized (expected: scheduled | github_event | api)`,
      };
  }
}

export function syncRoutine(taskId: string, repoRoutinesDir: string, runtimeTasksDir: string): SyncResult {
  const srcDir = join(repoRoutinesDir, taskId);
  const srcSkill = join(srcDir, "SKILL.md");
  const dstDir = join(runtimeTasksDir, taskId);
  const dstSkill = join(dstDir, "SKILL.md");

  const srcContent = readFileOrUndefined(srcSkill);
  if (srcContent === undefined) {
    return { taskId, action: "skipped-missing-skill", runtimePath: dstSkill };
  }

  const dstContent = readFileOrUndefined(dstSkill);
  let action: Action;
  if (dstContent === undefined) {
    action = "created";
  } else if (dstContent === srcContent) {
    action = "skipped-unchanged";
  } else {
    action = "updated";
  }

  if (action !== "skipped-unchanged") {
    mkdirSync(dstDir, { recursive: true });
    writeFileSync(dstSkill, srcContent);
  }

  const schedule = readSchedule(srcDir);
  const cloudSchedule = readCloudSchedule(srcDir);
  return {
    taskId,
    action,
    runtimePath: dstSkill,
    ...(schedule.cronExpression !== undefined ? { cronExpression: schedule.cronExpression } : {}),
    scheduleMissing: schedule.missing,
    ...(schedule.parseError !== undefined ? { scheduleParseError: schedule.parseError } : {}),
    cloudSchedule,
  };
}

export function main(
  repoRoutinesDir: string = DEFAULT_REPO_ROUTINES_DIR,
  runtimeTasksDir: string = DEFAULT_RUNTIME_TASKS_DIR,
): number {
  console.log(`tools/routines/install.ts`);
  console.log(`  source: ${repoRoutinesDir}`);
  console.log(`  target: ${runtimeTasksDir}\n`);

  const routines = listRoutines(repoRoutinesDir).filter((id) => id !== "install.ts" && !id.endsWith(".md"));
  if (routines.length === 0) {
    console.log("No routines found under tools/routines/");
    return 0;
  }

  const results = routines.map((id) => syncRoutine(id, repoRoutinesDir, runtimeTasksDir));

  for (const r of results) {
    const tag = `[${r.action}]`.padEnd(22, " ");
    console.log(`${tag} ${r.taskId}`);
    console.log(`  runtime: ${r.runtimePath}`);
    if (r.scheduleParseError !== undefined) {
      console.error(`  schedule.json malformed: ${r.scheduleParseError}`);
    } else if (r.cronExpression !== undefined) {
      console.log(`  cron:    ${r.cronExpression}`);
    } else if (r.scheduleMissing) {
      console.log(`  cron:    (no schedule.json — ad-hoc routine, register manually)`);
    }
    if (r.cloudSchedule?.parseError !== undefined) {
      console.error(`  cloud-schedule.json malformed: ${r.cloudSchedule.parseError}`);
    }
  }

  const needsRegistration = results.filter((r) => r.cronExpression !== undefined);
  if (needsRegistration.length > 0) {
    console.log(`\nNext step — register cron schedules via the scheduled-tasks MCP:`);
    console.log(`(invoke create_scheduled_task from an interactive Claude session, or via direct MCP API call)\n`);
    for (const r of needsRegistration) {
      console.log(`  create_scheduled_task(taskId="${r.taskId}", cronExpression="${r.cronExpression}", ...)`);
    }
  }

  const needsCloudRegistration = results.filter(
    (r) => r.cloudSchedule && !r.cloudSchedule.missing && r.cloudSchedule.trigger !== undefined,
  );
  if (needsCloudRegistration.length > 0) {
    console.log(`\nNext step — register Cloud Routines (Anthropic-hosted):`);
    console.log(`  Register via the web UI: https://claude.ai/code/routines\n`);
    for (const r of needsCloudRegistration) {
      const trigger = r.cloudSchedule?.trigger;
      let details = "";
      if (trigger?.type === "scheduled") {
        details = `cron="${trigger.cronExpression}"`;
      } else if (trigger?.type === "github_event") {
        const repos = trigger.repos.map((x) => `"${x}"`).join(",");
        details = `event="${trigger.event}" repos=[${repos}]`;
      }
      console.log(`  ${r.taskId}: trigger=${trigger?.type} ${details}`);
    }
  }

  const summary = {
    created: results.filter((r) => r.action === "created").length,
    updated: results.filter((r) => r.action === "updated").length,
    unchanged: results.filter((r) => r.action === "skipped-unchanged").length,
    missingSkill: results.filter((r) => r.action === "skipped-missing-skill").length,
    parseErrors: results.filter((r) => r.scheduleParseError !== undefined || r.cloudSchedule?.parseError !== undefined)
      .length,
  };
  console.log(
    `\nDone. created=${summary.created} updated=${summary.updated} unchanged=${summary.unchanged} missing=${summary.missingSkill} parseErrors=${summary.parseErrors}`,
  );

  // SKILL.md is required per README. A routine directory with no SKILL.md is
  // a developer mistake, not graceful state. Fail loudly so CI catches it.
  // Same discipline for cloud-schedule.json parse errors — a malformed cloud
  // schedule means a routine that would never fire correctly in production.
  return summary.parseErrors > 0 || summary.missingSkill > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main());
}
