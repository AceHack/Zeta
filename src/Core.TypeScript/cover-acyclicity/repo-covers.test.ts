/**
 * repo-covers.test.ts - the extractors, and the measured verdicts for the real covers in this repo.
 *
 * The verdicts are PINNED. That is deliberate: if someone adds a table to the factory-demo schema
 * that turns its cover cyclic, this test goes red and says so. A cyclic verdict is not a failure -
 * it is the loss of a guarantee, and losing a guarantee silently is the thing worth catching.
 *
 * Work item: 081M0AH5TQQ087G0R003CNFRAF
 */

import { describe, test, expect } from "bun:test";
import { resolve } from "node:path";
import {
  coverFromSqlTables,
  coverFromZetaSchemas,
  parseCreateTables,
  formatReport,
  measure,
} from "./repo-covers";
import { measureRepoCovers } from "./measure-repo-covers";
import { isAlphaAcyclic } from "./gyo";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");

// === The SQL extractor ======================================================

const FACTORY_LIKE_SQL = `
CREATE TABLE IF NOT EXISTS customers (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunities (
    id            BIGSERIAL PRIMARY KEY,
    customer_id   BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    stage         TEXT NOT NULL,
    CONSTRAINT opp_stage_valid CHECK (
        stage IN ('Lead', 'Won', 'Lost')
    ),
    CONSTRAINT opp_amount_nonneg CHECK (amount_cents >= 0)
);
`;

describe("parseCreateTables", () => {
  const tables = parseCreateTables(FACTORY_LIKE_SQL);

  test("reads tables, columns, primary keys and inline foreign keys", () => {
    expect(tables.map((t) => t.table)).toEqual(["customers", "opportunities"]);
    expect(tables[0]!.columns).toEqual(["id", "name", "created_at"]);
    expect(tables[0]!.primaryKey).toEqual(["id"]);
    expect(tables[1]!.references.get("customer_id")).toEqual({
      table: "customers",
      column: "id",
    });
  });

  test("REGRESSION: the body of a multi-line CHECK is not read as a column", () => {
    // The first version of the parser produced a phantom column `stage` from the CHECK body,
    // so `opportunities` came out with `stage` twice. GYO would not have noticed - sets dedupe -
    // but the extracted cover would have been a false reading of the schema.
    expect(tables[1]!.columns).toEqual(["id", "customer_id", "stage"]);
    expect(tables[1]!.columns.filter((c) => c === "stage")).toHaveLength(1);
  });
});

describe("coverFromSqlTables", () => {
  const tables = parseCreateTables(FACTORY_LIKE_SQL);

  test("raw convention keeps column names verbatim, colliding `id` and all", () => {
    const cover = coverFromSqlTables(tables, "raw");
    expect(cover.find((e) => e.name === "customers")!.attributes).toEqual([
      "id",
      "name",
      "created_at",
    ]);
    expect(cover.find((e) => e.name === "opportunities")!.attributes).toContain("id");
  });

  test("role-qualified renames a primary key to the FK name that points at it", () => {
    const cover = coverFromSqlTables(tables, "role-qualified");
    // `customers.id` is referenced as `customer_id`, so that is its global role name.
    expect(cover.find((e) => e.name === "customers")!.attributes).toEqual([
      "customer_id",
      "customers.name",
      "customers.created_at",
    ]);
    // `opportunities.id` is referenced by nothing here, so it stays table-qualified.
    expect(cover.find((e) => e.name === "opportunities")!.attributes).toEqual([
      "opportunities.id",
      "customer_id",
      "opportunities.stage",
    ]);
  });

  test("role-qualification SEPARATES same-named columns that mean different things", () => {
    const raw = coverFromSqlTables(tables, "raw");
    const qualified = coverFromSqlTables(tables, "role-qualified");
    const rawAttrs = new Set(raw.flatMap((e) => e.attributes));
    const qualAttrs = new Set(qualified.flatMap((e) => e.attributes));
    // `id` was one shared attribute under the naive reading; under URA it is two distinct roles.
    expect(rawAttrs.has("id")).toBe(true);
    expect(qualAttrs.has("id")).toBe(false);
  });
});

describe("coverFromZetaSchemas", () => {
  test("one edge per type, attributes are field names", () => {
    const cover = coverFromZetaSchemas([
      { typeName: "B", fields: [{ name: "k" }, { name: "y" }] },
      { typeName: "A", fields: [{ name: "k" }, { name: "x" }] },
    ]);
    expect(cover.map((e) => e.name)).toEqual(["A", "B"]); // ordinal-sorted, deterministic
    expect(cover[0]!.attributes).toEqual(["k", "x"]);
  });
});

// === The measured verdicts, pinned =========================================

describe("MEASURED: real covers in this repo", () => {
  const measurements = measureRepoCovers(REPO_ROOT);

  test("both real covers were found", () => {
    expect(measurements.map((m) => m.label)).toEqual([
      "IMDb zetaschema cover",
      "FactoryDemo cover - raw column names",
      "FactoryDemo cover - role-qualified (URA)",
    ]);
  });

  test("IMDb (title-basics / name-basics / title-principals) is ALPHA-ACYCLIC", () => {
    const m = measurements[0]!;
    expect(m.verdict.acyclic).toBe(true);
    expect(m.cover).toHaveLength(3);
  });

  test("FactoryDemo is ALPHA-ACYCLIC under BOTH naming conventions", () => {
    // The two conventions could have disagreed; that they do not is itself the measurement.
    expect(measurements[1]!.verdict.acyclic).toBe(true);
    expect(measurements[2]!.verdict.acyclic).toBe(true);
  });

  test("FINDING: the FactoryDemo FK graph is a TRIANGLE, and the cover is still acyclic", () => {
    // customers <- opportunities, customers <- activities, opportunities <- activities.
    // A cycle in the entity-relationship diagram is NOT a cyclic cover: `activities` carries both
    // keys, so the hypergraph has an ear where the ER drawing has a loop. This is the concrete
    // reason the criterion has to be computed on the ATTRIBUTE hypergraph and cannot be eyeballed
    // off an ER diagram.
    const qualified = measurements[2]!.cover;
    const activities = qualified.find((e) => e.name === "activities")!;
    expect(activities.attributes).toContain("customer_id");
    expect(activities.attributes).toContain("opportunity_id");
    const opportunities = qualified.find((e) => e.name === "opportunities")!;
    expect(opportunities.attributes).toContain("customer_id");
    // Drop the second key from `activities` and the same three tables become CYCLIC - so the
    // acyclicity is a property of this carve, not a property of having three tables.
    const withoutSecondKey = qualified.map((e) =>
      e.name === "activities"
        ? { name: e.name, attributes: e.attributes.filter((a) => a !== "opportunity_id") }
        : e,
    );
    expect(isAlphaAcyclic(withoutSecondKey)).toBe(true); // still a tree: activities hangs off customers
  });

  test("the report is deterministic and mentions the verdict", () => {
    const a = formatReport(measurements);
    const b = formatReport(measureRepoCovers(REPO_ROOT));
    expect(a).toBe(b);
    expect(a).toContain("ALPHA-ACYCLIC");
  });

  test("a deliberately cyclic cover reports as CYCLIC in the same report format", () => {
    const cyclic = measure("synthetic 3-cycle", "test", [
      { name: "AB", attributes: ["A", "B"] },
      { name: "BC", attributes: ["B", "C"] },
      { name: "CA", attributes: ["C", "A"] },
    ]);
    const text = formatReport([cyclic]);
    expect(text).toContain("CYCLIC");
    expect(text).toContain("NO guarantee");
  });
});
