#!/usr/bin/env bun
/**
 * src/Core.TypeScript/kiro/launchd/install.ts — install Kiro loop as macOS launchd user agent.
 *
 * TS port of tools/kiro/launchd/install.sh. Since tools/setup/install.sh
 * guarantees bun is on PATH, all downstream service setup can be TS.
 *
 * Usage:
 *   bun src/Core.TypeScript/kiro/launchd/install.ts
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

const PLIST_LABEL = "com.lucent.zeta.kiro-loop";
const PLIST_NAME = `${PLIST_LABEL}.plist`;

function main(): number {
  const home = homedir();
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  const repoRoot = resolve(scriptDir, "../../..");

  const plistSrc = join(scriptDir, PLIST_NAME);
  const plistDst = join(home, "Library/LaunchAgents", PLIST_NAME);
  const logDir = join(home, "Library/Logs/zeta-kiro-loop");
  const stateDir = join(home, "Library/Application Support/ZetaKiroLoop");

  // Create directories
  mkdirSync(logDir, { recursive: true });
  mkdirSync(stateDir, { recursive: true });
  mkdirSync(join(home, "Library/LaunchAgents"), { recursive: true });

  // Unload if already loaded
  const uid = spawnSync("id", ["-u"], { encoding: "utf8" }).stdout.trim();
  spawnSync("launchctl", ["bootout", `gui/${uid}/${PLIST_LABEL}`], { stdio: "ignore" });

  // Template the plist
  if (!existsSync(plistSrc)) {
    process.stderr.write(`ERROR: plist template not found: ${plistSrc}\n`);
    return 1;
  }
  let content = readFileSync(plistSrc, "utf8");
  content = content.replace(/__USER_HOME__/g, home);
  content = content.replace(/__REPO_ROOT__/g, repoRoot);
  writeFileSync(plistDst, content);

  // Validate plist
  const lint = spawnSync("plutil", ["-lint", plistDst], { encoding: "utf8" });
  if (lint.status !== 0) {
    process.stderr.write(`ERROR: plist validation failed:\n${lint.stderr}\n`);
    return 1;
  }

  // Load the service
  const load = spawnSync("launchctl", ["bootstrap", `gui/${uid}`, plistDst], { encoding: "utf8" });
  if (load.status !== 0) {
    process.stderr.write(`ERROR: launchctl bootstrap failed:\n${load.stderr}\n`);
    return 1;
  }

  console.log("Kiro loop installed and running.");
  console.log(`  Label: ${PLIST_LABEL}`);
  console.log(`  Logs: ${logDir}`);
  console.log(`  State: ${stateDir}`);
  console.log(`  Unload: launchctl bootout gui/${uid}/${PLIST_LABEL}`);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}

export { main };
