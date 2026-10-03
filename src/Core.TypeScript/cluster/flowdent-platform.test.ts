/**
 * flowdent-platform.test.ts - 081M3XNG5C6087G0R00223X96E.
 *
 * The OPT-IN tenancy for the flowdent `fd-core` API (full-ai-cluster/k8s/flowdent/) and the two
 * public Gateway listeners it is reached through (k8s/public-tls/). What these tests can prove
 * with no cluster, and what they cannot, is stated in docs/ops/FLOWDENT-ON-CLUSTER.md: nothing
 * here proves a CNPG role was created or a certificate issued -- that needs the live node.
 *
 * A. opt-in: the Application is OUTSIDE the catalog the app-of-apps root recurses, and the
 *    directory is self-consistent (kustomization lists exactly the manifests present).
 * B. isolation: no ClusterRole, no wildcard, the two deployers are byte-identical modulo namespace
 *    and can reach only their own namespace; Secrets they can read are the two named ones.
 * C. the database wiring: one role per database, each role's Secret is the one the Job creates,
 *    the app Secret carries an Npgsql connection string, and no password is ever a literal.
 * D. the shared Cluster is untouched: `postgres-shared/cluster.yaml` declares no `managed` block,
 *    so the Job's merge patch cannot clobber a role somebody else declared.
 * F. the connection budget (docs/ops/POSTGRES-CONNECTION-BUDGET.md): per-role CONNECTION LIMITs and Npgsql pool
 *    sizes are declared in one ConfigMap, satisfy (replicas + surge) x pool <= role limit and sum(limits) <=
 *    usable slots, and the Job that applies them is an idempotent PostSync hook with least-privilege RBAC.
 * E. public TLS: SET adds api.<domain> / api-staging.<domain> as listeners 5 and 6, each with its
 *    OWN certificate; the base carries no hostname; UNSET applies nothing.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { publicTlsObjects, yamlDocs, type K8sObject } from "./public-tls.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const DIR = join(REPO_ROOT, "full-ai-cluster/k8s/flowdent");
const SET = { acmeEmail: "ops@zeta-cluster-fixture.net", publicDomain: "zeta-cluster-fixture.net" } as const;

const read = (f: string) => readFileSync(join(DIR, f), "utf8");
const docs = (f: string) => yamlDocs(read(f));
const all = () => ["namespaces.yaml", "priorityclasses.yaml", "deployer.yaml", "database.yaml", "database-budget.yaml"].flatMap(docs);
const meta = (o: K8sObject) => (o["metadata"] ?? {}) as Record<string, any>;
const name = (o: K8sObject) => String(meta(o)["name"] ?? "");
const ns = (o: K8sObject) => String(meta(o)["namespace"] ?? "");
const kinds = (objs: K8sObject[], kind: string) => objs.filter((o) => o["kind"] === kind);

describe("A. opt-in: nothing here exists unless an operator applies Application.yaml", () => {
  const root = parseYaml(readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/bootstrap/root-application.yaml"), "utf8")) as Record<string, any>;

  test("the app-of-apps root recurses only k8s/applications, and this directory is not under it", () => {
    expect(root.spec.source.path).toBe("full-ai-cluster/k8s/applications");
    expect("full-ai-cluster/k8s/flowdent".startsWith(root.spec.source.path)).toBe(false);
  });

  test("the Application points at this directory, never prunes, and self-heals", () => {
    const app = parseYaml(read("Application.yaml")) as Record<string, any>;
    expect(app.kind).toBe("Application");
    expect(app.metadata.name).toBe("flowdent-platform");
    expect(app.spec.source.path).toBe("full-ai-cluster/k8s/flowdent");
    expect(app.spec.syncPolicy.automated.prune).toBe(false);
    expect(app.spec.syncPolicy.automated.selfHeal).toBe(true);
    expect(app.spec.syncPolicy.syncOptions).toContain("SkipDryRunOnMissingResource=true");
  });

  test("kustomization.yaml lists exactly the manifests in the directory (Application.yaml is not one of them)", () => {
    const k = parseYaml(read("kustomization.yaml")) as Record<string, any>;
    const present = readdirSync(DIR).filter((f) => f.endsWith(".yaml") && f !== "kustomization.yaml" && f !== "Application.yaml").sort();
    expect([...k.resources].sort()).toEqual(present);
  });

  test("the only namespaces it creates are flowdent-staging and flowdent-prod", () => {
    expect(kinds(all(), "Namespace").map(name).sort()).toEqual(["flowdent-prod", "flowdent-staging"]);
  });

  test("every object is in one of the three namespaces it is allowed to touch (Namespaces and PriorityClasses excepted)", () => {
    const allowed = new Set(["flowdent-staging", "flowdent-prod", "postgres-shared"]);
    for (const o of all().filter((x) => x["kind"] !== "Namespace" && x["kind"] !== "PriorityClass")) expect(allowed.has(ns(o))).toBe(true);
  });

  test("the only cluster-scoped objects are the two Namespaces and the two PriorityClasses", () => {
    const clusterScoped = all().filter((o) => ns(o) === "");
    expect(clusterScoped.map((o) => `${String(o["kind"])}/${name(o)}`).sort()).toEqual([
      "Namespace/flowdent-prod", "Namespace/flowdent-staging", "PriorityClass/flowdent-prod", "PriorityClass/flowdent-staging",
    ]);
  });
});

describe("B. isolation: the deployers", () => {
  const roles = () => kinds(all(), "Role");
  const deployer = (n: string) => roles().find((r) => name(r) === "flowdent-deployer" && ns(r) === n)!;

  test("no ClusterRole, no ClusterRoleBinding anywhere in the tenancy", () => {
    expect(kinds(all(), "ClusterRole")).toEqual([]);
    expect(kinds(all(), "ClusterRoleBinding")).toEqual([]);
  });

  test("no Role grants a wildcard verb, resource or apiGroup", () => {
    for (const r of roles()) {
      for (const rule of r["rules"] as Array<Record<string, string[]>>) {
        for (const key of ["verbs", "resources", "apiGroups"] as const) expect(rule[key]).not.toContain("*");
      }
    }
  });

  test("staging and prod deployers are the SAME grant, differing only in namespace", () => {
    expect(deployer("flowdent-staging")["rules"]).toEqual(deployer("flowdent-prod")["rules"]);
  });

  test("secrets: `create` (no resourceNames form exists), `get` on the three names the pipeline reads, write on the pull Secret ONLY", () => {
    for (const n of ["flowdent-staging", "flowdent-prod"]) {
      const sec = (deployer(n)["rules"] as Array<Record<string, any>>).filter((r) => r["resources"].includes("secrets"));
      expect(sec).toEqual([
        { apiGroups: [""], resources: ["secrets"], verbs: ["create"] },
        { apiGroups: [""], resources: ["secrets"], resourceNames: ["flowdent-api-secrets", "flowdent-db", "flowdent-registry"], verbs: ["get"] },
        { apiGroups: [""], resources: ["secrets"], resourceNames: ["flowdent-registry"], verbs: ["update", "patch"] },
      ]);
    }
  });

  test("the deployer can never list/watch/delete secrets or touch RBAC, nodes, namespaces", () => {
    for (const n of ["flowdent-staging", "flowdent-prod"]) {
      for (const rule of deployer(n)["rules"] as Array<Record<string, any>>) {
        const res: string[] = rule["resources"];
        if (res.includes("secrets")) expect(rule["verbs"].filter((v: string) => !["create", "get", "update", "patch"].includes(v))).toEqual([]);
        // an unrestricted (no resourceNames) rule on secrets may only ever CREATE
        if (res.includes("secrets") && rule["resourceNames"] === undefined) expect(rule["verbs"]).toEqual(["create"]);
        for (const bad of ["roles", "rolebindings", "clusterroles", "nodes", "namespaces", "serviceaccounts/token"]) expect(res).not.toContain(bad);
      }
    }
  });

  test("each RoleBinding binds that namespace's own deployer ServiceAccount, in that namespace", () => {
    for (const n of ["flowdent-staging", "flowdent-prod"]) {
      const rb = kinds(all(), "RoleBinding").find((b) => name(b) === "flowdent-deployer" && ns(b) === n)!;
      expect(rb["subjects"]).toEqual([{ kind: "ServiceAccount", name: "flowdent-deployer", namespace: n }]);
      expect(rb["roleRef"]).toEqual({ apiGroup: "rbac.authorization.k8s.io", kind: "Role", name: "flowdent-deployer" });
    }
  });

  test("a token Secret per namespace is declared for the SA, so the CI variable can be minted", () => {
    for (const n of ["flowdent-staging", "flowdent-prod"]) {
      const s = kinds(all(), "Secret").find((x) => name(x) === "flowdent-deployer-token" && ns(x) === n)!;
      expect(s["type"]).toBe("kubernetes.io/service-account-token");
      expect(meta(s)["annotations"]["kubernetes.io/service-account.name"]).toBe("flowdent-deployer");
      // never a committed credential
      expect(s["data"]).toBeUndefined();
      expect(s["stringData"]).toBeUndefined();
    }
  });

  test("each namespace carries a ResourceQuota that forces requests (so a pod with none is refused)", () => {
    for (const q of kinds(all(), "ResourceQuota")) {
      const hard = (q["spec"] as any).hard as Record<string, string>;
      expect(Object.keys(hard)).toContain("requests.cpu");
      expect(Object.keys(hard)).toContain("requests.memory");
    }
  });

  // The node has ONE disk and tainted itself DiskPressure on 2026-10-02 (~150 pods evicted).
  test("the quota also forces an ephemeral-storage REQUEST and caps the limit, so a pod is never 'over' a request it never made", () => {
    for (const q of kinds(all(), "ResourceQuota")) {
      const hard = (q["spec"] as any).hard as Record<string, string>;
      expect(Object.keys(hard)).toContain("requests.ephemeral-storage");
      expect(Object.keys(hard)).toContain("limits.ephemeral-storage");
    }
  });

  test("no PVC may be claimed in an app namespace (the databases live on postgres-shared's volume)", () => {
    for (const q of kinds(all(), "ResourceQuota")) expect((q["spec"] as any).hard["persistentvolumeclaims"]).toBe("0");
  });

  test("PriorityClasses: prod above staging above default, far below the system classes, and NEVER preempting", () => {
    const pc = Object.fromEntries(kinds(all(), "PriorityClass").map((p) => [name(p), p]));
    expect(Object.keys(pc).sort()).toEqual(["flowdent-prod", "flowdent-staging"]);
    expect(pc["flowdent-prod"]!["value"] as number).toBeGreaterThan(pc["flowdent-staging"]!["value"] as number);
    expect(pc["flowdent-staging"]!["value"] as number).toBeGreaterThan(0);
    expect(pc["flowdent-prod"]!["value"] as number).toBeLessThan(1_000_000);
    for (const p of Object.values(pc)) {
      expect(p["preemptionPolicy"]).toBe("Never");
      expect(p["globalDefault"]).toBe(false);
    }
  });
});

describe("C. the database wiring", () => {
  const dbs = () => kinds(all(), "Database");
  const job = () => kinds(all(), "Job").find((j) => name(j) === "flowdent-db-provision")!;
  const podSpec = () => (job()["spec"] as any).template.spec;
  const kubectlSteps = () => [...podSpec().initContainers, ...podSpec().containers].filter((c: any) => c.image.includes("rancher/kubectl"));
  const rolesPatch = () => {
    const c = podSpec().containers[0];
    const json = (c.args as string[])[(c.args as string[]).indexOf("-p") + 1]!;
    return JSON.parse(json).spec.managed.roles as Array<Record<string, any>>;
  };

  test("two databases on postgres-shared, one OWNER role each, retained on CR deletion", () => {
    const got = dbs().map((d) => ({ ns: ns(d), cluster: (d["spec"] as any).cluster.name, db: (d["spec"] as any).name, owner: (d["spec"] as any).owner, reclaim: (d["spec"] as any).databaseReclaimPolicy }));
    expect(got).toEqual([
      { ns: "postgres-shared", cluster: "postgres-shared", db: "flowdent_staging", owner: "flowdent_staging", reclaim: "retain" },
      { ns: "postgres-shared", cluster: "postgres-shared", db: "flowdent_prod", owner: "flowdent_prod", reclaim: "retain" },
    ]);
  });

  test("every Database owner is a managed role the Job registers, and no role is registered that owns nothing", () => {
    expect(rolesPatch().map((r) => r["name"]).sort()).toEqual(dbs().map((d) => (d["spec"] as any).owner).sort());
  });

  test("a managed role is a plain LOGIN role: no superuser, createdb, createrole, replication", () => {
    for (const r of rolesPatch()) {
      expect(r["login"]).toBe(true);
      for (const k of ["superuser", "createdb", "createrole", "replication", "bypassrls"]) expect(r[k]).toBeUndefined();
    }
  });

  test("each role's passwordSecret is a Secret the Job creates in postgres-shared, as basic-auth", () => {
    const created = kubectlSteps()
      .filter((c: any) => c.args[0] === "create")
      .map((c: any) => ({ name: c.args[3], n: c.args[c.args.indexOf("-n") + 1], type: (c.args as string[]).find((a) => a.startsWith("--type=")) }));
    for (const r of rolesPatch()) {
      expect(created).toContainEqual({ name: r["passwordSecret"].name, n: "postgres-shared", type: "--type=kubernetes.io/basic-auth" });
    }
  });

  test("the app copy is `flowdent-db` in each app namespace, and carries an Npgsql connection string under the ASP.NET key", () => {
    for (const n of ["flowdent-staging", "flowdent-prod"]) {
      const step = kubectlSteps().find((c: any) => c.args[0] === "create" && c.args.includes(n))!;
      expect(step.args[3]).toBe("flowdent-db");
      expect((step.args as string[]).some((a) => a.startsWith("--from-file=ConnectionStrings__DefaultConnection="))).toBe(true);
    }
    const script = podSpec().initContainers[0].args[0] as string;
    expect(script).toContain("Host=postgres-shared-rw.postgres-shared.svc;Port=5432;Database=flowdent_$env;Username=flowdent_$env;Password=$pw");
  });

  test("create-only: every kubectl write that carries a secret is `create` (never apply/replace), and uses --from-file, never --from-literal", () => {
    for (const c of kubectlSteps().filter((s: any) => s.args.includes("secret"))) {
      expect(c.args[0]).toBe("create");
      expect((c.args as string[]).filter((a) => a.startsWith("--from-literal"))).toEqual([]);
      expect((c.args as string[]).some((a) => a.startsWith("--from-file="))).toBe(true);
    }
  });

  test("no manifest in the tenancy contains a password: Secrets are minted at runtime, the Job drags in /dev/urandom", () => {
    expect(read("database.yaml")).toContain("/dev/urandom");
    for (const s of kinds(all(), "Secret")) expect(s["data"] ?? s["stringData"]).toBeUndefined();
  });

  test("the only shell is the entropy container; every kubectl container is shell-less and unprivileged", () => {
    const withShell = [...podSpec().initContainers, ...podSpec().containers].filter((c: any) => (c.command ?? []).includes("/bin/sh"));
    expect(withShell.map((c: any) => c.name)).toEqual(["draw-entropy"]);
    for (const c of [...podSpec().initContainers, ...podSpec().containers]) {
      expect(c.securityContext.allowPrivilegeEscalation).toBe(false);
      expect(c.securityContext.readOnlyRootFilesystem).toBe(true);
      expect(c.securityContext.capabilities.drop).toEqual(["ALL"]);
    }
    expect(podSpec().securityContext.runAsNonRoot).toBe(true);
  });

  test("the entropy volume is memory-backed (the password never touches a disk)", () => {
    expect(podSpec().volumes.find((v: any) => v.name === "entropy").emptyDir.medium).toBe("Memory");
  });

  test("the roles are registered LAST, after every Secret exists", () => {
    expect(podSpec().containers.map((c: any) => c.name)).toEqual(["register-roles"]);
    expect(podSpec().initContainers.map((c: any) => c.name).slice(-1)).toEqual(["app-secret-prod"]);
  });

  test("provisioner RBAC: create secrets, and get/patch ONLY the one Cluster; app namespaces get `create` on secrets alone", () => {
    const roles = kinds(all(), "Role").filter((r) => name(r) === "flowdent-db-provision");
    const by = (n: string) => roles.find((r) => ns(r) === n)!["rules"];
    expect(by("postgres-shared")).toEqual([
      { apiGroups: [""], resources: ["secrets"], verbs: ["create"] },
      { apiGroups: ["postgresql.cnpg.io"], resources: ["clusters"], resourceNames: ["postgres-shared"], verbs: ["get", "patch"] },
    ]);
    for (const n of ["flowdent-staging", "flowdent-prod"]) expect(by(n)).toEqual([{ apiGroups: [""], resources: ["secrets"], verbs: ["create"] }]);
  });

  test("the Job is not a hook and has no TTL: it runs once and stays as the record that it did", () => {
    expect(meta(job())["annotations"]["argocd.argoproj.io/hook"]).toBeUndefined();
    expect((job()["spec"] as any).ttlSecondsAfterFinished).toBeUndefined();
  });

  test("the kubectl and busybox images are the ones the bootstrap seeding already pins (one image to preload and verify)", () => {
    const seeding = readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/bootstrap/internal-secret-seeding.yaml"), "utf8");
    const imgs = new Set([...podSpec().initContainers, ...podSpec().containers].map((c: any) => c.image as string));
    expect(imgs.size).toBe(2);
    for (const i of imgs) expect(seeding).toContain(i);
  });
});

describe("D. the shared Cluster is untouched", () => {
  test("postgres-shared/cluster.yaml declares no `managed` block (this Job's merge patch would replace it)", () => {
    const cluster = yamlDocs(readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/applications/postgres-shared/cluster.yaml"), "utf8"))[0]!;
    expect((cluster["spec"] as Record<string, unknown>)["managed"]).toBeUndefined();
  });

  test("enableSuperuserAccess is still not turned on (an owner role needs no superuser)", () => {
    const cluster = yamlDocs(readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/applications/postgres-shared/cluster.yaml"), "utf8"))[0]!;
    expect((cluster["spec"] as Record<string, unknown>)["enableSuperuserAccess"]).toBeUndefined();
  });
});

describe("F. the connection budget", () => {
  const budget = () => (kinds(docs("database-budget.yaml"), "ConfigMap").find((c) => name(c) === "flowdent-db-budget")!["data"] as Record<string, string>);
  const n = (k: string) => Number(budget()[k]);
  const tune = () => kinds(docs("database-budget.yaml"), "Job").find((j) => name(j) === "flowdent-db-tune")!;
  const tunePod = () => (tune()["spec"] as any).template.spec;
  const steps = () => [...tunePod().initContainers, ...tunePod().containers];
  const composeScript = () => tunePod().initContainers[0].args[0] as string;
  const clusterYaml = () => yamlDocs(readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/applications/postgres-shared/cluster.yaml"), "utf8"))[0]!;

  test("the budget declares every number the Job reads, as non-negative integers, and nothing else", () => {
    const keys = ["max-connections", "superuser-reserved", "headroom"];
    for (const e of ["staging", "prod"]) for (const k of ["role-limit", "max-replicas", "max-surge", "pool", "health-reserve"]) keys.push(`${e}.${k}`);
    for (const k of keys) expect(Number.isInteger(n(k)) && n(k) >= 0).toBe(true);
    expect(Object.keys(budget()).sort()).toEqual([...keys].sort());
  });

  test("per environment: (max-replicas + max-surge) x pool + health-reserve <= role-limit -- pooled work and its unpooled /health companions cannot exceed the role", () => {
    for (const e of ["staging", "prod"]) {
      expect((n(`${e}.max-replicas`) + n(`${e}.max-surge`)) * n(`${e}.pool`) + n(`${e}.health-reserve`)).toBeLessThanOrEqual(n(`${e}.role-limit`));
    }
  });

  test("the two role limits fit in max_connections minus the superuser reserve minus headroom -- the roles cannot exhaust the server", () => {
    const usable = n("max-connections") - n("superuser-reserved") - n("headroom");
    expect(n("staging.role-limit") + n("prod.role-limit")).toBeLessThanOrEqual(usable);
    expect(n("headroom")).toBeGreaterThanOrEqual(15);
  });

  test("staging alone can never take the slots prod is promised", () => {
    expect(n("prod.role-limit")).toBeGreaterThan(n("staging.role-limit"));
    expect(n("max-connections") - n("superuser-reserved") - n("staging.role-limit")).toBeGreaterThanOrEqual(n("prod.role-limit"));
  });

  test("the budget max-connections is the Cluster max_connections (changing one without the other fails here)", () => {
    const params = (clusterYaml()["spec"] as any).postgresql.parameters as Record<string, string>;
    expect(Number(params["max_connections"])).toBe(n("max-connections"));
  });

  test("the pool options are all in the connection string the Job composes, and the shared prefix matches the provisioner", () => {
    for (const opt of ["Maximum Pool Size=$pool", "Timeout=15", "Command Timeout=30", "Connection Idle Lifetime=60", "Application Name=fd-core-$env"]) {
      expect(composeScript()).toContain(opt);
    }
    const provision = (kinds(docs("database.yaml"), "Job").find((j) => name(j) === "flowdent-db-provision")!["spec"] as any).template.spec.initContainers[0].args[0] as string;
    for (const part of ["Host=postgres-shared-rw.postgres-shared.svc;Port=5432", "SSL Mode=Require;Trust Server Certificate=true"]) {
      expect(provision).toContain(part);
      expect(composeScript()).toContain(part);
    }
  });

  test("the Job refuses to apply a budget that violates either inequality (the same two checks, in the container)", () => {
    expect(composeScript()).toContain("(rep + surge) * pool + reserve");
    expect(composeScript()).toContain('-gt "$limit"');
    expect(composeScript()).toContain('-gt "$usable"');
  });

  test("it is an idempotent PostSync hook, recreated on each sync", () => {
    const a = meta(tune())["annotations"] as Record<string, string>;
    expect(a["argocd.argoproj.io/hook"]).toBe("PostSync");
    expect(a["argocd.argoproj.io/hook-delete-policy"]).toBe("BeforeHookCreation");
  });

  test("every write is a `patch` of ONE named object: secrets by merge patch, the Cluster by a test-guarded JSON patch", () => {
    const patches = steps().filter((c: any) => c.image.includes("rancher/kubectl"));
    expect(patches.map((c: any) => c.args[0])).toEqual(["patch", "patch", "patch"]);
    expect(patches.map((c: any) => c.args[2])).toEqual(["flowdent-db", "flowdent-db", "postgres-shared"]);
    for (const c of patches) expect((c.args as string[]).some((a) => a.startsWith("--patch-file="))).toBe(true);
    expect(composeScript()).toContain('{"op":"test","path":"/spec/managed/roles/0/name","value":"flowdent_staging"}');
    expect(composeScript()).toContain('{"op":"test","path":"/spec/managed/roles/1/name","value":"flowdent_prod"}');
    expect(composeScript()).toContain('"path":"/spec/managed/roles/0/connectionLimit"');
    expect(composeScript()).toContain('"path":"/spec/managed/roles/1/connectionLimit"');
  });

  test("the role limits land LAST, after both connection strings carry the pool caps", () => {
    expect(tunePod().containers.map((c: any) => c.name)).toEqual(["limit-roles"]);
    expect(tunePod().initContainers.map((c: any) => c.name)).toEqual(["compose", "pool-staging", "pool-prod"]);
  });

  test("the password is read from the role Secret volume into a memory-backed file, never an argv token, env var or literal", () => {
    expect(tunePod().volumes.find((v: any) => v.name === "work").emptyDir.medium).toBe("Memory");
    for (const c of steps()) {
      // the only env a container carries is the kubectl cache location: no secret can ride in one
      expect((c.env ?? []).map((e: any) => e.name as string).filter((e: string) => e !== "HOME" && e !== "KUBECACHEDIR")).toEqual([]);
      expect((c.args as string[]).filter((a) => /^--from-literal/.test(a))).toEqual([]);
    }
    expect(composeScript()).toContain('pw=$(cat "/roles/$env/password")');
    // every `Password=` in the manifest is the shell variable, never a value
    const assigned = [...read("database-budget.yaml").matchAll(/Password=([^;\s"]*)/g)].map((m) => m[1]);
    expect(assigned.length).toBeGreaterThan(0);
    expect(assigned.every((v) => v === "$pw")).toBe(true);
  });

  test("the only shell is `compose`; every container is unprivileged and uses an image the bootstrap seeding already pins", () => {
    expect(steps().filter((c: any) => (c.command ?? []).includes("/bin/sh")).map((c: any) => c.name)).toEqual(["compose"]);
    for (const c of steps()) {
      expect(c.securityContext.allowPrivilegeEscalation).toBe(false);
      expect(c.securityContext.readOnlyRootFilesystem).toBe(true);
      expect(c.securityContext.capabilities.drop).toEqual(["ALL"]);
    }
    const seeding = readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/bootstrap/internal-secret-seeding.yaml"), "utf8");
    for (const i of new Set(steps().map((c: any) => c.image as string))) expect(seeding).toContain(i);
  });

  test("RBAC: get/patch the ONE Cluster in postgres-shared; `get`+`patch` on the ONE Secret `flowdent-db` in each app namespace, nothing else", () => {
    const roles = kinds(docs("database-budget.yaml"), "Role").filter((r) => name(r) === "flowdent-db-tune");
    const by = (x: string) => roles.find((r) => ns(r) === x)!["rules"];
    expect(by("postgres-shared")).toEqual([{ apiGroups: ["postgresql.cnpg.io"], resources: ["clusters"], resourceNames: ["postgres-shared"], verbs: ["get", "patch"] }]);
    for (const x of ["flowdent-staging", "flowdent-prod"]) {
      expect(by(x)).toEqual([{ apiGroups: [""], resources: ["secrets"], resourceNames: ["flowdent-db"], verbs: ["get", "patch"] }]);
    }
  });
});

describe("E. public TLS: api.<domain> and api-staging.<domain>", () => {
  const listeners = (objs: K8sObject[]) => ((kinds(objs, "Gateway")[0]!["spec"] as any).listeners as Array<Record<string, any>>);

  test("SET: listeners 5 and 6 carry api.<domain> and api-staging.<domain>, each with its OWN certificate Secret", () => {
    const ls = listeners(publicTlsObjects(SET));
    expect(ls[5]).toMatchObject({ name: "https-flowdent-api", hostname: "api.zeta-cluster-fixture.net", protocol: "HTTPS", port: 443 });
    expect(ls[6]).toMatchObject({ name: "https-flowdent-api-staging", hostname: "api-staging.zeta-cluster-fixture.net" });
    expect(ls[5]!["tls"]["certificateRefs"]).toEqual([{ kind: "Secret", name: "flowdent-api-tls" }]);
    expect(ls[6]!["tls"]["certificateRefs"]).toEqual([{ kind: "Secret", name: "flowdent-api-staging-tls" }]);
    const secrets = ls.filter((l) => l["tls"]).map((l) => l["tls"]["certificateRefs"][0]["name"]);
    expect(new Set(secrets).size).toBe(secrets.length);
  });

  test("SET: the earlier listeners did not move (portal 1, gitlab 2, registry 3, forgejo 4)", () => {
    const ls = listeners(publicTlsObjects(SET));
    expect(ls.slice(0, 5).map((l) => l["hostname"])).toEqual([undefined, "portal.zeta-cluster-fixture.net", "gitlab.zeta-cluster-fixture.net", "registry.zeta-cluster-fixture.net", "git.zeta-cluster-fixture.net"]);
    expect(ls.length).toBe(9);
  });

  test("SET: listeners 7 and 8 carry the apex and www.<domain> for the public website, each with its OWN certificate Secret", () => {
    const ls = listeners(publicTlsObjects(SET));
    expect(ls[7]).toMatchObject({ name: "https-flowdent-web", hostname: "zeta-cluster-fixture.net", protocol: "HTTPS", port: 443 });
    expect(ls[8]).toMatchObject({ name: "https-flowdent-web-www", hostname: "www.zeta-cluster-fixture.net", protocol: "HTTPS", port: 443 });
    expect(ls[7]!["tls"]["certificateRefs"]).toEqual([{ kind: "Secret", name: "flowdent-web-tls" }]);
    expect(ls[8]!["tls"]["certificateRefs"]).toEqual([{ kind: "Secret", name: "flowdent-web-www-tls" }]);
    for (const i of [7, 8]) expect(ls[i]!["allowedRoutes"]).toEqual({ namespaces: { from: "All" } });
  });

  test("the api listeners admit routes from any namespace, which is how flowdent-prod / flowdent-staging attach", () => {
    const ls = listeners(publicTlsObjects(SET));
    for (const i of [5, 6]) expect(ls[i]!["allowedRoutes"]).toEqual({ namespaces: { from: "All" } });
  });

  test("the BASE carries no api hostname (it arrives only as the install-time patch), and the platform owns no HTTPRoute for it", () => {
    const base = yamlDocs(readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/public-tls/resources.yaml"), "utf8"));
    const ls = ((kinds(base, "Gateway")[0]!["spec"] as any).listeners as Array<Record<string, any>>);
    expect(ls[5]!["hostname"]).toBeUndefined();
    expect(ls[6]!["hostname"]).toBeUndefined();
    expect(ls[7]!["hostname"]).toBeUndefined();
    expect(ls[8]!["hostname"]).toBeUndefined();
    const routes = kinds(base, "HTTPRoute").map(name);
    expect(routes.filter((r) => r.includes("flowdent") || r.includes("api"))).toEqual([]);
  });
});
