import { equal, ok } from "node:assert/strict";
import { test } from "node:test";
import { asZetaIdDecimal, type ZetaIdDecimal } from "../src/event.ts";
import { ColumnType, type FrontmatterRow, type TableSchema } from "../src/schema.ts";
import { edgesOf, neighbors } from "../src/traverse.ts";
import { validateRow } from "../src/validate.ts";

const taskSchema: TableSchema = {
  table: "task",
  schemaVersion: 1,
  columns: [
    { name: "id", type: ColumnType.ZetaId, pk: true, required: true },
    { name: "status", type: ColumnType.Enum, required: true, values: ["ready", "done"] },
    { name: "title", type: ColumnType.Text, required: true },
    { name: "project_id", type: ColumnType.Fk, required: false, references: "project" },
    { name: "depends_on", type: ColumnType.FkArray, required: false, references: "task" },
  ],
};

function row(values: Record<string, string | readonly string[]>): FrontmatterRow {
  return { table: "task", values };
}

test("a well-formed row validates", () => {
  const result = validateRow(row({ id: "42", status: "ready", title: "t", project_id: "7", depends_on: ["8", "9"] }), taskSchema);
  equal(result.outcome, "valid");
});

test("a non-ZetaId FK reference is rejected (FK targets a ZetaId pk)", () => {
  const result = validateRow(row({ id: "42", status: "ready", title: "t", project_id: "not-a-zeta-id" }), taskSchema);
  equal(result.outcome, "invalid");
  if (result.outcome !== "invalid") return;
  ok(result.violations.some((v) => v.column === "project_id" && v.reason === "bad_fk"));
});

test("a non-ZetaId element in an FK array is rejected", () => {
  const result = validateRow(row({ id: "42", status: "ready", title: "t", depends_on: ["8", "nope"] }), taskSchema);
  equal(result.outcome, "invalid");
  if (result.outcome !== "invalid") return;
  ok(result.violations.some((v) => v.column === "depends_on" && v.reason === "bad_fk_array"));
});

test("a stray 'table' key in values is flagged as unknown column (no bypass)", () => {
  const result = validateRow({ table: "task", values: { id: "42", status: "ready", title: "t", table: "task" } }, taskSchema);
  equal(result.outcome, "invalid");
  if (result.outcome !== "invalid") return;
  ok(result.violations.some((v) => v.column === "table" && v.reason === "unknown_column"));
});

test("enum out of range is reported", () => {
  const result = validateRow(row({ id: "42", status: "frozen", title: "t" }), taskSchema);
  equal(result.outcome, "invalid");
  if (result.outcome !== "invalid") return;
  equal(result.violations.some((v) => v.reason === "enum_out_of_range"), true);
});

test("missing required column is reported", () => {
  const result = validateRow(row({ id: "42", status: "ready" }), taskSchema);
  equal(result.outcome, "invalid");
  if (result.outcome !== "invalid") return;
  equal(result.violations.some((v) => v.column === "title" && v.reason === "required_missing"), true);
});

test("unknown column is reported (schema is the contract)", () => {
  const result = validateRow(row({ id: "42", status: "ready", title: "t", nonsense: "x" }), taskSchema);
  equal(result.outcome, "invalid");
  if (result.outcome !== "invalid") return;
  equal(result.violations.some((v) => v.column === "nonsense" && v.reason === "unknown_column"), true);
});

test("edgesOf surfaces fk and fk_array columns as graph edges", () => {
  const edges = edgesOf(row({ id: "42", status: "ready", title: "t", project_id: "7", depends_on: ["8", "9"] }), taskSchema);
  equal(edges.length, 2);
  const project = edges.find((e) => e.column === "project_id");
  equal(project?.references, "project");
  equal(project?.toIds.length, 1);
  const deps = edges.find((e) => e.column === "depends_on");
  equal(deps?.toIds.length, 2);
});

test("neighbors resolves edge ids against a store", () => {
  const store = new Map<ZetaIdDecimal, FrontmatterRow>([
    [asZetaIdDecimal("8"), row({ id: "8", status: "done", title: "dep-8" })],
    [asZetaIdDecimal("9"), row({ id: "9", status: "ready", title: "dep-9" })],
  ]);
  const found = neighbors(row({ id: "42", status: "ready", title: "t", depends_on: ["8", "9"] }), taskSchema, "depends_on", store);
  equal(found.length, 2);
  equal(found.map((r) => r.values.title).sort().join(","), "dep-8,dep-9");
});
