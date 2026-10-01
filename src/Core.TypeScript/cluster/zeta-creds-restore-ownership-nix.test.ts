#!/usr/bin/env bun
/**
 * zeta-creds-restore-ownership-nix.test.ts — the restore unit must always get to its
 * ownership pass, and the pass must reach everything root created in the home.
 *
 * `zeta-creds-restore.service` runs as ROOT with HOME=/home/zeta under `set -euo pipefail`.
 * Two properties of the old script left root-owned files in the operator's home:
 *
 *   1. The restore CLI's non-zero exit terminated the script before the chown pass, so a
 *      restore that died half-way left everything it had already written root-owned.
 *   2. The pass was `find ... -maxdepth 4`, which covers the manifest's own paths but not
 *      what the root-run bun/mise shim creates below them (~/.cache/mise/<tool>/<ver>/...).
 *
 * `nix flake check` is not run by any workflow on this flake; this reads the module as
 * text (the `zeta-creds-to-k8s-nix.test.ts` pattern) and is the gate that still fires.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MODULE = fileURLToPath(
  new URL("../../../full-ai-cluster/nixos/modules/zeta-creds-restore.nix", import.meta.url),
);
const raw = readFileSync(MODULE, "utf8");
/** Nix with whole-line `#` comments removed so prose can neither satisfy nor trip a check. */
const code = raw
  .split("\n")
  .filter((l) => !/^\s*#/.test(l))
  .join("\n");

describe("zeta-creds-restore.nix ownership pass", () => {
  test("the restore CLI's exit status is held, not fatal, so the chown pass always runs", () => {
    // Both arms (serial-tee and plain) must capture the status instead of dying under `set -e`.
    const arms = code.match(/\|\| RESTORE_RC=\$\?/g) ?? [];
    expect(arms).toHaveLength(2);
    expect(code).toContain("RESTORE_RC=0");
  });

  test("the held status is re-raised AFTER the ownership pass, never before", () => {
    const chown = code.indexOf("chown -h");
    const exit = code.indexOf('exit "$RESTORE_RC"');
    expect(chown).toBeGreaterThan(-1);
    expect(exit).toBeGreaterThan(chown);
    // ...so the unit still fails (and Restart=on-failure still retries) when the restore did.
    expect(code.indexOf("RESTORE_RC=0")).toBeLessThan(chown);
  });

  test("the pass has no depth cap", () => {
    expect(code).not.toMatch(/-maxdepth/);
    expect(code).toMatch(/find "\$\{cfg\.home\}" -xdev -user root/);
  });

  test("a root-owned symlink is re-owned itself, never its target", () => {
    expect(code).toMatch(/chown -h \$\{cfg\.user\}:\$\{cfg\.group\}/);
  });

  test("the pass is still scoped to files root owns (the operator's own files are untouched)", () => {
    expect(code).toContain("-user root");
  });
});
