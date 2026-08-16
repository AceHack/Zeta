#!/usr/bin/env bun
// context-cost-trend.ts — the persisted DORA trend store for context-window cost
// (081KT7YW00008QG0R002T1XNWT over-time leg). `--check`/`--kpi` in context-cost.ts are point-in-time;
// this APPENDS each measurement to an append-only series so drift over TIME is
// visible — the DORA cost trend.
//
// APPEND-ONLY / lightlike (substrate discipline): records are never rewritten;
// the past is immutable, drift shows as new rows. The store is DATA, not a
// cold-boot surface, so it does not add to the cost it measures. NCI: records only.
//
//   --record  measure now + append one row per harness to the trend JSONL.
//   default   read the trend + report direction (growing / shrinking / stable).
import { Glob } from "bun";
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { stringCompare } from "../collation/collation";
import { MANIFESTS, measureHarness } from "./context-cost";
import { estimateTokens } from "./token-calibration";

export interface TrendRecord {
  readonly ts: string; // ISO date-time
  readonly harness: string;
  readonly bytes: number;
  readonly estTokens: number;
}

export interface TrendVerdict {
  readonly harness: string;
  readonly n: number;
  readonly firstBytes: number;
  readonly latestBytes: number;
  readonly delta: number;
  readonly pctChange: number;
  readonly direction: "growing" | "shrinking" | "stable";
}

/** Analyze one harness's series (chronological). Pure. stable = |%| < 1%. */
export function analyzeTrend(records: readonly TrendRecord[]): TrendVerdict | null {
  if (records.length === 0) return null;
  const sorted = [...records].sort((a, b) => stringCompare(a.ts, b.ts));
  const first = sorted[0]!.bytes;
  const latest = sorted[sorted.length - 1]!.bytes;
  const delta = latest - first;
  const pctChange = first === 0 ? 0 : (delta / first) * 100;
  const direction = Math.abs(pctChange) < 1 ? "stable" : delta > 0 ? "growing" : "shrinking";
  return { harness: sorted[0]!.harness, n: sorted.length, firstBytes: first, latestBytes: latest, delta, pctChange, direction };
}

/** Group flat records by harness (pure). */
export function byHarness(records: readonly TrendRecord[]): Map<string, TrendRecord[]> {
  const m = new Map<string, TrendRecord[]>();
  for (const r of records) (m.get(r.harness) ?? m.set(r.harness, []).get(r.harness)!).push(r);
  return m;
}

// ── CLI (I/O at the edge) ────────────────────────────────────────────────────
const STORE = "src/Core.TypeScript/observe/context-cost-trend.jsonl";

function measureNow(): Array<{ harness: string; bytes: number }> {
  return MANIFESTS.map((m) => {
    const files = m.surfaces.flatMap((s) => {
      const paths = s.glob.includes("*")
        ? [...new Glob(s.glob).scanSync({ cwd: ".", dot: true })]
        : existsSync(s.glob)
          ? [s.glob]
          : [];
      return paths.sort().map((p) => ({ path: p, text: readFileSync(p, "utf8"), mode: s.mode }));
    });
    // Record RESIDENT cold-boot bytes (what actually loads at startup).
    return { harness: m.harness, bytes: measureHarness(m.harness, files).resident.bytes };
  });
}

function readStore(): TrendRecord[] {
  if (!existsSync(STORE)) return [];
  return readFileSync(STORE, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as TrendRecord);
}

if (import.meta.main) {
  const args = new Set(Bun.argv.slice(2));

  if (args.has("--record")) {
    const cal = JSON.parse(readFileSync("src/Core.TypeScript/observe/token-calibration.json", "utf8")) as { bytesPerToken: number };
    const ts = new Date().toISOString();
    const rows = measureNow().map(
      (m): TrendRecord => ({ ts, harness: m.harness, bytes: m.bytes, estTokens: Math.round(estimateTokens(m.bytes, cal.bytesPerToken)) }),
    );
    appendFileSync(STORE, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    console.log(`recorded ${rows.length} row(s) @ ${ts}: ${rows.map((r) => `${r.harness}=${r.bytes}B/${r.estTokens}t`).join(" ")}`);
    process.exit(0);
  }

  const records = readStore();
  if (records.length === 0) {
    console.log("context-cost trend: empty — run --record (ideally on a cron) to start the series.");
    process.exit(0);
  }
  console.log(`context-cost trend: ${records.length} records over ${new Set(records.map((r) => r.harness)).size} harness(es)`);
  for (const [harness, recs] of byHarness(records)) {
    const v = analyzeTrend(recs)!;
    const arrow = v.direction === "growing" ? "↑" : v.direction === "shrinking" ? "↓" : "→";
    const sign = v.delta >= 0 ? "+" : "";
    console.log(`  ${arrow} ${harness}: ${v.firstBytes}B → ${v.latestBytes}B (${sign}${v.delta}B, ${sign}${v.pctChange.toFixed(1)}%, ${v.n} samples) ${v.direction}`);
  }
  process.exit(0);
}
