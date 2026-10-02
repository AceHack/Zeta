#!/usr/bin/env bun
/**
 * A namespace that enforces PodSecurity `restricted` REJECTS non-conforming
 * pods at admission -- they never run. There is no partial credit and no
 * warning phase once `enforce` is set, so a workload missing the fields is not
 * "less hardened", it is DEAD.
 *
 * This existed as a live defect and nothing caught it: hat-system enforces
 * `restricted` (namespace.yaml) while `gatekeeper-crd-wait.yaml` carried no
 * securityContext at all. CI reported the pod forbidden on all four counts at
 * once. The Job is an ArgoCD *Sync hook* whose whole purpose is making
 * cold-start sync work, so the failure it exists to prevent came back -- a
 * guard that is present, wired, and unable to run.
 *
 * Scope, stated so it is not read wider than it is: this reads every authored
 * manifest under the apps tree, maps each `Namespace` to the level its OWN
 * manifest enforces, and checks only workloads whose declared
 * `metadata.namespace` enforces `restricted` -- the folder a YAML sits in is
 * irrelevant (a privileged workload may legitimately share a directory with a
 * restricted namespace's manifest). It checks only the four fields that
 * admission actually requires. It does not model the whole policy, and it
 * cannot see a Helm-rendered workload -- those arrive from a chart, not from
 * this tree.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAllDocuments } from "yaml";

const APPS = fileURLToPath(new URL("../../../full-ai-cluster/k8s/applications", import.meta.url));

interface Doc {
  kind?: string;
  metadata?: { name?: string; namespace?: string; labels?: Record<string, string> };
  spec?: any;
}

/** Every authored manifest doc under the apps tree, recursively, with its file. */
function allDocs(): { file: string; doc: Doc }[] {
  const out: { file: string; doc: Doc }[] = [];
  const walk = (dir: string): void => {
    // `withFileTypes` rather than readdir-then-stat: CodeQL flagged the latter
    // as a check-then-use race (the entry can change between the check and the
    // read). Reading the type off the directory entry removes the second
    // syscall entirely, so there is no window rather than a narrow one.
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(p);
        continue;
      }
      if (!entry.name.endsWith(".yaml") && !entry.name.endsWith(".yml")) continue;
      for (const d of parseAllDocuments(readFileSync(p, "utf8"))) {
        const js = d.toJS() as Doc | null;
        if (js !== null && js !== undefined) out.push({ file: p, doc: js });
      }
    }
  };
  walk(APPS);
  return out;
}

/**
 * Namespace name -> its enforced PodSecurity level, read off the `Namespace`
 * object's OWN manifest. This is what admission actually keys on -- NOT the
 * directory a workload's YAML happens to sit in. The earlier directory-scoped
 * version wrongly swept a privileged DaemonSet into the restricted check merely
 * because a restricted namespace's manifest shared its folder (node-lan-hosts
 * in cluster-hygiene, 2026-10-02): same folder, different namespace, opposite
 * policy.
 */
function enforceLevelByNamespace(docs: { doc: Doc }[]): Map<string, string> {
  const levels = new Map<string, string>();
  for (const { doc } of docs) {
    const level = doc.metadata?.labels?.["pod-security.kubernetes.io/enforce"];
    if (doc.kind === "Namespace" && doc.metadata?.name !== undefined && level !== undefined) {
      levels.set(doc.metadata.name, level);
    }
  }
  return levels;
}

/**
 * Pod templates authored in this tree, tagged with the namespace the workload
 * itself declares. A workload with no explicit namespace is reported as
 * `undefined` -- it cannot be matched to a restricted namespace by this tree
 * alone, so it is not checked (and not silently assumed hardened).
 */
function podTemplates(docs: { file: string; doc: Doc }[]): {
  file: string;
  owner: string;
  namespace: string | undefined;
  spec: any;
}[] {
  const out: { file: string; owner: string; namespace: string | undefined; spec: any }[] = [];
  for (const { file, doc } of docs) {
    // A CronJob's pod template is one level deeper (`spec.jobTemplate.spec.template.spec`), and was
    // INVISIBLE here until `cluster-hygiene` (2026-10-02) shipped two of them in a restricted namespace.
    const spec =
      doc.spec?.template?.spec ??
      doc.spec?.jobTemplate?.spec?.template?.spec ??
      (doc.kind === "Pod" ? doc.spec : undefined);
    if (spec?.containers !== undefined) {
      out.push({
        file,
        owner: `${doc.kind ?? "?"}/${doc.metadata?.name ?? "?"}`,
        namespace: doc.metadata?.namespace,
        spec,
      });
    }
  }
  return out;
}

describe("workloads in a restricted namespace are admissible", () => {
  const docs = allDocs();
  const levels = enforceLevelByNamespace(docs);
  const restrictedWorkloads = podTemplates(docs).filter(
    (w) => w.namespace !== undefined && levels.get(w.namespace) === "restricted",
  );

  test("at least one namespace enforces restricted -- otherwise this suite proves nothing", () => {
    // Without this the whole file would pass vacuously the day the label moves
    // or is renamed, which is exactly the failure mode it is guarding against.
    expect([...levels.values()]).toContain("restricted");
  });

  test("at least one workload lives in a restricted namespace -- otherwise this suite checks nothing", () => {
    // Pairs with the guard above: a restricted namespace with no authored
    // workload would also make every check below vacuous.
    expect(restrictedWorkloads.length).toBeGreaterThan(0);
  });

  for (const { file, owner, namespace, spec } of restrictedWorkloads) {
    test(`${owner} in ${namespace} (${file.split("/").pop()}) satisfies the four restricted requirements`, () => {
      const pod = spec.securityContext ?? {};
      for (const c of spec.containers as { name: string; securityContext?: any }[]) {
        const sc = c.securityContext ?? {};
        // runAsNonRoot and seccompProfile may be set at pod OR container level.
        expect(pod.runAsNonRoot === true || sc.runAsNonRoot === true).toBe(true);
        const seccomp = sc.seccompProfile?.type ?? pod.seccompProfile?.type;
        expect(["RuntimeDefault", "Localhost"]).toContain(seccomp);
        // These two are container-level only.
        expect(sc.allowPrivilegeEscalation).toBe(false);
        expect(sc.capabilities?.drop).toContain("ALL");
      }
    });
  }
});
