#!/usr/bin/env bun
// audit-promotion-ledger.ts -- validate memory/promotion-ledger.jsonl,
// project current-state per id by latest transition, and surface validation
// failures + actionable items.
//
// Origin: Vera 2026-05-05 twin-flame thread (codex-side). Canonical home for
// the 4-state promotion machine (Promoted / Pending-NOW / Pending-LATER /
// Declined) is the JSONL ledger; this validator mechanizes the claim-check
// (composes with 081KQNJ500008QG0R003SCWBDV substrate-claim-checker).
//
// TypeScript+Bun only per CLAUDE.md Rule 0 (no .sh except install-graph;
// TS IS cross-platform DST).
//
// Pattern reference: src/Core.TypeScript/hygiene/audit-backlog-items.ts +
// tools/github/poll-pr-gate.ts. Markdown output, structured JSON-friendly
// counters, exit codes for CI mechanization.
//
// Validations:
//   1. Schema-doc on line 1 (kind=="schema-doc").
//   2. Per-line schema: required fields present + enum values valid.
//   3. Promoted-state entries: operational_artifact path must exist
//      on disk OR be a URL (URL not deep-fetched; existence-on-disk is
//      the only mechanizable check today).
//   4. Declined-state entries: wont_do_pointer must reference an existing
//      file AND that file (docs/WONT-DO.md) must contain the pointer's
//      anchor / id substring.
//   5. Impossible-move warnings: Declined -> Promoted without an
//      intermediate re-open transition (Pending-NOW or Pending-LATER) is
//      surfaced as a WARNING (not a hard fail; the ledger is append-only
//      and human can append a re-open transition retroactively).
//
// Output: markdown report on stdout with sections:
//   - Header (timestamp, ledger path, transition count)
//   - Schema-doc summary
//   - Current-state projection (latest transition per id)
//   - Validation failures (Promoted artifact-missing; Declined pointer-broken;
//     impossible-move warnings)
//   - Actionable items (one bullet per failure)
//   - Summary counts
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-promotion-ledger.ts
//
// Exit codes:
//   0 -- 0 validation failures (warnings allowed)
//   1 -- >=1 validation failures
//   2 -- fatal invocation error (ledger missing or unparseable)

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..", "..");
const LEDGER_PATH = join(REPO_ROOT, "memory", "promotion-ledger.jsonl");
const WONT_DO_PATH = join(REPO_ROOT, "docs", "WONT-DO.md");

const VALID_STATES = new Set([
  "Promoted",
  "Pending-NOW",
  "Pending-LATER",
  "Declined",
]);
const VALID_FROM_STATES = new Set([...VALID_STATES, "(none)"]);
const VALID_ACTORS = new Set(["vera", "otto", "aaron", "amara", "ani"]);

interface SchemaDoc {
  readonly kind: "schema-doc";
  readonly ts: string;
  readonly origin?: string;
  readonly format?: string;
  readonly four_state_machine?: Record<string, string>;
}

interface Transition {
  readonly transition_id: string;
  readonly ts: string;
  readonly id: string;
  readonly from_state: string;
  readonly to_state: string;
  readonly operational_artifact: string | null;
  readonly wont_do_pointer: string | null;
  readonly rationale: string;
  readonly actor: string;
  readonly lineNo: number;
}

interface ParseResult {
  readonly schemaDoc: SchemaDoc | null;
  readonly transitions: readonly Transition[];
  readonly parseFailures: ReadonlyArray<{
    readonly lineNo: number;
    readonly reason: string;
  }>;
}

interface Failure {
  readonly kind:
    | "schema-doc-missing"
    | "schema-violation"
    | "promoted-artifact-missing"
    | "declined-pointer-missing"
    | "declined-pointer-not-in-wont-do";
  readonly lineNo: number;
  readonly id?: string;
  readonly detail: string;
}

interface Warning {
  readonly kind: "impossible-move";
  readonly lineNo: number;
  readonly id: string;
  readonly detail: string;
}

function nowIso(): string {
  return `${new Date().toISOString().slice(0, 16)}Z`;
}

function parseLedger(): ParseResult {
  if (!existsSync(LEDGER_PATH)) {
    return {
      schemaDoc: null,
      transitions: [],
      parseFailures: [
        { lineNo: 0, reason: `ledger file not found: ${LEDGER_PATH}` },
      ],
    };
  }
  const text = readFileSync(LEDGER_PATH, "utf8");
  const rawLines = text.split("\n");
  const transitions: Transition[] = [];
  const parseFailures: Array<{ lineNo: number; reason: string }> = [];
  let schemaDoc: SchemaDoc | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i] ?? "";
    if (line.trim().length === 0) continue;
    const lineNo = i + 1;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      parseFailures.push({
        lineNo,
        reason: `JSON.parse failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }
    if (typeof parsed !== "object" || parsed === null) {
      parseFailures.push({ lineNo, reason: "not a JSON object" });
      continue;
    }
    const obj = parsed as Record<string, unknown>;
    if (obj["kind"] === "schema-doc") {
      if (lineNo !== 1) {
        parseFailures.push({
          lineNo,
          reason: `schema-doc found on line ${lineNo}; expected line 1`,
        });
      } else {
        schemaDoc = obj as unknown as SchemaDoc;
      }
      continue;
    }
    // Transition record validation (presence-only here; enum + cross-field
    // checks happen in validate()).
    const required = [
      "transition_id",
      "ts",
      "id",
      "from_state",
      "to_state",
      "operational_artifact",
      "wont_do_pointer",
      "rationale",
      "actor",
    ] as const;
    const missing = required.filter((k) => !(k in obj));
    if (missing.length > 0) {
      parseFailures.push({
        lineNo,
        reason: `missing required fields: ${missing.join(", ")}`,
      });
      continue;
    }
    transitions.push({
      transition_id: String(obj["transition_id"]),
      ts: String(obj["ts"]),
      id: String(obj["id"]),
      from_state: String(obj["from_state"]),
      to_state: String(obj["to_state"]),
      operational_artifact:
        obj["operational_artifact"] === null
          ? null
          : String(obj["operational_artifact"]),
      wont_do_pointer:
        obj["wont_do_pointer"] === null
          ? null
          : String(obj["wont_do_pointer"]),
      rationale: String(obj["rationale"]),
      actor: String(obj["actor"]),
      lineNo,
    });
  }

  return { schemaDoc, transitions, parseFailures };
}

function resolveRepoPath(p: string): string {
  // Resolve a ledger-recorded path against REPO_ROOT unless absolute.
  // URLs (http:// https://) are NOT resolved -- caller should detect
  // those before calling this helper.
  return isAbsolute(p) ? p : join(REPO_ROOT, p);
}

function isUrl(p: string): boolean {
  return /^https?:\/\//.test(p);
}

function validate(parse: ParseResult): {
  failures: Failure[];
  warnings: Warning[];
} {
  const failures: Failure[] = [];
  const warnings: Warning[] = [];

  if (parse.schemaDoc === null) {
    failures.push({
      kind: "schema-doc-missing",
      lineNo: 1,
      detail: "no kind=\"schema-doc\" record found on line 1",
    });
  }

  // Pre-load WONT-DO.md text once (used for declined-pointer cross-checks).
  let wontDoText: string | null = null;
  if (existsSync(WONT_DO_PATH)) {
    wontDoText = readFileSync(WONT_DO_PATH, "utf8");
  }

  // Sort transitions by ts ascending so impossible-move check sees true order.
  const sortedByTs = [...parse.transitions].sort((a, b) =>
    a.ts.localeCompare(b.ts),
  );

  // Track latest state per id for impossible-move detection.
  const lastStateById = new Map<string, string>();

  // Latest-per-id projection. Filesystem-existence checks (operational_artifact
  // path exists / wont_do_pointer path exists) only run on the latest transition
  // per id -- the append-only ledger uses supersession via new transitions
  // (per Vera 2026-05-06 review): a Promoted row that points at a now-deleted
  // artifact is fine if a later transition has re-anchored or demoted it.
  // Schema-shape and impossible-move checks still run on every transition.
  const latestById = projectCurrentState(parse.transitions);

  for (const t of sortedByTs) {
    // Schema enum violations.
    if (!VALID_FROM_STATES.has(t.from_state)) {
      failures.push({
        kind: "schema-violation",
        lineNo: t.lineNo,
        id: t.id,
        detail: `invalid from_state="${t.from_state}"; must be one of ${[...VALID_FROM_STATES].join(", ")}`,
      });
    }
    if (!VALID_STATES.has(t.to_state)) {
      failures.push({
        kind: "schema-violation",
        lineNo: t.lineNo,
        id: t.id,
        detail: `invalid to_state="${t.to_state}"; must be one of ${[...VALID_STATES].join(", ")}`,
      });
    }
    if (!VALID_ACTORS.has(t.actor)) {
      failures.push({
        kind: "schema-violation",
        lineNo: t.lineNo,
        id: t.id,
        detail: `invalid actor="${t.actor}"; must be one of ${[...VALID_ACTORS].join(", ")}`,
      });
    }

    // Cross-field requirement: Promoted requires operational_artifact.
    if (t.to_state === "Promoted") {
      if (t.operational_artifact === null || t.operational_artifact === "") {
        failures.push({
          kind: "schema-violation",
          lineNo: t.lineNo,
          id: t.id,
          detail: "to_state=Promoted requires non-null operational_artifact",
        });
      } else if (!isUrl(t.operational_artifact) && latestById.get(t.id) === t) {
        // Filesystem-existence check only on the latest-per-id transition.
        // Historical Promoted rows whose artifact has since been deleted/moved
        // are valid as long as a later transition re-anchors or demotes them.
        const full = resolveRepoPath(t.operational_artifact);
        if (!existsSync(full)) {
          failures.push({
            kind: "promoted-artifact-missing",
            lineNo: t.lineNo,
            id: t.id,
            detail: `operational_artifact path does not exist: ${t.operational_artifact} (resolved: ${full})`,
          });
        }
      }
      // URLs are not deep-fetched; presence-of-string is the only check.
    }

    // Cross-field requirement: Declined requires wont_do_pointer.
    if (t.to_state === "Declined") {
      if (t.wont_do_pointer === null || t.wont_do_pointer === "") {
        failures.push({
          kind: "schema-violation",
          lineNo: t.lineNo,
          id: t.id,
          detail: "to_state=Declined requires non-null wont_do_pointer",
        });
      } else if (latestById.get(t.id) === t) {
        // Filesystem-existence check only on the latest-per-id transition
        // (same supersession discipline as Promoted rows, per Vera 2026-05-06).
        // Strip optional #anchor for path-existence check.
        const hashIdx = t.wont_do_pointer.indexOf("#");
        const pathOnly =
          hashIdx >= 0
            ? t.wont_do_pointer.slice(0, hashIdx)
            : t.wont_do_pointer;
        const anchor =
          hashIdx >= 0 ? t.wont_do_pointer.slice(hashIdx + 1) : "";
        const full = resolveRepoPath(pathOnly);
        if (!existsSync(full)) {
          failures.push({
            kind: "declined-pointer-missing",
            lineNo: t.lineNo,
            id: t.id,
            detail: `wont_do_pointer path does not exist: ${pathOnly}`,
          });
        } else if (
          pathOnly.endsWith("WONT-DO.md") &&
          wontDoText !== null &&
          anchor.length > 0 &&
          !wontDoText.includes(anchor) &&
          !wontDoText.includes(t.id)
        ) {
          failures.push({
            kind: "declined-pointer-not-in-wont-do",
            lineNo: t.lineNo,
            id: t.id,
            detail: `WONT-DO.md does not contain anchor="${anchor}" or id="${t.id}"`,
          });
        }
      }
    }

    // Impossible-move warning: Declined -> Promoted without intermediate
    // re-open transition.
    const prev = lastStateById.get(t.id);
    if (
      prev === "Declined" &&
      t.to_state === "Promoted" &&
      t.from_state !== "Pending-NOW" &&
      t.from_state !== "Pending-LATER"
    ) {
      warnings.push({
        kind: "impossible-move",
        lineNo: t.lineNo,
        id: t.id,
        detail: `${t.id}: Declined -> Promoted without intermediate Pending-NOW/Pending-LATER re-open transition`,
      });
    }
    lastStateById.set(t.id, t.to_state);
  }

  return { failures, warnings };
}

function projectCurrentState(
  transitions: readonly Transition[],
): Map<string, Transition> {
  // Latest-transition-per-id by ts (lexicographic ISO 8601 sorts correctly).
  const latest = new Map<string, Transition>();
  for (const t of transitions) {
    const cur = latest.get(t.id);
    if (cur === undefined || t.ts.localeCompare(cur.ts) > 0) {
      latest.set(t.id, t);
    }
  }
  return latest;
}

function reportSchemaDoc(schemaDoc: SchemaDoc | null): void {
  console.log("## Schema-doc");
  console.log("");
  if (schemaDoc === null) {
    console.log("  MISSING -- line 1 must carry kind=\"schema-doc\".");
    console.log("");
    return;
  }
  console.log(`  - kind: ${schemaDoc.kind}`);
  console.log(`  - ts: ${schemaDoc.ts}`);
  if (typeof schemaDoc.origin === "string") {
    console.log(`  - origin: ${schemaDoc.origin.slice(0, 120)}${schemaDoc.origin.length > 120 ? "..." : ""}`);
  }
  if (schemaDoc.four_state_machine !== undefined) {
    console.log(
      `  - four_state_machine keys: ${Object.keys(schemaDoc.four_state_machine).join(" / ")}`,
    );
  }
  console.log("");
}

function reportProjection(latest: Map<string, Transition>): void {
  console.log("## Current-state projection (latest transition per id)");
  console.log("");
  if (latest.size === 0) {
    console.log("  (no transitions)");
    console.log("");
    return;
  }
  const buckets: Record<string, Transition[]> = {
    Promoted: [],
    "Pending-NOW": [],
    "Pending-LATER": [],
    Declined: [],
  };
  for (const t of latest.values()) {
    const list = buckets[t.to_state];
    if (list !== undefined) list.push(t);
  }
  for (const state of [
    "Promoted",
    "Pending-NOW",
    "Pending-LATER",
    "Declined",
  ] as const) {
    const list = buckets[state] ?? [];
    console.log(`### ${state} (${list.length})`);
    for (const t of list.sort((a, b) => a.id.localeCompare(b.id))) {
      const artifact =
        t.operational_artifact !== null
          ? ` -> ${t.operational_artifact}`
          : "";
      const pointer =
        t.wont_do_pointer !== null ? ` -> ${t.wont_do_pointer}` : "";
      console.log(`  - ${t.id}${artifact}${pointer}  (actor=${t.actor})`);
    }
    console.log("");
  }
}

function reportFailures(failures: readonly Failure[]): void {
  console.log("## Validation failures");
  console.log("");
  if (failures.length === 0) {
    console.log("  0 failures.");
    console.log("");
    return;
  }
  console.log(`  ${failures.length} failures:`);
  console.log("");
  for (const f of failures) {
    const idTag = f.id !== undefined ? ` [id=${f.id}]` : "";
    console.log(`  - line ${f.lineNo}${idTag} (${f.kind}): ${f.detail}`);
  }
  console.log("");
}

function reportWarnings(warnings: readonly Warning[]): void {
  console.log("## Warnings");
  console.log("");
  if (warnings.length === 0) {
    console.log("  0 warnings.");
    console.log("");
    return;
  }
  for (const w of warnings) {
    console.log(`  - line ${w.lineNo} [id=${w.id}] (${w.kind}): ${w.detail}`);
  }
  console.log("");
}

function reportActionables(
  failures: readonly Failure[],
  warnings: readonly Warning[],
): void {
  console.log("## Actionable items");
  console.log("");
  if (failures.length === 0 && warnings.length === 0) {
    console.log("  (none -- ledger is clean)");
    console.log("");
    return;
  }
  for (const f of failures) {
    switch (f.kind) {
      case "schema-doc-missing":
        console.log(
          "  - Add a kind=\"schema-doc\" record on line 1 of memory/promotion-ledger.jsonl.",
        );
        break;
      case "schema-violation":
        console.log(
          `  - Fix schema-violation on line ${f.lineNo}: ${f.detail}`,
        );
        break;
      case "promoted-artifact-missing":
        console.log(
          `  - Promoted id=${f.id ?? "?"}: create the operational_artifact OR demote to Pending-* (line ${f.lineNo}).`,
        );
        break;
      case "declined-pointer-missing":
        console.log(
          `  - Declined id=${f.id ?? "?"}: create / fix the wont_do_pointer path (line ${f.lineNo}).`,
        );
        break;
      case "declined-pointer-not-in-wont-do":
        console.log(
          `  - Declined id=${f.id ?? "?"}: add the anchor / id to docs/WONT-DO.md (line ${f.lineNo}).`,
        );
        break;
    }
  }
  for (const w of warnings) {
    if (w.kind === "impossible-move") {
      console.log(
        `  - id=${w.id}: append a Pending-NOW or Pending-LATER re-open transition before the Promoted transition on line ${w.lineNo}.`,
      );
    }
  }
  console.log("");
}

async function main(): Promise<number> {
  const today = nowIso();
  const parse = parseLedger();

  console.log(`# Promotion-ledger audit (${today})`);
  console.log("");
  console.log(`Ledger: memory/promotion-ledger.jsonl`);
  console.log(`Transitions parsed: ${parse.transitions.length}`);
  console.log(`Parse failures: ${parse.parseFailures.length}`);
  console.log("");

  if (parse.parseFailures.length > 0) {
    console.log("## Parse failures");
    console.log("");
    for (const pf of parse.parseFailures) {
      console.log(`  - line ${pf.lineNo}: ${pf.reason}`);
    }
    console.log("");
    // Per PR #1702 review 2026-05-06: parse failures in
    // an existing ledger MUST gate CI. The header documents exit
    // code 2 for an unparseable ledger; previously this branch only
    // returned 2 when the file was missing, so JSONL syntax corruption
    // could still exit 0 after passing through validation. Fail-fast
    // on any parse failure (file missing OR malformed lines).
    return 2;
  }

  reportSchemaDoc(parse.schemaDoc);

  const latest = projectCurrentState(parse.transitions);
  reportProjection(latest);

  const { failures, warnings } = validate(parse);
  reportFailures(failures);
  reportWarnings(warnings);
  reportActionables(failures, warnings);

  console.log("## Summary");
  console.log("");
  console.log(`  - Transitions: ${parse.transitions.length}`);
  console.log(`  - Unique ids: ${latest.size}`);
  console.log(`  - Validation failures: ${failures.length}`);
  console.log(`  - Warnings: ${warnings.length}`);
  console.log("");
  console.log(
    "Composes with: memory/identity-substrate-receipts.jsonl (sibling JSONL pattern),",
  );
  console.log(
    "  src/Core.TypeScript/hygiene/audit-backlog-items.ts (sibling audit-* pattern),",
  );
  console.log(
    "  docs/backlog/P1/081KQNJ500008QG0R003SCWBDV* substrate-claim-checker (this audit IS the checker).",
  );

  return failures.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(
        `fatal: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    },
  );
}
