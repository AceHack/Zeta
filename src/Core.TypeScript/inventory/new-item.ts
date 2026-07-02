#!/usr/bin/env bun
// new-item.ts — mint a Category.InventoryAsset ZetaId and scaffold an item file
// under inventory/items/. Git is the database: the file IS the row, git log IS
// the change log. Sibling of backlog/new-workitem.ts (same governed-mint shape).

import { writeFileSync, existsSync } from "node:fs";
import { join, normalize } from "node:path";
import { packGeneric } from "../zeta-id/zeta-id";
import { format } from "../zeta-id/encoding";
import { Category } from "../zeta-id/types";

const REPO_ROOT = normalize(join(__dirname, "..", "..", ".."));
const ITEMS_DIR = join(REPO_ROOT, "inventory", "items");

export const STATUSES = ["active", "storage", "attention", "repair", "retired", "disposed", "missing"] as const;

export function mintInventoryZetaId(): string {
  // Categories >= 9 use the Generic layout (packGeneric). Payload is 119 bits;
  // the top 41 carry the ms timestamp (time-sortable filenames, same property
  // as workitems/), the low 78 are crypto-random (conflict-free local mint).
  const rand = new BigUint64Array(2);
  crypto.getRandomValues(rand);
  const random78 = ((rand[0]! << 64n) | rand[1]!) & ((1n << 78n) - 1n);
  const payload = (BigInt(Date.now()) << 78n) | random78;
  return format(packGeneric(1, Category.InventoryAsset, payload));
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function arg(flag: string, fallback = ""): string {
  const i = Bun.argv.indexOf(flag);
  return i !== -1 && Bun.argv[i + 1] ? Bun.argv[i + 1]! : fallback;
}

function main(): number {
  const name = arg("--name");
  if (!name) {
    console.error('usage: bun new-item.ts --name "..." [--brand X] [--model-pn X] [--qty N] [--device-type X] [--category X] [--status X] [--location X] [--purpose X] [--value-usd N] [--serial X] [--sample]');
    return 1;
  }
  const status = arg("--status", "active");
  if (!(STATUSES as readonly string[]).includes(status)) {
    console.error(`invalid --status ${status}; expected one of ${STATUSES.join("|")}`);
    return 1;
  }
  const qty = Number.parseInt(arg("--qty", "1"), 10);
  if (!Number.isInteger(qty) || qty < 1) {
    console.error("--qty must be a positive integer");
    return 1;
  }
  const id = mintInventoryZetaId();
  const file = join(ITEMS_DIR, `${id}-${slugify(name)}.md`);
  if (existsSync(file)) {
    console.error(`collision (should be impossible): ${file}`);
    return 1;
  }
  const sample = Bun.argv.includes("--sample");
  const fm = [
    "---",
    `id: ${id}`,
    `name: ${name}`,
    `brand: ${arg("--brand")}`,
    `model_pn: ${arg("--model-pn")}`,
    `qty: ${qty}`,
    `device_type: ${arg("--device-type", "other")}`,
    `category: ${arg("--category", "uncategorized")}`,
    `status: ${status}`,
    `location: ${arg("--location")}`,
    `assignment_purpose: ${arg("--purpose")}`,
    `value_usd: ${arg("--value-usd", "0")}`,
    `serial: "${arg("--serial")}"`,
    `acquired: ${arg("--acquired")}`,
    `assigned_machine: ${arg("--assigned-machine")}`,
    ...(sample ? ["sample: true"] : []),
    "---",
    "",
    "",
  ].join("\n");
  writeFileSync(file, fm, "utf8");
  console.log(`created inventory/items/${id}-${slugify(name)}.md`);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
