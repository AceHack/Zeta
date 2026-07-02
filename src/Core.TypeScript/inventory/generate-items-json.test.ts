import { expect, test } from "bun:test";
import { parseItem } from "./generate-items-json";
import { mintInventoryZetaId, slugify, STATUSES } from "./new-item";

const ID = "081KWFYQDET08QG0R003CFV97T"; // any valid 26-char Crockford ZetaId shape

function fm(overrides: Record<string, string> = {}): string {
  const base: Record<string, string> = {
    id: ID, name: "RTX 4090 FE", brand: "NVIDIA", model_pn: "900-1G136",
    qty: "1", device_type: "gpu", category: "compute", status: "active",
    location: "rack-1", assignment_purpose: "k3s-gpu-node", value_usd: "1599.00",
    serial: '"SN123"', acquired: "2026-01-15", assigned_machine: "",
  };
  Object.assign(base, overrides);
  const lines = Object.entries(base).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join("\n")}\n---\n\nnotes here\n`;
}

test("parseItem accepts a valid item and extracts fields", () => {
  const { item, errors } = parseItem(`${ID}-rtx-4090-fe.md`, fm());
  expect(errors).toEqual([]);
  expect(item!.name).toBe("RTX 4090 FE");
  expect(item!.qty).toBe(1);
  expect(item!.value_usd).toBe(1599);
  expect(item!.serial).toBe("SN123");
  expect(item!.notes).toBe("notes here");
});

test("parseItem rejects bad status, qty, id, filename mismatch", () => {
  expect(parseItem(`${ID}-x.md`, fm({ status: "on-fire" })).errors.length).toBe(1);
  expect(parseItem(`${ID}-x.md`, fm({ qty: "0" })).errors.length).toBe(1);
  expect(parseItem(`${ID}-x.md`, fm({ id: "notanid" })).errors.length).toBeGreaterThan(0);
  expect(parseItem(`WRONGPREFIX-x.md`, fm()).errors.length).toBeGreaterThan(0);
});

test("minted ids are valid, distinct, and slugify is filename-safe", () => {
  const a = mintInventoryZetaId();
  const b = mintInventoryZetaId();
  expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  expect(a).not.toBe(b);
  expect(slugify("Mac Studio (M2 Ultra) — 192GB!")).toBe("mac-studio-m2-ultra-192gb");
  expect(STATUSES).toContain("active");
});
