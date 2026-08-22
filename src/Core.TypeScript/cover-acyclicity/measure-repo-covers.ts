#!/usr/bin/env bun
/**
 * measure-repo-covers.ts - point the acyclicity criterion at covers that exist in this repo.
 *
 *   bun src/Core.TypeScript/cover-acyclicity/measure-repo-covers.ts
 *
 * Reports, per cover, ALPHA-ACYCLIC (with its join tree) or CYCLIC (with the irreducible core).
 * A CYCLIC verdict is a FINDING, not a failure: it says this cover carries no local-implies-global
 * guarantee, so anything relying on one there needs a coordination protocol or a different carve.
 * The exit code is 0 either way - this reports, it does not gate.
 *
 * Work item: 081M0AH5TQQ087G0R003CNFRAF
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  coverFromSqlTables,
  coverFromZetaSchemas,
  formatReport,
  measure,
  parseCreateTables,
  type CoverMeasurement,
  type ZetaSchemaDoc,
} from "./repo-covers";
import { ordinalCompare } from "./gyo";

function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

/** The measurements, as data - so the test can pin them without re-running the CLI. */
export function measureRepoCovers(root: string): readonly CoverMeasurement[] {
  const out: CoverMeasurement[] = [];

  const imdbDir = join(root, "schemas", "imdb");
  if (existsSync(imdbDir)) {
    const files = readdirSync(imdbDir)
      .filter((f) => f.endsWith(".zetaschema.json"))
      .sort(ordinalCompare);
    const docs: ZetaSchemaDoc[] = files.map(
      (f) => JSON.parse(readFileSync(join(imdbDir, f), "utf8")) as ZetaSchemaDoc,
    );
    out.push(
      measure(
        "IMDb zetaschema cover",
        "schemas/imdb/*.zetaschema.json",
        coverFromZetaSchemas(docs),
      ),
    );
  }

  const factorySql = join(root, "samples", "FactoryDemo.Db", "schema.sql");
  if (existsSync(factorySql)) {
    const tables = parseCreateTables(readFileSync(factorySql, "utf8"));
    out.push(
      measure(
        "FactoryDemo cover - raw column names",
        "samples/FactoryDemo.Db/schema.sql (convention: raw)",
        coverFromSqlTables(tables, "raw"),
      ),
    );
    out.push(
      measure(
        "FactoryDemo cover - role-qualified (URA)",
        "samples/FactoryDemo.Db/schema.sql (convention: role-qualified)",
        coverFromSqlTables(tables, "role-qualified"),
      ),
    );
  }

  return out;
}

if (import.meta.main) {
  const measurements = measureRepoCovers(repoRoot());
  if (measurements.length === 0) {
    console.log("no covers found - run from the repo root or set REPO_ROOT");
  } else {
    process.stdout.write(formatReport(measurements));
  }
}
