#!/usr/bin/env bun
// drift-ledger.ts — tick-indexed drift events + the MTTH fold.
// Workitem 081KX3KA3EW08QG0R002WFQ6BG (drift-and-heal ADR items 2 + 6, as
// amended 2026-07-09): detectors run on the tick and publish drift events;
// MTTH (mean time to heal) per drift class is TICK-INDEXED, not
// wallclock-indexed — the clock is the agreed reference frame, so every
// agent measures the same drift against the same now (the
// deterministic-agreed-time ferry; Lamport: agreed ORDER, not agreed now).
//
// The tick, concretely: the detector SWEEP. Each sweep of main records the
// full finding set as one ledger event with a monotonically increasing
// `tick` (next = max existing + 1 — derived from the ledger itself, no
// ambient clock in the math; the ISO timestamp is carried as metadata only).
// A finding first present at tick B and first absent at tick H > B was
// healed in H − B ticks. MTTH per class = mean over healed findings;
// unhealed findings report their open age. Unmeasured drift-tolerance is
// normalized deviance — this fold is the flip's safety net (#9860).
//
// Pure core (parse/fold), edge-only I/O — noninterference §13; the fold is
// a deterministic function of the event set (DST; same evidence ⇒ same
// report, per the two-orders rule: local wallclock never enters the fold).
//
// Usage:
//   <linter> 2>&1 | bun drift-ledger.ts sweep --dir docs/drift-events \
//       [--tracked tracked-files.txt]
//       Parse findings from stdin (same formats as scoped-lint), append one
//       sweep event at the next tick. --tracked (e.g. `git ls-files` output)
//       keeps path-shaped tool preamble out of the permanent ledger.
//   bun drift-ledger.ts report --dir docs/drift-events
//       Fold all events, print MTTH per class in ticks.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  mintWorkItem,
  publishCreatedEvent,
  SYSTEM_ENV,
  workItemEventsRoot,
  type NewWorkItemSpec,
} from "../backlog/new-workitem.ts";
import { findingPath, normalizePath, parseChangedFiles } from "./scoped-lint.ts";

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/** One observed finding, keyed by path+rule (line numbers drift; keys must
 * survive unrelated edits, same lesson as the healer baseline). */
export interface DriftFinding {
  readonly path: string;
  readonly rule: string;
}

/** One detector sweep = one tick of the drift clock. */
export interface SweepEvent {
  readonly tick: number;
  readonly at: string; // ISO metadata ONLY — never enters the fold
  readonly findings: readonly DriftFinding[];
}

/** Extract the rule token from a finding line (MD032, TS2322, SC1091, …);
 * falls back to the detector-agnostic class "finding". */
export function findingRule(line: string): string {
  const m = line.match(/\b(MD\d{3}|TS\d{4,5}|SC\d{4}|CS\d{4}|CA\d{4}|[A-Z]{2,4}\d{3,5})\b/);
  return m?.[1] ?? "finding";
}

/** Parse linter output (scoped-lint's recognized formats) into findings.
 * `knownPaths` (e.g. `git ls-files`) guards against tool preamble that merely
 * LOOKS path-shaped (`Summary: 3 error(s)`, glob-echo preamble lines) — the same
 * guard as scoped-lint's classifyLines. The ledger is permanent; junk keys
 * must never enter it. Paths are normalized so ledger keys are stable. */
export function parseFindings(output: string, knownPaths?: ReadonlySet<string>): readonly DriftFinding[] {
  const seen = new Set<string>();
  const out: DriftFinding[] = [];
  for (const line of output.split("\n")) {
    const raw = findingPath(line);
    if (raw === null) continue;
    const path = normalizePath(raw);
    if (knownPaths !== undefined && !knownPaths.has(path)) continue;
    const rule = findingRule(line);
    const key = JSON.stringify([path, rule]);
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ path, rule });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The fold (pure)
// ---------------------------------------------------------------------------

export interface ClassMtth {
  readonly rule: string;
  readonly healedCount: number;
  readonly mtthTicks: number | null; // null when nothing healed yet
  readonly openCount: number;
  readonly oldestOpenAgeTicks: number | null;
}

export interface MtthReport {
  readonly latestTick: number;
  readonly classes: readonly ClassMtth[];
  readonly lines: readonly string[];
}

function findingKey(f: DriftFinding): string {
  return JSON.stringify([f.path, f.rule]);
}

/** Fold sweep events into per-class MTTH. Pure function of the event set;
 * sweeps are ordered by tick (ties impossible: ticks are unique). */
export function foldMtth(events: readonly SweepEvent[]): MtthReport {
  const sweeps = [...events].sort((a, b) => a.tick - b.tick);
  const latestTick = sweeps.length > 0 ? sweeps[sweeps.length - 1]!.tick : 0;

  // birth tick per finding key; heal durations per rule; open ages per rule.
  const birth = new Map<string, { tick: number; rule: string }>();
  const healed = new Map<string, number[]>(); // rule -> durations
  const open = new Map<string, number[]>(); // rule -> ages at latest tick

  for (const sweep of sweeps) {
    const present = new Set(sweep.findings.map(findingKey));
    // heals: previously-born keys absent in this sweep
    for (const [key, b] of [...birth]) {
      if (!present.has(key)) {
        const durations = healed.get(b.rule) ?? [];
        durations.push(sweep.tick - b.tick);
        healed.set(b.rule, durations);
        birth.delete(key);
      }
    }
    // births: newly-present keys
    for (const f of sweep.findings) {
      const key = findingKey(f);
      if (!birth.has(key)) birth.set(key, { tick: sweep.tick, rule: f.rule });
    }
  }
  for (const b of birth.values()) {
    const ages = open.get(b.rule) ?? [];
    ages.push(latestTick - b.tick);
    open.set(b.rule, ages);
  }

  const rules = [...new Set([...healed.keys(), ...open.keys()])].sort();
  const classes: ClassMtth[] = rules.map((rule) => {
    const durations = healed.get(rule) ?? [];
    const ages = open.get(rule) ?? [];
    return {
      rule,
      healedCount: durations.length,
      mtthTicks: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
      openCount: ages.length,
      oldestOpenAgeTicks: ages.length > 0 ? Math.max(...ages) : null,
    };
  });

  const lines = [
    `drift-ledger: ${String(sweeps.length)} sweep(s), latest tick ${String(latestTick)}`,
    ...classes.map(
      (c) =>
        `  ${c.rule}: MTTH ${c.mtthTicks === null ? "—" : c.mtthTicks.toFixed(1)} tick(s) over ${String(c.healedCount)} heal(s); ` +
        `${String(c.openCount)} open${c.oldestOpenAgeTicks === null ? "" : ` (oldest ${String(c.oldestOpenAgeTicks)} tick(s))`}`,
    ),
  ];
  return { latestTick, classes, lines };
}

// ---------------------------------------------------------------------------
// SLO (pure) — the enforcement half. A measurement nobody must act on is
// still normalized deviance; the SLO makes the ledger BIND: a drift class
// whose oldest open finding outlives its tick-indexed budget is in breach,
// and a breach auto-files a P1 workitem (ADR item 6 as amended). One filing
// per breach EPISODE: the filed-map remembers the workitem while the class
// has open findings and clears when it fully heals, so a later re-breach
// files a fresh workitem instead of being silently deduped forever.
// ---------------------------------------------------------------------------

export interface SloConfig {
  readonly defaults: { readonly maxOpenAgeTicks: number };
  readonly perRule: Readonly<Record<string, { readonly maxOpenAgeTicks: number }>>;
}

export interface SloBreach {
  readonly rule: string;
  readonly openCount: number;
  readonly oldestOpenAgeTicks: number;
  readonly maxOpenAgeTicks: number;
}

export function sloLimit(cfg: SloConfig, rule: string): number {
  return cfg.perRule[rule]?.maxOpenAgeTicks ?? cfg.defaults.maxOpenAgeTicks;
}

/** Pure: classes whose oldest open finding has OUTLIVED its budget. Breach is
 * age > max (at age == max the class is at the boundary, not past it). */
export function sloBreaches(report: MtthReport, cfg: SloConfig): readonly SloBreach[] {
  return report.classes.flatMap((c) => {
    if (c.oldestOpenAgeTicks === null) return [];
    const max = sloLimit(cfg, c.rule);
    return c.oldestOpenAgeTicks > max
      ? [{ rule: c.rule, openCount: c.openCount, oldestOpenAgeTicks: c.oldestOpenAgeTicks, maxOpenAgeTicks: max }]
      : [];
  });
}

/** rule -> the workitem filed for the CURRENT breach episode. */
export type FiledMap = Readonly<Record<string, { readonly workitem: string; readonly filedAtTick: number }>>;

/** Pure: drop filed entries whose rule has fully healed — that episode is
 * over; a future re-breach files a NEW workitem. Still-open rules persist
 * (idempotency: apply-N-times == apply-once per episode, manifesto §12). */
export function reconcileFiled(report: MtthReport, filed: FiledMap): FiledMap {
  const open = new Set(report.classes.filter((c) => c.openCount > 0).map((c) => c.rule));
  return Object.fromEntries(Object.entries(filed).filter(([rule]) => open.has(rule)));
}

/** Pure: breaches not yet filed this episode. */
export function newlyBreaching(breaches: readonly SloBreach[], filed: FiledMap): readonly SloBreach[] {
  return breaches.filter((b) => !(b.rule in filed));
}

interface RawSloYaml {
  readonly defaults?: { readonly max_open_age_ticks?: number };
  readonly per_rule?: Readonly<Record<string, { readonly max_open_age_ticks?: number }>>;
}

/** Registry surface is snake_case YAML (registry/drift-slo.yaml, sibling of
 * uncompensatable-floor.yaml); normalize the already-parsed document to the
 * typed config here. YAML parsing itself stays at the CLI edge via dynamic
 * import — the `yaml` package is the module's only external dep, and the
 * hygiene unit-test job runs `bun test` without `bun install`, so a static
 * import would break every consumer that never touches the SLO path. */
export function normalizeSloConfig(rawDoc: unknown): SloConfig {
  const raw = rawDoc as RawSloYaml | null;
  const def = raw?.defaults?.max_open_age_ticks;
  if (typeof def !== "number" || !Number.isFinite(def) || def < 1) {
    throw new Error("drift-slo config: defaults.max_open_age_ticks must be a number >= 1");
  }
  const perRule: Record<string, { maxOpenAgeTicks: number }> = {};
  for (const [rule, v] of Object.entries(raw?.per_rule ?? {})) {
    const n = v?.max_open_age_ticks;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 1) {
      throw new Error(`drift-slo config: per_rule.${rule}.max_open_age_ticks must be a number >= 1`);
    }
    perRule[rule] = { maxOpenAgeTicks: n };
  }
  return { defaults: { maxOpenAgeTicks: def }, perRule };
}

// ---------------------------------------------------------------------------
// Ledger I/O edge (one JSON file per sweep: NNNNNN.json, tick-named — the
// filename IS the tick, so ordering is the directory listing, codepoint sort)
// ---------------------------------------------------------------------------

export function readLedger(dir: string): readonly SweepEvent[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => /^\d{6}\.json$/.test(f));
  } catch {
    return [];
  }
  return files.sort().map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as SweepEvent);
}

export function nextTick(events: readonly SweepEvent[]): number {
  return events.reduce((m, e) => Math.max(m, e.tick), 0) + 1;
}

/** The filed-map lives beside the sweeps: <ledger-dir>/slo-filed.json. */
export function filedMapPath(dir: string): string {
  return join(dir, "slo-filed.json");
}

function readFiledMap(dir: string): FiledMap {
  const p = filedMapPath(dir);
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, "utf8")) as FiledMap;
}

function writeFiledMap(dir: string, filed: FiledMap): void {
  // Sorted keys => deterministic bytes => readable diffs (DST; text-only proofs).
  const sorted = Object.fromEntries(Object.entries(filed).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  writeFileSync(filedMapPath(dir), `${JSON.stringify(sorted, null, 2)}\n`);
}

/** File one P1 workitem per newly-breaching class; returns the updated map.
 * Edge-only I/O; the decision (breaches, episode dedup) is the pure core. */
function runSloFile(dir: string, cfg: SloConfig, workitemsDir: string): void {
  const report = foldMtth(readLedger(dir));
  const filed = reconcileFiled(report, readFiledMap(dir));
  const fresh = newlyBreaching(sloBreaches(report, cfg), filed);
  const next: Record<string, { workitem: string; filedAtTick: number }> = { ...filed };
  const actor = process.env["ZETA_WORKITEM_ACTOR"] ?? "drift-sweep";
  for (const b of fresh) {
    const spec: NewWorkItemSpec = {
      type: "bug",
      priority: "P1",
      title:
        `drift SLO breach: ${b.rule} open ${String(b.oldestOpenAgeTicks)} tick(s) ` +
        `(budget ${String(b.maxOpenAgeTicks)}, ${String(b.openCount)} finding(s)) — heal the class`,
    };
    const minted = mintWorkItem(spec, SYSTEM_ENV);
    const path = join(workitemsDir, minted.filename);
    mkdirSync(workitemsDir, { recursive: true });
    // flag "wx" = atomic create-exclusive: throws EEXIST instead of clobbering,
    // with no check-then-write race (CodeQL js/file-system-race on the
    // existsSync form; collision itself is astronomically unlikely — 128-bit id).
    writeFileSync(path, minted.content, { encoding: "utf8", flag: "wx" });
    const ev = publishCreatedEvent(minted, spec, SYSTEM_ENV, actor, workItemEventsRoot(workitemsDir), false);
    if (ev.kind === "collision") throw new Error(`drift-slo: event collision at ${ev.path}`);
    next[b.rule] = { workitem: minted.zetaid, filedAtTick: report.latestTick };
    console.log(`drift-slo: filed ${minted.zetaid} for ${b.rule} (${path})`);
  }
  writeFiledMap(dir, next);
  console.log(
    `drift-slo: ${String(fresh.length)} newly-breaching class(es) filed, ` +
      `${String(Object.keys(next).length)} episode(s) tracked, latest tick ${String(report.latestTick)}`,
  );
}

const invokedDirectly = typeof process.argv[1] === "string" && /drift-ledger\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const [cmd, ...rest] = process.argv.slice(2);
  const dirIdx = rest.indexOf("--dir");
  const dir = dirIdx !== -1 ? rest[dirIdx + 1] : undefined;
  const trackedIdx = rest.indexOf("--tracked");
  const trackedFile = trackedIdx !== -1 ? rest[trackedIdx + 1] : undefined;
  const configIdx = rest.indexOf("--config");
  const configFile = configIdx !== -1 ? rest[configIdx + 1] : undefined;
  const wiIdx = rest.indexOf("--workitems");
  const workitemsDir = wiIdx !== -1 ? (rest[wiIdx + 1] ?? "workitems") : "workitems";
  if ((cmd !== "sweep" && cmd !== "report" && cmd !== "slo") || dir === undefined) {
    console.error(
      "usage: drift-ledger.ts <sweep|report|slo> --dir <ledger-dir> [--tracked <ls-files.txt>] " +
        "[--config <drift-slo.yaml>] [--workitems <dir>]   (sweep reads linter output on stdin)",
    );
    process.exit(2);
  }
  if (cmd === "report") {
    const report = foldMtth(readLedger(dir));
    if (rest.includes("--json")) {
      // Machine-readable surface (data/drift-mtth.json → the Pages monitor
      // panel). Same fold, same bytes for the same ledger (DST).
      const { lines: _lines, ...machine } = report;
      console.log(JSON.stringify(machine, null, 2));
    } else {
      for (const l of report.lines) console.log(l);
    }
    process.exit(0);
  }
  if (cmd === "slo") {
    if (configFile === undefined) {
      console.error("drift-ledger slo: --config <drift-slo.yaml> is required");
      process.exit(2);
    }
    // Lazy edge-only import (see normalizeSloConfig doc comment).
    const { parse } = await import("yaml");
    runSloFile(dir, normalizeSloConfig(parse(readFileSync(configFile, "utf8"))), workitemsDir);
    process.exit(0);
  }
  const tracked = trackedFile !== undefined ? parseChangedFiles(readFileSync(trackedFile, "utf8")) : undefined;
  const chunks: Buffer[] = [];
  process.stdin.on("data", (c: Buffer) => chunks.push(c));
  process.stdin.on("end", () => {
    mkdirSync(dir, { recursive: true });
    const events = readLedger(dir);
    const tick = nextTick(events);
    const event: SweepEvent = {
      tick,
      at: new Date().toISOString(),
      findings: parseFindings(Buffer.concat(chunks).toString("utf8"), tracked),
    };
    writeFileSync(join(dir, `${String(tick).padStart(6, "0")}.json`), `${JSON.stringify(event, null, 2)}\n`);
    console.log(`drift-ledger: tick ${String(tick)} recorded, ${String(event.findings.length)} finding(s)`);
    process.exit(0);
  });
}
