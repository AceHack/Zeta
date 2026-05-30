/**
 * Convert a SQL `CREATE TABLE` into a frontmatter TableSchema (operator vision:
 * "easily convert sql --> frontmatter schema"). One schema definition then
 * governs the git rows, the events, the projection, and the Cockroach index.
 *
 * Supported subset (the common case): column name, base type, PRIMARY KEY,
 * NOT NULL, CHECK (col IN ('a','b')) -> enum, REFERENCES tbl(col) -> fk,
 * and TYPE[] -> fk_array when combined with REFERENCES. Table-level constraint
 * lines are skipped. Anything unrecognized returns explicit feedback rather
 * than guessing (Result<T, TFeedback> as a two-variant DU).
 */

import { ColumnType, type ColumnDef, type TableSchema } from "./schema.ts";

export type SchemaParseResult =
  | { outcome: "schema"; schema: TableSchema }
  | { outcome: "feedback"; feedback: { reason: string; message: string } };

const RESERVED_LEADERS = new Set(["PRIMARY", "FOREIGN", "CONSTRAINT", "UNIQUE", "CHECK"]);

export function parseCreateTable(sql: string, schemaVersion = 1): SchemaParseResult {
  const match = /create\s+table\s+(?:if\s+not\s+exists\s+)?["']?([A-Za-z_][A-Za-z0-9_.]*)["']?\s*\(([\s\S]*)\)\s*;?\s*$/i.exec(
    sql.trim(),
  );
  if (match === null) {
    return { outcome: "feedback", feedback: { reason: "no_create_table", message: "input is not a CREATE TABLE statement" } };
  }

  const table = stripSchemaQualifier(match[1]!);
  const body = match[2]!;
  const lines = splitTopLevelCommas(body);

  const columns: ColumnDef[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }
    const leader = line.split(/\s+/)[0]!.toUpperCase();
    if (RESERVED_LEADERS.has(leader)) {
      continue;
    }
    const column = parseColumn(line);
    if (column.outcome === "feedback") {
      return column;
    }
    columns.push(column.column);
  }

  if (columns.length === 0) {
    return { outcome: "feedback", feedback: { reason: "no_columns", message: `table ${table} has no parseable columns` } };
  }

  return { outcome: "schema", schema: { table, schemaVersion, columns } };
}

type ColumnParse =
  | { outcome: "column"; column: ColumnDef }
  | { outcome: "feedback"; feedback: { reason: string; message: string } };

function parseColumn(line: string): ColumnParse {
  const tokens = line.split(/\s+/);
  const name = unquote(tokens[0]!);
  const rawType = (tokens[1] ?? "").toUpperCase();
  if (rawType.length === 0) {
    return { outcome: "feedback", feedback: { reason: "missing_type", message: `column '${name}' has no type` } };
  }

  const upper = line.toUpperCase();
  const isArray = rawType.endsWith("[]") || /\[\s*\]/.test(upper);
  const required = /\bNOT\s+NULL\b/.test(upper) || /\bPRIMARY\s+KEY\b/.test(upper);
  const isPk = /\bPRIMARY\s+KEY\b/.test(upper);

  const references = parseReferences(line);
  if (references !== undefined) {
    return {
      outcome: "column",
      column: isArray
        ? { name, type: ColumnType.FkArray, required, references }
        : { name, type: ColumnType.Fk, required, references },
    };
  }

  const enumValues = parseCheckInValues(line, name);
  if (enumValues !== undefined) {
    return { outcome: "column", column: { name, type: ColumnType.Enum, required, values: enumValues } };
  }

  if (isPk) {
    return { outcome: "column", column: { name, type: ColumnType.ZetaId, pk: true, required: true } };
  }

  return { outcome: "column", column: { name, type: mapScalarType(rawType), required } };
}

function mapScalarType(
  rawType: string,
): typeof ColumnType.Text | typeof ColumnType.Int | typeof ColumnType.Bool | typeof ColumnType.Timestamp {
  const base = rawType.replace(/\[\s*\]$/, "").replace(/\(.*$/, "");
  if (/^(TIMESTAMP|TIMESTAMPTZ|DATE|DATETIME)$/.test(base)) {
    return ColumnType.Timestamp;
  }
  if (/^(INT|INTEGER|BIGINT|SMALLINT|SERIAL|BIGSERIAL)$/.test(base)) {
    return ColumnType.Int;
  }
  if (/^(BOOL|BOOLEAN)$/.test(base)) {
    return ColumnType.Bool;
  }
  return ColumnType.Text;
}

function parseReferences(line: string): string | undefined {
  const m = /\breferences\s+["']?([A-Za-z_][A-Za-z0-9_.]*)["']?/i.exec(line);
  if (m === null) {
    return undefined;
  }
  return stripSchemaQualifier(m[1]!);
}

function parseCheckInValues(line: string, columnName: string): readonly string[] | undefined {
  const m = new RegExp(`check\\s*\\(\\s*["']?${columnName}["']?\\s+in\\s*\\(([^)]*)\\)`, "i").exec(line);
  if (m === null) {
    return undefined;
  }
  const values = m[1]!
    .split(",")
    .map((part) => unquote(part.trim()))
    .filter((part) => part.length > 0);
  return values.length > 0 ? values : undefined;
}

function splitTopLevelCommas(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of body) {
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    }
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim().length > 0) {
    parts.push(current);
  }
  return parts;
}

function unquote(value: string): string {
  return value.replace(/^["'`]/, "").replace(/["'`]$/, "");
}

function stripSchemaQualifier(value: string): string {
  const parts = value.split(".");
  return parts[parts.length - 1]!;
}
