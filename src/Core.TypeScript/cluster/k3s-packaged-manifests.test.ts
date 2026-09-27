/**
 * src/Core.TypeScript/cluster/k3s-packaged-manifests.test.ts
 *
 * THE NODE'S FLOOR: k3s's own CoreDNS and metrics-server, vendored into the
 * first-boot roster (`full-ai-cluster/k8s/bootstrap/k3s-coredns.yaml`,
 * `k3s-metrics-server.yaml`) so their liveness probes can be widened. Measured
 * reason, in those files' headers: on the constrained replica lane (dispatch
 * 36119931377) both were killed by their own 1-second liveness probe while alive
 * and slow, with zero OOMKilled and zero Evicted.
 *
 * A vendored copy of an upstream file is a SECOND COPY, and a second copy
 * drifts. Each test below is a named way this one could drift or regress, and
 * each goes red on exactly that:
 *
 *   1. k3s is bumped and the copy is not re-vendored -- the image tag and the
 *      manifest shape then disagree with what the new k3s bundles.
 *   2. The cluster name (hence service CIDR) changes and the CoreDNS Service
 *      keeps the old clusterIP -- every pod's resolv.conf points at nothing.
 *   3. A `%{...}%` k3s template variable is left unresolved -- k3s substitutes
 *      those only in ITS copy, never in ours.
 *   4. The probe widening is reverted, or the floor's QoS / priority is lost.
 *   5. The roster stops carrying the replacement or its `.skip` marker -- the
 *      first leaves the node with NO CoreDNS, the second with TWO owners of one
 *      Deployment.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseAllDocuments } from "yaml";

import { deriveClusterNetwork } from "./cluster-cidr.ts";
import { buildRoster, isAppliedManifestFilename, readClusterIdentity, readKubernetesVersionPin } from "./first-boot-replica.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const BOOTSTRAP = join(REPO_ROOT, "full-ai-cluster/k8s/bootstrap");

interface Vendored {
  readonly file: string;
  readonly deployment: string;
  readonly priorityClassName: string;
}

const VENDORED: readonly Vendored[] = [
  { file: "k3s-coredns.yaml", deployment: "coredns", priorityClassName: "system-cluster-critical" },
  { file: "k3s-metrics-server.yaml", deployment: "metrics-server", priorityClassName: "system-node-critical" },
];

type Doc = Record<string, unknown>;

function docsOf(file: string): Doc[] {
  const text = readFileSync(join(BOOTSTRAP, file), "utf8");
  return parseAllDocuments(text)
    .map((d) => d.toJS() as unknown)
    .filter((d): d is Doc => typeof d === "object" && d !== null);
}

function find(docs: readonly Doc[], kind: string, name: string): Doc {
  const hit = docs.find((d) => d.kind === kind && (d.metadata as Doc | undefined)?.name === name);
  if (hit === undefined) throw new Error(`no ${kind}/${name}`);
  return hit;
}

function firstContainer(deployment: Doc): Doc {
  const spec = (deployment.spec as Doc).template as Doc;
  const containers = (spec.spec as Doc).containers as Doc[];
  const c = containers[0];
  if (c === undefined) throw new Error("no container");
  return c;
}

/** k3s's ClusterDNS: the service CIDR's network address + 10 (pkg/cli/server). Our /19 always ends in .0. */
function clusterDnsFor(serviceCidr: string): string {
  const [network] = serviceCidr.split("/");
  const octets = (network ?? "").split(".").map((o) => Number.parseInt(o, 10));
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o))) throw new Error(`bad CIDR ${serviceCidr}`);
  const n = ((octets[0] ?? 0) * 2 ** 24 + (octets[1] ?? 0) * 2 ** 16 + (octets[2] ?? 0) * 2 ** 8 + (octets[3] ?? 0)) + 10;
  return [Math.floor(n / 2 ** 24) % 256, Math.floor(n / 2 ** 16) % 256, Math.floor(n / 2 ** 8) % 256, n % 256].join(".");
}

describe("vendored k3s floor manifests", () => {
  test("1. each names the k3s version it was vendored from, and that is the pinned k3s", () => {
    const { k3sVersion } = readKubernetesVersionPin(join(REPO_ROOT, "full-ai-cluster/k8s/kubernetes-version.json"));
    for (const v of VENDORED) {
      const text = readFileSync(join(BOOTSTRAP, v.file), "utf8");
      const m = /VENDORED FROM k3s v(\S+?),/.exec(text);
      expect(m?.[1], `${v.file} must say which k3s it was vendored from`).toBeDefined();
      // Re-vendor from `manifests/` at the new tag when this fails -- the bundled image tag moves with k3s.
      expect(m?.[1], `${v.file} was vendored from a k3s other than the pinned one`).toBe(k3sVersion);
    }
  });

  test("2. the CoreDNS Service's clusterIP is the kubelet's --cluster-dns for THIS cluster's service CIDR", () => {
    const { clusterName } = readClusterIdentity(join(REPO_ROOT, "full-ai-cluster/cluster-identity.json"));
    const net = deriveClusterNetwork(clusterName);
    if (!net.ok) throw new Error(net.error);
    const dns = clusterDnsFor(net.value.serviceCidr);
    const svc = find(docsOf("k3s-coredns.yaml"), "Service", "kube-dns");
    const spec = svc.spec as Doc;
    expect(spec.clusterIP).toBe(dns);
    expect(spec.clusterIPs).toEqual([dns]);
  });

  test("clusterDnsFor is k3s's +10 rule (negative control: a wrong answer is visible)", () => {
    expect(clusterDnsFor("10.43.0.0/16")).toBe("10.43.0.10"); // k3s's own default pair
    expect(clusterDnsFor("10.99.192.0/19")).toBe("10.99.192.10");
    expect(clusterDnsFor("10.99.192.0/19")).not.toBe("10.99.192.1");
  });

  test("3. no k3s template variable survives in either copy", () => {
    for (const v of VENDORED) {
      const body = readFileSync(join(BOOTSTRAP, v.file), "utf8")
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("#"))
        .join("\n");
      expect(body, `${v.file} still carries an unresolved %{...}% variable`).not.toMatch(/%\{[A-Z_]+\}%/);
    }
  });

  test("4. the widened liveness probe, and the floor's priority and requests, are in place", () => {
    for (const v of VENDORED) {
      const deployment = find(docsOf(v.file), "Deployment", v.deployment);
      const podSpec = ((deployment.spec as Doc).template as Doc).spec as Doc;
      expect(podSpec.priorityClassName).toBe(v.priorityClassName);
      const c = firstContainer(deployment);
      const requests = (c.resources as Doc | undefined)?.requests as Doc | undefined;
      expect(requests?.cpu, `${v.file}: a floor pod with no CPU request is BestEffort`).toBeDefined();
      expect(requests?.memory, `${v.file}: a floor pod with no memory request is BestEffort`).toBeDefined();
      const live = c.livenessProbe as Doc;
      // k3s ships 1 / 3. Upstream Kubernetes' CoreDNS ships 5 / 5 -- the anchor in the file headers.
      expect(live.timeoutSeconds).toBe(5);
      expect(live.failureThreshold).toBe(5);
      expect(live.periodSeconds).toBe(10);
      expect(live.initialDelaySeconds).toBe(60);
    }
  });

  test("5. the roster carries each replacement AND the skip marker that keeps k3s's copy out", () => {
    const roster = buildRoster({
      k3sServerNixPath: join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-server.nix"),
      localStorageNixPath: join(REPO_ROOT, "full-ai-cluster/nixos/modules/local-storage.nix"),
    });
    const filenames = roster.map((e) => e.filename);
    for (const v of VENDORED) expect(filenames).toContain(v.file);
    // Keyed by BASENAME in k3s's deploy controller, which is why the second one reaches
    // `metrics-server/metrics-server-deployment.yaml` and nothing else in that directory.
    expect(filenames).toContain("coredns.yaml.skip");
    expect(filenames).toContain("metrics-server-deployment.yaml.skip");
    for (const f of ["coredns.yaml.skip", "metrics-server-deployment.yaml.skip"]) {
      expect(isAppliedManifestFilename(f)).toBe(false);
    }
  });
});
