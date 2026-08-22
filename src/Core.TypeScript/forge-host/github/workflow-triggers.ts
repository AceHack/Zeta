/**
 * forge-host/github/workflow-triggers.ts — derive a check's EXPECTATION from the
 * substrate's own declaration.
 *
 * This is the module that separates **expected-absent** from **unexpectedly-absent**,
 * and that distinction is the reason a wall of unknowns does not form. A PR-only
 * workflow with no runs on `main` is correct and must read as such; a *weekly*
 * workflow with no runs on `main` should not be possible and must read as red.
 *
 * DERIVED, NEVER ASSUMED. The expectation comes from the workflow's own `on:` block.
 * Anything this parser cannot read yields `{ kind: "unknown" }` — loudly — rather than
 * defaulting to the convenient case. That refusal is the whole value of the file: a
 * parser that guesses turns a display bug into a silent one.
 *
 * WHY A NARROW PARSER RATHER THAN A YAML DOM. GitHub Actions' key is literally `on:`,
 * which YAML 1.1 parsers coerce to the boolean `true`, and the repo's DOM is not
 * pinned against that hazard. A shallow, total, tested extraction of the top-level
 * `on:` block has a failure mode we control; a coercion has one we would discover the
 * way today's failure was discovered.
 */

import type { CheckExpectation } from "../types.ts";

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86_400;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

/** Fallback period for a `schedule:` whose cron we cannot read. Stated, not hidden. */
export const UNDERIVABLE_CRON_PERIOD_SECONDS = MONTH;

/**
 * Estimate a cron expression's period in seconds. Standard 5-field cron
 * (minute hour day-of-month month day-of-week), which is what Actions accepts.
 *
 * Returns `null` when the shape is not one this function actually understands — the
 * caller then says so in the expectation's detail rather than inventing a number.
 */
export function cronPeriodSeconds(expr: string): number | null {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) return null;
  const [min, hour, dom, month, dow] = f as [string, string, string, string, string];

  const step = (field: string): number | null => {
    const m = field.match(/^\*\/(\d+)$/);
    if (m === null) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const isFixed = (field: string): boolean => /^\d+(,\d+)*$/.test(field);
  const listLen = (field: string): number => field.split(",").length;

  const minStep = step(min);
  if (minStep !== null) return minStep * MINUTE;
  if (isFixed(min)) {
    const hourStep = step(hour);
    if (hourStep !== null) return (hourStep * HOUR) / listLen(min);
    if (hour === "*") return HOUR / listLen(min);
    if (isFixed(hour)) {
      const perDay = listLen(min) * listLen(hour);
      if (dow !== "*" && isFixed(dow)) return WEEK / listLen(dow) / perDay;
      if (dom !== "*" && isFixed(dom)) return MONTH / listLen(dom) / perDay;
      if (dom === "*" && dow === "*" && month === "*") return DAY / perDay;
    }
  }
  return null;
}

/**
 * Extract the top-level `on:` block's text from a workflow file.
 *
 * Handles both the block form (`on:` then an indented mapping) and the inline forms
 * (`on: push`, `on: [push, pull_request]`). Returns `null` when no top-level `on:` is
 * present at all — a workflow with no triggers, which is itself worth seeing.
 */
export function extractOnBlock(yaml: string): string | null {
  const lines = yaml.split("\n");
  let start = -1;
  let inline = "";
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const m = line.match(/^(?:["']?on["']?|true)\s*:(.*)$/);
    if (m !== null) {
      start = i;
      inline = (m[1] ?? "").trim();
      break;
    }
  }
  if (start === -1) return null;
  if (inline !== "" && !inline.startsWith("#")) return inline;

  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.trim() === "" || line.startsWith("#")) {
      body.push(line);
      continue;
    }
    if (!/^\s/.test(line)) break; // back to column 0 ⇒ next top-level key
    body.push(line);
  }
  return body.join("\n");
}

/**
 * Values of a list-valued key inside a trigger's sub-block, in either YAML form:
 * `branches: [main, 'release/*']` or an indented `- main` block. `null` when the key
 * is absent — which for `branches:` means "every branch", a real and different answer
 * from "an empty list".
 *
 * Caught by its own falsifier: the first version of this only recognised the block
 * form and the quoted flow form, so `branches: [main]` — which is how `gate.yml`
 * writes it — was read as "does not include main", and the repo's single most
 * important workflow was classified `on-demand`. The dashboard still showed its red;
 * it would have shown the wrong reason for a silence.
 */
export function listValuesFor(subText: string, key: string): readonly string[] | null {
  // `[^\S\n]` is HORIZONTAL whitespace. Plain `\s*` matches newlines, so a greedy
  // `\s*(.*)$` silently swallowed the key's own line and resumed on the next one —
  // which is how the first version of `triggerSubBlock` lost the `branches:` line
  // entirely and reported "no branch filter" for every block-form workflow.
  const re = new RegExp(`^([^\\S\\n]*)${key}[^\\S\\n]*:([^\\n]*)$`, "m");
  const m = subText.match(re);
  if (m === null) return null;
  const indent = (m[1] ?? "").length;
  const inline = (m[2] ?? "").trim();
  const unquote = (v: string): string => v.trim().replace(/^["']|["']$/g, "");

  if (inline.startsWith("[")) {
    return inline.replace(/^\[|\].*$/g, "").split(",").map(unquote).filter((v) => v !== "");
  }
  if (inline !== "" && !inline.startsWith("#")) return [unquote(inline)];

  const out: string[] = [];
  for (const line of subText.slice((m.index ?? 0) + m[0].length + 1).split("\n")) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const lead = line.length - line.trimStart().length;
    if (lead <= indent) break;
    const item = line.trim();
    if (!item.startsWith("-")) break;
    out.push(unquote(item.slice(1)));
  }
  return out;
}

/**
 * GitHub's branch-filter glob, narrowly: `*` matches within a path segment, `**`
 * across segments, `?` one character. A leading `!` is an exclusion.
 */
const GLOBSTAR = "\uE000globstar\uE000"; // private-use sentinel; never a raw NUL in source
export function globMatches(pattern: string, value: string): boolean {
  const body = pattern.startsWith("!") ? pattern.slice(1) : pattern;
  const rx = body
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, GLOBSTAR)
    .replace(/\*/g, "[^/]*")
    .replaceAll(GLOBSTAR, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${rx}$`).test(value);
}

/** The sub-block of `onBlock` belonging to `trigger`, or `null` if absent. */
export function triggerSubBlock(onBlock: string, trigger: string): string | null {
  const re = new RegExp(`^([^\\S\\n]*)${trigger}[^\\S\\n]*:[^\\n]*$`, "m");
  const m = onBlock.match(re);
  if (m === null) return null;
  const indent = (m[1] ?? "").length;
  const sub: string[] = [];
  for (const line of onBlock.slice((m.index ?? 0) + m[0].length + 1).split("\n")) {
    if (line.trim() === "") continue;
    const lead = line.length - line.trimStart().length;
    if (lead <= indent) break;
    sub.push(line);
  }
  return sub.join("\n");
}

/**
 * Does `trigger`'s branch filter admit `ref`? A trigger with no `branches:` /
 * `branches-ignore:` admits every branch, which is the YAML's own meaning and not a
 * default we chose.
 */
export function branchesMatchRef(onBlock: string, trigger: "push" | "pull_request", ref: string): boolean {
  const sub = triggerSubBlock(onBlock, trigger);
  if (sub === null) return true;
  const bare = ref.replace(/^refs\/heads\//, "");

  const ignore = listValuesFor(sub, "branches-ignore");
  if (ignore !== null && ignore.length > 0) return !ignore.some((p) => globMatches(p, bare));

  const branches = listValuesFor(sub, "branches");
  if (branches === null || branches.length === 0) return true;
  if (branches.some((p) => p.startsWith("!") && globMatches(p, bare))) return false;
  return branches.filter((p) => !p.startsWith("!")).some((p) => globMatches(p, bare));
}

/**
 * Names from an INLINE `on:` (either `on: push` or `on: [push, pull_request]`).
 * `null` when the block is the ordinary indented mapping form.
 */
export function inlineTriggerNames(onBlock: string): readonly string[] | null {
  const t = onBlock.trim();
  if (t === "" || t.includes("\n")) return null;
  if (t.startsWith("[")) {
    return t.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter((s) => s !== "");
  }
  if (/^[a-z_]+$/.test(t)) return [t];
  return null;
}

/**
 * Workflow source → what we should expect it to do on `ref`.
 *
 * Ordering is deliberate: a workflow that is BOTH scheduled and PR-triggered is
 * `periodic`, because the clock is the stronger claim — the schedule says it should
 * report whether or not anyone opens a PR.
 */
export function expectationFromWorkflow(yaml: string, ref: string): CheckExpectation {
  const onBlock = extractOnBlock(yaml);
  if (onBlock === null) {
    return { kind: "unknown", reason: "underivable", detail: "no top-level `on:` block found in the workflow file" };
  }

  const crons = [...onBlock.matchAll(/cron\s*:\s*["']?([^"'\n#]+)["']?/g)].map((m) => (m[1] ?? "").trim());
  if (crons.length > 0) {
    const periods = crons.map(cronPeriodSeconds);
    const derived = periods.filter((p): p is number => p !== null);
    if (derived.length === crons.length) {
      const period = Math.min(...derived);
      return { kind: "periodic", periodSeconds: period, detail: `schedule: ${crons.map((c) => `'${c}'`).join(", ")}` };
    }
    return {
      kind: "periodic",
      periodSeconds: derived.length > 0 ? Math.min(...derived) : UNDERIVABLE_CRON_PERIOD_SECONDS,
      detail: `schedule: ${crons.map((c) => `'${c}'`).join(", ")} — period not fully derivable, using ${derived.length > 0 ? "the derivable minimum" : "a 30d floor"} for staleness`,
    };
  }

  const inlineNames = inlineTriggerNames(onBlock);
  const hasPush = inlineNames === null ? /^\s*push\s*:/m.test(onBlock) : inlineNames.includes("push");
  if (hasPush) {
    if (inlineNames !== null || branchesMatchRef(onBlock, "push", ref)) {
      return { kind: "on-change", detail: `push to ${ref.replace(/^refs\/heads\//, "")}` };
    }
    return { kind: "on-demand", detail: `push, but not to ${ref.replace(/^refs\/heads\//, "")}` };
  }

  // `workflow_run` chains off another workflow completing: it fires when something
  // else fires, so silence on it is not itself alarming — the workflow it chains from
  // is the one that carries the cadence claim.
  const requestish = ["pull_request", "pull_request_target", "workflow_dispatch", "workflow_call", "workflow_run", "issue_comment", "issues", "repository_dispatch", "release", "watch", "fork", "deployment", "check_run", "check_suite", "discussion", "label", "milestone", "page_build", "project", "public", "status"];
  for (const t of requestish) {
    const present = inlineNames === null ? new RegExp(`^\\s*${t}\\s*:`, "m").test(onBlock) : inlineNames.includes(t);
    if (present) return { kind: "on-demand", detail: t };
  }

  return { kind: "unknown", reason: "underivable", detail: `unrecognised triggers in \`on:\` block: ${onBlock.trim().slice(0, 120).replace(/\s+/g, " ")}` };
}
