#!/usr/bin/env bun
// lint-tlc-model-registry.ts -- the drift guard for registry/tlc-models.json.
//
// If a spec is run with flags other than its pinned ones, that is a FAILURE, not a
// footnote. This checker is the loud half of that: it refuses a .cfg that no model
// entry claims (which is how twelve configs sat ungated for a day without anyone
// being able to see it), a model whose files are gone, a violation-expecting model
// with no pinned error string, and a CHECK_DEADLOCK declaration that disagrees with
// what the registry says the deadlock check is worth.
//
// Exit codes: 0 clean, 1 drift found, 2 registry unreadable.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  REGISTRY_RELATIVE_PATH,
  SPECS_RELATIVE_PATH,
  loadTlcRegistry,
  type TlcModel,
  type TlcRegistry,
} from "../formal-verification/tlc-invocation";

export function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (result.status !== 0) return process.cwd();
  return result.stdout.trim();
}

/** True when the .cfg turns deadlock checking off on a line that is not a comment.
 *  TLA+ config comments start with a backslash-star, so a commented rationale line
 *  mentioning CHECK_DEADLOCK must not count as a declaration. */
export function cfgDisablesDeadlock(cfgText: string): boolean {
  return cfgText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !line.startsWith("\\"))
    .some((line) => /^CHECK_DEADLOCK\s+FALSE\b/.test(line));
}

function checkModelShape(model: TlcModel, problems: string[]): void {
  if (model.expect === "violation") {
    if ((model.expectDetail ?? "") === "") {
      problems.push(model.id + ": expect is violation but no expectDetail is pinned. A witness that starts violating a different property would pass.");
    }
    if (model.exitCode === 0) {
      problems.push(model.id + ": expect is violation but exitCode is 0.");
    }
  } else if (model.exitCode !== 0) {
    problems.push(model.id + ": expect is valid but exitCode is " + String(model.exitCode) + ".");
  }
  if (model.tier === "extended" && (model.tierReason ?? "") === "") {
    problems.push(model.id + ": tier is extended with no tierReason. An ungated model must say why out loud.");
  }
  if (model.distinctStates !== undefined && model.haltDistinctStates !== undefined) {
    problems.push(model.id + ": carries both distinctStates (asserted) and haltDistinctStates (recorded). A run is exhaustive or it halts, not both.");
  }
  if (model.expect === "valid" && model.haltDistinctStates !== undefined) {
    problems.push(model.id + ": expect is valid but carries haltDistinctStates.");
  }
}

export function checkTlcModelRegistry(root: string): readonly string[] {
  const problems: string[] = [];
  let registry: TlcRegistry;
  try {
    registry = loadTlcRegistry(root);
  } catch (error) {
    return [REGISTRY_RELATIVE_PATH + " is unreadable: " + String(error)];
  }
  const specsPath = join(root, SPECS_RELATIVE_PATH);

  const seen = new Map<string, string>();
  for (const model of registry.models) {
    const previous = seen.get(model.id);
    if (previous !== undefined) problems.push("duplicate model id " + model.id + ".");
    seen.set(model.id, model.config);
    checkModelShape(model, problems);
    const cfgPath = join(specsPath, model.config);
    const tlaPath = join(specsPath, model.module + ".tla");
    if (!existsSync(cfgPath)) {
      problems.push(model.id + ": config " + model.config + " does not exist.");
      continue;
    }
    if (!existsSync(tlaPath)) {
      problems.push(model.id + ": module " + model.module + ".tla does not exist.");
    }
    const declaredOff = cfgDisablesDeadlock(readFileSync(cfgPath, "utf8"));
    if (declaredOff && model.deadlock !== "off-cfg") {
      problems.push(model.id + ": " + model.config + " declares CHECK_DEADLOCK FALSE but the registry records deadlock as " + model.deadlock + ".");
    }
    if (!declaredOff && model.deadlock === "off-cfg") {
      problems.push(model.id + ": registry records deadlock as off-cfg but " + model.config + " does not declare CHECK_DEADLOCK FALSE.");
    }
  }

  const claimed = new Set(registry.models.map((m) => m.config));
  const onDisk = readdirSync(specsPath).filter((f) => f.endsWith(".cfg")).sort();
  for (const cfg of onDisk) {
    if (!claimed.has(cfg)) {
      problems.push(cfg + " exists on disk and NO model entry claims it, so nothing runs it. Add an entry to " + REGISTRY_RELATIVE_PATH + " -- a config that never executes must not look like one that passed.");
    }
  }

  const jarPath = join(root, registry.toolchain.jar);
  if (existsSync(jarPath)) {
    const actual = createHash("sha256").update(readFileSync(jarPath)).digest("hex");
    if (actual !== registry.toolchain.jarSha256) {
      problems.push("toolchain drift: " + registry.toolchain.jar + " hashes to " + actual + ", registry pins " + registry.toolchain.jarSha256 + ". A different TLC is a different experiment; update the pin and re-measure every distinctStates.");
    }
  }
  return problems;
}

function main(): number {
  const root = repoRoot();
  const problems = checkTlcModelRegistry(root);
  if (problems.length === 0) {
    process.stdout.write("OK: " + REGISTRY_RELATIVE_PATH + " agrees with " + SPECS_RELATIVE_PATH + "\n");
    return 0;
  }
  for (const problem of problems) process.stderr.write("DRIFT: " + problem + "\n");
  process.stderr.write("\n" + String(problems.length) + " problem(s).\n");
  return 1;
}

if (import.meta.main) {
  process.exit(main());
}
