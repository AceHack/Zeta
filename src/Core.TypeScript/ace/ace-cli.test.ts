import { describe, it, expect } from "bun:test";
import {
  emptyGraph, install, remove, verify, list, graphRoot,
  applyDelta, graphMerkleRoot, STUB_REGISTRY
} from "./ace-cli";

describe("ACE CLI — Z-set delta protocol", () => {
  it("ACE-1: empty graph has no packages", () => {
    const r = list(emptyGraph);
    expect(r.success).toBe(true);
    expect(r.entries).toHaveLength(0);
  });

  it("ACE-2: install adds a package (+1 delta)", () => {
    const r = install(emptyGraph, "zeta-core");
    expect(r.success).toBe(true);
    expect(r.graph!.get("zeta-core")!.weight).toBe(1);
  });

  it("ACE-3: install unknown package returns error", () => {
    const r = install(emptyGraph, "does-not-exist");
    expect(r.success).toBe(false);
  });

  it("ACE-4: install is idempotent (same version, same weight)", () => {
    const g1 = install(emptyGraph, "zeta-core").graph!;
    const r2 = install(g1, "zeta-core");
    expect(r2.success).toBe(true);
    expect(r2.graph!.get("zeta-core")!.weight).toBe(1);
    expect(r2.message).toContain("idempotent");
  });

  it("ACE-5: remove subtracts the package (-1 delta)", () => {
    const g1 = install(emptyGraph, "zeta-core").graph!;
    const r = remove(g1, "zeta-core");
    expect(r.success).toBe(true);
    expect(r.graph!.has("zeta-core")).toBe(false);
  });

  it("ACE-6: remove non-installed package is no-op", () => {
    const r = remove(emptyGraph, "zeta-core");
    expect(r.success).toBe(true);
    expect(r.message).toContain("no-op");
  });

  it("ACE-7: install then remove = empty graph (Z-set identity)", () => {
    const g1 = install(emptyGraph, "zeta-core").graph!;
    const g2 = remove(g1, "zeta-core").graph!;
    expect(g2.size).toBe(0);
  });

  it("ACE-8: verify passes for correctly installed package", () => {
    const g = install(emptyGraph, "zeta-core").graph!;
    const r = verify(g, "zeta-core");
    expect(r.success).toBe(true);
    expect(r.message).toContain("Verified");
  });

  it("ACE-9: verify fails for not-installed package", () => {
    const r = verify(emptyGraph, "zeta-core");
    expect(r.success).toBe(false);
  });

  it("ACE-10: verify fails for tampered content address", () => {
    const g = install(emptyGraph, "zeta-core").graph!;
    // Tamper with the content address
    const tampered = new Map(g);
    tampered.set("zeta-core", { ...tampered.get("zeta-core")!, contentAddress: "sha256:TAMPERED" });
    const r = verify(tampered, "zeta-core");
    expect(r.success).toBe(false);
    expect(r.message).toContain("VERIFICATION FAILED");
  });

  it("ACE-11: list shows installed packages", () => {
    const g = install(install(emptyGraph, "zeta-core").graph!, "longhorn").graph!;
    const r = list(g);
    expect(r.success).toBe(true);
    expect(r.entries).toHaveLength(2);
  });

  it("ACE-12: list filters by package manager", () => {
    const g = install(install(emptyGraph, "zeta-core").graph!, "longhorn").graph!;
    const helmOnly = list(g, "helm");
    expect(helmOnly.entries).toHaveLength(1);
    expect(helmOnly.entries![0]!.name).toBe("longhorn");
    const aceOnly = list(g, "ace");
    expect(aceOnly.entries).toHaveLength(1);
    expect(aceOnly.entries![0]!.name).toBe("zeta-core");
  });

  it("ACE-13: Merkle root is deterministic", () => {
    const g1 = install(emptyGraph, "zeta-core").graph!;
    const g2 = install(emptyGraph, "zeta-core").graph!;
    expect(graphMerkleRoot(g1)).toBe(graphMerkleRoot(g2));
  });

  it("ACE-14: Merkle root changes after install", () => {
    const root0 = graphMerkleRoot(emptyGraph);
    const g1 = install(emptyGraph, "zeta-core").graph!;
    const root1 = graphMerkleRoot(g1);
    expect(root0).not.toBe(root1);
  });

  it("ACE-15: Merkle root is order-independent (same packages, different install order)", () => {
    const gAB = install(install(emptyGraph, "zeta-core").graph!, "longhorn").graph!;
    const gBA = install(install(emptyGraph, "longhorn").graph!, "zeta-core").graph!;
    expect(graphMerkleRoot(gAB)).toBe(graphMerkleRoot(gBA));
  });

  it("ACE-16: graph-root command returns root string", () => {
    const g = install(emptyGraph, "zeta-core").graph!;
    const r = graphRoot(g);
    expect(r.success).toBe(true);
    expect(r.message).toContain("zeta:");
    expect(r.message).toContain("1 packages");
  });

  it("ACE-17: applyDelta with weight=0 removes entry", () => {
    const g = install(emptyGraph, "zeta-core").graph!;
    const g2 = applyDelta(g, { name: "zeta-core", version: "1.0.0", contentAddress: "sha256:abc123", deltaWeight: -1, packageManager: "ace" });
    expect(g2.has("zeta-core")).toBe(false);
  });

  it("ACE-18: STUB_REGISTRY has all expected packages", () => {
    expect(STUB_REGISTRY.has("zeta-core")).toBe(true);
    expect(STUB_REGISTRY.has("zeta-db")).toBe(true);
    expect(STUB_REGISTRY.has("longhorn")).toBe(true);
    expect(STUB_REGISTRY.has("cockroachdb")).toBe(true);
  });
});
