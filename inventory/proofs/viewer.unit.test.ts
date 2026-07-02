import { expect, test } from "bun:test";
import { compareItems, escapeHtml, filterItems, matchesQuery, rowHtml, totals } from "../lib/inventory-viewer.js";

const items = [
  { id: "A", name: "RTX 4090", brand: "NVIDIA", model_pn: "", serial: "SN1", location: "rack-1", category: "compute", assignment_purpose: "", assigned_machine: "", notes: "", status: "active", qty: 2, value_usd: 1599, device_type: "gpu", file: "inventory/items/a.md", sample: false },
  { id: "B", name: "Mac Studio", brand: "Apple", model_pn: "", serial: "SN2", location: "office", category: "compute", assignment_purpose: "", assigned_machine: "", notes: "192GB", status: "storage", qty: 1, value_usd: 6599, device_type: "cpu-system", file: "inventory/items/b.md", sample: true },
];

test("filter: query matches across fields, status narrows", () => {
  expect(filterItems(items, "nvidia", "").length).toBe(1);
  expect(filterItems(items, "192gb", "").length).toBe(1);
  expect(filterItems(items, "", "storage").length).toBe(1);
  expect(filterItems(items, "sn", "active").length).toBe(1);
  expect(matchesQuery(items[0]!, "")).toBe(true);
});

test("sort: ordinal strings + numeric columns + direction", () => {
  const byName = [...items].sort((a, b) => compareItems(a, b, "name", "asc"));
  expect(byName[0]!.name).toBe("Mac Studio");
  const byValueDesc = [...items].sort((a, b) => compareItems(a, b, "value_usd", "desc"));
  expect(byValueDesc[0]!.value_usd).toBe(6599);
});

test("totals: value multiplies qty", () => {
  expect(totals(items)).toEqual({ count: 2, value: 1599 * 2 + 6599 });
});

test("rowHtml escapes and links to the item file; sample badged", () => {
  const evil = { ...items[0]!, name: '<img src=x onerror=alert(1)>', file: "inventory/items/a.md" };
  const html = rowHtml(evil);
  expect(html).not.toContain("<img");
  expect(html).toContain("&lt;img");
  expect(html).toContain("blob/main/inventory/items/a.md");
  expect(rowHtml(items[1]!)).toContain("sample");
  expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
});
