// lint-cluster-cidr-agreement.test.ts
//
// THE CI-EXECUTED HALF of the cluster-CIDR derivation's proof.
//
// Three separate jobs, and they fail on different facts:
//
//   1. GOLDEN VECTORS — the TypeScript derivation reproduces
//      `full-ai-cluster/nixos/tests/cluster-cidr-golden-vectors.json`. The Nix
//      twin (`nixos/lib/cluster-cidr.nix`) replays the SAME file via
//      `nixos/tests/cluster-cidr-eval-test.nix`, so the vectors are the
//      cross-language byte-lock. That matters here specifically because NO
//      workflow in this repository runs `nix flake check` on
//      `full-ai-cluster/flake.nix` — the Nix side's assertions are real but
//      unexecuted in CI, and this file is what the gate actually runs.
//
//   2. RESERVED-RANGE WALK — every one of the 255 slots, exhaustively, against
//      every range this tree already uses. Not a spot check: the first draft of
//      the derivation put the service space at `10.64.0.0/10`, which looks
//      entirely reasonable and puts slot 96 on `10.88.0.0/18` — a range that
//      CONTAINS the `10.88.0.0/24` cluster segment every joiner is addressed
//      on. One cluster name in 255 would have made the segment unroutable. The
//      walk found it on its first run; no amount of reading the constant would
//      have.
//
//   3. AGREEMENT — the real tree's four surfaces restate one derived value.
//      Driven over a FIXTURE as well as over the tree, so the audit is proven
//      capable of failing rather than assumed to be.
//
// `.claude/rules/toy-is-free-metered-must-be-earned.md`: a check that cannot
// fail is not a check, so every assertion below has a companion that shows the
// mutant it kills.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import {
  CLUSTER_NAME_MAX_LENGTH,
  CLUSTER_SLOT_COUNT,
  MAX_CLUSTER_ID,
  MIN_CLUSTER_ID,
  POD_PREFIX_LENGTH,
  POD_SPACE_FIRST_SECOND_OCTET,
  RESERVED_RANGES,
  SERVICE_PREFIX_LENGTH,
  SERVICE_SPACE_FIRST_SECOND_OCTET,
  cidrBounds,
  cidrsOverlap,
  clusterNameHash16,
  clusterNetworksCollide,
  deriveClusterNetwork,
  validateClusterName,
} from "../cluster/cluster-cidr";
import {
  CLUSTER_IDENTITY_PATH,
  POD_CIDR_SURFACES,
  auditClusterCidrAgreement,
  readClusterIdentity,
} from "./lint-cluster-cidr-agreement";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const GOLDEN_PATH = join(REPO_ROOT, "full-ai-cluster/nixos/tests/cluster-cidr-golden-vectors.json");

interface GoldenVector {
  readonly clusterName: string;
  readonly hash16: number;
  readonly clusterId: number;
  readonly podCidr: string;
  readonly serviceCidr: string;
}

function goldenVectors(): readonly GoldenVector[] {
  const parsed = JSON.parse(readFileSync(GOLDEN_PATH, "utf8")) as { vectors: GoldenVector[] };
  return parsed.vectors;
}

describe("cluster-cidr golden vectors (cross-language byte-lock)", () => {
  test("the vector set is not empty — zero rows walked is not zero disagreements found", () => {
    // Guards the vacuity the other tests in this block would otherwise inherit:
    // every `for (const v of vectors)` below passes trivially on an empty file.
    expect(goldenVectors().length).toBeGreaterThanOrEqual(4);
  });

  test("every vector is reproduced by the TypeScript derivation", () => {
    for (const v of goldenVectors()) {
      expect({ name: v.clusterName, hash: clusterNameHash16(v.clusterName) }).toEqual({
        name: v.clusterName,
        hash: v.hash16,
      });
      const got = deriveClusterNetwork(v.clusterName);
      expect(got.ok).toBe(true);
      if (!got.ok) continue;
      expect({
        name: v.clusterName,
        id: got.value.clusterId,
        pod: got.value.podCidr,
        service: got.value.serviceCidr,
      }).toEqual({ name: v.clusterName, id: v.clusterId, pod: v.podCidr, service: v.serviceCidr });
    }
  });

  test("the Nix twin exists and reads the same vector file", () => {
    // The byte-lock is only real if the other side actually opens this file.
    // A golden vector nothing reads is the vacuity class in its purest form
    // (.claude/rules/no-binary-in-proof-lineage.md, condition 2).
    const evalTest = readFileSync(
      join(REPO_ROOT, "full-ai-cluster/nixos/tests/cluster-cidr-eval-test.nix"),
      "utf8",
    );
    expect(evalTest).toContain("cluster-cidr-golden-vectors.json");
    expect(evalTest).toContain("../lib/cluster-cidr.nix");

    // ...and the shipped module must call that same library rather than
    // carrying a third copy of the arithmetic.
    const module = readFileSync(
      join(REPO_ROOT, "full-ai-cluster/nixos/modules/cluster-network.nix"),
      "utf8",
    );
    expect(module).toContain("../lib/cluster-cidr.nix");
  });

  test("the derivation is a function — same name, same answer, every time", () => {
    for (const v of goldenVectors()) {
      const a = deriveClusterNetwork(v.clusterName);
      const b = deriveClusterNetwork(v.clusterName);
      expect(a).toEqual(b);
    }
  });
});

describe("reserved-range walk (this is the test that caught the real bug)", () => {
  test("no slot's pod or service CIDR overlaps any range this tree already uses", () => {
    const clashes: string[] = [];
    for (let slot = 0; slot < CLUSTER_SLOT_COUNT; slot += 1) {
      const pod = `10.${String(POD_SPACE_FIRST_SECOND_OCTET + Math.floor(slot / 2))}.${String((slot % 2) * 128)}.0/${String(POD_PREFIX_LENGTH)}`;
      const service = `10.${String(SERVICE_SPACE_FIRST_SECOND_OCTET + Math.floor(slot / 8))}.${String((slot % 8) * 32)}.0/${String(SERVICE_PREFIX_LENGTH)}`;
      for (const reserved of RESERVED_RANGES) {
        if (cidrsOverlap(pod, reserved.cidr)) {
          clashes.push(`slot ${String(slot)} pod ${pod} overlaps ${reserved.cidr} (${reserved.why})`);
        }
        if (cidrsOverlap(service, reserved.cidr)) {
          clashes.push(`slot ${String(slot)} service ${service} overlaps ${reserved.cidr} (${reserved.why})`);
        }
      }
      if (cidrsOverlap(pod, service)) {
        clashes.push(`slot ${String(slot)} pod ${pod} overlaps its own service ${service}`);
      }
    }
    expect(clashes).toEqual([]);
  });

  test("distinct slots never share address space", () => {
    // Would catch an arithmetic error that maps two slots onto one block —
    // which is the same failure as a hash collision, arriving by a different
    // route and without the birthday bound to excuse it.
    const pods = new Set<string>();
    const services = new Set<string>();
    for (let slot = 0; slot < CLUSTER_SLOT_COUNT; slot += 1) {
      pods.add(`10.${String(POD_SPACE_FIRST_SECOND_OCTET + Math.floor(slot / 2))}.${String((slot % 2) * 128)}.0`);
      services.add(`10.${String(SERVICE_SPACE_FIRST_SECOND_OCTET + Math.floor(slot / 8))}.${String((slot % 8) * 32)}.0`);
    }
    expect(pods.size).toBe(CLUSTER_SLOT_COUNT);
    expect(services.size).toBe(CLUSTER_SLOT_COUNT);
  });

  test("the walk KILLS the mutant it exists for (10.64.0.0/10 service space)", () => {
    // The exact first-draft bug, reproduced against the same reserved list. If
    // this ever stops finding an overlap, the walk above has stopped meaning
    // anything.
    const mutantSlot96Service = "10.88.0.0/18";
    const segment = RESERVED_RANGES.find((r) => r.cidr === "10.88.0.0/24");
    expect(segment).toBeDefined();
    expect(cidrsOverlap(mutantSlot96Service, "10.88.0.0/24")).toBe(true);
  });

  test("cidrBounds masks rather than trusting the written address", () => {
    expect(cidrBounds("10.42.5.0/16")).toEqual(cidrBounds("10.42.0.0/16"));
    expect(cidrsOverlap("10.0.0.0/8", "10.143.0.0/17")).toBe(true);
    expect(cidrsOverlap("10.143.0.0/17", "10.143.128.0/17")).toBe(false);
  });

  // The membership predicate `cilium-kind-up.ts` asserts CoreDNS pod IPs with.
  // It used to be `ip.startsWith("10.42.")`, which broke the moment the pod
  // CIDR became a DERIVED /17 — and the naive repair (`startsWith("10.143.")`)
  // is still wrong, because a /17 does not fall on a text boundary. The
  // second block below is the whole reason this is address arithmetic: a
  // prefix test accepts 10.143.128.1, and the pool never hands it out.
  test("a /32 through cidrBounds gives a single address, so containment is arithmetic not textual", () => {
    const pool = cidrBounds("10.143.0.0/17");
    const contains = (ip: string): boolean => {
      const addr = cidrBounds(`${ip}/32`);
      expect(addr.first).toBe(addr.last); // a /32 is exactly one address
      return addr.first >= pool.first && addr.first <= pool.last;
    };

    // Inside, including the last address of the block.
    expect(contains("10.143.0.164")).toBe(true);
    expect(contains("10.143.127.255")).toBe(true);

    // Outside but TEXTUALLY prefixed by "10.143." — a startsWith test passes
    // these, which is the bug this arithmetic exists to not have.
    expect(contains("10.143.128.0")).toBe(false);
    expect(contains("10.143.200.1")).toBe(false);

    // Outside and textually unrelated: the pre-derivation pod CIDR, and
    // kind's own default CNI range (the "Cilium is not the CNI" case).
    expect(contains("10.42.0.5")).toBe(false);
    expect(contains("10.244.0.7")).toBe(false);
  });
});

describe("cluster-id range and name validation", () => {
  test("every derived id is inside Cilium's 1..255", () => {
    for (const name of ["zeta", "zeta-home", "a", "z9", "x".repeat(CLUSTER_NAME_MAX_LENGTH)]) {
      const got = deriveClusterNetwork(name);
      expect(got.ok).toBe(true);
      if (!got.ok) continue;
      expect(got.value.clusterId).toBeGreaterThanOrEqual(MIN_CLUSTER_ID);
      expect(got.value.clusterId).toBeLessThanOrEqual(MAX_CLUSTER_ID);
    }
  });

  test("names Cilium would reject are refused here, where it costs nothing", () => {
    for (const bad of ["", "Zeta", "zeta_home", "-zeta", "zeta-", "z".repeat(CLUSTER_NAME_MAX_LENGTH + 1), "zeta.home"]) {
      expect(validateClusterName(bad)).not.toBeNull();
      expect(deriveClusterNetwork(bad).ok).toBe(false);
    }
  });

  test("collision detection reports the FACT, and same-name is not a collision", () => {
    const a = deriveClusterNetwork("zeta");
    const b = deriveClusterNetwork("zeta");
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    // Two names that are equal are ONE cluster, not two colliding ones.
    expect(clusterNetworksCollide(a.value, b.value)).toBe(false);
    // A synthetic collision must still be reported — otherwise the detector is
    // a function that always returns false, which is the vacuity class again.
    expect(clusterNetworksCollide(a.value, { ...a.value, clusterName: "other" })).toBe(true);
  });
});

describe("agreement audit across the surfaces that restate the value", () => {
  test("the real tree agrees", () => {
    expect(auditClusterCidrAgreement(REPO_ROOT)).toEqual([]);
  });

  test("the declared identity is the one the manifests were written for", () => {
    // Pinned so that changing `clusterName` without regenerating the manifests
    // fails HERE with a readable diff rather than at first boot with a routing
    // symptom. Update this line and the manifests together, or not at all.
    expect(readClusterIdentity(REPO_ROOT).clusterName).toBe("zeta");
  });

  test("the audit FAILS when a surface carries a stale CIDR (mutation)", () => {
    const fixture = mkdtempSync(join(tmpdir(), "zeta-cidr-"));
    // Copy only what the audit reads.
    for (const rel of [
      CLUSTER_IDENTITY_PATH,
      ...POD_CIDR_SURFACES.map((s) => s.path),
      "full-ai-cluster/nixos/modules/k3s-server.nix",
    ]) {
      mkdirSync(dirname(join(fixture, rel)), { recursive: true });
      cpSync(join(REPO_ROOT, rel), join(fixture, rel));
    }
    expect(auditClusterCidrAgreement(fixture)).toEqual([]);

    // MUTANT 1: the ArgoCD Application reverts to the old hardcoded literal.
    const appPath = join(fixture, "full-ai-cluster/k8s/applications/cilium/Application.yaml");
    writeFileSync(
      appPath,
      readFileSync(appPath, "utf8").replaceAll("10.143.0.0/17", "10.42.0.0/16"),
    );
    const stale = auditClusterCidrAgreement(fixture);
    expect(stale.length).toBeGreaterThan(0);
    expect(stale.some((f) => f.file.includes("applications/cilium"))).toBe(true);
    expect(stale.some((f) => f.problem.includes("10.42.0.0/16"))).toBe(true);
  });

  test("the audit FAILS when the cluster is renamed without regenerating (mutation)", () => {
    const fixture = mkdtempSync(join(tmpdir(), "zeta-cidr-"));
    for (const rel of [
      CLUSTER_IDENTITY_PATH,
      ...POD_CIDR_SURFACES.map((s) => s.path),
      "full-ai-cluster/nixos/modules/k3s-server.nix",
    ]) {
      mkdirSync(dirname(join(fixture, rel)), { recursive: true });
      cpSync(join(REPO_ROOT, rel), join(fixture, rel));
    }
    writeFileSync(join(fixture, CLUSTER_IDENTITY_PATH), JSON.stringify({ clusterName: "zeta-lab" }));
    const renamed = auditClusterCidrAgreement(fixture);
    // Both Cilium surfaces must be flagged — a rename moves the pod CIDR, and
    // this is the exact edit that would otherwise ship a cluster whose CNI and
    // control plane disagree.
    expect(renamed.length).toBeGreaterThanOrEqual(2);
    for (const surface of POD_CIDR_SURFACES) {
      expect(renamed.some((f) => f.file === surface.path)).toBe(true);
    }
  });

  test("the audit FAILS when k3s-server.nix goes back to a literal (mutation)", () => {
    const fixture = mkdtempSync(join(tmpdir(), "zeta-cidr-"));
    for (const rel of [
      CLUSTER_IDENTITY_PATH,
      ...POD_CIDR_SURFACES.map((s) => s.path),
      "full-ai-cluster/nixos/modules/k3s-server.nix",
    ]) {
      mkdirSync(dirname(join(fixture, rel)), { recursive: true });
      cpSync(join(REPO_ROOT, rel), join(fixture, rel));
    }
    const k3s = join(fixture, "full-ai-cluster/nixos/modules/k3s-server.nix");
    writeFileSync(
      k3s,
      readFileSync(k3s, "utf8").replace(
        "--cluster-cidr=${config.zeta.cluster.podCidr}",
        "--cluster-cidr=10.42.0.0/16",
      ),
    );
    const regressed = auditClusterCidrAgreement(fixture);
    expect(regressed.some((f) => f.file.includes("k3s-server.nix"))).toBe(true);
  });

  test("a roster entry naming a file that does not exist is REPORTED, not skipped", () => {
    // The audit must not go quiet when its own roster rots. Proven by giving it
    // an identity file and nothing else.
    const fixture = mkdtempSync(join(tmpdir(), "zeta-cidr-"));
    mkdirSync(dirname(join(fixture, CLUSTER_IDENTITY_PATH)), { recursive: true });
    writeFileSync(join(fixture, CLUSTER_IDENTITY_PATH), JSON.stringify({ clusterName: "zeta" }));
    const findings = auditClusterCidrAgreement(fixture);
    expect(findings.length).toBe(POD_CIDR_SURFACES.length + 1);
    for (const f of findings) expect(f.problem).toContain("exist");
  });
});
