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
const ITEMS_DIR = join(REPO_ROOT, "inventory", "items");
const OUT = join(REPO_ROOT, "inventory", "items.json");

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

export function generate(): { items: Item[]; errors: string[] } {
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
  // ordinal sort by id (codepoint order — culture-invariant by default)
  items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { items, errors };
}

function main(): number {
  const checkOnly = Bun.argv.includes("--check");
  const { items, errors } = generate();
  if (errors.length > 0) {
    for (const e of errors) console.error(`✗ ${e}`);
    return 1;
  }
  const totalValue = items.reduce((s, i) => s + i.value_usd * i.qty, 0);
  const payload = {
    generated_by: "src/Core.TypeScript/inventory/generate-items-json.ts",
    count: items.length,
    total_value_usd: Math.round(totalValue * 100) / 100,
    items,
  };
  const json = JSON.stringify(payload, null, 2) + "\n";
  if (checkOnly) {
    let current = "";
    try {
      current = readFileSync(OUT, "utf8");
    } catch {
      /* missing = stale */
    }
    if (current !== json) {
      console.error("✗ inventory/items.json is stale — run: bun src/Core.TypeScript/inventory/generate-items-json.ts");
      return 1;
    }
    console.log(`✓ items.json current (${items.length} items)`);
    return 0;
  }
  writeFileSync(OUT, json, "utf8");
  console.log(`wrote inventory/items.json — ${items.length} items, total value $${payload.total_value_usd}`);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
