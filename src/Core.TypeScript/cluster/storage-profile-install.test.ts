/**
 * storage-profile-install.test.ts — docs/ops/INSTALL-TIME-CONFIG.md row 29.
 *
 * The storage profile as INSTALL-TIME configuration, derived from the ONE existing ladder
 * (`k8s/storage-profiles.json`). Each group below fails on the tree this change replaces:
 *
 *   (a) the installer's ladder, its shell table, the generated kit and the root's ignore set are all
 *       DERIVED from the catalogue, and a test says so byte-for-byte — they cannot drift;
 *   (b) every claim an install-time choice reaches is reached by a patch that, applied to the committed
 *       Application, yields exactly the catalogue's size for that profile — and the committed profile's
 *       patch is a no-op, which is what "the committed tree IS that rung" means;
 *   (c) the Jobs, the RBAC, the ConfigMap, the template and the Nix module agree with each other;
 *   (d) the chain ESP -> first-boot -> installer -> /etc/zeta -> Nix has a consumer at every link (an
 *       install-time key nothing reads is inert, and an inert key reads exactly like a working one).
 *
 * WHAT THIS CANNOT PROVE, stated: that ArgoCD's bundled kustomize applies the inline patches exactly as
 * `storageProfileObjects` mirrors them (including a patch that renames a Job), that `nix` renders the
 * template as the TypeScript mirror does, that the Jobs win the race against the first sync of a freshly
 * created Application, or that Longhorn then places what the profile declares. All of those are pinned on
 * the TEXT, not run — the same boundary lb-ipam-pool.test.ts records. Nothing here has been booted.
 */

import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { COMMITTED_LONGHORN_DEMAND_GIB } from "../installer/longhorn-capacity-preflight.ts";
import { STORAGE_PROFILE_COMMITTED, STORAGE_PROFILE_ENV, STORAGE_PROFILE_LADDER } from "../installer/storage-profile-selection.ts";
import { ORPHANED_SUPPORTING_REASONS } from "./app-of-apps-discovery.ts";
import { applyPatch, yamlDocs, type K8sObject, type PatchOp } from "./public-tls.ts";
import {
  buildStorageProfileKit,
  classifyClaim,
  committedProfile,
  INSTALL_SH_PATH,
  installDemandGib,
  installLadder,
  keptAtCommitted,
  patchedApplications,
  readRegion,
  renderRootIgnoreEntries,
  renderShellData,
  renderTemplateJobPatches,
  renderTsLadder,
  rungChanges,
  ROOT_APPLICATION_PATH,
  ROOT_IGNORE_BEGIN,
  ROOT_IGNORE_END,
  SELECTION_TS_PATH,
  SHELL_DATA_BEGIN,
  SHELL_DATA_END,
  STORAGE_PROFILE_APPLICATION_NAME,
  STORAGE_PROFILE_KIT_DIR,
  STORAGE_PROFILE_NIX_MODULE,
  STORAGE_PROFILE_TEMPLATE,
  STORAGE_PROFILE_TOKEN,
  storageProfileObjects,
  renderStorageProfileApplicationText,
  TEMPLATE_JOBS_BEGIN,
  TEMPLATE_JOBS_END,
  TS_LADDER_BEGIN,
  TS_LADDER_END,
  runnerOnlyProfiles,
} from "./storage-profile-install.ts";
import {
  applyProfile,
  DEFAULT_CATALOGUE_PATH,
  loadCatalogue,
  parseFieldPath,
  podsScalarFor,
  profileTotalGib,
  type ProfileClaim,
} from "./storage-profiles.ts";

setDefaultTimeout(60_000);

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const read = (path: string): string => readFileSync(join(REPO_ROOT, path), "utf8");
const catalogue = loadCatalogue();
const committed = committedProfile();
const ladder = installLadder();

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The value at a dotted field path, or `undefined`. */
function getIn(doc: unknown, field: string): unknown {
  let cur: unknown = doc;
  for (const part of parseFieldPath(field)) {
    cur = Array.isArray(cur) ? cur[Number(part)] : isRecord(cur) ? cur[String(part)] : undefined;
    if (cur === undefined) return undefined;
  }
  return cur;
}

/** RFC 7386 JSON merge patch onto a clone — what `kubectl patch --type merge` does. */
function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isRecord(patch)) return patch;
  const out: Record<string, unknown> = isRecord(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete out[key];
    else out[key] = mergePatch(out[key], value);
  }
  return out;
}

function applicationDoc(path: string, docIndex: number): K8sObject {
  const doc = yamlDocs(read(path))[docIndex];
  if (doc === undefined) throw new Error(`${path} has no document ${String(docIndex)}`);
  return doc;
}

const kit = buildStorageProfileKit();
const kitFile = (name: string): string => {
  const file = kit.find((f) => f.path === `${STORAGE_PROFILE_KIT_DIR}/${name}`);
  if (file === undefined) throw new Error(`kit has no ${name}`);
  return file.text;
};

// ---------------------------------------------------------------------------

describe("(a) the ladder is DERIVED from the catalogue, never restated", () => {
  test("the installer's TypeScript ladder is byte-for-byte what the catalogue derives", () => {
    // Fails the moment a size/pod count in storage-profiles.json moves, or a claim changes how it is reached.
    expect(readRegion(read(SELECTION_TS_PATH), TS_LADDER_BEGIN, TS_LADDER_END)).toBe(renderTsLadder());
    expect(STORAGE_PROFILE_LADDER).toEqual(ladder);
  });

  test("the shell table in zeta-install.sh is byte-for-byte what the catalogue derives", () => {
    expect(readRegion(read(INSTALL_SH_PATH), SHELL_DATA_BEGIN, SHELL_DATA_END)).toBe(renderShellData());
  });

  test("the committed rung is the ledger's activeStorageProfile and is on the ladder", () => {
    const ledger = JSON.parse(read("full-ai-cluster/k8s/single-node-budget.json")) as { activeStorageProfile: string };
    expect(committed).toBe(ledger.activeStorageProfile);
    expect(STORAGE_PROFILE_COMMITTED).toBe(committed);
    expect(ladder.map((r) => r.name)).toContain(committed);
  });

  test("`ci` is not offered: it exists to serve the dev rung's hosted runner", () => {
    expect([...runnerOnlyProfiles()]).toEqual(["ci"]);
    expect(ladder.map((r) => r.name)).toEqual(catalogue.profiles.filter((p) => p !== "ci"));
  });

  test("the committed rung's demand IS the committed roster's declared demand — the number the old gate convicted on", () => {
    // Ties the new ladder to the two constants the installer already pins (COMMITTED_LONGHORN_DEMAND_GIB is
    // recomputed from the render snapshot by single-node-readiness.ts, which REFUSES when it moves), so the
    // top of the ladder cannot be restated by hand.
    const demand = ladder.find((r) => r.name === committed)?.demandGib;
    expect(demand).toBe(COMMITTED_LONGHORN_DEMAND_GIB);
    expect(demand).toBe(profileTotalGib(catalogue, committed));
  });

  test("the owner's pool: 607 GiB schedulable selects `minimal` since 2026-10-02, because `standard` now declares 671", () => {
    const standard = ladder.find((r) => r.name === "standard");
    // 571 -> 671 on 2026-10-02: postgres-shared (3 x 20Gi), seaweedfs (20Gi) and forgejo (20Gi) are on the
    // Longhorn pool now, so a single-1-TB-disk install (607 GiB schedulable) NO LONGER FITS `standard` and the
    // installer selects `minimal` for it. That is the honest price of putting these volumes on bounded
    // storage instead of an unmetered directory on root; the remedies (a second disk, or LONGHORN1_TAIL) are
    // named in docs/ops/STORAGE-RELOCATION.md and in the installer's own refusal text.
    expect(standard?.demandGib).toBe(671);
    expect(standard?.demandGib).toBe(profileTotalGib(catalogue, "standard"));
    expect(ladder.filter((r) => r.demandGib <= 607).map((r) => r.name)).toEqual(["minimal"]);
  });

  test("what a rung charges is what it ACTUALLY requests: below the committed rung it can exceed the catalogue total", () => {
    // `minimal` declares 231 GiB, but five git-path claims cannot be resized at install time and keep their
    // committed size, so the pool must hold 279. Charging the smaller number would be a lie that fills a disk.
    const minimal = ladder.find((r) => r.name === "minimal")?.demandGib ?? 0;
    expect(minimal).toBeGreaterThan(profileTotalGib(catalogue, "minimal"));
    const keptGib = catalogue.claims
      .filter((c) => classifyClaim(c).kind === "committed")
      // x the pod count at `minimal`: a per-instance claim (postgres-shared, 3 instances) keeps its
      // committed size on EVERY pod, so the deficit is per-pod size x pods, not the size alone.
      .reduce(
        (sum, c) =>
          sum + (parseFloat(c.sizes[committed] ?? "0") - parseFloat(c.sizes["minimal"] ?? "0")) * (c.pods["minimal"] ?? 1),
        0,
      );
    expect(minimal - profileTotalGib(catalogue, "minimal")).toBeCloseTo(keptGib, 5);
    // And above the committed rung nothing can grow past what it keeps.
    const top = ladder.at(-1);
    expect(top?.demandGib).toBeLessThanOrEqual(profileTotalGib(catalogue, top?.name ?? ""));
  });

  test("the banner's 'what it shrinks' for the owner's rung is exactly the two non-bring-up claims", () => {
    expect(rungChanges(catalogue, "standard", committed)).toEqual(["ollama/models 200Gi->48Gi", "vllm/hf-cache 200Gi->48Gi"]);
    expect(rungChanges(catalogue, committed, committed)).toEqual([]);
    expect(rungChanges(catalogue, "minimal", committed)).toContain("cockroachdb/data pods 3->1");
    expect(rungChanges(catalogue, "minimal", committed)).toContain("kube-prometheus-stack/prometheus retentionSize 24GiB->12GiB");
    // Claims a directory source cannot resize are NAMED, with the size they keep.
    expect(keptAtCommitted(catalogue, committed)).toEqual([
      "agent-memory/memory 8Gi",
      "game-hosting-gmod/data 10Gi",
      "headscale/data 3Gi",
      "platform/portal 5Gi",
      "postgres-shared/data 20Gi",
    ]);
  });
});

describe("(a) every generated artefact is current — regenerate with `storage-profile-install.ts --write`", () => {
  for (const file of kit) {
    test(`${file.path} is byte-for-byte what the generator emits`, () => {
      expect(read(file.path)).toBe(file.text);
    });
  }

  test("the template's per-Job rename patches are current", () => {
    expect(readRegion(read(STORAGE_PROFILE_TEMPLATE), TEMPLATE_JOBS_BEGIN, TEMPLATE_JOBS_END)).toBe(
      renderTemplateJobPatches(patchedApplications()),
    );
  });

  test("the root's ignoreDifferences region is current", () => {
    expect(readRegion(read(ROOT_APPLICATION_PATH), ROOT_IGNORE_BEGIN, ROOT_IGNORE_END)).toBe(
      renderRootIgnoreEntries(patchedApplications()).replace(/\n$/, ""),
    );
  });
});

describe("(b) how each claim is reached — derived from the manifests, nothing stated by hand", () => {
  const byKind = (kind: string): string[] => catalogue.claims.filter((c) => classifyClaim(c).kind === kind).map((c) => c.id);

  test("16 claims are helm valuesObject leaves (a merge patch moves them), 1 is a kustomize patch, 5 stay committed, 1 is applied by nothing", () => {
    expect(byKind("values")).toHaveLength(16);
    expect(byKind("kustomize")).toEqual(["full-ai-cluster/vllm/hf-cache"]);
    expect(byKind("committed")).toEqual([
      "full-ai-cluster/agent-memory/memory",
      "full-ai-cluster/game-hosting-gmod/data",
      "full-ai-cluster/headscale/data",
      "full-ai-cluster/platform/portal",
      "full-ai-cluster/postgres-shared/data",
    ]);
    expect(byKind("unapplied")).toEqual(["full-ai-cluster/arc-runner-set/model-cache"]);
  });

  test("the claim nothing applies is exactly the one app-of-apps-discovery registers as ORPHANED", () => {
    // The day someone wires model-cache-pvc.yaml up, classifyClaim stops saying `unapplied`, the generated
    // tables change, and this fails until the registry entry is deleted: the exclusion cannot outlive the bug.
    expect(ORPHANED_SUPPORTING_REASONS.has("arc-runner-set/model-cache-pvc.yaml")).toBe(true);
  });

  test("vllm is a KUSTOMIZE source, not a directory one, and applies exactly what the old include glob did", () => {
    const app = applicationDoc("full-ai-cluster/k8s/applications/vllm/Application.yaml", 0);
    const source = getIn(app, "spec.source") as Record<string, unknown>;
    expect(source["kustomize"]).toEqual({});
    expect(source["directory"]).toBeUndefined();
    const kustomization = parseYaml(read("full-ai-cluster/k8s/applications/vllm/kustomization.yaml")) as Record<string, unknown>;
    expect(kustomization["kind"]).toBe("Kustomization");
    // The old glob named namespace.yaml, deployment.yaml and service.yaml; only deployment.yaml ever existed
    // (the Namespace and the Service are documents inside it).
    expect(kustomization["resources"]).toEqual(["deployment.yaml"]);
    const kinds = yamlDocs(read("full-ai-cluster/k8s/applications/vllm/deployment.yaml")).map((d) => d["kind"]);
    expect(kinds).toEqual(["Namespace", "Deployment", "PersistentVolumeClaim", "Service"]);
  });

  test("every patched Application name is a real Application in the tree", () => {
    const names = new Set<string>();
    for (const claim of catalogue.claims) {
      const reach = classifyClaim(claim);
      if (reach.kind === "values" || reach.kind === "kustomize") names.add(reach.app);
    }
    expect([...names].sort()).toEqual(patchedApplications().map((a) => a.app));
  });
});

describe("(b) applying a profile's patches to the COMMITTED Application yields exactly the catalogue's sizes", () => {
  for (const rung of ladder) {
    test(`${rung.name}: every reached claim's size, pod count and governor lands at the catalogue value`, () => {
      const patched = new Map(patchedApplications().map((a) => [a.app, a]));
      let reached = 0;
      for (const claim of catalogue.claims) {
        const reach = classifyClaim(claim);
        if (reach.kind !== "values" && reach.kind !== "kustomize") continue;
        reached += 1;
        const patch = patched.get(reach.app)?.patches.get(rung.name);
        if (patch === undefined) throw new Error(`no ${rung.name} patch for ${reach.app}`);
        if (reach.kind === "values") {
          const after = mergePatch(applicationDoc(claim.path, claim.docIndex), JSON.parse(patch));
          expect(getIn(after, claim.sizeField)).toBe(claim.sizes[rung.name]);
          for (const [field, byProfile] of Object.entries(claim.governors)) {
            expect(getIn(after, field)).toBe(byProfile[rung.name]);
          }
          if (claim.podsField !== null && new Set(ladder.map((r) => claim.pods[r.name])).size > 1) {
            expect(getIn(after, claim.podsField)).toBe(podsScalarFor(claim, claim.pods[rung.name] ?? 0));
          }
        } else {
          // The patch is a kustomize JSON6902 patch on the PVC document: apply it as ArgoCD would.
          const app = mergePatch(applicationDoc(`full-ai-cluster/k8s/applications/${reach.app}/Application.yaml`, 0), JSON.parse(patch));
          const patches = getIn(app, "spec.source.kustomize.patches") as Array<{ target: Record<string, string>; patch: string }>;
          expect(patches).toHaveLength(1);
          expect(patches[0]?.target).toEqual(reach.target);
          const pvc = yamlDocs(read(claim.path))[claim.docIndex];
          if (pvc === undefined) throw new Error("no pvc doc");
          applyPatch(pvc, JSON.parse(patches[0]?.patch ?? "[]") as PatchOp[]);
          expect(getIn(pvc, claim.sizeField)).toBe(claim.sizes[rung.name]);
        }
      }
      expect(reached).toBe(17);
    });
  }

  test(`the committed profile (${committed}) patches NOTHING that is not already true: the committed tree IS that rung`, () => {
    // This is the sentence 'selecting the committed rung writes no install-time config' rests on. If the ledger
    // says `measured` and the Applications do not, the readiness auditor is red and so is this.
    const patched = patchedApplications();
    for (const claim of catalogue.claims) {
      const reach = classifyClaim(claim);
      if (reach.kind !== "values") continue;
      const patch = patched.find((a) => a.app === reach.app)?.patches.get(committed);
      const doc = applicationDoc(claim.path, claim.docIndex);
      expect(mergePatch(doc, JSON.parse(patch ?? "{}"))).toEqual(doc);
    }
  });

  test("no patch writes a key the committed Application does not already carry (an inert or invented key)", () => {
    // Same refusal as applyProfile: inventing a key in someone else's values block is how a silent
    // misconfiguration ships. A leaf the chart ignores would 'apply' and do nothing.
    for (const app of patchedApplications()) {
      const claims = catalogue.claims.filter((c) => {
        const reach = classifyClaim(c);
        return reach.kind === "values" && reach.app === app.app;
      });
      for (const claim of claims) {
        const doc = applicationDoc(claim.path, claim.docIndex);
        expect(getIn(doc, claim.sizeField)).toBeDefined();
        for (const field of Object.keys(claim.governors)) expect(getIn(doc, field)).toBeDefined();
        if (claim.podsField !== null) expect(getIn(doc, claim.podsField)).toBeDefined();
      }
    }
  });

  test("the profile patches are the SAME values `storage-profiles.ts --apply` writes for the dev lanes (one ladder, two appliers)", () => {
    // applyProfile edits a staged copy in place; the Job merges a patch into the live Application. Both must
    // land the identical value, or there would be two ladders that happen to share a file.
    for (const rung of ladder) {
      const edits = applyProfile(catalogue, rung.name, REPO_ROOT, false);
      const bySize = new Map(edits.map((e) => [`${e.path}::${e.field}`, e.to]));
      for (const claim of catalogue.claims) {
        if (classifyClaim(claim).kind !== "values") continue;
        const key = `${claim.path}::${claim.sizeField}`;
        const committedSize = String(getIn(applicationDoc(claim.path, claim.docIndex), claim.sizeField));
        // An edit exists exactly when the rung differs from what is committed; otherwise the value is unchanged.
        expect(bySize.get(key) ?? committedSize).toBe(claim.sizes[rung.name] as string);
      }
    }
  });
});

describe("(b) the root ignores exactly the leaves the Jobs write — and nothing else of those Applications", () => {
  const root = yamlDocs(read(ROOT_APPLICATION_PATH))[0] as K8sObject;
  const ignore = (getIn(root, "spec.ignoreDifferences") as Array<Record<string, unknown>>).map((e) => ({
    name: String(e["name"]),
    pointers: (e["jsonPointers"] as string[]).slice().sort(),
  }));

  test("every patched Application has an entry whose pointers are exactly the generated set", () => {
    for (const app of patchedApplications()) {
      // `some`, not `find`: forgejo carries TWO entries since 2026-10-02 -- the install-time public-domain
      // one (/spec/source/helm/parameters, owned by platform-public-tls) and the generated size one. Two
      // entries naming one Application is legal ArgoCD; each must stay exactly its own writer's pointers.
      const entries = ignore.filter((e) => e.name === app.app);
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.some((e) => JSON.stringify(e.pointers) === JSON.stringify([...app.pointers]))).toBe(true);
    }
  });

  test("the GitLab / Forgejo entries the install-time public-domain and LB range own are untouched", () => {
    expect(ignore.find((e) => e.name === "gitlab")?.pointers).toContain("/spec/source/helm/valuesObject/global/zeta/lanAddress");
    expect(ignore.find((e) => e.name === "forgejo")?.pointers).toEqual(["/spec/source/helm/parameters"]);
  });

  test("it ignores NO Application the profile does not patch (an ignore with no writer hides real drift)", () => {
    const patched = new Set(patchedApplications().map((a) => a.app));
    const owned = new Set(["gitlab", "forgejo"]);
    for (const entry of ignore) expect(patched.has(entry.name) || owned.has(entry.name)).toBe(true);
  });

  test("every values pointer resolves in the committed Application (an ignore of a key nothing has is inert)", () => {
    for (const app of patchedApplications()) {
      const claim = catalogue.claims.find((c) => {
        const reach = classifyClaim(c);
        return reach.kind === "values" && reach.app === app.app;
      });
      if (claim === undefined) continue; // vllm: a kustomize patch surface that is ABSENT until the Job writes it
      const doc = applicationDoc(claim.path, claim.docIndex);
      for (const pointer of app.pointers) {
        const field = pointer.slice(1).split("/").join(".");
        expect(getIn(doc, field)).toBeDefined();
      }
    }
  });
});

describe("(c) the kit's own parts agree", () => {
  const apps = patchedApplications();
  const objects = yamlDocs(kitFile("jobs.yaml"));
  const jobs = objects.filter((o) => o["kind"] === "Job");
  const configMap = yamlDocs(kitFile("configmap.yaml"))[0] as K8sObject;
  const data = (configMap["data"] ?? {}) as Record<string, string>;

  test("one Job per patched Application, and each waits for and patches THE SAME Application", () => {
    expect(jobs.map((j) => (j["metadata"] as Record<string, string>)["name"])).toEqual(apps.map((a) => `zeta-storage-profile-${a.app}`));
    for (const app of apps) {
      const job = jobs.find((j) => (j["metadata"] as Record<string, string>)["name"] === `zeta-storage-profile-${app.app}`);
      const spec = (getIn(job, "spec.template.spec") ?? {}) as Record<string, Array<Record<string, unknown>>>;
      expect(spec["initContainers"]?.[0]?.["args"]).toEqual(["wait", "--for=create", `applications.argoproj.io/${app.app}`, "-n", "argocd", "--timeout=24h"]);
      expect(spec["containers"]?.[0]?.["args"]).toEqual([
        "patch",
        "applications.argoproj.io",
        app.app,
        "-n",
        "argocd",
        "--type",
        "merge",
        "--patch-file",
        `/patch/$(ZETA_STORAGE_PROFILE)--${app.app}.json`,
      ]);
    }
  });

  test("the Jobs reuse the one kubectl image the repo already pins (a new image would need its own resolvability proof)", () => {
    const images = new Set<string>();
    for (const job of jobs) {
      const spec = (getIn(job, "spec.template.spec") ?? {}) as Record<string, Array<Record<string, string>>>;
      for (const c of [...(spec["initContainers"] ?? []), ...(spec["containers"] ?? [])]) images.add(String(c["image"]));
    }
    expect([...images]).toEqual(["docker.io/rancher/kubectl:v1.35.6"]);
    expect(read("full-ai-cluster/k8s/lb-ipam/gitlab-lan-address.yaml")).toContain("docker.io/rancher/kubectl:v1.35.6");
  });

  test("a Job's health is not the Application's: it carries ignore-healthcheck, like every other install-time Job", () => {
    for (const job of jobs) {
      expect(getIn(job, "metadata.annotations")).toEqual({ "argocd.argoproj.io/ignore-healthcheck": "true" });
    }
  });

  test("the ConfigMap carries one patch per (profile, Application), each valid JSON, and NO profile key", () => {
    expect(Object.keys(data).sort()).toEqual(
      ladder.flatMap((r) => apps.map((a) => `${r.name}--${a.app}.json`)).sort(),
    );
    expect(data["profile"]).toBeUndefined();
    for (const value of Object.values(data)) expect(() => JSON.parse(value)).not.toThrow();
  });

  test("the RBAC may patch exactly the patched Applications and nothing else", () => {
    const role = yamlDocs(kitFile("rbac.yaml")).find((o) => o["kind"] === "Role") as K8sObject;
    const rules = role["rules"] as Array<Record<string, unknown>>;
    const write = rules.find((r) => (r["verbs"] as string[]).includes("patch"));
    expect(write?.["resourceNames"]).toEqual(apps.map((a) => a.app));
    expect(write?.["verbs"]).toEqual(["patch"]);
    for (const rule of rules) {
      expect(rule["verbs"] as string[]).not.toContain("delete");
      expect(rule["verbs"] as string[]).not.toContain("create");
    }
  });

  test("the generated manifests carry no placeholder and no profile of their own", () => {
    for (const name of ["configmap.yaml", "rbac.yaml", "jobs.yaml", "kustomization.yaml"]) {
      expect(kitFile(name)).not.toContain("@ZETA_");
      expect(kitFile(name)).not.toMatch(/example\.com|change-me|:placeholder/);
    }
  });
});

describe("(c) the rendered Application, per profile (what the Nix module hands to k3s)", () => {
  test("the template carries exactly one token, and prose that never spells it", () => {
    const template = read(STORAGE_PROFILE_TEMPLATE);
    const tokens = new Set(template.match(/@ZETA_[A-Z_]+@/g));
    expect([...tokens]).toEqual([STORAGE_PROFILE_TOKEN]);
    const comments = template.split("\n").filter((l) => l.trim().startsWith("#") && !l.includes("ZETA-STORAGE-PROFILE-JOBS"));
    for (const line of comments) expect(line).not.toContain("@ZETA_");
  });

  for (const rung of ladder) {
    test(`${rung.name}: no unsubstituted token, the ConfigMap names the profile, and every Job reads a patch that exists`, () => {
      const text = renderStorageProfileApplicationText(rung.name);
      expect(text).not.toContain("@ZETA_");
      const app = yamlDocs(text)[0] as K8sObject;
      expect(getIn(app, "metadata.name")).toBe(STORAGE_PROFILE_APPLICATION_NAME);
      const objects = storageProfileObjects(rung.name);
      const cm = objects.find((o) => o["kind"] === "ConfigMap") as K8sObject;
      expect(getIn(cm, "data.profile")).toBe(rung.name);
      const jobs = objects.filter((o) => o["kind"] === "Job");
      const names = jobs.map((j) => (j["metadata"] as Record<string, string>)["name"]);
      // The profile is in every Job's NAME: a changed profile is a NEW Job, not a completed one nobody re-runs.
      for (const name of names) expect(name).toMatch(new RegExp(`^zeta-storage-profile-.+-${rung.name}$`));
      expect(new Set(names).size).toBe(names.length);
      for (const name of names) expect(String(name).length).toBeLessThanOrEqual(63);
      const dataKeys = new Set(Object.keys(cm["data"] as Record<string, string>));
      for (const job of jobs) {
        const args = ((getIn(job, "spec.template.spec.containers") as Array<Record<string, string[]>>)[0]?.["args"] ?? []) as string[];
        const patchFile = String(args.at(-1)).replace("$(ZETA_STORAGE_PROFILE)", rung.name).replace("/patch/", "");
        expect(dataKeys.has(patchFile)).toBe(true);
      }
    });
  }

  test("two different profiles render two different Job sets (the grow-later path re-runs the Jobs)", () => {
    const a = storageProfileObjects("standard").filter((o) => o["kind"] === "Job").map((j) => (j["metadata"] as Record<string, string>)["name"]);
    const b = storageProfileObjects("large").filter((o) => o["kind"] === "Job").map((j) => (j["metadata"] as Record<string, string>)["name"]);
    expect(a.filter((n) => b.includes(n))).toEqual([]);
  });
});

describe("(d) the Nix module — pinned on its TEXT (nothing here evaluates nix)", () => {
  const nix = read(STORAGE_PROFILE_NIX_MODULE);

  test("it reads the file the installer writes, the high-water mark, the generated ladder and the template", () => {
    expect(nix).toContain('profileFile = "/etc/zeta/storage-profile"');
    expect(nix).toContain('highWaterFile = "/var/lib/zeta/storage-profile-high-water"');
    expect(nix).toContain("../../k8s/storage-profile/ladder.json");
    expect(nix).toContain("../../k8s/storage-profile/argocd-application.yaml.in");
    expect(nix).toContain(`"${STORAGE_PROFILE_TOKEN}"`);
  });

  test("it fills exactly the token the template carries", () => {
    const filled = [...nix.matchAll(/"(@ZETA_[A-Z_]+@)"/g)].map((m) => m[1]);
    // The assertion's `@ZETA_` prefix check is a prefix, not a token.
    expect(new Set(filled)).toEqual(new Set([STORAGE_PROFILE_TOKEN]));
  });

  test("the ladder it validates against is the generated ladder.json, which is the catalogue's", () => {
    const generated = JSON.parse(kitFile("ladder.json")) as { committed: string; profiles: string[] };
    expect(generated.profiles).toEqual(ladder.map((r) => r.name));
    expect(generated.committed).toBe(committed);
  });

  test("a value that is not a rung is REFUSED at evaluation, and an unsubstituted token is refused too", () => {
    expect(nix).toContain("assertion = !present || valid;");
    expect(nix).toContain("which is not a storage profile");
    expect(nix).toContain('assertion = !valid || !(lib.hasInfix "@ZETA_" rendered);');
  });

  test("it only acts on a k3s SERVER, like the other injected modules", () => {
    expect(nix).toContain('config.services.k3s.role == "server"');
    expect(nix).toContain("(lib.mkIf (valid && isServer)");
    expect(nix).toContain("services.k3s.manifests.zeta-storage-profile.source");
  });

  test("NEVER SHRINKS: it takes the HIGHER of the file and the recorded high-water mark, and records what it rendered", () => {
    expect(nix).toContain("else if rank highWater > rank requested then highWater");
    expect(nix).toContain("system.activationScripts.zetaStorageProfileHighWater");
    expect(nix).toContain("${highWaterFile}");
    // A garbled high-water file must not lower or break anything.
    expect(nix).toContain("highWater = if rank recorded > 0 then recorded else");
  });

  test("an absent file contributes NOTHING: no Application, no placeholder, no default profile", () => {
    expect(nix).toContain("ABSENT -> this module contributes nothing");
    expect(nix).toContain('requested = readTrimmed profileFile;');
    expect(nix).toContain("effective =\n    if !valid then \"\"");
  });

  test("common.nix imports it, so every host evaluates it", () => {
    expect(read("full-ai-cluster/nixos/modules/common.nix")).toContain("./injected-storage-profile.nix");
  });
});

describe("(d) every link of ESP -> first boot -> installer -> /etc/zeta -> Nix has a CONSUMER (an install-time key nothing reads is inert)", () => {
  const install = read(INSTALL_SH_PATH);
  const firstBoot = read("full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh");

  test("zflash writes the variable the first-boot script exports", () => {
    expect(STORAGE_PROFILE_ENV).toBe("ZETA_STORAGE_PROFILE");
    expect(firstBoot).toContain('export ZETA_STORAGE_PROFILE="${ZETA_STORAGE_PROFILE:-}"');
  });

  test("the installer reads that variable, decides, and the decision reaches the writer", () => {
    expect(install).toContain('want="${ZETA_STORAGE_PROFILE:-}"');
    expect(install).toContain('decision="$(zeta_storage_profile_decide "$schedulable" "$want" "$floor"');
    expect(install).toContain('ZETA_STORAGE_PROFILE_WRITE="$write"');
    expect(install).toContain('if [ "${ZETA_STORAGE_PROFILE_WRITE:-0}" = "1" ]; then');
  });

  test("the writer's file is the one the module reads, and it is symlinked for `--impure` evaluation", () => {
    expect(install).toContain("/mnt/etc/zeta/storage-profile");
    expect(install).toContain("maybe_symlink /mnt/etc/zeta/storage-profile /etc/zeta/storage-profile");
    expect(read(STORAGE_PROFILE_NIX_MODULE)).toContain('"/etc/zeta/storage-profile"');
  });

  test("the choice is made BEFORE anything is wiped, by the function the wipe-ordering test already pins", () => {
    const decide = install.indexOf("assert_longhorn_pool_holds_the_roster\n\n# ── Step 2.9");
    const wipe = install.indexOf("sudo wipefs -af");
    expect(decide).toBeGreaterThan(0);
    expect(wipe).toBeGreaterThan(decide);
  });

  test("repair mode recovers the prior profile and its high-water mark as the NEVER-SHRINK floor", () => {
    expect(install).toContain('[ -f "$f/storage-profile" ] && ZETA_REPAIR_STORAGE_PROFILE=');
    expect(install).toContain("var/lib/zeta/storage-profile-high-water");
    expect(install).toContain("ZETA_REPAIR_STORAGE_PROFILE_HW");
  });

  test("the documented override is honest about what it cannot do", () => {
    const doc = read("docs/ops/INSTALL-TIME-CONFIG.md");
    expect(doc).toContain("| 29 |");
    expect(doc).toContain("ZETA_STORAGE_PROFILE");
    expect(doc).toContain("--storage-profile");
    expect(doc).toContain("NEVER shrinks");
  });
});

describe("the dev-lane applier is untouched: the same catalogue, `ci` for the hosted runner", () => {
  test("applyProfile still takes every profile (the ladder has not forked)", () => {
    for (const name of catalogue.profiles) {
      expect(() => applyProfile(catalogue, name, REPO_ROOT, false)).not.toThrow();
    }
    expect(DEFAULT_CATALOGUE_PATH).toBe("full-ai-cluster/k8s/storage-profiles.json");
  });

  test("a claim's install demand is its rung size x pods, charged per reach", () => {
    const claim = catalogue.claims.find((c) => c.id === "full-ai-cluster/cockroachdb/data") as ProfileClaim;
    expect(installDemandGib(catalogue, "minimal", committed)).toBeGreaterThan(0);
    expect(claim.sizes["minimal"]).toBe("32Gi");
    expect(claim.pods["minimal"]).toBe(1);
  });
});
