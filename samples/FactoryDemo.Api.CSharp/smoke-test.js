#!/usr/bin/env bun
// Factory-demo C# API smoke test — exercises all 9 endpoints (`/` plus
// the 8 `/api/*` routes) and validates the JSON-shape contract. Exits 0
// on pass, 1 on any failure.
//
// Usage:
//   bun samples/FactoryDemo.Api.CSharp/smoke-test.ts
//
// Starts the API on a random free port, waits for /, hits each endpoint,
// verifies response shape + key invariants (row counts, duplicate-pair
// identity, funnel totals). Stops the API cleanly on exit.
//
// Dependencies on host: dotnet. Uses native fetch (Bun built-in) instead
// of curl, and direct JSON access instead of jq.
import { spawn, spawnSync } from "bun";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";
import { mkdtempSync, readFileSync } from "fs";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(SCRIPT_DIR, "FactoryDemo.Api.CSharp.csproj");
// Check for dotnet
if (!Bun.which("dotnet")) {
    console.error("Missing required tool: dotnet");
    process.exit(2);
}
// Pick a high random port to avoid clashes with other dev services.
const PORT = 5100 + Math.floor(Math.random() * 400);
const BASE_URL = `http://localhost:${PORT}`;
console.log("Building API...");
const buildResult = spawnSync([
    "dotnet", "build", PROJECT, "-c", "Release", "--nologo", "-v", "quiet",
]);
if (buildResult.exitCode !== 0) {
    console.error("Build failed:");
    console.error(buildResult.stderr.toString());
    process.exit(1);
}
// Per-run server log
const logDir = mkdtempSync(join(tmpdir(), "factory-demo-api-csharp-"));
const LOG_FILE = join(logDir, "server.log");
console.log(`Starting API on ${BASE_URL} (server log: ${LOG_FILE})...`);
// Run API in background
const logFileHandle = Bun.file(LOG_FILE);
const apiProc = spawn(["dotnet", "run", "--project", PROJECT, "-c", "Release", "--no-build", "--urls", BASE_URL], {
    stdout: logFileHandle,
    stderr: logFileHandle,
});
// Cleanup on exit
function cleanup() {
    try {
        apiProc.kill();
    }
    catch {
        // already dead
    }
}
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(130); });
process.on("SIGTERM", () => { cleanup(); process.exit(143); });
// Wait for API to accept requests. Bounded — 20 attempts * 0.5s = 10s budget.
async function waitForReady() {
    for (let i = 0; i < 20; i++) {
        try {
            const resp = await fetch(`${BASE_URL}/`);
            if (resp.ok)
                return true;
        }
        catch {
            // not ready yet
        }
        await Bun.sleep(500);
    }
    return false;
}
let fail = 0;
async function check(label, path, extractor, expected) {
    try {
        const resp = await fetch(`${BASE_URL}${path}`);
        if (!resp.ok) {
            console.log(`  FAIL ${label.padEnd(50)} expected=${expected} got=HTTP ${resp.status}`);
            fail = 1;
            return;
        }
        const json = await resp.json();
        const actual = String(extractor(json));
        if (actual === expected) {
            console.log(`  OK   ${label.padEnd(50)} (${actual})`);
        }
        else {
            console.log(`  FAIL ${label.padEnd(50)} expected=${expected} got=${actual}`);
            fail = 1;
        }
    }
    catch (e) {
        console.log(`  FAIL ${label.padEnd(50)} expected=${expected} got=ERROR`);
        fail = 1;
    }
}
async function main() {
    const ready = await waitForReady();
    if (!ready) {
        console.error(`API did not come up within budget. Server log at ${LOG_FILE}:`);
        try {
            console.error(readFileSync(LOG_FILE, "utf-8"));
        }
        catch { /* empty log */ }
        cleanup();
        process.exit(1);
    }
    console.log("");
    console.log("Factory-demo C# API smoke test");
    console.log("==============================");
    // Root metadata
    await check("root.name contains 'Factory-demo'", "/", (j) => /Factory-demo/.test(j.name), "true");
    await check("root.version", "/", (j) => j.version, "0.0.1");
    await check("root.endpoints length", "/", (j) => j.endpoints.length, "9");
    // Collection counts
    await check("/api/customers length", "/api/customers", (j) => j.length, "20");
    await check("/api/opportunities length", "/api/opportunities", (j) => j.length, "30");
    await check("/api/activities length", "/api/activities", (j) => j.length, "33");
    // Single-item lookup
    await check("customer #1 name", "/api/customers/1", (j) => j.name, "Alice Plumbing LLC");
    await check("opportunity #1 stage", "/api/opportunities/1", (j) => j.stage, "Lead");
    // Per-customer activities
    await check("customer #1 activities count", "/api/customers/1/activities", (j) => j.length, "4");
    // Pipeline funnel — per-stage counts
    await check("funnel Lead count", "/api/pipeline/funnel", (j) => j.find((x) => x.stage === "Lead")?.count, "10");
    await check("funnel Qualified count", "/api/pipeline/funnel", (j) => j.find((x) => x.stage === "Qualified")?.count, "6");
    await check("funnel Won count", "/api/pipeline/funnel", (j) => j.find((x) => x.stage === "Won")?.count, "6");
    await check("funnel Lost count", "/api/pipeline/funnel", (j) => j.find((x) => x.stage === "Lost")?.count, "2");
    // Pipeline funnel — totals in cents
    await check("funnel Lead totalCents", "/api/pipeline/funnel", (j) => j.find((x) => x.stage === "Lead")?.totalCents, "5400000");
    await check("funnel Won totalCents", "/api/pipeline/funnel", (j) => j.find((x) => x.stage === "Won")?.totalCents, "2670000");
    // Duplicates
    await check("duplicate pairs count", "/api/pipeline/duplicates", (j) => j.length, "2");
    await check("alice@acme.example pair members", "/api/pipeline/duplicates", (j) => j.find((x) => x.email === "alice@acme.example")?.customerIds?.join(","), "1,13");
    await check("bob@trades.example pair members", "/api/pipeline/duplicates", (j) => j.find((x) => x.email === "bob@trades.example")?.customerIds?.join(","), "5,19");
    // 404 behavior
    try {
        const resp = await fetch(`${BASE_URL}/api/customers/999`);
        const status = resp.status;
        if (status === 404) {
            console.log(`  OK   ${"missing customer HTTP status".padEnd(50)} (404)`);
        }
        else {
            console.log(`  FAIL ${"missing customer HTTP status".padEnd(50)} expected=404 got=${status}`);
            fail = 1;
        }
    }
    catch {
        console.log(`  FAIL ${"missing customer HTTP status".padEnd(50)} expected=404 got=ERROR`);
        fail = 1;
    }
    console.log("");
    if (fail === 0) {
        console.log(`All checks passed. Server log: ${LOG_FILE}`);
        cleanup();
        process.exit(0);
    }
    else {
        console.log(`One or more checks failed — see ${LOG_FILE} for server output.`);
        cleanup();
        process.exit(1);
    }
}
main();
