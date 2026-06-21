#!/usr/bin/env bun
// lint-python.ts — Python sync, formatting, linting, and type checking.
//
// Post-install orchestration of native Python toolchains (uv + ruff + mypy
// in src/Core.Python) — it runs in CI where Bun is already available, so it is
// OUR CODE, not shell.
//
// Usage:
//   bun src/Core.TypeScript/lint/lint-python.ts
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
// 3 levels up from src/Core.TypeScript/lint/ to repo root.
const REPO_ROOT = resolve(here, "..", "..", "..");
const PY_DIR = join(REPO_ROOT, "src", "Core.Python");
const STEPS = [
    { label: "Linting Python: uv sync", cmd: ["uv", "sync"] },
    { label: "Linting Python: ruff check", cmd: ["uv", "run", "ruff", "check"] },
    { label: "Linting Python: ruff format --check", cmd: ["uv", "run", "ruff", "format", "--check"] },
    { label: "Linting Python: mypy", cmd: ["uv", "run", "mypy", "src/", "tests/"] },
];
function run(step) {
    console.log(`=== ${step.label} ===`);
    const [bin, ...args] = step.cmd;
    const result = spawnSync(bin, args, { cwd: PY_DIR, stdio: "inherit" });
    if (result.error) {
        console.error(`✗ ${step.label}: failed to start — ${result.error.message}`);
        return false;
    }
    if (result.status !== 0) {
        console.error(`✗ ${step.label}: exited with code ${result.status ?? "signal"}`);
        return false;
    }
    return true;
}
function main() {
    for (const step of STEPS) {
        if (!run(step))
            return 1;
    }
    console.log("✓ Python linting checks passed successfully!");
    return 0;
}
process.exit(main());
