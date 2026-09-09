#!/usr/bin/env bun
/**
 * CI-executed twin of nixos/tests/zeta-creds-to-k8s-eval-test.nix.
 * `nix flake check` is not run by any workflow on this flake; this file
 * is the gate that still fires. It reads the Nix module as text and
 * refuses wiring that would either take k3s down on a projector miss
 * or project before restore / before the API exists.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MODULE = fileURLToPath(
  new URL("../../../full-ai-cluster/nixos/modules/zeta-creds-to-k8s.nix", import.meta.url),
);
const COMMON = fileURLToPath(new URL("../../../full-ai-cluster/nixos/modules/common.nix", import.meta.url));

describe("zeta-creds-to-k8s.nix wiring lock", () => {
  const text = readFileSync(MODULE, "utf8");
  const common = readFileSync(COMMON, "utf8");

  test("common.nix imports the projector", () => {
    expect(common).toContain("./zeta-creds-to-k8s.nix");
  });

  test("control-plane default-on is role == server, not every node", () => {
    expect(common).toContain("zeta.credsToK8s.enable");
    expect(common).toContain('config.services.k3s.role == "server"');
  });

  test("unit waits for restore and k3s", () => {
    expect(text).toContain('"k3s.service"');
    expect(text).toContain('"zeta-creds-restore.service"');
    expect(text).toMatch(/after\s*=\s*\[[^\]]*"k3s\.service"/s);
    expect(text).toMatch(/after\s*=\s*\[[^\]]*"zeta-creds-restore\.service"/s);
  });

  test("projector miss does not take k3s down", () => {
    const hits = text.match(/requiredBy/g) ?? [];
    expect(hits).toHaveLength(2);
    expect(text).toContain("Failure does not take k3s down (no requiredBy).");
    expect(text).toContain("Deliberately NOT requiredBy k3s");
  });

  test("ExecStart calls the TypeScript projector, not a second shell implementation", () => {
    expect(text).toContain("zeta-creds-to-k8s.ts");
    expect(text).toContain("--k3s-bin");
    expect(text).toContain("MISSING precondition");
  });

  test("missing bun/script is a named skip; missing kubeconfig retries", () => {
    // T5 / 081M23BTKYK087G0R002J6E297. Lumping kubeconfig into the exit-0
    // skip loop + RemainAfterExit made first-boot look like projection ran.
    // k3s writes the admin kubeconfig after the unit has already succeeded.
    const skipLoop = text.match(/for _req in [^\n]+/)?.[0];
    expect(skipLoop).toBe("for _req in ${cfg.scriptPath} ${bunShimPath}; do");

    const kubeStart = text.indexOf('if [ ! -e "${cfg.kubeconfig}" ]; then');
    expect(kubeStart).toBeGreaterThan(-1);
    const kubeArm = text.slice(kubeStart, text.indexOf("\n          fi", kubeStart));
    const kubeLines = kubeArm
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
    expect(kubeLines.at(-1)).toBe("exit 1");
    expect(text).toContain('Restart = "on-failure"');
  });
});
