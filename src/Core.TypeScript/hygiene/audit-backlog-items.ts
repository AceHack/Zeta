#!/usr/bin/env bun
// audit-backlog-items.ts -- survey backlog rows for state, broken edges,
// orphans, blocked rows, and merged-but-unclosed candidates.
//
// TypeScript+Bun port of audit-backlog-items.sh, per Aaron's just-landed
// Rule 0 in CLAUDE.md ("no more .sh files except install-graph; TS IS
// cross-platform DST"). Same first-run output shape (markdown sections per
// audit class).
//
// Aaron 2026-05-05: "not just lost files all the trjaectoris and backlog
// tiems" -- extending the audit pattern from "where files go to die" to
// "where backlog rows go to die."
//
// Composes with the typed-edge graph in
// memory/feedback_decision_graph_emergent_from_archaeologies_and_flywheel_aaron_2026_05_03.md
// (depends_on / composes_with / supersedes / etc.) -- this script makes the
// graph state observable: orphan rows, broken edges, top blocked rows.
//
// Pattern reference: tools/github/poll-pr-gate.ts. All shell-out via
// Bun.spawn with explicit argv arrays (no shell expansion, no pipe parsing).
//
// What it audits:
//   1. Per-tier counts (P0/P1/P2/P3) with status breakdown
//   2. Aging open rows by tier (>30 / >60 / >90 days from `created:`)
//   3. Broken depends_on pointers (B-NNNN refs that don't exist)
//   4. Broken composes_with pointers (B-NNNN refs that don't exist)
//   5. Orphan rows (no incoming depends_on or composes_with from anyone)
//   6. Top-10 most-blocked rows (rows whose depends_on chain blocks the most
//      downstream rows)
//   7. Unclosed-but-merged rows (head-keyword matches recent merged-PR title)
//   8. Duplicate IDs (multiple files claiming the same `id: B-NNNN`) —
//      factory-wide uniqueness violation per src/Core.TypeScript/backlog/README.md.
//      Surfaced 2026-05-14 (Copilot caught two files claiming 081KR2E4K0008QG0R001F0YB5S on
//      PR #3247; PR #3249 added this audit class).
//   9. Parent-child status mismatch — parent declares `status: closed`
//      while a declared `child` is still `status: open`. Surfaced 2026-
//      05-15 (PR #3518 closed 081KRFA460008QG0R00061SXRW without closing children 081KRHWGX0008QG0R000PVB6FF +
//      081KRHWGX0008QG0R002C038BJ; 081KRMEXM0008QG0R003FZNK3E row + this audit class capture the failure mode).
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-backlog-items.ts                            # detect-only
//   bun src/Core.TypeScript/hygiene/audit-backlog-items.ts --enforce-duplicate-ids
//       # exit non-zero on duplicate-ID groups (081KRMEXM0008QG0R000HHAG77 CI gate)
//   bun src/Core.TypeScript/hygiene/audit-backlog-items.ts --enforce-parent-child-status
//       # exit non-zero on parent-child status-mismatch groups (081KRMEXM0008QG0R003FZNK3E CI gate)
//
// Exit codes:
//   0 -- survey ran (findings reported in body); detect-only mode
//   1 -- fatal invocation error (e.g., backlog dir missing) OR
//        duplicate-ID groups found AND --enforce-duplicate-ids set OR
//        parent-child mismatch groups found AND --enforce-parent-child-status set

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..", "..");
const REPO = process.env.REPO ?? "Lucent-Financial-Group/Zeta";
const BACKLOG_ROOT = join(REPO_ROOT, "docs", "backlog");

interface SpawnResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

async function runCmd(
  cmd: readonly string[],
  cwd: string = REPO_ROOT,
): Promise<SpawnResult> {
  const proc = Bun.spawn({
    cmd: [...cmd],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}

async function hasCommand(name: string): Promise<boolean> {
  // Use Bun.which (cross-platform: scans PATH and PATHEXT on Windows)
  // instead of shelling out to `which`, which is not portable. This also
  // avoids Bun.spawn throwing when `which` is itself absent.
  return Bun.which(name) !== null;
}

function nowIso(): string {
  const d = new Date();
  return `${d.toISOString().slice(0, 16)}Z`;
}

interface BacklogRow {
  readonly tier: string;
  readonly id: string;
  readonly path: string;
  readonly status: string;
  readonly created: string;
  readonly title: string;
  readonly childrenRefs: readonly string[];
}

interface FrontmatterFields {
  readonly id?: string;
  readonly status?: string;
  readonly created?: string;
  readonly title?: string;
  readonly dependsOnRefs: readonly string[];
  readonly composesWithRefs: readonly string[];
  readonly childrenRefs: readonly string[];
}

const B_REF_RE = /B-\d{4}(?:\.\d+)*/g;

function parseFrontmatter(text: string): FrontmatterFields {
  const lines = text.split("\n");
  let inFm = false;
  let dashCount = 0;
  const fmLines: string[] = [];
  for (const line of lines) {
    if (/^---\s*$/.test(line)) {
      dashCount++;
      if (dashCount === 1) {
        inFm = true;
        continue;
      } else {
        break;
      }
    }
    if (inFm) fmLines.push(line);
  }

  const getScalar = (field: string): string | undefined => {
    const re = new RegExp(`^${field}:\\s*(.*)$`);
    for (const l of fmLines) {
      const m = re.exec(l);
      if (m) {
        return (m[1] ?? "").trim().replace(/^["']|["']$/g, "");
      }
    }
    return undefined;
  };

  const getListRefs = (field: string): string[] => {
    let inField = false;
    const collected: string[] = [];
    for (const l of fmLines) {
      const startRe = new RegExp(`^${field}:(.*)$`);
      const m = startRe.exec(l);
      if (m) {
        inField = true;
        const tail = (m[1] ?? "").trim();
        if (tail.length > 0) {
          collected.push(tail);
          if (tail.includes("]")) {
            inField = false;
          }
        }
        continue;
      }
      if (inField) {
        if (/^[a-zA-Z_]+:/.test(l)) {
          inField = false;
          continue;
        }
        collected.push(l);
      }
    }
    const joined = collected.join("\n");
    const refs = new Set<string>();
    for (const m of joined.matchAll(B_REF_RE)) {
      refs.add(m[0]);
    }
    return [...refs].sort();
  };

  // Build with conditional spread so `exactOptionalPropertyTypes: true`
  // doesn't reject explicit-undefined assignments to optional fields.
  const id = getScalar("id");
  const status = getScalar("status");
  const created = getScalar("created");
  const title = getScalar("title");
  return {
    ...(id !== undefined ? { id } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(created !== undefined ? { created } : {}),
    ...(title !== undefined ? { title } : {}),
    dependsOnRefs: getListRefs("depends_on"),
    composesWithRefs: getListRefs("composes_with"),
    childrenRefs: getListRefs("children"),
  };
}

function loadBacklog(): BacklogRow[] {
  const rows: BacklogRow[] = [];
  if (!existsSync(BACKLOG_ROOT)) return rows;
  const tiers = ["P0", "P1", "P2", "P3"];
  for (const tier of tiers) {
    const tierDir = join(BACKLOG_ROOT, tier);
    if (!existsSync(tierDir)) continue;
    let entries: string[] = [];
    try {
      entries = readdirSync(tierDir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!/^B-\d{4}.*\.md$/.test(name)) continue;
      const full = join(tierDir, name);
      // CodeQL js/file-system-race: stat-then-read introduces a TOCTOU
      // window. Skip the precheck and let readFileSync surface ENOENT /
      // EISDIR via its own error -- a single syscall is race-free.
      let text = "";
      try {
        text = readFileSync(full, "utf8");
      } catch {
        continue;
      }
      const fm = parseFrontmatter(text);
      let id = fm.id;
      if (id === undefined || id.length === 0) {
        const m = /^B-\d{4}/.exec(name);
        if (m) id = m[0];
      }
      if (id === undefined || id.length === 0) continue;
      rows.push({
        tier,
        id,
        path: full,
        status: fm.status ?? "unknown",
        created: fm.created ?? "unknown",
        title: fm.title ?? "(no title)",
        childrenRefs: fm.childrenRefs,
      });
    }
  }
  return rows;
}

const CLOSED_STATUSES = new Set([
  "closed",
  "landed",
  "superseded",
  "merged",
  "done",
]);

function toEpoch(d: string): number | null {
  if (d.length === 0 || d === "unknown") return null;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!ymd) return null;
  const iso = `${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00Z`;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor(t / 1000);
}

function tierStatusBreakdown(rows: readonly BacklogRow[]): void {
  console.log("## 1. Per-tier counts + status breakdown");
  console.log("");
  const tiers = ["P0", "P1", "P2", "P3"];
  let total = 0;
  for (const tier of tiers) {
    const tierRows = rows.filter((r) => r.tier === tier);
    console.log(`### ${tier} (${tierRows.length} rows)`);
    if (tierRows.length > 0) {
      const counts = new Map<string, number>();
      for (const r of tierRows) {
        counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
      }
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      for (const [status, count] of sorted) {
        console.log(`  - ${status}: ${count}`);
      }
    }
    total += tierRows.length;
    console.log("");
  }
  console.log(`**Total rows: ${total}**`);
  console.log("");
}

interface AgedRow {
  readonly tier: string;
  readonly id: string;
  readonly status: string;
  readonly ageDays: number;
  readonly created: string;
  readonly title: string;
}

function buildAgedRows(rows: readonly BacklogRow[], nowEpoch: number): AgedRow[] {
  const aged: AgedRow[] = [];
  for (const r of rows) {
    if (CLOSED_STATUSES.has(r.status)) continue;
    const ep = toEpoch(r.created);
    if (ep === null) continue;
    const ageDays = Math.floor((nowEpoch - ep) / 86400);
    aged.push({
      tier: r.tier,
      id: r.id,
      status: r.status,
      ageDays,
      created: r.created,
      title: r.title,
    });
  }
  return aged;
}

function reportAging(aged: readonly AgedRow[]): void {
  console.log(
    "## 2. Aging open rows by tier (status open and not closed/landed/superseded)",
  );
  console.log("");
  for (const bucket of [30, 60, 90]) {
    console.log(`### Open rows older than ${bucket} days`);
    const matches = aged.filter((a) => a.ageDays > bucket);
    console.log(`  Count: ${matches.length}`);
    const lines = matches
      .map(
        (a) =>
          `  - [${a.tier}][${a.id}] ${a.created} (${a.ageDays}d, status=${a.status})`,
      )
      .sort();
    for (const l of lines.slice(0, 20)) console.log(l);
    console.log("");
  }
}

interface Edges {
  readonly depends: ReadonlyArray<readonly [string, string]>;
  readonly composes: ReadonlyArray<readonly [string, string]>;
}

function reportBrokenEdges(rows: readonly BacklogRow[]): Edges {
  const allIds = new Set(rows.map((r) => r.id));
  const dependsEdges: Array<[string, string]> = [];
  const composesEdges: Array<[string, string]> = [];

  console.log("## 3. Broken depends_on pointers");
  console.log("");
  let brokenDepends = 0;
  for (const r of rows) {
    let text = "";
    try {
      text = readFileSync(r.path, "utf8");
    } catch {
      continue;
    }
    const fm = parseFrontmatter(text);
    for (const ref of fm.dependsOnRefs) {
      dependsEdges.push([r.id, ref]);
      if (!allIds.has(ref)) {
        console.log(`  - ${r.id} [${r.tier}] depends_on missing ${ref}`);
        brokenDepends++;
      }
    }
    for (const ref of fm.composesWithRefs) {
      composesEdges.push([r.id, ref]);
    }
  }
  console.log("");
  console.log(`**Broken depends_on edges: ${brokenDepends}**`);
  console.log("");

  console.log("## 4. Broken composes_with pointers");
  console.log("");
  let brokenComposes = 0;
  for (const [src, ref] of composesEdges) {
    if (!allIds.has(ref)) {
      const srcRow = rows.find((r) => r.id === src);
      const tier = srcRow?.tier ?? "?";
      console.log(`  - ${src} [${tier}] composes_with missing ${ref}`);
      brokenComposes++;
    }
  }
  console.log("");
  console.log(`**Broken composes_with edges: ${brokenComposes}**`);
  console.log("(Note: composes_with also accepts non-B refs -- skill/memory/doc paths;");
  console.log(" only B-NNNN refs are checked here.)");
  console.log("");

  return { depends: dependsEdges, composes: composesEdges };
}

function reportOrphans(rows: readonly BacklogRow[], edges: Edges): number {
  console.log(
    "## 5. Orphan rows (no incoming depends_on or composes_with from any other row)",
  );
  console.log("");
  const incoming = new Set<string>();
  for (const [, target] of edges.depends) incoming.add(target);
  for (const [, target] of edges.composes) incoming.add(target);
  const orphans = rows.filter((r) => !incoming.has(r.id));
  console.log(`**Orphan rows: ${orphans.length}**`);
  if (orphans.length > 0) {
    console.log("");
    console.log("Sample (first 20):");
    for (const o of orphans.slice(0, 20)) {
      console.log(`  - ${o.id}: ${o.tier}\t${o.status}\t${o.title}`);
    }
  }
  console.log("");
  return orphans.length;
}

function reportTopBlocked(rows: readonly BacklogRow[], edges: Edges): void {
  console.log(
    "## 6. Top-10 most-blocked rows (direct downstream dependents via depends_on)",
  );
  console.log("");
  if (edges.depends.length === 0) {
    console.log("  (no depends_on edges in backlog)");
    console.log("");
    return;
  }
  const counts = new Map<string, number>();
  for (const [, target] of edges.depends) {
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [target, cnt] of ranked) {
    const row = rows.find((r) => r.id === target);
    const detail =
      row !== undefined
        ? `${row.tier}\t${row.status}\t${row.title}`
        : "(target id not found in current rows)";
    console.log(`  - ${target} blocks ${cnt} direct downstream: ${detail}`);
  }
  console.log("");
}

interface MergedPR {
  readonly number: number;
  readonly title: string;
}

const STOPWORDS = new Set([
  "rewrite",
  "review",
  "update",
  "create",
  "enable",
  "backlog",
  "memory",
  "across",
  "using",
  "after",
  "before",
  "where",
  "which",
  "while",
  "their",
  "there",
  "other",
  "maintainer",
  "aaron",
  "otto",
  "amara",
]);

function headKeywords(title: string): string[] {
  const lower = title.toLowerCase();
  const cleaned = lower.replace(/[^a-z0-9]+/g, " ");
  const tokens = cleaned
    .split(/\s+/)
    .filter((t) => t.length >= 5 && !STOPWORDS.has(t));
  return tokens.slice(0, 3);
}

async function reportMergedCandidates(
  rows: readonly BacklogRow[],
  ghAvailable: boolean,
): Promise<void> {
  console.log(
    "## 7. Unclosed-but-merged rows (head-keyword matches recent merged-PR title; heuristic)",
  );
  console.log("");
  if (!ghAvailable) {
    console.log("SKIP: gh CLI not available");
    console.log("");
    return;
  }
  const r = await runCmd([
    "gh",
    "pr",
    "list",
    "--repo",
    REPO,
    "--state",
    "merged",
    "--limit",
    "200",
    "--json",
    "number,title",
  ]);
  // Per PR #1702 review 2026-05-06: never silently swallow
  // a non-zero exit. A failed gh call would otherwise scan zero PRs
  // and report no candidates -- identical to genuine cleanliness --
  // hiding auth/network breakage. Surface the failure as a SKIP.
  if (r.exitCode !== 0) {
    console.log(
      `SKIP: gh pr list (merged) exited ${r.exitCode}; merged-candidate scan unreliable. stderr: ${r.stderr.trim()}`,
    );
    console.log("");
    return;
  }
  let prs: MergedPR[] = [];
  try {
    prs = JSON.parse(r.stdout || "[]") as MergedPR[];
  } catch {
    prs = [];
  }
  console.log(`Scanned ${prs.length} merged PR titles.`);
  if (prs.length === 0) {
    console.log("");
    return;
  }
  const open = rows.filter((r2) => !CLOSED_STATUSES.has(r2.status));
  const candidates: string[] = [];
  for (const row of open) {
    const kws = headKeywords(row.title);
    if (kws.length < 2) continue;
    let matched: MergedPR | undefined;
    for (const pr of prs) {
      const lt = pr.title.toLowerCase();
      let ok = true;
      for (const k of kws) {
        if (!lt.includes(k)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        matched = pr;
        break;
      }
    }
    if (matched !== undefined) {
      candidates.push(
        `  - ${row.id} [${row.tier}] status=${row.status} -- candidate match: PR #${matched.number}`,
      );
      candidates.push(`      row title: ${row.title}`);
      candidates.push(`      pr  title: ${matched.title}`);
    }
  }
  for (const c of candidates.slice(0, 60)) console.log(c);
  console.log("");
  console.log(
    "(Heuristic: 3 head-keywords of >=5 chars must all appear in PR title.",
  );
  console.log(" False positives expected; manual review required before closing rows.)");
  console.log("");
}

function reportDuplicateIds(rows: readonly BacklogRow[]): number {
  console.log(
    "## 8. Duplicate IDs (factory-wide uniqueness violation)",
  );
  console.log("");
  const byId = new Map<string, BacklogRow[]>();
  for (const r of rows) {
    const list = byId.get(r.id);
    if (list === undefined) {
      byId.set(r.id, [r]);
    } else {
      list.push(r);
    }
  }
  const duplicates: Array<readonly [string, readonly BacklogRow[]]> = [];
  for (const [id, list] of byId) {
    if (list.length > 1) duplicates.push([id, list]);
  }
  duplicates.sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`**Duplicate-ID groups: ${duplicates.length}**`);
  if (duplicates.length > 0) {
    console.log("");
    for (const [id, list] of duplicates) {
      console.log(`### ${id} (${list.length} files claim this ID)`);
      for (const r of list) {
        console.log(
          `  - ${r.path} (tier=${r.tier}, status=${r.status})`,
        );
      }
      console.log("");
    }
    console.log(
      "Resolution: renumber all-but-one of the colliding files to the next",
    );
    console.log(
      "available B-NNNN ID; update frontmatter `id:`, body heading, and add a",
    );
    console.log(
      "`renumbered_from:` breadcrumb. Per src/Core.TypeScript/backlog/README.md, backlog",
    );
    console.log(
      "IDs must be factory-wide unique so edge references resolve unambiguously.",
    );
  }
  console.log("");
  return duplicates.length;
}

interface ParentChildMismatch {
  readonly parentId: string;
  readonly parentPath: string;
  readonly parentStatus: string;
  readonly openChildren: ReadonlyArray<{ readonly id: string; readonly status: string; readonly path: string }>;
}

function isClosedStatus(status: string): boolean {
  return CLOSED_STATUSES.has(status) || status.startsWith("superseded-by-");
}

function reportParentChildStatusMismatch(rows: readonly BacklogRow[]): number {
  console.log("## 9. Parent-child status mismatch (081KRMEXM0008QG0R003FZNK3E)");
  console.log("");

  const byId = new Map<string, BacklogRow>();
  for (const r of rows) byId.set(r.id, r);

  const mismatches: ParentChildMismatch[] = [];
  for (const parent of rows) {
    if (!isClosedStatus(parent.status)) continue;
    if (parent.childrenRefs.length === 0) continue;
    const openChildren: Array<{ id: string; status: string; path: string }> = [];
    for (const childRef of parent.childrenRefs) {
      const child = byId.get(childRef);
      if (child === undefined) continue;
      if (!isClosedStatus(child.status)) {
        openChildren.push({ id: child.id, status: child.status, path: child.path });
      }
    }
    if (openChildren.length > 0) {
      mismatches.push({
        parentId: parent.id,
        parentPath: parent.path,
        parentStatus: parent.status,
        openChildren,
      });
    }
  }

  mismatches.sort((a, b) => a.parentId.localeCompare(b.parentId));
  console.log(`**Parent-child status-mismatch groups: ${mismatches.length}**`);
  if (mismatches.length > 0) {
    console.log("");
    console.log("Closed parent row(s) with open child row(s) — graph inconsistency.");
    console.log("");
    for (const m of mismatches) {
      console.log(`- \`${m.parentId}\` (\`${m.parentStatus}\`) has open children:`);
      for (const c of m.openChildren) {
        console.log(`  - \`${c.id}\` (\`${c.status}\`)`);
      }
    }
    console.log("");
    console.log("Either:");
    console.log("- Close the open children if their work has landed, OR");
    console.log("- Re-open the parent if the children represent unfinished work, OR");
    console.log("- Remove the child refs from the parent's `children:` if they no longer apply");
  }
  console.log("");
  return mismatches.length;
}

async function main(): Promise<number> {
  if (!existsSync(BACKLOG_ROOT)) {
    process.stderr.write(`ERROR: ${BACKLOG_ROOT} not found\n`);
    return 1;
  }

  const argv = process.argv.slice(2);
  const enforceDuplicateIds = argv.includes("--enforce-duplicate-ids");
  const enforceParentChildStatus = argv.includes("--enforce-parent-child-status");
  for (const arg of argv) {
    if (arg !== "--enforce-duplicate-ids" && arg !== "--enforce-parent-child-status") {
      process.stderr.write(`error: unknown argument: ${arg}\n`);
      return 1;
    }
  }

  const today = nowIso();
  const nowEpoch = Math.floor(Date.now() / 1000);

  console.log(`# Backlog-items audit (${today})`);
  console.log("");
  console.log(`Repo: ${REPO_ROOT}`);
  console.log("Backlog root: docs/backlog/");
  console.log("");

  const rows = loadBacklog();
  const totalRows = rows.length;

  tierStatusBreakdown(rows);

  const aged = buildAgedRows(rows, nowEpoch);
  reportAging(aged);

  const edges = reportBrokenEdges(rows);

  const allIds = new Set(rows.map((r) => r.id));
  let brokenDepends = 0;
  let brokenComposes = 0;
  for (const [, ref] of edges.depends) if (!allIds.has(ref)) brokenDepends++;
  for (const [, ref] of edges.composes) if (!allIds.has(ref)) brokenComposes++;

  const orphanCount = reportOrphans(rows, edges);
  reportTopBlocked(rows, edges);

  const ghAvailable = await hasCommand("gh");
  await reportMergedCandidates(rows, ghAvailable);

  const duplicateIdGroups = reportDuplicateIds(rows);

  const parentChildMismatches = reportParentChildStatusMismatch(rows);

  console.log("## Summary");
  console.log("");
  console.log(`  - Total backlog rows: ${totalRows}`);
  console.log(`  - Broken depends_on edges: ${brokenDepends}`);
  console.log(
    `  - Broken composes_with edges (B-NNNN refs only): ${brokenComposes}`,
  );
  console.log(`  - Orphan rows (no incoming graph edge): ${orphanCount}`);
  console.log(`  - Duplicate-ID groups: ${duplicateIdGroups}`);
  console.log(`  - Parent-child status-mismatch groups: ${parentChildMismatches}`);
  console.log("");
  console.log(
    "Composes with: src/Core.TypeScript/hygiene/audit-lost-files.ts (sibling pattern),",
  );
  console.log(
    "  memory/feedback_decision_graph_emergent_from_archaeologies_and_flywheel_aaron_2026_05_03.md",
  );
  console.log("  (typed-edge backlog graph).");

  if (enforceDuplicateIds && duplicateIdGroups > 0) {
    process.stderr.write(
      `\nerror: ${duplicateIdGroups} duplicate-ID group(s) found; --enforce-duplicate-ids set (081KRMEXM0008QG0R000HHAG77 gate)\n`,
    );
    return 1;
  }

  if (enforceParentChildStatus && parentChildMismatches > 0) {
    process.stderr.write(
      `\nerror: ${parentChildMismatches} parent-child status-mismatch group(s) found; --enforce-parent-child-status set (081KRMEXM0008QG0R003FZNK3E gate)\n`,
    );
    return 1;
  }

  return 0;
}

if (import.meta.main) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(
        `fatal: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(1);
    },
  );
}
