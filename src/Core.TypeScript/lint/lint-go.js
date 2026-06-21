#!/usr/bin/env bun
// lint-go.ts — Go formatting and linting checks.
//
// Post-install orchestration of native Go toolchains (gofmt / golangci-lint
// in src/Core.Go) — it runs in CI where Bun is already available, so it is
// OUR CODE, not shell.
//
// FORMATTING IS VERIFIED, NOT APPLIED. We run `gofmt -l` (list files that are
// not formatted) and FAIL if any are listed — like every other language's
// `--check` / `--verify-no-changes`. The earlier `go fmt ./...` REWROTE files
// in place and returned 0, so committed Go format drift never failed the gate
// (it was silently auto-fixed on each run and re-drifted on the next commit).
//
// Usage:
//   bun src/Core.TypeScript/lint/lint-go.ts
//   # to fix drift locally: (cd src/Core.Go && gofmt -w .)
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
// 3 levels up from src/Core.TypeScript/lint/ to repo root.
const REPO_ROOT = resolve(here, "..", "..", "..");
const GO_DIR = join(REPO_ROOT, "src", "Core.Go");
/** gofmt -l lists unformatted files and exits 0 even when it lists some, so we
 * must FAIL on non-empty output (not on exit code). Never mutates. */
function checkFormatting() {
    console.log("=== Linting Go: gofmt -l (verify, no mutate) ===");
    const result = spawnSync("gofmt", ["-l", "."], { cwd: GO_DIR, encoding: "utf8" });
    if (result.error) {
        console.error(`✗ gofmt: failed to start — ${result.error.message}`);
        return false;
    }
    const listed = (result.stdout ?? "").trim();
    if (listed.length > 0) {
        console.error("✗ Go formatting drift — these files are not gofmt-clean:");
        console.error(listed);
        console.error("  Fix with: (cd src/Core.Go && gofmt -w .)");
        return false;
    }
    return true;
}
/** golangci-lint: exit-code based (0 = clean). */
function checkLint() {
    console.log("=== Linting Go: golangci-lint ===");
    const result = spawnSync("golangci-lint", ["run", "./..."], { cwd: GO_DIR, stdio: "inherit" });
    if (result.error) {
        console.error(`✗ golangci-lint: failed to start — ${result.error.message}`);
        return false;
    }
    if (result.status !== 0) {
        console.error(`✗ golangci-lint: exited with code ${result.status ?? "signal"}`);
        return false;
    }
    return true;
}
function main() {
    // Run BOTH (don't short-circuit) so one run surfaces format + lint issues together.
    const okFmt = checkFormatting();
    const okLint = checkLint();
    if (!okFmt || !okLint)
        return 1;
    console.log("✓ Go linting checks passed successfully!");
    return 0;
}
process.exit(main());
