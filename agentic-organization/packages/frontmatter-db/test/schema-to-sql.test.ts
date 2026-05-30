import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { emitCreateTable } from "../src/schema-to-sql.ts";
import { parseCreateTable } from "../src/sql-to-schema.ts";
import { ColumnType, type TableSchema, type ColumnDef } from "../src/schema.ts";

test("escapes single quotes in enum literals so they can't break/inject SQL", () => {
  const schema: TableSchema = {
    table: "t",
    schemaVersion: 1,
    columns: [{ type: ColumnType.Enum, name: "label", required: true, values: ["it's", "ok"] } as ColumnDef],
  };
  const sql = emitCreateTable(schema);
  ok(sql.includes("'it''s'"));
  ok(!sql.includes("'it's'"));
});

const taskSchema: TableSchema = {
  table: "task",
  schemaVersion: 1,
  columns: [
    { type: ColumnType.ZetaId, name: "id", pk: true, required: true },
    {
      type: ColumnType.Enum,
      name: "status",
      required: true,
      values: ["created", "ready", "done"],
    },
    { type: ColumnType.Text, name: "title", required: true },
    { type: ColumnType.Fk, name: "project_id", required: false, references: "project" },
    { type: ColumnType.FkArray, name: "reviewer_ids", required: false, references: "hat_assignment" },
    { type: ColumnType.Int, name: "estimate", required: false },
    { type: ColumnType.Timestamp, name: "created_at", required: true },
  ],
};

test("emitCreateTable round-trips through parseCreateTable", () => {
  const sql = emitCreateTable(taskSchema);
  const parsed = parseCreateTable(sql, taskSchema.schemaVersion);
  equal(parsed.outcome, "schema");
  if (parsed.outcome !== "schema") return;
  equal(parsed.schema.table, taskSchema.table);
  equal(parsed.schema.schemaVersion, taskSchema.schemaVersion);
  deepEqual(parsed.schema.columns, taskSchema.columns);
});

test("emitCreateTable produces a TEXT PRIMARY KEY for zeta_id pk", () => {
  const schema: TableSchema = {
    table: "t",
    schemaVersion: 1,
    columns: [{ type: ColumnType.ZetaId, name: "id", pk: true, required: true }],
  };
  const sql = emitCreateTable(schema);
  equal(sql.includes("id TEXT PRIMARY KEY"), true);
});

test("emitCreateTable emits NOT NULL only when required", () => {
  const schema: TableSchema = {
    table: "t",
    schemaVersion: 2,
    columns: [
      { type: ColumnType.Text, name: "a", required: true },
      { type: ColumnType.Text, name: "b", required: false },
    ],
  };
  const sql = emitCreateTable(schema);
  equal(sql.includes("a TEXT NOT NULL"), true);
  equal(/\bb TEXT(?! NOT NULL)/.test(sql), true);
});

test("each non-pk column round-trips its NOT NULL flag", () => {
  const schema: TableSchema = {
    table: "flags",
    schemaVersion: 3,
    columns: [
      { type: ColumnType.Int, name: "i_req", required: true },
      { type: ColumnType.Bool, name: "b_opt", required: false },
      { type: ColumnType.Timestamp, name: "ts_req", required: true },
      {
        type: ColumnType.Enum,
        name: "e_opt",
        required: false,
        values: ["x", "y"],
      },
    ],
  };
  const parsed = parseCreateTable(
    emitCreateTable(schema),
    schema.schemaVersion,
  );
  equal(parsed.outcome, "schema");
  if (parsed.outcome !== "schema") return;
  const byName = (n: string): ColumnDef | undefined =>
    parsed.schema.columns.find((c) => c.name === n);
  deepEqual(byName("i_req"), schema.columns[0]);
  deepEqual(byName("b_opt"), schema.columns[1]);
  deepEqual(byName("ts_req"), schema.columns[2]);
  deepEqual(byName("e_opt"), schema.columns[3]);
});
