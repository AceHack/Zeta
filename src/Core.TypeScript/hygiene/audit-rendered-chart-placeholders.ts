#!/usr/bin/env bun
// audit-rendered-chart-placeholders.ts - the half of the placeholder check that needs HELM.
//
// lint-rendered-manifest-placeholders.ts scans what is IN GIT. A remote chart's defaults are not in
// git: they arrive when helm renders, so a chart that ships `git.example.com` as its default
// hostname is invisible to a file scan and applied on every install. MEASURED 2026-10-01 on Forgejo
// 17.1.5 (code.forgejo.org/forgejo-helm): the chart renders
//
//     DOMAIN=git.example.com   ROOT_URL=http://git.example.com   SSH_DOMAIN=git.example.com
//
// into app.ini, and nothing in this repo set any of them. This renders every Application (the same
// renderer the render-determinism and storage-claim censuses use) and scans the RENDERED objects with
// the SAME patterns, with the same discipline: a finding that is not baselined WITH an owner and a
// reason fails, and a baselined entry that no longer matches fails too (STALE).
//
// WHAT IT NEEDS: helm on PATH and the network the renderer already uses. An app that could not be
// rendered is reported by name and is NEVER counted as clean - a check that did not run is not a pass
// (exit 2 when nothing could be measured at all).
//
// RUN:  bun src/Core.TypeScript/hygiene/audit-rendered-chart-placeholders.ts [--write-baseline]

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { discoverApplications, renderApplication } from "../cluster/rendered-storage-claims.ts";
import { documentKey } from "../cluster/chart-render-determinism.ts";
import { scanDocs } from "./lint-rendered-manifest-placeholders.ts";

export const BASELINE_PATH = "src/Core.TypeScript/hygiene/rendered-chart-placeholders.baseline.json";

export interface ChartFinding {
  readonly app: string;
  readonly document: string;
  readonly path: string;
  readonly pattern: string;
  readonly excerpt: string;
}

export interface BaselineEntry {
  readonly app: string;
  readonly document: string;
  readonly path: string;
  readonly pattern: string;
  readonly owner: string;
  readonly reason: string;
}

const keyOf = (f: { app: string; document: string; path: string; pattern: string }) =>
  `${f.app}\t${f.document}\t${f.path}\t${f.pattern}`;

/**
 * A document's stable identity. Some charts name a Job after a hash of their own values
 * (`gitlab-shared-secrets-1328cc1-selfsign`), so the raw name changes whenever a value or the chart
 * does and a baseline keyed on it would churn for the very reason it exists to record. A 6-8 digit
 * hex segment is replaced by `*` - the same discipline chart-render-determinism applies to random
 * suffixes.
 */
export function stableDocumentKey(doc: Record<string, unknown>): string {
  return documentKey(doc).replace(/-[0-9a-f]{6,8}(?=-|$)/g, "-*");
}

/** Scan one app's rendered documents. Pure. */
export function scanRendered(app: string, documents: readonly Record<string, unknown>[]): ChartFinding[] {
  const out: ChartFinding[] = [];
  for (const doc of documents) {
    const document = stableDocumentKey(doc);
    for (const f of scanDocs([doc], app)) out.push({ app, document, path: f.path, pattern: f.pattern, excerpt: f.excerpt });
  }
  return out;
}

export interface ChartAudit {
  readonly unexpected: readonly ChartFinding[];
  readonly stale: readonly BaselineEntry[];
  readonly reasonless: readonly BaselineEntry[];
  readonly unmeasured: ReadonlyArray<{ app: string; detail: string }>;
  readonly measured: number;
}

export function compare(
  findings: readonly ChartFinding[],
  baseline: readonly BaselineEntry[],
  measuredApps: ReadonlySet<string>,
): Pick<ChartAudit, "unexpected" | "stale" | "reasonless"> {
  const known = new Set(baseline.map(keyOf));
  const seen = new Set(findings.map(keyOf));
  return {
    unexpected: findings.filter((f) => !known.has(keyOf(f))),
    // An entry for an app that was NOT measured this run is not stale - it is unknown.
    stale: baseline.filter((b) => measuredApps.has(b.app) && !seen.has(keyOf(b))),
    reasonless: baseline.filter((b) => b.reason.trim().length < 20 || b.owner.trim().length === 0),
  };
}

export function loadBaseline(repoRoot: string): BaselineEntry[] {
  try {
    return (JSON.parse(readFileSync(resolve(repoRoot, BASELINE_PATH), "utf8")) as { entries: BaselineEntry[] }).entries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export function run(repoRoot: string): { findings: ChartFinding[]; unmeasured: Array<{ app: string; detail: string }>; measuredApps: Set<string> } {
  const findings: ChartFinding[] = [];
  const unmeasured: Array<{ app: string; detail: string }> = [];
  const measuredApps = new Set<string>();
  for (const app of discoverApplications(repoRoot)) {
    const r = renderApplication(app, { repoRoot });
    if (!r.ok) {
      unmeasured.push({ app: app.appId, detail: `${r.reason}: ${r.detail.trim() === "" ? "(no detail)" : r.detail}` });
      continue;
    }
    measuredApps.add(app.appId);
    findings.push(...scanRendered(app.appId, r.documents));
  }
  return { findings, unmeasured, measuredApps };
}

function main(): number {
  const repoRoot = resolve(process.cwd());
  const { findings, unmeasured, measuredApps } = run(repoRoot);
  if (measuredApps.size === 0) {
    console.error("audit-rendered-chart-placeholders: rendered NOTHING (helm/network?). A check that did not run is not a pass.");
    return 2;
  }
  if (process.argv.includes("--write-baseline")) {
    const existing = new Map(loadBaseline(repoRoot).map((e) => [keyOf(e), e]));
    const entries = findings.map(
      (f): BaselineEntry =>
        existing.get(keyOf(f)) ?? { app: f.app, document: f.document, path: f.path, pattern: f.pattern, owner: "UNASSIGNED", reason: "UNADJUDICATED - fill in why this is acceptable or fix it" },
    );
    writeFileSync(resolve(repoRoot, BASELINE_PATH), JSON.stringify({ entries }, null, 2) + "\n");
    console.log(`wrote ${entries.length} entries to ${BASELINE_PATH} - adjudicate every UNASSIGNED one before committing.`);
    return 0;
  }
  const a = compare(findings, loadBaseline(repoRoot), measuredApps);
  let bad = 0;
  for (const f of a.unexpected) {
    bad++;
    console.error(`PLACEHOLDER  ${f.app} ${f.document} ${f.path} [${f.pattern}] ...${f.excerpt}...`);
  }
  for (const e of a.stale) {
    bad++;
    console.error(`STALE        ${e.app} ${e.document} ${e.path} [${e.pattern}] no longer renders - remove the baseline entry`);
  }
  for (const e of a.reasonless) {
    bad++;
    console.error(`NO REASON    ${e.app} ${e.document} ${e.path}: a baseline entry needs an owner and a reason`);
  }
  for (const u of unmeasured) console.error(`UNMEASURED   ${u.app}: ${u.detail}  (NOT counted as clean)`);
  console.log(`rendered-chart placeholders: ${measuredApps.size} app(s) rendered, ${unmeasured.length} unmeasured, ${bad} problem(s).`);
  return bad === 0 ? 0 : 1;
}

if (import.meta.main) process.exit(main());
