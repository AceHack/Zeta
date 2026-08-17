#!/usr/bin/env bun
// generate-items-json.ts — walk inventory/items/*.md, validate, emit the
// committed inventory/items.json index (deterministic: ordinal-sorted by id,
// stable key order). The static viewer + dashboards read this file; the item
// markdown files remain the source of truth (DV2.0: items = hubs+satellites,
// items.json = derived read-model, regenerated on change).

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, normalize } from "node:path";
import { STATUSES } from "./new-item";

const REPO_ROOT = normalize(join(__dirname, "..", "..", ".."));

/** The published read-model's path, repo-relative. Exported because the
 *  cross-surface reconciliation check names this file in its findings, and a
 *  second hardcoded `"inventory/items.json"` over there would be one more copy of
 *  exactly the fact this module exists to keep single-sourced. */
export const ITEMS_JSON_REL = "inventory/items.json";

export interface Item {
  id: string;
  name: string;
  brand: string;
  model_pn: string;
  qty: number;
  device_type: string;
  category: string;
  status: string;
  location: string;
  assignment_purpose: string;
  value_usd: number;
  serial: string;
  acquired: string;
  assigned_machine: string;
  sample: boolean;
  notes: string;
  file: string;
}

export function parseItem(relFile: string, text: string): { item?: Item; errors: string[] } {
  const errors: string[] = [];
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) {
    return { errors: [`${relFile}: no frontmatter block`] };
  }
  const fields = new Map<string, string>();
  for (const line of m[1]!.split("\n")) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (kv) {
      fields.set(kv[1]!, kv[2]!.replace(/^"(.*)"$/, "$1").trim());
    }
  }
  const get = (k: string): string => fields.get(k) ?? "";
  const id = get("id");
  const name = get("name");
  const qty = Number.parseInt(get("qty") || "0", 10);
  const status = get("status");
  const valueUsd = Number.parseFloat(get("value_usd") || "0");
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)) errors.push(`${relFile}: id is not a 26-char ZetaId`);
  if (!name) errors.push(`${relFile}: name is required`);
  if (!Number.isInteger(qty) || qty < 1) errors.push(`${relFile}: qty must be a positive integer`);
  if (!(STATUSES as readonly string[]).includes(status)) errors.push(`${relFile}: status '${status}' not in ${STATUSES.join("|")}`);
  if (Number.isNaN(valueUsd) || valueUsd < 0) errors.push(`${relFile}: value_usd must be a non-negative number`);
  if (!relFile.startsWith(id)) errors.push(`${relFile}: filename must start with the item id`);
  if (errors.length > 0) return { errors };
  return {
    errors,
    item: {
      id,
      name,
      brand: get("brand"),
      model_pn: get("model_pn"),
      qty,
      device_type: get("device_type"),
      category: get("category"),
      status,
      location: get("location"),
      assignment_purpose: get("assignment_purpose"),
      value_usd: valueUsd,
      serial: get("serial"),
      acquired: get("acquired"),
      assigned_machine: get("assigned_machine"),
      sample: get("sample") === "true",
      notes: m[2]!.trim(),
      file: `inventory/items/${relFile}`,
    },
  };
}

export function generate(root: string = REPO_ROOT): { items: Item[]; errors: string[] } {
  const ITEMS_DIR = join(root, "inventory", "items");
  const items: Item[] = [];
  const errors: string[] = [];
  let files: string[] = [];
  try {
    files = readdirSync(ITEMS_DIR).filter((f) => f.endsWith(".md") && f !== "README.md");
  } catch {
    errors.push("inventory/items/ missing");
  }
  for (const f of files) {
    const res = parseItem(f, readFileSync(join(ITEMS_DIR, f), "utf8"));
    errors.push(...res.errors);
    if (res.item) items.push(res.item);
  }
  // DECLARED SORT FIELD: identity, NOT time (see zeta-id/sort-key.ts).
  // Ordinal codepoint order over the canonical base32 id — culture-invariant by
  // default, and equal to whole-128-bit numeric order. What this site needs is a
  // stable total order so items.json has reproducible bytes; it makes NO claim
  // about acquisition order, and it stays correct for any future id version.
  // That distinction is load-bearing here: item ids are Category.InventoryAsset (10),
  // which uses the packGeneric layout and has NO Timestamp field at bits [75,123) —
  // reading one as an observation timestamp yields the year 9200. `timeSortKey`
  // refuses these ids for exactly that reason.
  items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { items, errors };
}

/**
 * THE derivation: register (`inventory/items/*.md`) ⟶ published read-model bytes.
 *
 * There is exactly ONE definition of what `items.json` should contain, and this is
 * it. Three consumers call it — `main()` to write, `main() --check` to compare, and
 * `reconcile-surfaces.ts` HWR-7 to report the divergence as a surface finding — so
 * none of them can hold a private opinion about the answer. Re-deriving the payload
 * in a second place would rebuild the exact bug the check exists to catch, one
 * level up: two copies, agreeing today, free to drift tomorrow.
 *
 * Deterministic by construction (ordinal-sorted ids, stable key order, fixed
 * 2-space indent, trailing newline), so byte-equality is the right comparison.
 */
export function renderItemsJson(root: string = REPO_ROOT): { json: string; count: number; errors: string[] } {
  const { items, errors } = generate(root);
  if (errors.length > 0) return { json: "", count: 0, errors };
  const totalValue = items.reduce((s, i) => s + i.value_usd * i.qty, 0);
  const payload = {
    generated_by: "src/Core.TypeScript/inventory/generate-items-json.ts",
    count: items.length,
    total_value_usd: Math.round(totalValue * 100) / 100,
    items,
  };
  return { json: JSON.stringify(payload, null, 2) + "\n", count: items.length, errors };
}

/** The committed read-model as it stands on disk. Absent reads as empty, which
 *  compares unequal to any real derivation — missing is stale, never "fine". */
export function readCommittedItemsJson(root: string = REPO_ROOT): string {
  try {
    return readFileSync(join(root, ITEMS_JSON_REL), "utf8");
  } catch {
    return "";
  }
}

function main(): number {
  const checkOnly = Bun.argv.includes("--check");
  const { json, count, errors } = renderItemsJson();
  if (errors.length > 0) {
    for (const e of errors) console.error(`✗ ${e}`);
    return 1;
  }
  if (checkOnly) {
    if (readCommittedItemsJson() !== json) {
      console.error(`✗ ${ITEMS_JSON_REL} is stale — run: bun src/Core.TypeScript/inventory/generate-items-json.ts`);
      return 1;
    }
    console.log(`✓ items.json current (${count} items)`);
    return 0;
  }
  writeFileSync(join(REPO_ROOT, ITEMS_JSON_REL), json, "utf8");
  console.log(`wrote ${ITEMS_JSON_REL} — ${count} items`);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
