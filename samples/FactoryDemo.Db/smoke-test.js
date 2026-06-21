#!/usr/bin/env bun
// Factory-demo DB smoke test — confirms schema + seed applied correctly.
//
// Run after `docker-compose up -d`:
//   bun samples/FactoryDemo.Db/smoke-test.ts
//
// Exits 0 if the seed is present and shapes are correct; 1 otherwise.
// Uses `docker-compose exec` so no host-side psql is required.
import { spawnSync } from "bun";
import { dirname } from "path";
import { fileURLToPath } from "url";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
// Check if db service is running
const psCheck = spawnSync(["docker-compose", "ps", "--services"], {
    cwd: SCRIPT_DIR,
});
const services = psCheck.stdout.toString();
if (!services.includes("db")) {
    console.log("db service not running. Start it first:");
    console.log(`    cd ${SCRIPT_DIR} && docker-compose up -d`);
    process.exit(1);
}
// Wait for Postgres to accept connections before smoke-checking.
// The compose healthcheck covers container-up; pg_isready confirms the
// server is actually answering. Bounded: 30 attempts * 1s = 30s budget.
async function waitForPostgres() {
    process.stdout.write("Waiting for Postgres to accept connections");
    for (let i = 0; i < 30; i++) {
        const readyCheck = spawnSync(["docker-compose", "exec", "-T", "db", "pg_isready", "-U", "postgres", "-d", "postgres"], { cwd: SCRIPT_DIR });
        if (readyCheck.exitCode === 0) {
            console.log(" ready.");
            return true;
        }
        process.stdout.write(".");
        await Bun.sleep(1000);
    }
    console.log("");
    console.error("Postgres did not become ready within 30s.");
    return false;
}
const pgReady = await waitForPostgres();
if (!pgReady) {
    process.exit(1);
}
let fail = 0;
let lastPsqlStderr = "";
function runPsql(sql) {
    const result = spawnSync(["docker-compose", "exec", "-T", "db", "psql", "-U", "postgres", "-tAX", "-c", sql], { cwd: SCRIPT_DIR });
    lastPsqlStderr = result.stderr.toString();
    if (result.exitCode !== 0) {
        console.error(lastPsqlStderr);
    }
    // Trim all whitespace to match the bash version's `tr -d '[:space:]'`
    return result.stdout.toString().replace(/\s/g, "");
}
function check(label, sql, expected) {
    let actual;
    try {
        actual = runPsql(sql);
    }
    catch {
        actual = "";
    }
    if (actual === expected) {
        console.log(`  OK   ${label.padEnd(40)} (${actual})`);
    }
    else {
        console.log(`  FAIL ${label.padEnd(40)} expected=${expected} got=${actual}`);
        if (lastPsqlStderr) {
            console.log(`       psql stderr: ${lastPsqlStderr}`);
        }
        fail = 1;
    }
}
console.log("Factory-demo DB smoke test");
console.log("==========================");
check("customer row count", "SELECT COUNT(*) FROM customers;", "20");
check("opportunity row count", "SELECT COUNT(*) FROM opportunities;", "30");
check("activity row count", "SELECT COUNT(*) FROM activities;", "33");
check("duplicate-email groups", "SELECT COUNT(*) FROM (SELECT email FROM customers GROUP BY email HAVING COUNT(*) > 1) s;", "2");
check("Lead-stage opportunity count", "SELECT COUNT(*) FROM opportunities WHERE stage = 'Lead';", "10");
check("Won-stage opportunity count", "SELECT COUNT(*) FROM opportunities WHERE stage = 'Won';", "6");
check("Lost-stage opportunity count", "SELECT COUNT(*) FROM opportunities WHERE stage = 'Lost';", "2");
if (fail === 0) {
    console.log("");
    console.log("All checks passed.");
    process.exit(0);
}
else {
    console.log("");
    console.log("One or more checks failed — seed data may be missing or corrupted.");
    process.exit(1);
}
