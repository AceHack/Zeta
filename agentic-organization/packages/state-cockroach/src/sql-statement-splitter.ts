/**
 * Split a multi-statement SQL string into individual statements.
 *
 * Why this exists: CockroachDB runs a multi-statement query string sent over the
 * simple query protocol as ONE implicit transaction, and it forbids referencing
 * a column added by a DDL statement earlier in the same transaction. Our
 * work-anchor-kernel migration does `ALTER TABLE ... ADD COLUMN version` then
 * `UPDATE ... SET version = ...` — which fails with `column "version" does not
 * exist` (SQLSTATE 42703) when run as one query. Splitting into separate
 * statements (each its own implicit transaction) fixes it: the ADD COLUMN
 * commits before the UPDATE references the column.
 *
 * The splitter is semicolon-based but respects:
 *   - single-quoted string literals, including the SQL '' escaped-quote
 *   - line comments (-- to end of line) which may contain semicolons
 * Our migrations use no dollar-quoted ($$) blocks or block comments, so those
 * are intentionally out of scope (adding one would require extending this).
 */

export function splitSqlStatements(sql: string): readonly string[] {
  const statements: string[] = [];
  let current = "";
  let inString = false;
  let inLineComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i]!;
    const next = i + 1 < sql.length ? sql[i + 1] : "";

    if (inLineComment) {
      current += ch;
      if (ch === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inString) {
      current += ch;
      if (ch === "'") {
        if (next === "'") {
          // escaped quote: consume both, stay in string
          current += next;
          i += 1;
        } else {
          inString = false;
        }
      }
      continue;
    }

    // not in string or comment
    if (ch === "-" && next === "-") {
      inLineComment = true;
      current += ch;
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === ";") {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = "";
      continue;
    }
    current += ch;
  }

  const tail = current.trim();
  if (tail.length > 0) {
    statements.push(tail);
  }
  return statements;
}
