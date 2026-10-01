/**
 * gmod-sftp-service.test.ts - docs/ops/INSTALL-TIME-CONFIG.md row 27.
 *
 * `gmod-sftp` was a LoadBalancer Service unconditionally, while SFTP itself is opt-in (no
 * `gmod-sftp-keys` ConfigMap => the sidecar idles and nothing listens on :22). A fresh install
 * therefore spent one address of the LoadBalancer pool - a range the installer resolves, a few
 * dozen addresses at most - on a port that answers nothing. It is ClusterIP until an operator
 * opts in, and the opt-in (changing `type` on the live object) is something ArgoCD must not revert.
 *
 * Each test fails against the manifests this replaces.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml, parseAllDocuments } from "yaml";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const DIR = "full-ai-cluster/k8s/applications/game-hosting/gmod";
const read = (f: string) => readFileSync(join(REPO_ROOT, DIR, f), "utf8");
const services = () =>
  parseAllDocuments(read("service.yaml"))
    .map((d) => d.toJS() as Record<string, any>)
    .filter((d) => d?.kind === "Service");
const svc = (name: string) => services().find((s) => s.metadata.name === name)!;

describe("gmod-sftp consumes no LoadBalancer address by default", () => {
  test("THE DEFECT: gmod-sftp is ClusterIP", () => {
    expect(svc("gmod-sftp").spec.type).toBe("ClusterIP");
  });

  test("the game port is still a LoadBalancer (players need an address)", () => {
    expect(svc("gmod").spec.type).toBe("LoadBalancer");
  });

  test("exactly ONE LoadBalancer Service in this directory: the game", () => {
    expect(services().filter((s) => s.spec.type === "LoadBalancer").map((s) => s.metadata.name)).toEqual(["gmod"]);
  });

  test("the opt-in is documented where the operator will look: service.yaml and the StatefulSet's SFTP section", () => {
    for (const f of ["service.yaml", "statefulset.yaml"]) {
      expect(read(f)).toContain(`kubectl -n game-hosting patch svc gmod-sftp -p '{"spec":{"type":"LoadBalancer"}}'`);
    }
  });
});

describe("opting in is not reverted by ArgoCD", () => {
  const app = () => parseYaml(read("Application.yaml")) as Record<string, any>;

  test("the Application ignores drift in gmod-sftp's type (and the node ports a LoadBalancer allocates)", () => {
    const ign = (app().spec.ignoreDifferences as Array<Record<string, any>>).find((i) => i["kind"] === "Service" && i["name"] === "gmod-sftp");
    expect(ign).toBeDefined();
    expect(ign!["jsonPointers"]).toContain("/spec/type");
    expect(ign!["jqPathExpressions"]).toContain(".spec.ports[]?.nodePort");
  });

  test("scoped to gmod-sftp ONLY: the game Service's type is not ignored", () => {
    for (const i of app().spec.ignoreDifferences as Array<Record<string, any>>) {
      if (i["kind"] === "Service") expect(i["name"]).toBe("gmod-sftp");
    }
  });

  test("RespectIgnoreDifferences is on, or a later sync would re-apply ClusterIP over the opt-in", () => {
    expect(app().spec.syncPolicy.syncOptions).toContain("RespectIgnoreDifferences=true");
  });

  test("the SFTP sidecar itself is still gated on the keys ConfigMap (the opt-in is real, not decorative)", () => {
    expect(read("statefulset.yaml")).toContain("SFTP disabled: no public key");
  });
});
