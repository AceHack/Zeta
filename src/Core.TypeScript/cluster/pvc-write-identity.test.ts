// Falsifiers for `pvc-write-identity.ts`. Each rule is shown refusing the defect and
// passing the corrected form, then the committed manifests are held to it.

import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { auditYaml, auditTree } from "./pvc-write-identity.ts";

const REPO = join(import.meta.dir, "..", "..", "..");
const APPS = join(REPO, "full-ai-cluster", "k8s", "applications");
const GMOD = join(APPS, "game-hosting", "gmod", "statefulset.yaml");

const sts = (opts: { podSc?: string; cSc?: string; image?: string; readOnly?: boolean }): string => `
apiVersion: apps/v1
kind: StatefulSet
metadata: { name: s }
spec:
  template:
    spec:
      ${opts.podSc ?? ""}
      containers:
        - name: c
          image: ${opts.image ?? "busybox"}
          ${opts.cSc ?? ""}
          volumeMounts:
            - { name: data, mountPath: /data${opts.readOnly ? ", readOnly: true" : ""} }
  volumeClaimTemplates:
    - metadata: { name: data }
      spec: { accessModes: [ReadWriteOnce], resources: { requests: { storage: 1Gi } } }
`;

const kinds = (yaml: string): string[] => auditYaml(yaml, "t").map((f) => f.kind);

describe("steamcmd-as-root", () => {
  test("SteamCMD with no runAsUser (the shipped shape) is refused", () => {
    expect(kinds(sts({ image: "cm2network/steamcmd:root", podSc: "securityContext: { fsGroup: 1000 }" }))).toEqual([
      "steamcmd-as-root",
    ]);
  });
  test("SteamCMD with explicit runAsUser 0 is refused", () => {
    expect(
      kinds(sts({ image: "cm2network/steamcmd:root", podSc: "securityContext: { fsGroup: 1000, runAsUser: 0 }" })),
    ).toEqual(["steamcmd-as-root"]);
  });
  test("SteamCMD as uid/gid 1000 with fsGroup 1000 passes", () => {
    expect(
      kinds(
        sts({
          image: "cm2network/steamcmd:root",
          podSc: "securityContext: { fsGroup: 1000 }",
          cSc: "securityContext: { runAsUser: 1000, runAsGroup: 1000 }",
        }),
      ),
    ).toEqual([]);
  });
});

describe("non-root writer of a PVC", () => {
  test("non-root with no fsGroup is refused", () => {
    expect(kinds(sts({ cSc: "securityContext: { runAsUser: 1000 }" }))).toEqual(["non-root-no-fsgroup"]);
  });
  test("fsGroup that is neither runAsGroup nor supplemental is refused", () => {
    expect(
      kinds(sts({ podSc: "securityContext: { fsGroup: 2000 }", cSc: "securityContext: { runAsUser: 1000, runAsGroup: 1000 }" })),
    ).toEqual(["fsgroup-mismatch"]);
  });
  test("fsGroup in supplementalGroups passes", () => {
    expect(
      kinds(
        sts({
          podSc: "securityContext: { fsGroup: 2000, supplementalGroups: [2000] }",
          cSc: "securityContext: { runAsUser: 1000, runAsGroup: 1000 }",
        }),
      ),
    ).toEqual([]);
  });
  test("a read-only mount is not a writer", () => {
    expect(kinds(sts({ cSc: "securityContext: { runAsUser: 1000 }", readOnly: true }))).toEqual([]);
  });
  test("non-root with matching fsGroup passes", () => {
    expect(kinds(sts({ podSc: "securityContext: { fsGroup: 1000 }", cSc: "securityContext: { runAsUser: 1000 }" }))).toEqual(
      [],
    );
  });
});

describe("committed manifests", () => {
  test("gmod: every SteamCMD container can write its install volume", () => {
    expect(auditYaml(readFileSync(GMOD, "utf8"), "game-hosting/gmod/statefulset.yaml")).toEqual([]);
  });
  test("no plain-YAML workload under k8s/applications has a PVC write-identity finding", () => {
    expect(auditTree(APPS)).toEqual([]);
  });
});
