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
 * Scope, stated so it is not read wider than it is: this walks the authored
 * manifests in namespaces whose OWN manifest sets
 * `pod-security.kubernetes.io/enforce: restricted`, and checks only the four
 * fields that admission actually requires. It does not model the whole policy,
 * and it cannot see a Helm-rendered workload -- those arrive from a chart, not
 * from this tree.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAllDocuments } from "yaml";

const APPS = fileURLToPath(new URL("../../../full-ai-cluster/k8s/applications", import.meta.url));

interface Doc { kind?: string; metadata?: { name?: string; labels?: Record<string, string> }; spec?: any }

function docsIn(dir: string): { file: string; doc: Doc }[] {
  const out: { file: string; doc: Doc }[] = [];
  // `withFileTypes` rather than readdir-then-stat: CodeQL flagged the latter as
  // a check-then-use race (the entry can change between the check and the
  // read). Reading the type off the directory entry removes the second syscall
  // entirely, so there is no window rather than a narrow one.
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) continue;
    if (!entry.name.endsWith(".yaml") && !entry.name.endsWith(".yml")) continue;
    for (const d of parseAllDocuments(readFileSync(p, "utf8"))) {
      const js = d.toJS() as Doc | null;
      if (js !== null && js !== undefined) out.push({ file: p, doc: js });
    }
  }
  return out;
}

/** Namespaces in this tree that ENFORCE restricted, keyed by their app directory. */
function restrictedAppDirs(): string[] {
  const dirs: string[] = [];
  for (const entry of readdirSync(APPS, { withFileTypes: true })) {
    const dir = join(APPS, entry.name);
    if (!entry.isDirectory()) continue;
    const enforced = docsIn(dir).some(
      ({ doc }) =>
        doc.kind === "Namespace" &&
        doc.metadata?.labels?.["pod-security.kubernetes.io/enforce"] === "restricted",
    );
    if (enforced) dirs.push(dir);
  }
  return dirs;
}

/** Pod templates authored in this tree, with the file that carries them. */
function podTemplates(dir: string): { file: string; owner: string; spec: any }[] {
  const out: { file: string; owner: string; spec: any }[] = [];
  for (const { file, doc } of docsIn(dir)) {
    const spec = doc.spec?.template?.spec ?? (doc.kind === "Pod" ? doc.spec : undefined);
    if (spec?.containers !== undefined) {
      out.push({ file, owner: `${doc.kind ?? "?"}/${doc.metadata?.name ?? "?"}`, spec });
    }
  }
  return out;
}

describe("workloads in a restricted namespace are admissible", () => {
  const dirs = restrictedAppDirs();

  test("at least one namespace enforces restricted -- otherwise this suite proves nothing", () => {
    // Without this the whole file would pass vacuously the day the label moves
    // or is renamed, which is exactly the failure mode it is guarding against.
    expect(dirs.length).toBeGreaterThan(0);
  });

  for (const dir of dirs) {
    const templates = podTemplates(dir);

    test(`${dir.split("/").pop()}: has authored pod templates to check`, () => {
      expect(templates.length).toBeGreaterThan(0);
    });

    for (const { file, owner, spec } of templates) {
      test(`${owner} (${file.split("/").pop()}) satisfies the four restricted requirements`, () => {
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
  }
});
