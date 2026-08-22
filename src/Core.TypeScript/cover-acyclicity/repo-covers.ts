/**
 * repo-covers.ts - extract covers from artifacts that actually exist in this repo, and measure
 * them with the GYO criterion.
 *
 * A criterion nobody points at a real schema is a criterion nobody has tested. These extractors
 * are deliberately narrow and deliberately EXPLICIT about the modelling choice they make, because
 * the choice - not the algorithm - is where a cover measurement goes wrong.
 *
 * THE MODELLING CHOICE, stated once: alpha-acyclicity is a property of a hypergraph whose
 * vertices are ATTRIBUTES, and "same attribute" means "the same thing, measured in two places."
 * Column NAMES only approximate that. Two conventions are therefore offered and BOTH are
 * reported, because disagreeing verdicts would themselves be the finding:
 *
 *   - "raw"            - a column name is an attribute. Naive, and wrong wherever two tables use
 *                        the same word for different things (`id`, `created_at`, `name`).
 *   - "role-qualified" - the universal-relation-assumption discipline (Fagin, Mendelzon & Ullman,
 *                        TODS 7(3):343, 1982): an attribute name must denote one role globally.
 *                        Each table's primary key is renamed to the column name that OTHER tables
 *                        use to reference it - read off the declared FOREIGN KEYS, not guessed
 *                        from a pluralisation heuristic - and every non-key column is qualified by
 *                        its table.
 *
 * Pure functions over strings; the CLI at the bottom is the only thing that touches the disk.
 *
 * Work item: 081M0AH5TQQ087G0R003CNFRAF
 */

import { gyoReduce, ordinalCompare, type Cover, type GyoVerdict } from "./gyo";

// === zetaschema JSON ========================================================

/** The subset of `*.zetaschema.json` this reads. */
export interface ZetaSchemaDoc {
  readonly typeName: string;
  readonly fields: readonly { readonly name: string }[];
}

/**
 * A cover from a set of zetaschema documents: one edge per type, attributes are field names.
 *
 * No qualification is applied - these schemas are already role-named (`Tconst`, `Nconst` are the
 * IMDb keys and mean the same thing in every file, which is exactly the URA discipline the SQL
 * extractor below has to reconstruct).
 */
export function coverFromZetaSchemas(docs: readonly ZetaSchemaDoc[]): Cover {
  return docs
    .map((d) => ({ name: d.typeName, attributes: d.fields.map((f) => f.name) }))
    .sort((a, b) => ordinalCompare(a.name, b.name));
}

// === CREATE TABLE SQL =======================================================

export interface SqlTable {
  readonly table: string;
  readonly columns: readonly string[];
  /** Primary-key columns, in declaration order. */
  readonly primaryKey: readonly string[];
  /** `column -> referenced table.column`, from inline REFERENCES clauses. */
  readonly references: ReadonlyMap<string, { readonly table: string; readonly column: string }>;
}

const CREATE_TABLE = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\n\);/g;
const COLUMN_LINE = /^([A-Za-z_][A-Za-z0-9_]*)\s+[A-Za-z]/;
const REFERENCES = /REFERENCES\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/i;
const NON_COLUMN_PREFIX = /^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|EXCLUDE|LIKE)\b/i;

/**
 * Parse the CREATE TABLE statements out of a SQL script. Deliberately narrow: one column per
 * line, inline REFERENCES, inline PRIMARY KEY. It is a reader for the schemas in this repo, not a
 * SQL parser - anything it cannot read it skips, and a skipped table simply is not in the cover.
 *
 * Paren depth is tracked because a table CONSTRAINT can span lines and its continuation lines look
 * exactly like column definitions. The first version of this did not track depth and read
 * `stage IN ('Lead', ...)` - the body of a multi-line CHECK - as a second column named `stage`.
 * A duplicated attribute is harmless to GYO (sets dedupe), but it is a false reading of the
 * schema, and a cover measurement is worth exactly what its extraction is worth.
 */
export function parseCreateTables(sql: string): readonly SqlTable[] {
  const out: SqlTable[] = [];
  CREATE_TABLE.lastIndex = 0;
  for (let m = CREATE_TABLE.exec(sql); m !== null; m = CREATE_TABLE.exec(sql)) {
    const table = m[1]!;
    const body = m[2]!;
    const columns: string[] = [];
    const primaryKey: string[] = [];
    const references = new Map<string, { table: string; column: string }>();
    let depth = 0;
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      const atTopLevel = depth === 0;
      for (const ch of line) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
      if (!atTopLevel) continue;
      if (line.length === 0 || line.startsWith("--")) continue;
      if (NON_COLUMN_PREFIX.test(line)) continue;
      const cm = COLUMN_LINE.exec(line);
      if (cm === null) continue;
      const col = cm[1]!;
      columns.push(col);
      if (/\bPRIMARY\s+KEY\b/i.test(line)) primaryKey.push(col);
      const rm = REFERENCES.exec(line);
      if (rm !== null) references.set(col, { table: rm[1]!, column: rm[2]! });
    }
    out.push({ table, columns, primaryKey, references });
  }
  return out;
}

export type NamingConvention = "raw" | "role-qualified";

/**
 * Turn parsed tables into a cover under one of the two naming conventions (see the file header).
 *
 * Under "role-qualified" the renaming of a primary key is DERIVED from the foreign keys that
 * point at it - if `activities.customer_id REFERENCES customers(id)` then `customers.id` becomes
 * the attribute `customer_id`. When several distinct FK column names point at one key, the
 * ordinal-least is chosen so the result is deterministic; when none do, the key keeps its
 * table-qualified name (nothing joins on it, so it cannot create a cycle either way).
 */
export function coverFromSqlTables(tables: readonly SqlTable[], convention: NamingConvention): Cover {
  if (convention === "raw") {
    return tables.map((t) => ({ name: t.table, attributes: [...t.columns] }));
  }

  // referenced "table.column" -> the FK column names used to point at it
  const inbound = new Map<string, string[]>();
  for (const t of tables) {
    for (const [col, ref] of t.references) {
      const key = `${ref.table}.${ref.column}`;
      const list = inbound.get(key);
      if (list === undefined) inbound.set(key, [col]);
      else list.push(col);
    }
  }

  const rename = (table: string, column: string): string => {
    const inboundNames = inbound.get(`${table}.${column}`);
    if (inboundNames !== undefined && inboundNames.length > 0) {
      return [...inboundNames].sort(ordinalCompare)[0]!;
    }
    return `${table}.${column}`;
  };

  return tables.map((t) => {
    const keySet = new Set(t.primaryKey);
    const attributes = t.columns.map((c) => {
      if (keySet.has(c)) return rename(t.table, c);
      // A column that is itself a foreign key already carries the referenced key's global name.
      const ref = t.references.get(c);
      if (ref !== undefined) return rename(ref.table, ref.column);
      return `${t.table}.${c}`;
    });
    return { name: t.table, attributes };
  });
}

// === Reporting ==============================================================

export interface CoverMeasurement {
  readonly label: string;
  readonly source: string;
  readonly cover: Cover;
  readonly verdict: GyoVerdict;
}

export function measure(label: string, source: string, cover: Cover): CoverMeasurement {
  return { label, source, cover, verdict: gyoReduce(cover) };
}

/** A one-line-per-cover text report. Deterministic; no clock, no locale. */
export function formatReport(measurements: readonly CoverMeasurement[]): string {
  const lines: string[] = [];
  for (const m of measurements) {
    const v = m.verdict;
    lines.push(`${m.label}`);
    lines.push(`  source:   ${m.source}`);
    lines.push(`  elements: ${m.cover.length}`);
    if (v.acyclic) {
      lines.push(`  verdict:  ALPHA-ACYCLIC`);
      lines.push(
        `  meaning:  every pairwise-consistent instance over this cover has a universal relation`,
      );
      const treeEdges = v.joinTree.edges
        .map((e) => `${e.child}->${e.parent}`)
        .sort(ordinalCompare)
        .join(", ");
      lines.push(`  jointree: ${treeEdges.length === 0 ? "(single element)" : treeEdges}`);
    } else {
      lines.push(`  verdict:  CYCLIC`);
      lines.push(
        `  meaning:  NO guarantee - some pairwise-consistent instance has no universal relation`,
      );
      lines.push(`  core:     ${v.cyclicCore.map((e) => e.name).join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
