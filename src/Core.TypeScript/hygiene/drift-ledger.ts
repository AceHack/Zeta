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
//   <linter> 2>&1 | bun drift-ledger.ts sweep --dir docs/drift-events
//       Parse findings from stdin (same formats as scoped-lint), append one
//       sweep event at the next tick.
//   bun drift-ledger.ts report --dir docs/drift-events
//       Fold all events, print MTTH per class in ticks.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { findingPath } from "./scoped-lint.ts";

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

/** Parse linter output (scoped-lint's recognized formats) into findings. */
export function parseFindings(output: string): readonly DriftFinding[] {
  const seen = new Set<string>();
  const out: DriftFinding[] = [];
  for (const line of output.split("\n")) {
    const path = findingPath(line);
    if (path === null) continue;
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

const invokedDirectly = typeof process.argv[1] === "string" && /drift-ledger\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const [cmd, ...rest] = process.argv.slice(2);
  const dirIdx = rest.indexOf("--dir");
  const dir = dirIdx !== -1 ? rest[dirIdx + 1] : undefined;
  if ((cmd !== "sweep" && cmd !== "report") || dir === undefined) {
    console.error("usage: drift-ledger.ts <sweep|report> --dir <ledger-dir>   (sweep reads linter output on stdin)");
    process.exit(2);
  }
  if (cmd === "report") {
    for (const l of foldMtth(readLedger(dir)).lines) console.log(l);
    process.exit(0);
  }
  const chunks: Buffer[] = [];
  process.stdin.on("data", (c: Buffer) => chunks.push(c));
  process.stdin.on("end", () => {
    mkdirSync(dir, { recursive: true });
    const events = readLedger(dir);
    const tick = nextTick(events);
    const event: SweepEvent = { tick, at: new Date().toISOString(), findings: parseFindings(Buffer.concat(chunks).toString("utf8")) };
    writeFileSync(join(dir, `${String(tick).padStart(6, "0")}.json`), `${JSON.stringify(event, null, 2)}\n`);
    console.log(`drift-ledger: tick ${String(tick)} recorded, ${String(event.findings.length)} finding(s)`);
    process.exit(0);
  });
}
