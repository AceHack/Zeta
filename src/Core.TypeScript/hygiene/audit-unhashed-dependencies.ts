#!/usr/bin/env bun
// audit-unhashed-dependencies.ts — the both-ways gate on the unhashed-dependency inventory.
//
// 081M25Z29W4087G0R002Y0Q1MG. Aaron 2026-09-10: an unhashed dependency is SUPPORTED, is NOT
// PREFERRED, must be HANDLED SEPARATELY, and the handling must be WIRED EVERYWHERE.
//
// THE PROPERTY WORTH COPYING, from the mise.lock roster: it FAILS BOTH WAYS, so the roster can
// shrink but never grow. A one-way check on an exception list is the weaker half of a check — it
// stops new exceptions and lets dead ones sit there looking justified, which is how a list of
// exceptions becomes a list of things nobody has looked at.
//
//   DIRECTION 1 — an unhashed dependency that is not in the committed inventory. It entered
//                 without anyone seeing it. FAILS.
//   DIRECTION 2 — an inventory entry the tree no longer produces, because the row gained a
//                 digest or the mechanism was wired. The roster must SHRINK. FAILS.
//
// Both directions are the SAME comparison — committed text against a fresh derivation — which is
// what makes them impossible to implement asymmetrically by accident.
//
// A THIRD REFUSAL, and it is the one that keeps the other two honest: a manifest in
// `tools/setup/manifests/` that `MECHANISMS` does not describe. An undescribed mechanism
// contributes nothing to either direction, so a new dependency mechanism would arrive completely
// invisible to a page whose entire job is being the complete list.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-unhashed-dependencies.ts            # check
//   bun src/Core.TypeScript/hygiene/audit-unhashed-dependencies.ts --write    # regenerate
//   bun src/Core.TypeScript/hygiene/audit-unhashed-dependencies.ts --json
//
// Exit codes:
//   0   the committed inventory is exactly what the tree derives
//   1   it is not, in one direction or the other, or an undescribed mechanism exists
//   2   configuration error — no manifests at all, i.e. a scan that did not run

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  INVENTORY_PATH,
  deriveInventory,
  renderInventory,
  unknownManifests,
  type Inventory,
  type InventoryEntry,
} from "./unhashed-inventory.ts";

export const DRIFT_CLASS = "AH011";

function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

/** A stable identity for an entry, so the two directions can be reported per-dependency. */
export function entryKey(e: InventoryEntry): string {
  return JSON.stringify([e.mechanism, e.source, e.subject]);
}

export interface Divergence {
  /** In the tree, absent from the committed inventory. */
  readonly entered: readonly InventoryEntry[];
  /** In the committed inventory, no longer in the tree. */
  readonly stale: readonly string[];
  /** Same key, different declared reason or coverage. */
  readonly changed: readonly string[];
}

/** The heading that ends the roster. Everything after it is the denominator, not the roster. */
export const DENOMINATOR_HEADING = "## Digest-covered";

/**
 * Compare a committed inventory against a fresh derivation.
 *
 * Deliberately parses the committed MARKDOWN rather than a side-car JSON. The document is the
 * artifact a human reads; if the check ran against a machine file instead, the page could rot
 * while the gate stayed green — a check that cannot fail on the thing it names.
 */
export function diffInventory(committed: string, derived: Inventory): Divergence {
  const derivedEntries = [...derived.declared, ...derived.undeclared];
  // ONLY THE ROSTER IS COMPARED. The digest-covered table below the denominator heading is
  // context for a reader, not an exception anybody took, and folding it into the comparison
  // would report all ~1900 covered dependencies as "no longer unhashed" on every single run —
  // a check that fails always is as useless as one that cannot fail, and louder about it.
  const rosterEnd = committed.indexOf(DENOMINATOR_HEADING);
  const roster = rosterEnd === -1 ? committed : committed.slice(0, rosterEnd);
  const committedRows = new Map<string, string>();
  for (const line of roster.split(/\r?\n/)) {
    if (!line.startsWith("| `")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // declared:  | mech | subject | kind | reason | source |
    // undeclared:| mech | count | subject | why | source |
    const mech = (cells[1] ?? "").replaceAll("`", "");
    const source = (cells[cells.length - 2] ?? "").replaceAll("`", "");
    const subject =
      /^\d+$/u.test((cells[2] ?? "").replaceAll("`", ""))
        ? (cells[3] ?? "").replaceAll("`", "")
        : (cells[2] ?? "").replaceAll("`", "");
    if (mech === "" || source === "") continue;
    committedRows.set(JSON.stringify([mech, source, subject]), line);
  }

  const derivedKeys = new Set(derivedEntries.map(entryKey));
  const entered = derivedEntries.filter((e) => !committedRows.has(entryKey(e)));
  const stale = [...committedRows.keys()].filter((k) => !derivedKeys.has(k)).sort();

  const changed: string[] = [];
  for (const e of derivedEntries) {
    const row = committedRows.get(entryKey(e));
    if (row === undefined) continue;
    if (e.reason !== "" && !row.includes(e.reason)) {
      changed.push(`${e.mechanism} ${e.subject}: declared reason changed to "${e.reason}"`);
    }
  }
  return { entered, stale, changed };
}

function renderFindings(d: Divergence, unknown: readonly string[]): string {
  const lines: string[] = [];
  for (const name of unknown) {
    lines.push(`  UNDESCRIBED MECHANISM: tools/setup/manifests/${name}`);
    lines.push(
      "      Add a MechanismDescriptor for it in unhashed-inventory.ts. Until then it contributes",
      "      nothing to this inventory, and a page whose job is being the complete list would be",
      "      silently incomplete.",
      "",
    );
  }
  for (const e of d.entered) {
    lines.push(`  ENTERED WITHOUT LANDING IN THE INVENTORY: ${e.mechanism} ${e.subject}  (${e.source})`);
    lines.push(
      "      An unhashed dependency must arrive in the same PR as its inventory row, which is the",
      "      moment somebody sees it. Regenerate with --write and commit the result.",
      "",
    );
  }
  for (const key of d.stale) {
    const [mech, source, subject] = JSON.parse(key) as [string, string, string];
    lines.push(`  NO LONGER UNHASHED, STILL ON THE ROSTER: ${mech ?? ""} ${subject ?? ""}  (${source ?? ""})`);
    lines.push(
      "      The tree does not produce this entry any more — the row gained a digest, or the",
      "      mechanism was wired. THE ROSTER SHRINKS. An exception that is no longer needed may not",
      "      sit here looking justified. Regenerate with --write.",
      "",
    );
  }
  for (const c of d.changed) {
    lines.push(`  DECLARED REASON DRIFTED: ${c}`, "      Regenerate with --write so the page states the reason the row actually carries.", "");
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const root = repoRoot();

  const derived = deriveInventory(root);
  const unknown = unknownManifests(root);

  // A derivation that saw nothing is a scan that did not run, not a clean tree.
  if (derived.declared.length + derived.undeclared.length + derived.digestCovered.length === 0) {
    console.error(
      "unhashed-dependencies: configuration error — derived ZERO dependencies of any coverage. " +
        "That is not a repo with no dependencies, it is a scan that did not run.",
    );
    process.exit(2);
  }

  const rendered = renderInventory(derived);

  if (argv.includes("--write")) {
    writeFileSync(resolve(root, INVENTORY_PATH), rendered, "utf8");
    console.log(
      `unhashed-dependencies: wrote ${INVENTORY_PATH} — ` +
        `${String(derived.declared.length)} declared, ${String(derived.undeclared.length)} undeclared row(s)`,
    );
    process.exit(unknown.length === 0 ? 0 : 1);
  }

  let committed: string;
  try {
    committed = readFileSync(resolve(root, INVENTORY_PATH), "utf8");
  } catch {
    console.error(
      `unhashed-dependencies: configuration error — no inventory at ${INVENTORY_PATH}. Generate it with --write.`,
    );
    process.exit(2);
  }

  const divergence = diffInventory(committed, derived);

  if (argv.includes("--json")) {
    console.log(JSON.stringify({ driftClass: DRIFT_CLASS, unknown, ...divergence }, null, 2));
  }

  const clean =
    unknown.length === 0 &&
    divergence.entered.length === 0 &&
    divergence.stale.length === 0 &&
    divergence.changed.length === 0;

  if (clean) {
    if (!argv.includes("--json")) {
      console.log(
        `unhashed-dependencies: OK — ${String(derived.declared.length)} declared, ` +
          `${String(derived.undeclared.length)} undeclared, ${String(derived.digestCovered.length)} digest-covered ` +
          `row(s); ${INVENTORY_PATH} agrees with the tree.`,
      );
    }
    process.exit(0);
  }

  if (!argv.includes("--json")) {
    console.error(`unhashed-dependencies (${DRIFT_CLASS}): the inventory disagrees with the tree\n`);
    console.error(renderFindings(divergence, unknown));
    console.error("FIX: bun src/Core.TypeScript/hygiene/audit-unhashed-dependencies.ts --write, then commit.");
  }
  process.exit(1);
}
