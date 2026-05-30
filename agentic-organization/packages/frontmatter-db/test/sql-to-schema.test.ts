import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { ColumnType, findColumn } from "../src/schema.ts";
import { parseCreateTable } from "../src/sql-to-schema.ts";

const SQL = `
CREATE TABLE task (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('created', 'ready', 'done')),
  title TEXT NOT NULL,
  project_id TEXT REFERENCES project(id),
  reviewer_ids TEXT[] REFERENCES hat_assignment(id),
  estimate INTEGER,
  created_at TIMESTAMPTZ NOT NULL
);
`;

test("parses CREATE TABLE into a frontmatter schema", () => {
  const result = parseCreateTable(SQL, 3);
  equal(result.outcome, "schema");
  if (result.outcome !== "schema") return;
  equal(result.schema.table, "task");
  equal(result.schema.schemaVersion, 3);
});

test("PRIMARY KEY column maps to zeta_id pk", () => {
  const result = parseCreateTable(SQL);
  if (result.outcome !== "schema") throw new Error("expected schema");
  const id = findColumn(result.schema, "id");
  deepEqual(id, { name: "id", type: ColumnType.ZetaId, pk: true, required: true });
});

test("CHECK ... IN (...) maps to an enum with values", () => {
  const result = parseCreateTable(SQL);
  if (result.outcome !== "schema") throw new Error("expected schema");
  const status = findColumn(result.schema, "status");
  deepEqual(status, { name: "status", type: ColumnType.Enum, required: true, values: ["created", "ready", "done"] });
});

test("REFERENCES maps to fk; TYPE[] REFERENCES maps to fk_array", () => {
  const result = parseCreateTable(SQL);
  if (result.outcome !== "schema") throw new Error("expected schema");
  deepEqual(findColumn(result.schema, "project_id"), { name: "project_id", type: ColumnType.Fk, required: false, references: "project" });
  deepEqual(findColumn(result.schema, "reviewer_ids"), { name: "reviewer_ids", type: ColumnType.FkArray, required: false, references: "hat_assignment" });
});

test("scalar types and NOT NULL map through", () => {
  const result = parseCreateTable(SQL);
  if (result.outcome !== "schema") throw new Error("expected schema");
  deepEqual(findColumn(result.schema, "estimate"), { name: "estimate", type: ColumnType.Int, required: false });
  deepEqual(findColumn(result.schema, "created_at"), { name: "created_at", type: ColumnType.Timestamp, required: true });
  equal(findColumn(result.schema, "title")?.required, true);
});

test("non-CREATE-TABLE input returns explicit feedback", () => {
  const result = parseCreateTable("SELECT 1;");
  equal(result.outcome, "feedback");
  if (result.outcome !== "feedback") return;
  equal(result.feedback.reason, "no_create_table");
});
