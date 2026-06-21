import { describe, expect, test } from "bun:test";
import { env } from "node:process";
import { generateUpProjectionQuery, generateTimeTravelQuery, generateStreamCompositionQuery, formatAsOfSystemTime, CockroachUpProjectionSubstrate, } from "./cockroach-up-projection.js";
describe("CockroachDB Query Generation Unit Tests", () => {
    test("generateUpProjectionQuery builds correct recursive CTE SQL structure", () => {
        const rootId = "helm:app-v1";
        const { sql, parameters } = generateUpProjectionQuery(rootId, { maxDepth: 15 });
        expect(sql).toContain("WITH RECURSIVE up_projection AS");
        expect(sql).toContain("package_id = $1");
        expect(sql).toContain("u.level < $2");
        expect(sql).toContain("NOT (p.package_id = ANY(u.visited))");
        expect(parameters).toEqual([rootId, 15]);
    });
    test("formatAsOfSystemTime formats Date, number, and string correctly", () => {
        const date = new Date("2026-06-13T12:00:00.000Z");
        expect(formatAsOfSystemTime(date)).toBe("'2026-06-13T12:00:00.000Z'");
        expect(formatAsOfSystemTime(12345.6)).toBe("12345.6");
        expect(formatAsOfSystemTime("2026-06-13 12:00:00")).toBe("'2026-06-13 12:00:00'");
        expect(() => formatAsOfSystemTime("'; DROP TABLE packages;")).toThrow();
    });
    test("generateTimeTravelQuery appends AS OF SYSTEM TIME safely", () => {
        const rootId = "helm:app-v1";
        const date = new Date("2026-06-13T12:00:00.000Z");
        const { sql, parameters } = generateTimeTravelQuery(rootId, date, { maxDepth: 5 });
        expect(sql).toContain("packages AS OF SYSTEM TIME '2026-06-13T12:00:00.000Z'");
        expect(sql).toContain("dependencies AS OF SYSTEM TIME '2026-06-13T12:00:00.000Z'");
        expect(sql).toContain("u.level < $2");
        expect(parameters).toEqual([rootId, 5]);
    });
    test("generateStreamCompositionQuery joins streams and checks conflicts", () => {
        const rootA = "helm:a";
        const rootB = "helm:b";
        const { sql, parameters } = generateStreamCompositionQuery(rootA, rootB, { maxDepth: 10 });
        expect(sql).toContain("stream_a AS");
        expect(sql).toContain("stream_b AS");
        expect(sql).toContain("stream_a a");
        expect(sql).toContain("stream_b b ON a.name = b.name");
        expect(sql).toContain("a.version != b.version");
        expect(parameters).toEqual([rootA, rootB, 10]);
    });
});
describe("Substrate Execution with Mock Executor", () => {
    test("upsertPackage and project dispatch correct SQL and parameters", async () => {
        const executed = [];
        const mockExecutor = {
            query: async (sql, params) => {
                executed.push({ sql, params: params ?? [] });
                return { rows: [] };
            },
        };
        const substrate = new CockroachUpProjectionSubstrate(mockExecutor);
        await substrate.initializeSchema();
        expect(executed.length).toBeGreaterThanOrEqual(2);
        expect(executed[0].sql).toContain("CREATE TABLE IF NOT EXISTS packages");
        executed.length = 0; // reset logs
        const testPackage = {
            package_id: "npm:react-18.0.0",
            package_manager: "npm",
            name: "react",
            version: "18.0.0",
            cardinality: "N-allowed",
            namespace_scope: "per-consumer",
            multi_tenant: "shared",
            multi_use: "standard",
            security_posture: "sbom-verified",
            operator_policy: "none",
        };
        await substrate.upsertPackage(testPackage);
        expect(executed.length).toBe(1);
        expect(executed[0].sql).toContain("INSERT INTO packages");
        expect(executed[0].params[0]).toBe("npm:react-18.0.0");
        expect(executed[0].params[4]).toBe("N-allowed");
        executed.length = 0; // reset
        await substrate.project("npm:react-18.0.0", { maxDepth: 8 });
        expect(executed.length).toBe(1);
        expect(executed[0].sql).toContain("WITH RECURSIVE up_projection AS");
        expect(executed[0].params).toEqual(["npm:react-18.0.0", 8]);
    });
});
// Live Database Integration Tests (Optional)
const DB_URL = env.AGENTIC_ORG_COCKROACH_INTEGRATION_DATABASE_URL;
describe("CockroachDB Live Integration Tests", () => {
    test("creates schema, resolves dependencies, detects cycles and version conflicts", async () => {
        if (!DB_URL) {
            return;
        }
        // @ts-ignore
        const pgModule = (await import("pg"));
        const pool = new pgModule.Pool({ connectionString: DB_URL });
        const substrate = new CockroachUpProjectionSubstrate(pool);
        try {
            // 1. Setup tables
            await substrate.initializeSchema();
            // Clear any prior test entries
            await pool.query("DELETE FROM dependencies");
            await pool.query("DELETE FROM packages");
            // 2. Define packages graph
            // Root App A depends on Lib B (1.0.0). Lib B depends on Lib C (1.5.0)
            // Root App D depends on Lib E (1.0.0). Lib E depends on Lib C (1.6.0) -> Diamond conflict with A
            // Root App F depends on Lib G (1.0.0). Lib G depends on App F (1.0.0) -> Dependency cycle
            const packages = [
                {
                    package_id: "helm:app-a",
                    package_manager: "helm",
                    name: "app-a",
                    version: "1.0.0",
                    cardinality: "N-allowed",
                    namespace_scope: "namespace",
                    multi_tenant: "cross-tenant isolation",
                    multi_use: "standard",
                    security_posture: "signed",
                    operator_policy: "compliance-tier",
                },
                {
                    package_id: "npm:lib-b-1.0.0",
                    package_manager: "npm",
                    name: "lib-b",
                    version: "1.0.0",
                    cardinality: "N-allowed",
                    namespace_scope: "per-consumer",
                    multi_tenant: "shared",
                    multi_use: "standard",
                    security_posture: "sbom-verified",
                    operator_policy: "none",
                },
                {
                    package_id: "npm:lib-c-1.5.0",
                    package_manager: "npm",
                    name: "lib-c",
                    version: "1.5.0",
                    cardinality: "N-allowed",
                    namespace_scope: "per-consumer",
                    multi_tenant: "shared",
                    multi_use: "standard",
                    security_posture: "unverified",
                    operator_policy: "none",
                },
                {
                    package_id: "helm:app-d",
                    package_manager: "helm",
                    name: "app-d",
                    version: "1.0.0",
                    cardinality: "N-allowed",
                    namespace_scope: "namespace",
                    multi_tenant: "cross-tenant isolation",
                    multi_use: "standard",
                    security_posture: "signed",
                    operator_policy: "compliance-tier",
                },
                {
                    package_id: "npm:lib-e-1.0.0",
                    package_manager: "npm",
                    name: "lib-e",
                    version: "1.0.0",
                    cardinality: "N-allowed",
                    namespace_scope: "per-consumer",
                    multi_tenant: "shared",
                    multi_use: "standard",
                    security_posture: "sbom-verified",
                    operator_policy: "none",
                },
                {
                    package_id: "npm:lib-c-1.6.0",
                    package_manager: "npm",
                    name: "lib-c",
                    version: "1.6.0",
                    cardinality: "N-allowed",
                    namespace_scope: "per-consumer",
                    multi_tenant: "shared",
                    multi_use: "standard",
                    security_posture: "unverified",
                    operator_policy: "none",
                },
                {
                    package_id: "helm:app-f",
                    package_manager: "helm",
                    name: "app-f",
                    version: "1.0.0",
                    cardinality: "cluster-singleton",
                    namespace_scope: "cluster",
                    multi_tenant: "shared",
                    multi_use: "standard",
                    security_posture: "signed",
                    operator_policy: "environment",
                },
                {
                    package_id: "npm:lib-g-1.0.0",
                    package_manager: "npm",
                    name: "lib-g",
                    version: "1.0.0",
                    cardinality: "N-allowed",
                    namespace_scope: "per-consumer",
                    multi_tenant: "shared",
                    multi_use: "standard",
                    security_posture: "sbom-verified",
                    operator_policy: "none",
                },
            ];
            for (const pkg of packages) {
                await substrate.upsertPackage(pkg);
            }
            // 3. Define dependency edges
            const dependencies = [
                {
                    dependency_id: "edge-a-b",
                    source_package_id: "helm:app-a",
                    target_package_name: "lib-b",
                    target_package_version_constraint: "1.0.0",
                    relation_type: "depends_on",
                },
                {
                    dependency_id: "edge-b-c",
                    source_package_id: "npm:lib-b-1.0.0",
                    target_package_name: "lib-c",
                    target_package_version_constraint: "1.5.0",
                    relation_type: "depends_on",
                },
                {
                    dependency_id: "edge-d-e",
                    source_package_id: "helm:app-d",
                    target_package_name: "lib-e",
                    target_package_version_constraint: "1.0.0",
                    relation_type: "depends_on",
                },
                {
                    dependency_id: "edge-e-c",
                    source_package_id: "npm:lib-e-1.0.0",
                    target_package_name: "lib-c",
                    target_package_version_constraint: "1.6.0",
                    relation_type: "depends_on",
                },
                {
                    dependency_id: "edge-f-g",
                    source_package_id: "helm:app-f",
                    target_package_name: "lib-g",
                    target_package_version_constraint: "1.0.0",
                    relation_type: "depends_on",
                },
                {
                    dependency_id: "edge-g-f",
                    source_package_id: "npm:lib-g-1.0.0",
                    target_package_name: "app-f",
                    target_package_version_constraint: "1.0.0",
                    relation_type: "depends_on",
                },
            ];
            for (const dep of dependencies) {
                await substrate.upsertDependency(dep);
            }
            // 4. Test Up-projection traversal
            const projectionA = await substrate.project("helm:app-a");
            expect(projectionA.length).toBe(3); // A, B, C
            const names = projectionA.map((r) => r.name);
            expect(names).toContain("app-a");
            expect(names).toContain("lib-b");
            expect(names).toContain("lib-c");
            // Verify level values
            const cRow = projectionA.find((r) => r.name === "lib-c");
            expect(cRow.level).toBe(3);
            // 5. Test Dependency cycle resolution (NULL Escape Hatch / Cycle checking)
            const projectionF = await substrate.project("helm:app-f");
            expect(projectionF.length).toBe(2); // app-f, lib-g
            // 6. Test Stream composition conflict auditing
            const conflicts = await substrate.checkConflicts("helm:app-a", "helm:app-d");
            expect(conflicts.length).toBe(1);
            expect(conflicts[0].package_name).toBe("lib-c");
            expect(conflicts[0].version_a).toBe("1.5.0");
            expect(conflicts[0].version_b).toBe("1.6.0");
            // 7. Test Time Travel queries (AS OF SYSTEM TIME)
            const nowResult = (await pool.query("SELECT now() as now"));
            const testTime = nowResult.rows[0].now;
            // Update package version to test if we can travel back
            await substrate.upsertPackage({
                ...packages[0],
                version: "2.0.0",
            });
            const updatedProj = await substrate.project("helm:app-a");
            expect(updatedProj.find((r) => r.name === "app-a").version).toBe("2.0.0");
            // travel back using timestamp
            const pastProj = await substrate.project("helm:app-a", { asOfSystemTime: testTime });
            expect(pastProj.find((r) => r.name === "app-a").version).toBe("1.0.0");
        }
        finally {
            await pool.query("DELETE FROM dependencies").catch(() => undefined);
            await pool.query("DELETE FROM packages").catch(() => undefined);
            await pool.end();
        }
    });
});
