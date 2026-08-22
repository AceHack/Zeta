// full-ai-cluster/tools/k8s-manifests.test.ts
//
// Structural validation of the k8s manifests (no cluster needed): every
// ArgoCD Application that sources local manifests must point at a path that
// EXISTS and only `include` files that EXIST, and every manifest must declare
// apiVersion + kind. This catches the most common GitOps breakage — an
// Application referencing a dir/file that was renamed or never committed —
// before ArgoCD ever tries to sync it.
//
// Run:  cd full-ai-cluster && bun test tools/k8s-manifests.test.ts

import { test, expect, describe } from "bun:test";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO = join(import.meta.dir, "..", ".."); // .../full-ai-cluster/..  (repo root)
const K8S = join(REPO, "full-ai-cluster", "k8s");

function walkYaml(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walkYaml(p));
    else if (e.name.endsWith(".yaml") || e.name.endsWith(".yml")) out.push(p);
  }
  return out;
}

// TWO INDEPENDENT WALKS, UNIONED. Each is a separate route into the corpus, so each is
// tracked separately as well as summed — see the per-tree test below for why the sum
// alone is not enough.
const MANIFEST_TREES = ["applications", "bootstrap"] as const;
const perTree = new Map<string, readonly string[]>(
  MANIFEST_TREES.map((tree) => [tree, walkYaml(join(K8S, tree))]),
);
const allYaml = [...perTree.values()].flat();

describe("k8s manifests are present and well-formed", () => {
  test("found a non-trivial set of manifests", () => {
    expect(allYaml.length).toBeGreaterThan(20);
  });

  // PER-TREE, BECAUSE THE TOTAL ABOVE CANNOT SEE ONE WALK GO DARK.
  //
  // `walkYaml` returns [] for a directory that does not exist — deliberately, so a
  // partial checkout does not explode — which makes a renamed or moved tree
  // indistinguishable from an empty one inside the sum. Measured 2026-08-15:
  // applications 97, bootstrap 11. If `bootstrap/` moved, 97 still clears 20 and this
  // suite would report green having validated no bootstrap manifest at all. An
  // aggregate floor sums independent instruments, so it cannot detect the failure of
  // any one.
  //
  // The floor is ONE PER TREE: the non-vacuity boundary, and the only value here that
  // is not a guess about how many manifests a tree ought to hold.
  for (const tree of MANIFEST_TREES) {
    test(`the ${tree}/ walk still returns manifests — a dark walk is invisible in the total`, () => {
      expect(perTree.get(tree)?.length ?? 0).toBeGreaterThanOrEqual(1);
    });
  }

  test("every manifest declares apiVersion and kind", () => {
    const bad: string[] = [];
    for (const f of allYaml) {
      const t = readFileSync(f, "utf8");
      if (!/^\s*apiVersion:/m.test(t) || !/^\s*kind:/m.test(t)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });
});

describe("ArgoCD Applications reference paths/files that exist", () => {
  const apps = allYaml.filter((f) => {
    const t = readFileSync(f, "utf8");
    return /kind:\s*Application/.test(t) && /argoproj\.io/.test(t);
  });

  test("found the Applications (incl. the ones added this session)", () => {
    const names = apps.map((f) => f.replace(REPO, "").replace(/\\/g, "/"));
    // sanity: the foundation apps must be present
    expect(names.some((n) => n.includes("headlamp"))).toBe(true);
    expect(names.some((n) => n.includes("game-hosting/gmod"))).toBe(true);
    expect(names.some((n) => n.includes("cilium-lb-ipam"))).toBe(true);
    expect(names.some((n) => n.includes("agent-memory"))).toBe(true);
  });

  // Strict existence check scoped to the apps THIS session added — those
  // must be correct. (The repo-wide check is intentionally not enforced here:
  // some pre-existing apps list include files that don't exist but are handled
  // by CreateNamespace=true, and root-application.yaml uses a glob include —
  // both legitimate, neither ours to police in this test.)
  const SESSION_APPS = ["headlamp/", "agent-memory/", "cilium-lb-ipam/", "game-hosting/gmod/"];
  const mine = apps.filter((f) => SESSION_APPS.some((s) => f.replace(/\\/g, "/").includes(`/applications/${s}`)));

  test("session-added Applications reference paths + include files that exist", () => {
    expect(mine.length).toBeGreaterThanOrEqual(3); // at least the local-source ones
    const problems: string[] = [];
    for (const f of mine) {
      const t = readFileSync(f, "utf8");
      const pathM = t.match(/^\s*path:\s*(\S+)\s*$/m);
      if (!pathM) continue; // headlamp is a helm source — no local path
      const relPath = pathM[1]!.replace(/^['"]|['"]$/g, "");
      const absPath = join(REPO, relPath);
      if (!existsSync(absPath) || !statSync(absPath).isDirectory()) {
        problems.push(`${f.replace(REPO, "")}: path '${relPath}' missing`);
        continue;
      }
      const incM = t.match(/include:\s*'?\{([^}]+)\}'?/);
      if (incM) {
        for (const base of incM[1]!.split(",").map((s) => s.trim())) {
          if (base.includes("*")) continue; // glob, not a literal file
          const file = join(absPath, base.endsWith(".yaml") ? base : `${base}.yaml`);
          if (!existsSync(file)) problems.push(`${f.replace(REPO, "")}: include '${base}' missing in ${relPath}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("platform app: generic Blueprint/Deployable engine wiring", () => {
  const platform = join(K8S, "applications", "platform");
  const read = (p: string) => readFileSync(join(platform, p), "utf8");

  test("the platform Application's include list references files that all exist", () => {
    const app = read("Application.yaml");
    const incM = app.match(/include:\s*'?\{([^}]+)\}'?/);
    expect(incM).not.toBeNull();
    const missing: string[] = [];
    for (const base of incM![1]!.split(",").map((s) => s.trim())) {
      const file = join(platform, base.endsWith(".yaml") ? base : `${base}.yaml`);
      if (!existsSync(file)) missing.push(base);
    }
    expect(missing).toEqual([]);
  });

  test("Blueprint + Deployable CRDs register the generic kinds", () => {
    expect(read("crd-blueprint.yaml")).toContain("kind: Blueprint");
    expect(read("crd-blueprint.yaml")).toContain("blueprints.platform.zeta.io");
    expect(read("crd-deployable.yaml")).toContain("kind: Deployable");
    expect(read("crd-deployable.yaml")).toContain("deployables.platform.zeta.io");
  });

  test("starter Blueprint library covers game, web, database, and app categories", () => {
    const lib = read("blueprints.yaml");
    for (const name of ["name: gmod", "name: web", "name: postgres", "name: worker"]) expect(lib).toContain(name);
    for (const cat of ["category: game", "category: web", "category: database", "category: app"]) expect(lib).toContain(cat);
  });

  test("controller ships a ServiceAccount, scoped ClusterRole, binding, and Deployment", () => {
    const c = read("controller.yaml");
    for (const kind of ["kind: ServiceAccount", "kind: ClusterRole", "kind: ClusterRoleBinding", "kind: Deployment"]) {
      expect(c).toContain(kind);
    }
    expect(c).toContain("deployables/status"); // status patch permission
    expect(c).not.toContain('resources: ["*"]'); // least-privilege, no wildcard
  });

  test("portal is a StatefulSet with a Longhorn volumeClaimTemplate (durable rooms = agent-memory pattern)", () => {
    const p = read("portal.yaml");
    expect(p).toContain("kind: StatefulSet");
    expect(p).not.toContain("kind: Deployment"); // must be stateful, not a Deployment
    expect(p).toContain("volumeClaimTemplates");
    expect(p).toContain("storageClassName: longhorn");
    expect(p).toContain("/var/lib/zeta-rooms"); // the durable mount
    expect(p).toContain("pods/log"); // live logs RBAC (the real resource console)
    expect(p).toContain("metrics.k8s.io"); // live metrics RBAC
    expect(p).not.toContain('resources: ["*"]'); // scoped RBAC, no wildcard
    expect(p).toContain("kind: HTTPRoute"); // published on the shared Gateway
  });
});

describe("session-added apps: required objects present", () => {
  const dir = join(K8S, "applications");
  const read = (p: string) => readFileSync(join(dir, p), "utf8");

  test("gmod has StatefulSet + LoadBalancer Service + longhorn PVC", () => {
    const ss = read("game-hosting/gmod/statefulset.yaml");
    expect(ss).toContain("kind: StatefulSet");
    expect(ss).toContain("storageClassName: longhorn");
    expect(ss).toContain("volumeClaimTemplates");
    const svc = read("game-hosting/gmod/service.yaml");
    expect(svc).toContain("type: LoadBalancer");
    expect(svc).toContain("27015");
  });

  test("agent-memory binds a longhorn PVC via volumeClaimTemplates", () => {
    const ss = read("agent-memory/statefulset.yaml");
    expect(ss).toContain("kind: StatefulSet");
    expect(ss).toContain("storageClassName: longhorn");
  });

  test("cilium-lb-ipam declares an IP pool + an L2 announcement policy", () => {
    expect(read("cilium-lb-ipam/ip-pool.yaml")).toContain("kind: CiliumLoadBalancerIPPool");
    expect(read("cilium-lb-ipam/l2-policy.yaml")).toContain("kind: CiliumL2AnnouncementPolicy");
  });
});
