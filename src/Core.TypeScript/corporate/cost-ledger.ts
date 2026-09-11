/**
 * corporate/cost-ledger.ts — where the money went, and why.
 *
 * MEASURED on the Agentic Team, 2026-09-11: the organization spent about $3,900 in a day across
 * three repositories and recorded none of it. Claude Code reports `total_cost_usd` on every call and
 * the client threw it away, keeping one unstructured `usage:` line that mostly never reached a log -
 * of roughly 200 agent calls, eight left a trace. The day had to be reconstructed from the harness's
 * private transcripts, which is exactly the "no record" the rest of this organization refuses.
 *
 * `claude-agent.cjs` now appends one line per agent call to `<store>/cost/<date>.jsonl` carrying the
 * money AND its provenance: the work item, the hat, the mode, the model, the session, and the reason
 * the run was started. This folds those lines.
 *
 * ── WHY A FOLD AND NOT A COUNTER ─────────────────────────────────────────────
 * Lines are appended by many runs, and a run that is retried writes its calls again. The session id
 * is the natural key: folding is idempotent, so re-reading a day cannot double-count it. That is the
 * same discipline the event store is built on, applied to money.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const NL = String.fromCharCode(10);

/** One agent call, as `claude-agent.cjs` recorded it. Everything is optional: a line is evidence, not a form. */
export interface CostLine {
  readonly at: string;
  readonly org?: string | null;
  readonly profile?: string | null;
  readonly workId?: string | null;
  readonly hat?: string | null;
  readonly mode?: string | null;
  readonly model?: string | null;
  readonly sessionId?: string | null;
  readonly costUsd?: number | null;
  readonly durationMs?: number | null;
  readonly agentTurns?: number | null;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly cacheReadTokens?: number;
  readonly cacheWriteTokens?: number;
  readonly reason?: string | null;
}

export interface CostTotal {
  readonly calls: number;
  readonly usd: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
}

export interface CostFold {
  readonly total: CostTotal;
  /** Totals by day, work item, hat, mode, model and profile - each a map of name to its total. */
  readonly byDay: ReadonlyMap<string, CostTotal>;
  readonly byWork: ReadonlyMap<string, CostTotal>;
  readonly byHat: ReadonlyMap<string, CostTotal>;
  readonly byMode: ReadonlyMap<string, CostTotal>;
  readonly byModel: ReadonlyMap<string, CostTotal>;
  readonly byProfile: ReadonlyMap<string, CostTotal>;
  /** What the organization was answering when it spent - the reason, with what it cost. */
  readonly byReason: ReadonlyMap<string, CostTotal>;
  /** Lines that carried no cost figure: counted, never guessed at. */
  readonly withoutCost: number;
  /** Lines dropped because another line already carried that session id. */
  readonly duplicates: number;
}

const ZERO: CostTotal = { calls: 0, usd: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

function add(a: CostTotal, line: CostLine): CostTotal {
  return {
    calls: a.calls + 1,
    usd: a.usd + (typeof line.costUsd === "number" ? line.costUsd : 0),
    inputTokens: a.inputTokens + (line.inputTokens ?? 0),
    outputTokens: a.outputTokens + (line.outputTokens ?? 0),
    cacheReadTokens: a.cacheReadTokens + (line.cacheReadTokens ?? 0),
    cacheWriteTokens: a.cacheWriteTokens + (line.cacheWriteTokens ?? 0),
  };
}

function into(m: Map<string, CostTotal>, key: string | null | undefined, line: CostLine): void {
  const k = key === undefined || key === null || key === "" ? "(not stated)" : key;
  m.set(k, add(m.get(k) ?? ZERO, line));
}

/** Fold the lines. Pure: what it reads is handed in, and a repeated session id is counted once. */
export function foldCost(lines: readonly CostLine[]): CostFold {
  const byDay = new Map<string, CostTotal>();
  const byWork = new Map<string, CostTotal>();
  const byHat = new Map<string, CostTotal>();
  const byMode = new Map<string, CostTotal>();
  const byModel = new Map<string, CostTotal>();
  const byProfile = new Map<string, CostTotal>();
  const byReason = new Map<string, CostTotal>();
  const seen = new Set<string>();
  let total = ZERO;
  let withoutCost = 0;
  let duplicates = 0;
  for (const line of lines) {
    if (typeof line.sessionId === "string" && line.sessionId !== "") {
      if (seen.has(line.sessionId)) {
        duplicates += 1;
        continue;
      }
      seen.add(line.sessionId);
    }
    if (typeof line.costUsd !== "number") withoutCost += 1;
    total = add(total, line);
    into(byDay, typeof line.at === "string" ? line.at.slice(0, 10) : undefined, line);
    into(byWork, line.workId, line);
    into(byHat, line.hat, line);
    into(byMode, line.mode, line);
    into(byModel, line.model, line);
    into(byProfile, line.profile, line);
    into(byReason, line.reason, line);
  }
  return { total, byDay, byWork, byHat, byMode, byModel, byProfile, byReason, withoutCost, duplicates };
}

/**
 * Read a store's ledger. `since`/`until` are dates (YYYY-MM-DD) and bound the FILES read, by name.
 *
 * A malformed line is skipped rather than fatal - a ledger is a record of what happened, and one bad
 * append must not make the rest of the day unreadable. The count of them is returned, never hidden.
 */
export function readCostDir(dir: string, since?: string, until?: string): { readonly lines: readonly CostLine[]; readonly unreadable: number } {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
  } catch {
    return { lines: [], unreadable: 0 };
  }
  const lines: CostLine[] = [];
  let unreadable = 0;
  for (const f of files) {
    const day = f.slice(0, -".jsonl".length);
    if (since !== undefined && day < since) continue;
    if (until !== undefined && day > until) continue;
    let text: string;
    try {
      text = readFileSync(join(dir, f), "utf-8");
    } catch {
      unreadable += 1;
      continue;
    }
    for (const raw of text.split(NL)) {
      if (raw.trim() === "") continue;
      try {
        lines.push(JSON.parse(raw) as CostLine);
      } catch {
        unreadable += 1;
      }
    }
  }
  return { lines, unreadable };
}

const usd = (n: number): string => "$" + n.toFixed(2);
const tok = (n: number): string =>
  n >= 1e9 ? (n / 1e9).toFixed(2) + "B" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(0) + "k" : String(n);

function section(title: string, m: ReadonlyMap<string, CostTotal>, total: number, limit: number): readonly string[] {
  const rows = [...m.entries()].sort((a, b) => b[1].usd - a[1].usd).slice(0, limit);
  const out = [title];
  for (const [name, t] of rows) {
    const share = total === 0 ? "" : " (" + String(Math.round((100 * t.usd) / total)) + "%)";
    out.push("  " + usd(t.usd).padStart(9) + share.padEnd(6) + " " + String(t.calls).padStart(4) + " calls  " + name.slice(0, 88));
  }
  return out;
}

/** The report a person reads. Money first, then where it went, then what it was answering. */
export function renderCost(fold: CostFold, opts: { readonly reasons?: boolean } = {}): string {
  const t = fold.total;
  const out: string[] = [
    "spent " + usd(t.usd) + " over " + String(t.calls) + " agent calls",
    "  tokens: in " + tok(t.inputTokens) + ", out " + tok(t.outputTokens) + ", cache written " + tok(t.cacheWriteTokens) + ", cache read " + tok(t.cacheReadTokens),
  ];
  if (fold.withoutCost > 0) out.push("  " + String(fold.withoutCost) + " call(s) reported no cost figure - counted in the calls, not in the money");
  if (fold.duplicates > 0) out.push("  " + String(fold.duplicates) + " repeated session id(s) folded once");
  out.push("");
  const sections: readonly (readonly [string, ReadonlyMap<string, CostTotal>])[] = [
    ["by day", fold.byDay],
    ["by work item", fold.byWork],
    ["by hat", fold.byHat],
    ["by mode", fold.byMode],
    ["by model", fold.byModel],
    ["by profile", fold.byProfile],
  ];
  for (const [title, m] of sections) out.push(...section(title, m, t.usd, 12), "");
  if (opts.reasons === true) out.push(...section("by reason the run was started", fold.byReason, t.usd, 20), "");
  return out.join(NL);
}
