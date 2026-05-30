import { deepEqual } from "node:assert/strict";
import { test } from "node:test";
import { splitSqlStatements } from "../src/sql-statement-splitter.ts";

test("splits simple semicolon-separated statements", () => {
  deepEqual(splitSqlStatements("CREATE TABLE a (id INT); INSERT INTO a VALUES (1);"), [
    "CREATE TABLE a (id INT)",
    "INSERT INTO a VALUES (1)",
  ]);
});

test("ignores a trailing empty statement after the final semicolon", () => {
  deepEqual(splitSqlStatements("SELECT 1;\n\n"), ["SELECT 1"]);
});

test("a statement without a trailing semicolon is still returned", () => {
  deepEqual(splitSqlStatements("SELECT 1"), ["SELECT 1"]);
});

test("does NOT split on a semicolon inside a single-quoted string", () => {
  deepEqual(splitSqlStatements("INSERT INTO a VALUES ('x; y'); SELECT 1;"), [
    "INSERT INTO a VALUES ('x; y')",
    "SELECT 1",
  ]);
});

test("handles an escaped single quote inside a string ('' is a literal quote)", () => {
  deepEqual(splitSqlStatements("INSERT INTO a VALUES ('it''s; fine'); SELECT 2;"), [
    "INSERT INTO a VALUES ('it''s; fine')",
    "SELECT 2",
  ]);
});

test("does not split on a semicolon inside a line comment (comment is preserved)", () => {
  deepEqual(splitSqlStatements("SELECT 1; -- a comment with ; semicolon\nSELECT 2;"), [
    "SELECT 1",
    "-- a comment with ; semicolon\nSELECT 2",
  ]);
});

test("splits the real ADD COLUMN + UPDATE pattern into separate statements", () => {
  const sql = "ALTER TABLE t ADD COLUMN IF NOT EXISTS version INT8 DEFAULT 1;\nUPDATE t SET version = COALESCE(version, 1);";
  deepEqual(splitSqlStatements(sql), [
    "ALTER TABLE t ADD COLUMN IF NOT EXISTS version INT8 DEFAULT 1",
    "UPDATE t SET version = COALESCE(version, 1)",
  ]);
});

test("preserves multi-line statements (whitespace within a statement is kept, edges trimmed)", () => {
  const sql = "ALTER TABLE t\n  ADD COLUMN x INT;\n";
  deepEqual(splitSqlStatements(sql), ["ALTER TABLE t\n  ADD COLUMN x INT"]);
});
