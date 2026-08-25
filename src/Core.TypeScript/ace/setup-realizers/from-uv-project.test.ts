// The gate is the whole point of this mechanism, so the gate is what is tested.
//
// A heavy lane that installs by default is the cost regression this exists to
// prevent, and "it skipped when I tried it" is exactly the claim CI exists to
// stop us making. Each branch below can fail.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSetupManifest } from "../setup-manifest.ts";
import { optInSatisfied } from "./from-uv-project.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..", "..");
const manifestPath = join(repoRoot, "tools", "setup", "manifests", "from-uv-project");

describe("from-uv-project opt-in gate", () => {
  test("an undeclared opt-in is REFUSED, not defaulted to install", () => {
    // The dangerous default. If this ever returns ok:true, every project in the
    // manifest installs on every host.
    expect(optInSatisfied(undefined, {}).ok).toBe(false);
    expect(optInSatisfied("", {}).ok).toBe(false);
  });

  test("the declared variable must be exactly '1'", () => {
    expect(optInSatisfied("ZETA_INSTALL_INTERP", {}).ok).toBe(false);
    expect(optInSatisfied("ZETA_INSTALL_INTERP", { ZETA_INSTALL_INTERP: "0" }).ok).toBe(false);
    expect(optInSatisfied("ZETA_INSTALL_INTERP", { ZETA_INSTALL_INTERP: "yes" }).ok).toBe(false);
    expect(optInSatisfied("ZETA_INSTALL_INTERP", { ZETA_INSTALL_INTERP: "1" }).ok).toBe(true);
  });

  test("a skip states which variable would enable it", () => {
    expect(optInSatisfied("ZETA_INSTALL_INTERP", {}).reason).toContain("ZETA_INSTALL_INTERP");
  });
});

describe("from-uv-project manifest", () => {
  const entries = parseSetupManifest(readFileSync(manifestPath, "utf8"));

  test("declares the interpretability lane", () => {
    expect(entries.map((e) => e.spec)).toContain("src/Interp.Python");
  });

  test("EVERY row carries an opt-in and a tier", () => {
    // The load-bearing assertion: adding a row without a gate fails here rather
    // than quietly adding hundreds of MB to every install.sh run.
    for (const entry of entries) {
      expect(entry.attrs["opt-in"]).toBeDefined();
      expect(entry.attrs.tier).toBeDefined();
    }
  });

  test("no row opts in on ZETA_INSTALL_FULL", () => {
    // ZETA_INSTALL_FULL=1 is set by macos-install-sh-test.yml, tlaps-proof.yml
    // and wsl-install-sh-test.yml. Those jobs test the INSTALLER; none of them
    // reads an activation, so none should pay for a ~111-192 MB torch wheel.
    for (const entry of entries) {
      expect(entry.attrs["opt-in"]).not.toBe("ZETA_INSTALL_FULL");
    }
  });

  test("every declared project exists and ships a committed lock", () => {
    for (const entry of entries) {
      const dir = join(repoRoot, entry.spec);
      expect(readFileSync(join(dir, "pyproject.toml"), "utf8").length).toBeGreaterThan(0);
      // `--frozen` installs only from a lock; a row without one would warn and
      // skip forever, which is a silent no-op wearing a green check.
      expect(readFileSync(join(dir, "uv.lock"), "utf8")).toContain("[[package]]");
    }
  });
});
