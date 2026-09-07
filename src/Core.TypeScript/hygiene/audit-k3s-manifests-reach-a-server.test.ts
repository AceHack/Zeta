import { describe, expect, test } from "bun:test";
import {
  ACKNOWLEDGED,
  MIN_EXPECTED_HOSTS,
  auditHosts,
  findings,
  parseImports,
  type HostFacts,
} from "./audit-k3s-manifests-reach-a-server.ts";

describe("the mechanism, on synthetic hosts", () => {
  const server: HostFacts = { host: "cp", imports: [], manifestModules: ["a.nix"], declaresServer: true };
  const agent: HostFacts = { host: "w", imports: [], manifestModules: ["a.nix"], declaresServer: false };
  const plain: HostFacts = { host: "p", imports: [], manifestModules: [], declaresServer: false };

  test("an agent declaring manifests is a finding; a server is not; no manifests is not", () => {
    // All three branches, so this cannot pass by the rule never firing.
    expect(findings([agent]).length).toBe(1);
    expect(findings([server])).toEqual([]);
    expect(findings([plain])).toEqual([]);
  });

  test("the finding NAMES the consequence, not just the condition", () => {
    const f = findings([agent])[0] ?? "";
    expect(f).toContain("never applied");
    expect(f).toContain("/var/lib/rancher/k3s/server/manifests");
  });
});

describe("import parsing", () => {
  test("reads the imports block and ignores paths outside it", () => {
    expect(
      parseImports(`{
  imports = [
    ./hardware-configuration.nix
    ../../modules/common.nix
    ../../modules/k3s-agent.nix
  ];
  # not an import: ../../modules/decoy.nix
}`),
    ).toEqual(["hardware-configuration.nix", "common.nix", "k3s-agent.nix"]);
  });

  test("no imports block yields nothing rather than throwing", () => {
    expect(parseImports("{ networking.hostName = \"x\"; }")).toEqual([]);
  });
});

describe("against the real tree", () => {
  const facts = auditHosts(process.cwd());

  test("the scan is not vacuous — it found the hosts", () => {
    expect(facts.length).toBeGreaterThanOrEqual(MIN_EXPECTED_HOSTS);
  });

  test("control-plane is a server and worker-gpu is not — the asymmetry this audit is about", () => {
    const cp = facts.find((f) => f.host === "control-plane");
    const wg = facts.find((f) => f.host === "worker-gpu");
    expect(cp?.declaresServer).toBe(true);
    expect(wg?.declaresServer).toBe(false);
  });

  test("every acknowledged host STILL has the defect — the baseline may only shrink", () => {
    // If a fix lands and the roster is not trimmed, this goes red. An acknowledgement that
    // outlives its defect is a stale claim about the tree, which is the failure this repo
    // cares about most.
    const broken = new Set(findings(facts).map((f) => f.split(":")[0]));
    for (const host of ACKNOWLEDGED.keys()) {
      if (!facts.some((f) => f.host === host)) continue; // host removed entirely: fine
      expect(broken.has(host)).toBe(true);
    }
  });

  test("every acknowledgement carries a LIFTS condition, not just a name", () => {
    expect(ACKNOWLEDGED.size).toBeGreaterThan(0);
    for (const [host, reason] of ACKNOWLEDGED) {
      expect(reason).toMatch(/LIFTS/u);
      expect(host.length).toBeGreaterThan(0);
    }
  });
});
