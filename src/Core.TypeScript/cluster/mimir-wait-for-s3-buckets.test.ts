// Every mimir component that touches object storage must WAIT for its buckets, not crash on their
// absence.
//
// MEASURED in the constrained first-boot replica (run 36831938019, 4 vCPU / 12 GiB). Mimir's start-up
// sanity check (pkg/mimir/sanity_check.go in v3.2.0: `checkObjectStoresConfigWithRetries`, 20 retries,
// 1-5s backoff, ~85s) logged
//   level=warn  msg="Unable to successfully connect to configured object storage (will retry)"
//   err="blocks storage: unable to successfully send a request to object storage: The specified bucket does not exist"
// until the retries ran out, then `module failed module=sanity-check`, `error running application`, exit 1:
// CrashLoopBackOff, restartCount 1-4 on querier, ruler and store-gateway. The same logs show the S3 Service
// refusing connections (`dial tcp ...:8333: connect: connection refused`) before the bucket question arose.
//
// WHY NOTHING UPSTREAM ORDERS IT. seaweedfs is wave -5 and mimir wave 0 and the dependency graph says
// mimir dependsOn seaweedfs, but the root's Application health check is deliberately non-gating (only
// `zeta.io/gates-later-waves: "true"` Applications propagate health). And even a gating seaweedfs would not
// close it: the buckets come from the chart's post-install hook Job, which starts only after the all-in-one
// Deployment is Healthy. So the consumer waits.
//
// This file pins four things:
//   1. STRUCTURE  -- the six sanity-check components carry the wait, derived from this Application's own
//                    structuredConfig (every bucket, the access key, the endpoint, the secret) rather than a
//                    second copy of those literals, with the SAME image the seaweedfs Application pulls.
//   2. NEGATIVE CONTROLS -- the predicate is shown to reject each way the wait can rot, so the structural
//                    assertions cannot be passing on a manifest that waits for nothing.
//   3. BEHAVIOUR  -- the script itself is run under sh against a stub `curl`, for all three states a wait can
//                    end in: ready, ready-after-waiting, and gave-up (a visible non-zero exit, not a hang).
//   4. SCOPE      -- the components that never read the bucket carry no wait.
//
// Hermetic: manifests and a stubbed shell. No network, no cluster.

import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { parse } from "yaml";

import { spawnShellDeclared } from "../io/safe-io";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const APPS = join(REPO_ROOT, "full-ai-cluster/k8s/applications");

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Rec) : {});
const dig = (o: unknown, ...path: string[]): unknown => {
  let cur: unknown = o;
  for (const k of path) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Rec)[k];
  }
  return cur;
};
const load = (dir: string): unknown => parse(readFileSync(join(APPS, dir, "Application.yaml"), "utf8")) as unknown;

/**
 * Components whose start-up runs the object-storage sanity check. From mimir v3.2.0
 * pkg/mimir/sanity_check.go `checkObjectStoresConfig`: the blocks-storage bucket is checked when the target
 * set includes an ingester, querier, ruler, store-gateway or compactor; the alertmanager storage when it
 * includes the alertmanager. The distributor, query-frontend, query-scheduler, overrides-exporter and
 * gateway never read a bucket and are NOT here.
 */
const S3_COMPONENTS = ["ingester", "store_gateway", "compactor", "querier", "ruler", "alertmanager"] as const;
const NON_S3_COMPONENTS = ["distributor", "query_frontend", "query_scheduler", "overrides_exporter", "gateway"] as const;
const WAIT_NAME = "wait-for-s3-buckets";

const mimir = load("mimir");
const seaweed = load("seaweedfs");
const values = dig(mimir, "spec", "source", "helm", "valuesObject") as Rec;

/** What this Application says about its own object storage -- the source the wait is derived from. */
function declaredStorage(v: Rec): { buckets: string[]; accessKeys: string[]; endpoints: string[]; secretVars: string[]; secretName: string } {
  const sections = ["blocks_storage", "alertmanager_storage", "ruler_storage"].map((s) => rec(dig(v, "mimir", "structuredConfig", s, "s3")));
  const uniq = (xs: unknown[]): string[] => [...new Set(xs.filter((x): x is string => typeof x === "string"))];
  const secretVars = uniq(sections.map((s) => s.secret_access_key)).map((x) => /^\$\{([A-Z0-9_]+)\}$/.exec(x)?.[1] ?? x);
  const extraEnvFrom = dig(v, "global", "extraEnvFrom");
  const secretName = String(dig(Array.isArray(extraEnvFrom) ? extraEnvFrom[0] : undefined, "secretRef", "name"));
  return {
    buckets: uniq(sections.map((s) => s.bucket_name)),
    accessKeys: uniq(sections.map((s) => s.access_key_id)),
    endpoints: uniq(sections.map((s) => s.endpoint)),
    secretVars,
    secretName,
  };
}

/** The image the seaweedfs chart pulls: chart `4.45.0` renders `chrislusf/seaweedfs:4.45`. */
function seaweedImage(app: unknown): string {
  const rev = String(dig(app, "spec", "source", "targetRevision"));
  const [major, minor] = rev.split(".");
  return `chrislusf/seaweedfs:${String(major)}.${String(minor)}`;
}

/** Every way the wait can be wrong for ONE component, as readable strings. Empty = fine. */
function violations(v: Rec, component: string, seaweedApp: unknown = seaweed): string[] {
  const out: string[] = [];
  const decl = declaredStorage(v);
  const list = dig(v, component, "initContainers");
  const wait = (Array.isArray(list) ? list : []).map(rec).find((c) => c.name === WAIT_NAME);
  if (wait === undefined) return [`${component}: no \`${WAIT_NAME}\` init container -- it would crash-loop on a bucket that does not exist yet`];
  const script = String((Array.isArray(wait.args) ? wait.args : []).join("\n"));
  for (const b of decl.buckets) if (!new RegExp(`(^|[\\s'"])${b}([\\s'";]|$)`).test(script)) out.push(`${component}: does not wait for bucket ${b}`);
  for (const k of decl.accessKeys) if (!script.includes(`access_key=${k}`)) out.push(`${component}: access key is not ${k}`);
  for (const e of decl.endpoints) if (!script.includes(`endpoint=http://${e}`)) out.push(`${component}: endpoint is not http://${e}`);
  if (!script.includes("--aws-sigv4")) out.push(`${component}: probe is not a signed S3 request`);
  if (!/\bexit 1\b/.test(script)) out.push(`${component}: no give-up path -- a stuck wait would look busy forever`);
  if (wait.image !== seaweedImage(seaweedApp)) out.push(`${component}: image ${String(wait.image)} is not the seaweedfs image the cluster already pulls (${seaweedImage(seaweedApp)})`);
  const env = (Array.isArray(wait.env) ? wait.env : []).map(rec).find((e) => e.name === decl.secretVars[0]);
  const ref = rec(rec(env?.valueFrom).secretKeyRef);
  if (ref.name !== decl.secretName || ref.key !== decl.secretVars[0]) out.push(`${component}: ${String(decl.secretVars[0])} is not read from secret ${decl.secretName}`);
  const sc = rec(wait.securityContext);
  if (sc.allowPrivilegeEscalation !== false || sc.readOnlyRootFilesystem !== true) out.push(`${component}: init container is not locked down`);
  return out;
}

describe("mimir: components that read a bucket wait for it", () => {
  const decl = declaredStorage(values);

  test("the premise is read from the manifest, not assumed", () => {
    expect(decl.buckets.sort()).toEqual(["mimir-ruler", "mimir-tsdb"]);
    expect(decl.accessKeys).toEqual(["zeta-blob-store"]);
    expect(decl.endpoints).toEqual(["blob-store-seaweedfs-all-in-one.object-store.svc:8333"]);
    expect(decl.secretVars).toEqual(["BLOB_STORE_SECRET_KEY"]);
    expect(decl.secretName).toBe("zeta-blob-store");
  });

  test("seaweedfs actually creates every bucket mimir names (the wait would otherwise never end)", () => {
    const created = (dig(seaweed, "spec", "source", "helm", "valuesObject", "allInOne", "s3", "createBuckets") as Rec[]).map((b) => b.name);
    for (const b of decl.buckets) expect(created).toContain(b);
  });

  for (const component of S3_COMPONENTS) {
    test(`${component}: waits for every declared bucket before it starts`, () => {
      expect(violations(values, component)).toEqual([]);
    });
  }

  test("the six waits are one definition, not six that can drift apart", () => {
    const first = JSON.stringify(dig(values, S3_COMPONENTS[0], "initContainers"));
    for (const component of S3_COMPONENTS) expect(JSON.stringify(dig(values, component, "initContainers"))).toBe(first);
  });

  for (const component of NON_S3_COMPONENTS) {
    test(`${component}: reads no bucket, so carries no wait`, () => {
      expect(dig(values, component, "initContainers")).toBeUndefined();
    });
  }
});

describe("negative controls: the predicate rejects each way the wait can rot", () => {
  const clone = (): Rec => JSON.parse(JSON.stringify(values)) as Rec;
  const mutate = (fn: (wait: Rec) => void): string[] => {
    const v = clone();
    fn(rec((dig(v, "ingester", "initContainers") as unknown[])[0]));
    return violations(v, "ingester");
  };

  test("no init container at all (the state of main before this change)", () => {
    const v = clone();
    delete rec(v.querier).initContainers;
    expect(violations(v, "querier").join("\n")).toContain("no `wait-for-s3-buckets` init container");
  });
  test("a wait that names only one bucket", () => {
    expect(mutate((w) => { w.args = [String((w.args as string[])[0]).replace("mimir-ruler", "mimir-other")]; }).join("\n")).toContain("does not wait for bucket mimir-ruler");
  });
  test("a wait on the wrong endpoint", () => {
    expect(mutate((w) => { w.args = [String((w.args as string[])[0]).replace("object-store.svc:8333", "object-store.svc:9333")]; }).join("\n")).toContain("endpoint is not");
  });
  test("an unsigned probe (would read 403/404 the same way for a closed door)", () => {
    expect(mutate((w) => { w.args = [String((w.args as string[])[0]).replace("--aws-sigv4", "--no-sigv4")]; }).join("\n")).toContain("not a signed S3 request");
  });
  test("a wait that can never give up", () => {
    expect(mutate((w) => { w.args = [String((w.args as string[])[0]).replace("exit 1", "true")]; }).join("\n")).toContain("no give-up path");
  });
  test("an image that is not the one the cluster already pulls", () => {
    expect(mutate((w) => { w.image = "curlimages/curl:8.10.1"; }).join("\n")).toContain("not the seaweedfs image");
  });
  test("a secret read from somewhere else", () => {
    expect(mutate((w) => { rec((w.env as unknown[])[0]).valueFrom = { secretKeyRef: { name: "other", key: "BLOB_STORE_SECRET_KEY" } }; }).join("\n")).toContain("is not read from secret");
  });
  test("a seaweedfs chart bump moves the expected image with it", () => {
    const bumped = JSON.parse(JSON.stringify(seaweed)) as Rec;
    rec(rec(rec(bumped).spec).source).targetRevision = "4.46.0";
    expect(violations(values, "ingester", bumped).join("\n")).toContain("is not the seaweedfs image");
  });
});

describe("behaviour: the script, run under sh against a stub curl", () => {
  const initList = dig(values, "ingester", "initContainers");
  const args = rec(Array.isArray(initList) ? initList[0] : undefined).args;
  const script = Array.isArray(args) ? String(args[0]) : "";

  test("there is a script to run (an empty one would pass every case below by doing nothing)", () => {
    expect(script).toContain("--aws-sigv4");
  });

  function run(opts: { tsdb: string[]; ruler: string[]; tick?: number }): { code: number | null; out: string } {
    const dir = mkdtempSync(join(tmpdir(), "mimir-wait-"));
    const put = (name: string, body: string, exec = false): void => {
      writeFileSync(join(dir, name), body);
      if (exec) chmodSync(join(dir, name), 0o755);
    };
    put("mimir-tsdb.seq", opts.tsdb.join("\n") + "\n");
    put("mimir-ruler.seq", opts.ruler.join("\n") + "\n");
    put("clock", "1000\n");
    // The last line of a bucket's sequence repeats forever; earlier lines are consumed one per request.
    put(
      "curl",
      [
        "#!/bin/sh",
        'url=""; for a in "$@"; do url="$a"; done',
        'b="${url#*8333/}"; b="${b%%\\?*}"',
        'f="$STUB_DIR/$b.seq"',
        'code="$(head -n 1 "$f")"',
        'if [ "$(wc -l < "$f")" -gt 1 ]; then tail -n +2 "$f" > "$f.tmp" && mv "$f.tmp" "$f"; fi',
        'if [ "$code" = 000 ]; then printf 000; echo "curl: (7) stub: could not connect" >&2; exit 7; fi',
        'printf %s "$code"',
        "",
      ].join("\n"),
      true,
    );
    put("sleep", "#!/bin/sh\nexit 0\n", true);
    // `date +%s` is a fake clock that advances STUB_TICK per call, so a give-up needs no real waiting.
    put(
      "date",
      [
        "#!/bin/sh",
        'n="$(cat "$STUB_DIR/clock")"',
        'echo $(( n + ${STUB_TICK:-1} )) > "$STUB_DIR/clock"',
        'echo "$n"',
        "",
      ].join("\n"),
      true,
    );
    // The thing under test IS a shell script -- the mimir init container runs `sh -c <probe>`
    // against seaweedfs. Driving it under `sh` with a stub `curl`/`sleep`/`date` on PATH is the
    // only way to exercise its real control flow, so the command line genuinely is the contract.
    const res = spawnShellDeclared("sh", script, {
      reason: "exercises the init container's own `sh -c` S3-bucket wait probe against stub binaries",
      timeoutMs: 30_000,
      env: {
        ...process.env,
        PATH: `${dir}${delimiter}${process.env.PATH ?? ""}`,
        STUB_DIR: dir,
        STUB_TICK: String(opts.tick ?? 1),
        BLOB_STORE_SECRET_KEY: "not-a-real-secret",
      },
    });
    if (!res.ok) {
      // A spawn failure or timeout surfaces as a non-zero give-up, carrying the error text so the
      // behavioural assertions see the same shape a real give-up produces.
      return { code: 1, out: res.error.message };
    }
    return { code: res.value.status, out: `${res.value.stdout}${res.value.stderr}` };
  }

  test("both buckets already there -> exits 0 having waited for nothing", () => {
    const r = run({ tsdb: ["200"], ruler: ["200"] });
    expect(r.code).toBe(0);
    expect(r.out).toContain("bucket mimir-tsdb is ready");
    expect(r.out).toContain("bucket mimir-ruler is ready");
    expect(r.out).not.toContain("waiting for bucket");
  });

  test("gateway down, then bucket missing, then ready -> waits through 000 and 404, then exits 0", () => {
    const r = run({ tsdb: ["000", "000", "200"], ruler: ["404", "404", "404", "200"] });
    expect(r.code).toBe(0);
    expect(r.out).toContain("waiting for bucket mimir-tsdb: http 000");
    expect(r.out).toContain("waiting for bucket mimir-ruler: http 404");
    expect(r.out).toContain("bucket mimir-ruler is ready");
  });

  test("the second bucket is checked too -- the first being ready is not enough", () => {
    const r = run({ tsdb: ["200"], ruler: ["404", "200"] });
    expect(r.code).toBe(0);
    expect(r.out.indexOf("bucket mimir-tsdb is ready")).toBeLessThan(r.out.indexOf("waiting for bucket mimir-ruler"));
  });

  test("a bucket that never appears -> gives up with exit 1 and says which bucket and what it last saw", () => {
    // tick 100s per `date` call: the 1200s budget is spent in a dozen iterations, with no real sleeping
    const r = run({ tsdb: ["200"], ruler: ["404"], tick: 100 });
    expect(r.code).toBe(1);
    expect(r.out).toContain("gave up: bucket mimir-ruler not reachable after 1200s (last http 404)");
  });

  test("a gateway that never comes up -> gives up with exit 1 (000 is a state, not a pass)", () => {
    const r = run({ tsdb: ["000"], ruler: ["200"], tick: 100 });
    expect(r.code).toBe(1);
    expect(r.out).toContain("gave up: bucket mimir-tsdb not reachable after 1200s (last http 000)");
  });
});
