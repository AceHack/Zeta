/**
 * 081KSRGFP0008QG0R002FB1M0T: CockroachDB Substrate for the Up-Projection
 * Exposes schemas, query generators, and execution helper classes for running
 * recursive transitive dependency resolutions (up-projections) with cycle checking
 * (NULL escape hatch), time-travel (AS OF SYSTEM TIME), and stream composition.
 */
export const GET_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS packages (
  package_id STRING PRIMARY KEY,
  package_manager STRING NOT NULL,
  name STRING NOT NULL,
  version STRING NOT NULL,
  cardinality STRING NOT NULL CHECK (cardinality IN ('cluster-singleton', 'N-allowed')),
  namespace_scope STRING NOT NULL CHECK (namespace_scope IN ('cluster', 'namespace', 'per-consumer')),
  multi_tenant STRING NOT NULL CHECK (multi_tenant IN ('cross-tenant isolation', 'shared')),
  multi_use STRING NOT NULL CHECK (multi_use IN ('intra-tenant use-axis', 'standard')),
  security_posture STRING NOT NULL CHECK (security_posture IN ('signed', 'sbom-verified', 'vuln-scan-status', 'unverified')),
  operator_policy STRING NOT NULL CHECK (operator_policy IN ('environment', 'org-policy', 'compliance-tier', 'none')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dependencies (
  dependency_id STRING PRIMARY KEY,
  source_package_id STRING NOT NULL REFERENCES packages(package_id) ON DELETE CASCADE,
  target_package_name STRING NOT NULL,
  target_package_version_constraint STRING NOT NULL,
  relation_type STRING NOT NULL CHECK (relation_type IN ('depends_on', 'conflicts_with', 'provides', 'replaces'))
);
`.trim();
/**
 * Format date or timestamp for CockroachDB AS OF SYSTEM TIME safely.
 */
export function formatAsOfSystemTime(time) {
    if (time instanceof Date) {
        return `'${time.toISOString()}'`;
    }
    if (typeof time === "number") {
        // If it's a timestamp number (seconds or milliseconds)
        return time.toString();
    }
    if (typeof time === "string") {
        if (/^[a-zA-Z0-9\s:._+-]+$/.test(time)) {
            return `'${time}'`;
        }
    }
    throw new Error(`Invalid AS OF SYSTEM TIME expression: ${time}`);
}
/**
 * Generates recursive CTE query resolving transitive dependencies.
 * Uses a visited array of package_ids to prevent infinite loops (NULL/termination escape hatch).
 */
export function generateUpProjectionQuery(rootPackageId, options) {
    const maxDepth = options?.maxDepth ?? 100;
    const sql = `
WITH RECURSIVE up_projection AS (
  SELECT
    package_id,
    package_manager,
    name,
    version,
    cardinality,
    namespace_scope,
    multi_tenant,
    multi_use,
    security_posture,
    operator_policy,
    1 AS level,
    ARRAY[package_id] AS visited
  FROM packages
  WHERE package_id = $1

  UNION ALL

  SELECT
    p.package_id,
    p.package_manager,
    p.name,
    p.version,
    p.cardinality,
    p.namespace_scope,
    p.multi_tenant,
    p.multi_use,
    p.security_posture,
    p.operator_policy,
    u.level + 1 AS level,
    u.visited || p.package_id AS visited
  FROM up_projection u
  JOIN dependencies d ON u.package_id = d.source_package_id
  JOIN packages p ON d.target_package_name = p.name AND p.version = d.target_package_version_constraint
  WHERE NOT (p.package_id = ANY(u.visited))
    AND u.level < $2
)
SELECT
  package_id,
  package_manager,
  name,
  version,
  cardinality,
  namespace_scope,
  multi_tenant,
  multi_use,
  security_posture,
  operator_policy,
  level,
  visited
FROM up_projection;
`.trim();
    return { sql, parameters: [rootPackageId, maxDepth] };
}
/**
 * Generates recursive CTE query utilizing AS OF SYSTEM TIME temporal tables.
 */
export function generateTimeTravelQuery(rootPackageId, asOfSystemTime, options) {
    const maxDepth = options?.maxDepth ?? 100;
    const timeExpr = formatAsOfSystemTime(asOfSystemTime);
    const sql = `
WITH RECURSIVE up_projection AS (
  SELECT
    package_id,
    package_manager,
    name,
    version,
    cardinality,
    namespace_scope,
    multi_tenant,
    multi_use,
    security_posture,
    operator_policy,
    1 AS level,
    ARRAY[package_id] AS visited
  FROM packages AS OF SYSTEM TIME ${timeExpr}
  WHERE package_id = $1

  UNION ALL

  SELECT
    p.package_id,
    p.package_manager,
    p.name,
    p.version,
    p.cardinality,
    p.namespace_scope,
    p.multi_tenant,
    p.multi_use,
    p.security_posture,
    p.operator_policy,
    u.level + 1 AS level,
    u.visited || p.package_id AS visited
  FROM up_projection u
  JOIN dependencies AS OF SYSTEM TIME ${timeExpr} d ON u.package_id = d.source_package_id
  JOIN packages AS OF SYSTEM TIME ${timeExpr} p ON d.target_package_name = p.name AND p.version = d.target_package_version_constraint
  WHERE NOT (p.package_id = ANY(u.visited))
    AND u.level < $2
)
SELECT
  package_id,
  package_manager,
  name,
  version,
  cardinality,
  namespace_scope,
  multi_tenant,
  multi_use,
  security_posture,
  operator_policy,
  level,
  visited
FROM up_projection;
`.trim();
    return { sql, parameters: [rootPackageId, maxDepth] };
}
/**
 * Composes two recursive CTE generators and reports diamond dependency conflicts
 * (same package name, different transitive versions).
 */
export function generateStreamCompositionQuery(rootPackageIdA, rootPackageIdB, options) {
    const maxDepth = options?.maxDepth ?? 100;
    const sql = `
WITH RECURSIVE stream_a AS (
  SELECT
    package_id,
    package_manager,
    name,
    version,
    cardinality,
    namespace_scope,
    multi_tenant,
    multi_use,
    security_posture,
    operator_policy,
    1 AS level,
    ARRAY[package_id] AS visited
  FROM packages
  WHERE package_id = $1

  UNION ALL

  SELECT
    p.package_id,
    p.package_manager,
    p.name,
    p.version,
    p.cardinality,
    p.namespace_scope,
    p.multi_tenant,
    p.multi_use,
    p.security_posture,
    p.operator_policy,
    u.level + 1 AS level,
    u.visited || p.package_id AS visited
  FROM stream_a u
  JOIN dependencies d ON u.package_id = d.source_package_id
  JOIN packages p ON d.target_package_name = p.name AND p.version = d.target_package_version_constraint
  WHERE NOT (p.package_id = ANY(u.visited))
    AND u.level < $3
),
stream_b AS (
  SELECT
    package_id,
    package_manager,
    name,
    version,
    cardinality,
    namespace_scope,
    multi_tenant,
    multi_use,
    security_posture,
    operator_policy,
    1 AS level,
    ARRAY[package_id] AS visited
  FROM packages
  WHERE package_id = $2

  UNION ALL

  SELECT
    p.package_id,
    p.package_manager,
    p.name,
    p.version,
    p.cardinality,
    p.namespace_scope,
    p.multi_tenant,
    p.multi_use,
    p.security_posture,
    p.operator_policy,
    u.level + 1 AS level,
    u.visited || p.package_id AS visited
  FROM stream_b u
  JOIN dependencies d ON u.package_id = d.source_package_id
  JOIN packages p ON d.target_package_name = p.name AND p.version = d.target_package_version_constraint
  WHERE NOT (p.package_id = ANY(u.visited))
    AND u.level < $3
)
SELECT
  a.name AS package_name,
  a.package_id AS id_a,
  a.version AS version_a,
  b.package_id AS id_b,
  b.version AS version_b,
  'version_mismatch' AS conflict_type,
  'Package version mismatch between composed dependency streams' AS description
FROM stream_a a
JOIN stream_b b ON a.name = b.name
WHERE a.version != b.version;
`.trim();
    return { sql, parameters: [rootPackageIdA, rootPackageIdB, maxDepth] };
}
/**
 * Concrete substrate layer class wrapping a database executor connection.
 */
export class CockroachUpProjectionSubstrate {
    executor;
    constructor(executor) {
        this.executor = executor;
    }
    /** Create packages and dependencies tables. */
    async initializeSchema() {
        const statements = GET_SCHEMA_DDL.split(";")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        for (const stmt of statements) {
            await this.executor.query(stmt);
        }
    }
    /** Upsert a package vertex node. */
    async upsertPackage(pkg) {
        const sql = `
INSERT INTO packages (
  package_id, package_manager, name, version,
  cardinality, namespace_scope, multi_tenant, multi_use,
  security_posture, operator_policy, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, DEFAULT)
ON CONFLICT (package_id) DO UPDATE SET
  package_manager = EXCLUDED.package_manager,
  name = EXCLUDED.name,
  version = EXCLUDED.version,
  cardinality = EXCLUDED.cardinality,
  namespace_scope = EXCLUDED.namespace_scope,
  multi_tenant = EXCLUDED.multi_tenant,
  multi_use = EXCLUDED.multi_use,
  security_posture = EXCLUDED.security_posture,
  operator_policy = EXCLUDED.operator_policy,
  updated_at = now();
`.trim();
        await this.executor.query(sql, [
            pkg.package_id,
            pkg.package_manager,
            pkg.name,
            pkg.version,
            pkg.cardinality,
            pkg.namespace_scope,
            pkg.multi_tenant,
            pkg.multi_use,
            pkg.security_posture,
            pkg.operator_policy,
        ]);
    }
    /** Upsert a dependency edge. */
    async upsertDependency(dep) {
        const sql = `
INSERT INTO dependencies (
  dependency_id, source_package_id, target_package_name,
  target_package_version_constraint, relation_type
) VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (dependency_id) DO UPDATE SET
  source_package_id = EXCLUDED.source_package_id,
  target_package_name = EXCLUDED.target_package_name,
  target_package_version_constraint = EXCLUDED.target_package_version_constraint,
  relation_type = EXCLUDED.relation_type;
`.trim();
        await this.executor.query(sql, [
            dep.dependency_id,
            dep.source_package_id,
            dep.target_package_name,
            dep.target_package_version_constraint,
            dep.relation_type,
        ]);
    }
    /** Run a recursive CTE up-projection query. */
    async project(rootPackageId, options) {
        const maxDepth = options?.maxDepth;
        const query = options?.asOfSystemTime !== undefined
            ? generateTimeTravelQuery(rootPackageId, options.asOfSystemTime, maxDepth !== undefined ? { maxDepth } : undefined)
            : generateUpProjectionQuery(rootPackageId, maxDepth !== undefined ? { maxDepth } : undefined);
        const result = await this.executor.query(query.sql, query.parameters);
        return result.rows;
    }
    /** Audit conflicts between two composed CTE streams. */
    async checkConflicts(rootPackageIdA, rootPackageIdB, options) {
        const maxDepth = options?.maxDepth;
        const query = generateStreamCompositionQuery(rootPackageIdA, rootPackageIdB, maxDepth !== undefined ? { maxDepth } : undefined);
        const result = await this.executor.query(query.sql, query.parameters);
        return result.rows;
    }
}
