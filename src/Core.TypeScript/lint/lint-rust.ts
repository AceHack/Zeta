#!/usr/bin/env bun
// lint-rust.ts — Rust formatting and clippy checks.
//
// Post-install orchestration of native Rust toolchains (cargo fmt / cargo clippy)
// over all Cargo crates in the repository — it runs in CI where Bun is already available,
// so it is OUR CODE, not shell.
//
// Usage:
//   bun src/Core.TypeScript/lint/lint-rust.ts

import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// 3 levels up from src/Core.TypeScript/lint/ to repo root.
const REPO_ROOT = resolve(here, "..", "..", "..");
const SRC_DIR = join(REPO_ROOT, "src");

function findCargoTomls(dir: string): string[] {
  let results: string[] = [];
  const list = readdirSync(dir);
  for (const file of list) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".venv" && file !== "target" && file !== ".git") {
        results = results.concat(findCargoTomls(filePath));
      }
    } else if (file === "Cargo.toml") {
      results.push(filePath);
    }
  }
  return results;
}

function runCommand(bin: string, args: readonly string[], label: string): boolean {
  console.log(`=== ${label} ===`);
  const result = spawnSync(bin, args, { cwd: REPO_ROOT, stdio: "inherit" });
  if (result.error) {
    console.error(`✗ ${label}: failed to start — ${result.error.message}`);
    return false;
  }
  if (result.status !== 0) {
    console.error(`✗ ${label}: exited with code ${result.status ?? "signal"}`);
    return false;
  }
  return true;
}

function main(): number {
  const cargoTomls = findCargoTomls(SRC_DIR).sort();
  if (cargoTomls.length === 0) {
    console.error("✗ No Cargo.toml files found under src/ — refusing to pass on an empty surface");
    return 1;
  }

  for (const tomlPath of cargoTomls) {
    const crateName = dirname(tomlPath).split("/").pop() ?? tomlPath;

    const fmtOk = runCommand(
      "cargo",
      ["fmt", "--check", "--manifest-path", tomlPath],
      `Formatting check for Rust crate: ${crateName}`,
    );
    if (!fmtOk) return 1;

    const clippyOk = runCommand(
      "cargo",
      ["clippy", "--locked", "--manifest-path", tomlPath, "--all-targets", "--", "-D", "warnings"],
      `Clippy lint checks for Rust crate: ${crateName}`,
    );
    if (!clippyOk) return 1;
  }

  console.log("✓ All Rust formatting and clippy checks passed successfully!");
  return 0;
}

process.exit(main());
