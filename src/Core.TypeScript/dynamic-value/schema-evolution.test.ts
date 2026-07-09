import { test, expect } from "bun:test";
import vectors from "./golden-vectors-schema-evolution.json";
import { type Tagged } from "./types";
import {
  type Migration,
  addFieldMigration,
  renameFieldMigration,
  removeFieldMigration,
  removeFieldWithDumpMigration,
} from "./schema-evolution";

function parseOp(op: any): Migration {
  switch (op.op) {
    case "add":
      return addFieldMigration(0, op.key, op.default);
    case "rename":
      return renameFieldMigration(0, op.from, op.to);
    case "remove":
      return removeFieldMigration(0, op.key, op.default);
    case "remove_with_dump":
      return removeFieldWithDumpMigration(0, op.key);
    default:
      throw new Error(`Unknown op ${op.op}`);
  }
}

test("seed identifies as SchemaEvolution v1", () => {
  expect(vectors.primitive).toBe("SchemaEvolution");
  expect(vectors.version).toBe(1);
  expect(vectors.vectors.length).toBeGreaterThan(0);
});

for (const v of vectors.vectors) {
  test(`replays golden vector schema evolution: ${v.name}`, () => {
    const input = v.input as Tagged;
    const expectedUp = v.expected_up as Tagged;
    const expectedDown = v.expected_down as Tagged;
    const ops = v.ops.map(parseOp);

    // Run Up migrations
    let val = input;
    for (const op of ops) {
      val = op.up(val);
    }
    expect(val).toEqual(expectedUp);

    // Run Down migrations
    let backVal = val;
    for (let i = ops.length - 1; i >= 0; i--) {
      const op = ops[i];
      expect(op).toBeDefined();
      if (op && op.down) {
        backVal = op.down(backVal);
      }
    }
    expect(backVal).toEqual(expectedDown);
  });
}
