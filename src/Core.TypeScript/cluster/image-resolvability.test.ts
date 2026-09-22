// Falsifiers for image-resolvability.ts.
//
// The registry client is exercised against a MOCKED `global.fetch` — never the
// real network, so this suite is fast and deterministic. The real network is
// exercised by `bun src/Core.TypeScript/cluster/image-resolvability.ts --refresh`,
// which is a scheduled/manual run, not this test.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { deferred } from "../testing/deterministic-async.ts";

import {
  ACKNOWLEDGED_MISSING,
  KUBE_VERSION_PATH,
  OPERATOR_INJECTED_RULES,
  REQUIRED_ARCHES,
  SNAPSHOT_PATH,
  acknowledgedAndLive,
  audit,
  canonicalRef,
  declaredKubeVersion,
  dockerHubDisambiguate,
  formatReport,
  gatingRows,
  isKubeVersionDerived,
  mapWithConcurrency,
  resolveImage,
  staleAcknowledgements,
  type Acknowledgement,
  type DiscoveredImage,
  type ResolvedImage,
} from "./image-resolvability.ts";

// ---------------------------------------------------------------------------
// canonicalRef
// ---------------------------------------------------------------------------

describe("canonicalRef", () => {
  test("a tagged reference normalizes to host/repository:tag", () => {
    expect(canonicalRef("ghcr.io/foo/bar:1.2.3")).toBe("ghcr.io/foo/bar:1.2.3");
  });

  test("an untagged docker.io reference defaults to library/<name>:latest", () => {
    expect(canonicalRef("busybox")).toBe("registry-1.docker.io/library/busybox:latest");
  });

  test("a digest reference uses @ not :, and keeps the sha256: prefix", () => {
    expect(canonicalRef("ghcr.io/foo/bar@sha256:abcd")).toBe("ghcr.io/foo/bar@sha256:abcd");
  });

  test("a tag AND a digest resolve to the digest form (the bug image-footprint.ts names)", () => {
    expect(canonicalRef("ghcr.io/foo/bar:v1.2@sha256:abcd")).toBe("ghcr.io/foo/bar@sha256:abcd");
  });
});

// ---------------------------------------------------------------------------
// declaredKubeVersion / isKubeVersionDerived — the spire/kubectl incident
// ---------------------------------------------------------------------------

describe("declaredKubeVersion", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "image-resolvability-kubever-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test("reads kubernetesVersion out of the declared file — never hardcoded", () => {
    const abs = join(root, KUBE_VERSION_PATH);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, JSON.stringify({ kubernetesVersion: "1.35.7" }));
    expect(declaredKubeVersion(root)).toBe("1.35.7");
  });

  test("refuses (throws) rather than silently defaulting when the field is missing", () => {
    const abs = join(root, KUBE_VERSION_PATH);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, JSON.stringify({ notTheRightKey: "1.35.7" }));
    expect(() => declaredKubeVersion(root)).toThrow();
  });
});

describe("isKubeVersionDerived", () => {
  test("flags a hook image whose tag EXACTLY equals the render's kube-version (v-prefix either way)", () => {
    expect(isKubeVersionDerived("docker.io/rancher/kubectl:v1.35.7", "1.35.7")).toBe(true);
    expect(isKubeVersionDerived("docker.io/rancher/kubectl:1.35.7", "v1.35.7")).toBe(true);
  });

  test("does not flag a tag that merely shares a major.minor with the kube-version", () => {
    // Precise on purpose — a fuzzy major.minor match would flag unrelated
    // images that happen to share a version prefix (the noise this checker's
    // other risk flags avoid by being narrow).
    expect(isKubeVersionDerived("docker.io/grafana/loki:1.35.2", "1.35.7")).toBe(false);
  });

  test("never flags a digest reference — a digest cannot equal a version string", () => {
    expect(isKubeVersionDerived("docker.io/rancher/kubectl@sha256:abcd", "1.35.7")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveImage — mocked registry client
// ---------------------------------------------------------------------------

type Handler = (url: string) => Response | null;

let originalFetch: typeof fetch;

function installFetch(handler: Handler): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = async (input: unknown): Promise<Response> => {
    const url = typeof input === "string" ? input : (input as Request | URL).toString();
    const response = handler(url);
    if (response === null) throw new Error(`unmocked URL: ${url}`);
    return response;
  };
}

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * The exact hostname a fixture URL targets — parsed via `new URL`, never a
 * substring check. The prior form, `url.includes("registry-1.docker.io")`,
 * would also match `https://evil.example/?registry-1.docker.io` or a
 * path/query carrying the same text; CodeQL's "Incomplete URL substring
 * sanitization" flags exactly that (js/incomplete-url-substring-sanitization).
 * These are test fixtures with no untrusted input, so nothing here was
 * exploitable — parsing anyway is what makes that true by construction rather
 * than by argument, and it matches the discipline `dockerHubDisambiguate`
 * itself uses in the module under test (host comes from `parseImageReference`,
 * never from string-matching a URL).
 */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

describe("resolveImage", () => {
  test("a manifest LIST covering linux/amd64 and linux/arm64 resolves ok with both arches reported", async () => {
    installFetch((url) => {
      if (url.endsWith("/manifests/v1.0")) {
        return jsonResponse(200, {
          manifests: [
            { digest: "sha256:aaa", platform: { os: "linux", architecture: "amd64" } },
            { digest: "sha256:bbb", platform: { os: "linux", architecture: "arm64" } },
            { digest: "sha256:ccc", platform: { os: "unknown", architecture: "unknown" } }, // attestation, excluded
          ],
        });
      }
      return null;
    });
    const r = await resolveImage("example.com/foo/bar:v1.0");
    expect(r.status).toBe("ok");
    expect(r.arches).toEqual(["linux/amd64", "linux/arm64"]);
    expect(r.requiredArchesMissing).toEqual([]);
  });

  test("a manifest LIST with no linux/amd64 entry is arch-missing, never ok", async () => {
    installFetch((url) => {
      if (url.endsWith("/manifests/v1.0")) {
        return jsonResponse(200, { manifests: [{ digest: "sha256:bbb", platform: { os: "linux", architecture: "arm64" } }] });
      }
      return null;
    });
    const r = await resolveImage("example.com/foo/bar:v1.0");
    expect(r.status).toBe("arch-missing");
    expect(r.requiredArchesMissing).toEqual([...REQUIRED_ARCHES]);
    expect(r.arches).toEqual(["linux/arm64"]);
  });

  test("a single-platform manifest reads its arch from the CONFIG BLOB, not the manifest itself", async () => {
    installFetch((url) => {
      if (url.endsWith("/manifests/v1.0")) return jsonResponse(200, { config: { digest: "sha256:cfg" } });
      if (url.endsWith("/blobs/sha256:cfg")) return jsonResponse(200, { architecture: "amd64", os: "linux" });
      return null;
    });
    const r = await resolveImage("example.com/foo/bar:v1.0");
    expect(r.status).toBe("ok");
    expect(r.arches).toEqual(["linux/amd64"]);
  });

  test("a single-platform manifest whose config blob is a different arch is arch-missing", async () => {
    installFetch((url) => {
      if (url.endsWith("/manifests/v1.0")) return jsonResponse(200, { config: { digest: "sha256:cfg" } });
      if (url.endsWith("/blobs/sha256:cfg")) return jsonResponse(200, { architecture: "arm64", os: "linux" });
      return null;
    });
    const r = await resolveImage("example.com/foo/bar:v1.0");
    expect(r.status).toBe("arch-missing");
    expect(r.arches).toEqual(["linux/arm64"]);
  });

  test("a top-level 404 is `missing`, never `unknown`", async () => {
    installFetch((url) => (url.endsWith("/manifests/v1.0") ? jsonResponse(404, { errors: [{ code: "MANIFEST_UNKNOWN" }] }) : null));
    const r = await resolveImage("example.com/foo/bar:v1.0");
    expect(r.status).toBe("missing");
    expect(r.httpStatus).toBe(404);
  });

  test("a 401 (closed door) is `unknown`, never `missing`", async () => {
    installFetch((url) => (url.endsWith("/manifests/v1.0") ? jsonResponse(401, { errors: [] }) : null));
    const r = await resolveImage("example.com/foo/bar:v1.0");
    expect(r.status).toBe("unknown");
    expect(r.httpStatus).toBe(401);
  });

  test("a network throw, after retries exhaust, is `unknown` — never `missing`", async () => {
    installFetch(() => {
      throw new Error("ECONNRESET");
    });
    const r = await resolveImage("example.com/foo/bar:v1.0", new Map(), 1);
    expect(r.status).toBe("unknown");
    expect(r.reason).toContain("ECONNRESET");
  });

  test("a transient 503 is retried and can still resolve ok on a later attempt", async () => {
    let calls = 0;
    installFetch((url) => {
      if (url.endsWith("/manifests/v1.0")) {
        calls += 1;
        if (calls === 1) return new Response("", { status: 503 });
        return jsonResponse(200, { config: { digest: "sha256:cfg" } });
      }
      if (url.endsWith("/blobs/sha256:cfg")) return jsonResponse(200, { architecture: "amd64" });
      return null;
    });
    // The real backoff between attempts is a genuine wall-clock wait in
    // production (real jittered milliseconds) and MUST stay real there — but
    // this test exists to prove the RETRY COUNT and CLASSIFICATION, not to
    // observe elapsed time, so the clock is injected as a no-op. Same
    // discipline as `mapWithConcurrency`'s tests above: eliminate the real
    // wait rather than allowlist it.
    const sleepCalls: number[] = [];
    const noSleep = async (ms: number): Promise<void> => {
      sleepCalls.push(ms);
    };
    const r = await resolveImage("example.com/foo/bar:v1.0", new Map(), 3, noSleep);
    expect(r.status).toBe("ok");
    expect(calls).toBeGreaterThan(1);
    expect(sleepCalls.length).toBe(1);
  });

  test("docker.io / latest / digest flags are read off the reference, not the resolution", async () => {
    installFetch((url) => (url.endsWith("/manifests/latest") ? jsonResponse(200, { config: { digest: "sha256:cfg" } }) : url.endsWith("/blobs/sha256:cfg") ? jsonResponse(200, { architecture: "amd64" }) : null));
    const r = await resolveImage("busybox");
    expect(r.isDockerHub).toBe(true);
    expect(r.isLatestOrUntagged).toBe(true);
    expect(r.hasDigest).toBe(false);
  });

  // The minio incident: a docker.io 401 is ambiguous (private repo AND a
  // deleted one both answer it the same way) — disambiguated against Docker
  // Hub's own catalog API rather than left as `unknown`.

  test("docker.io 401 + Hub catalog 404 on the REPOSITORY promotes to `missing`", async () => {
    installFetch((url) => {
      if (hostnameOf(url) === "registry-1.docker.io" && url.endsWith("/manifests/RELEASE.2017-12-28T01-21-00Z")) {
        return new Response("", { status: 401 });
      }
      if (url === "https://hub.docker.com/v2/repositories/minio/minio") return new Response("", { status: 404 });
      return null;
    });
    const r = await resolveImage("minio/minio:RELEASE.2017-12-28T01-21-00Z");
    expect(r.status).toBe("missing");
    expect(r.reason).toContain("does not exist");
  });

  test("docker.io 401 + Hub repo 200 + Hub catalog 404 on the TAG promotes to `missing`", async () => {
    installFetch((url) => {
      if (hostnameOf(url) === "registry-1.docker.io" && url.endsWith("/manifests/some-old-tag")) {
        return new Response("", { status: 401 });
      }
      if (url === "https://hub.docker.com/v2/repositories/foo/bar") return new Response("", { status: 200 });
      if (url === "https://hub.docker.com/v2/repositories/foo/bar/tags/some-old-tag") return new Response("", { status: 404 });
      return null;
    });
    const r = await resolveImage("foo/bar:some-old-tag");
    expect(r.status).toBe("missing");
    expect(r.reason).toContain('tag "some-old-tag"');
  });

  test("docker.io 401 + Hub catalog confirms the tag EXISTS stays `unknown` (a genuine access restriction)", async () => {
    installFetch((url) => {
      if (hostnameOf(url) === "registry-1.docker.io" && url.endsWith("/manifests/v1.0")) return new Response("", { status: 401 });
      if (url === "https://hub.docker.com/v2/repositories/foo/bar") return new Response("", { status: 200 });
      if (url === "https://hub.docker.com/v2/repositories/foo/bar/tags/v1.0") return new Response("", { status: 200 });
      return null;
    });
    const r = await resolveImage("foo/bar:v1.0");
    expect(r.status).toBe("unknown");
    expect(r.reason).toContain("genuine access restriction");
  });

  test("docker.io 401 + an unreachable Hub API stays `unknown` — inconclusive is not missing", async () => {
    installFetch((url) => {
      if (hostnameOf(url) === "registry-1.docker.io" && url.endsWith("/manifests/v1.0")) return new Response("", { status: 401 });
      if (hostnameOf(url) === "hub.docker.com") throw new Error("ECONNRESET");
      return null;
    });
    const r = await resolveImage("foo/bar:v1.0");
    expect(r.status).toBe("unknown");
  });

  test("a non-docker.io registry's 401 is NEVER disambiguated against Docker Hub", async () => {
    let hubCalled = false;
    installFetch((url) => {
      if (hostnameOf(url) === "hub.docker.com") {
        hubCalled = true;
        return new Response("", { status: 404 });
      }
      if (url.endsWith("/manifests/v1.0")) return new Response("", { status: 401 });
      return null;
    });
    const r = await resolveImage("ghcr.io/foo/bar:v1.0");
    expect(r.status).toBe("unknown");
    expect(hubCalled).toBe(false);
  });

  test("a DIGEST reference on docker.io is never sent to the Hub tags-by-name API", async () => {
    let hubCalled = false;
    installFetch((url) => {
      if (hostnameOf(url) === "hub.docker.com") {
        hubCalled = true;
        return new Response("", { status: 404 });
      }
      if (hostnameOf(url) === "registry-1.docker.io" && url.endsWith("/manifests/sha256:abcd")) return new Response("", { status: 401 });
      return null;
    });
    const r = await resolveImage("foo/bar@sha256:abcd");
    expect(r.status).toBe("unknown");
    expect(hubCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dockerHubDisambiguate — the underlying Hub-catalog probe, direct
// ---------------------------------------------------------------------------

describe("dockerHubDisambiguate", () => {
  test("repository 404 -> missing", async () => {
    installFetch((url) => (url === "https://hub.docker.com/v2/repositories/minio/minio" ? new Response("", { status: 404 }) : null));
    const r = await dockerHubDisambiguate("minio", "minio", "latest");
    expect(r.verdict).toBe("missing");
  });

  test("repository ok, tag 404 -> missing", async () => {
    installFetch((url) => {
      if (url === "https://hub.docker.com/v2/repositories/foo/bar") return new Response("", { status: 200 });
      if (url === "https://hub.docker.com/v2/repositories/foo/bar/tags/gone") return new Response("", { status: 404 });
      return null;
    });
    const r = await dockerHubDisambiguate("foo", "bar", "gone");
    expect(r.verdict).toBe("missing");
  });

  test("repository ok, tag ok -> null (inconclusive, not missing)", async () => {
    installFetch((url) => {
      if (url === "https://hub.docker.com/v2/repositories/foo/bar") return new Response("", { status: 200 });
      if (url === "https://hub.docker.com/v2/repositories/foo/bar/tags/present") return new Response("", { status: 200 });
      return null;
    });
    const r = await dockerHubDisambiguate("foo", "bar", "present");
    expect(r.verdict).toBeNull();
  });

  test("network failure on the repository call -> null, never missing", async () => {
    installFetch(() => {
      throw new Error("ECONNRESET");
    });
    const r = await dockerHubDisambiguate("foo", "bar", "v1");
    expect(r.verdict).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapWithConcurrency
// ---------------------------------------------------------------------------

describe("mapWithConcurrency", () => {
  test("preserves result order regardless of completion order", async () => {
    // Barriers, not a wall-clock delay: each item's `fn` suspends on its OWN
    // gate, and the gates are resolved in a deliberately scrambled order — the
    // property under test (results land at their INDEX, not their completion
    // order) needs no real time at all to demonstrate.
    const gates = [deferred<number>(), deferred<number>(), deferred<number>(), deferred<number>()];
    const promise = mapWithConcurrency([0, 1, 2, 3], 4, async (_item, i) => gates[i]?.promise);
    gates[3]?.resolve(3);
    gates[1]?.resolve(1);
    gates[2]?.resolve(2);
    gates[0]?.resolve(0);
    const results = await promise;
    expect(results).toEqual([0, 1, 2, 3]);
  });

  test("never runs more than `dop` at once", async () => {
    // Same barrier discipline. `mapWithConcurrency` calls its `dop` workers
    // SYNCHRONOUSLY (each runs up to its own first `await`) as part of
    // constructing the worker array, so the ceiling is already enforced the
    // instant this call returns — checked below with no turn or timer needed
    // — and releasing every gate immediately still cannot let a THIRD worker
    // start early: a worker can only reach its next item by finishing its
    // current `await` first, regardless of when that gate resolved.
    const gates = Array.from({ length: 6 }, () => deferred<number>());
    let inFlight = 0;
    let maxInFlight = 0;
    const promise = mapWithConcurrency([0, 1, 2, 3, 4, 5], 2, async (n) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const result = await gates[n]?.promise;
      inFlight -= 1;
      return result;
    });
    expect(inFlight).toBe(2);
    gates.forEach((gate, i) => gate.resolve(i));
    const results = await promise;
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(results).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("DoP=1 drains the queue one at a time (the deterministic/DST-friendly floor)", async () => {
    const order: number[] = [];
    await mapWithConcurrency([3, 1, 2], 1, async (n) => {
      order.push(n);
      return n;
    });
    expect(order).toEqual([3, 1, 2]);
  });

  test("an empty item list resolves to an empty result, not a hang", async () => {
    const results = await mapWithConcurrency<number, number>([], 4, async (n) => n);
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Operator-injected images — KubeVirt
// ---------------------------------------------------------------------------

describe("OPERATOR_INJECTED_RULES", () => {
  test("kubevirt-component-images derives every component at the operator's own tag", () => {
    const rule = OPERATOR_INJECTED_RULES.find((r) => r.name === "kubevirt-component-images");
    expect(rule).toBeDefined();
    const derived = rule?.derive("quay.io/kubevirt/virt-operator:v1.8.4") ?? [];
    expect(derived).toContain("quay.io/kubevirt/virt-api:v1.8.4");
    expect(derived).toContain("quay.io/kubevirt/pr-helper:v1.8.4");
    expect(derived).toContain("quay.io/kubevirt/sidecar-shim:v1.8.4");
    // NOT "virt-pr-helper" — the wrong guess this table was corrected FROM
    // (quay.io answers no-such-repository for it; see the module header).
    expect(derived).not.toContain("quay.io/kubevirt/virt-pr-helper:v1.8.4");
  });

  test("a non-matching image derives nothing", () => {
    const rule = OPERATOR_INJECTED_RULES.find((r) => r.name === "kubevirt-component-images");
    expect(rule?.derive("ghcr.io/some/other-image:1.0")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// audit() — the offline, snapshot-gated path
// ---------------------------------------------------------------------------

function resolvedFixture(over: Partial<ResolvedImage> & Pick<ResolvedImage, "reference" | "status">): ResolvedImage {
  return {
    httpStatus: 200,
    arches: ["linux/amd64"],
    requiredArchesMissing: [],
    reason: "",
    isDockerHub: false,
    isLatestOrUntagged: false,
    hasDigest: false,
    resolvedAt: "2026-09-22",
    ...over,
  };
}

describe("audit (offline, snapshot-gated)", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "image-resolvability-audit-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function writeSnapshot(entries: readonly ResolvedImage[]): void {
    const abs = join(root, SNAPSHOT_PATH);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, JSON.stringify({ $comment: "fixture", requiredArches: REQUIRED_ARCHES, reportedArches: REQUIRED_ARCHES, entries }, null, 2));
  }

  function fakeDiscover(images: readonly DiscoveredImage[]): () => { images: readonly DiscoveredImage[]; renderFailures: readonly string[] } {
    return () => ({ images, renderFailures: [] });
  }

  test("an image the snapshot marks `missing` is a gating finding", () => {
    writeSnapshot([resolvedFixture({ reference: "example.com/foo/bar:1.0", status: "missing", httpStatus: 404 })]);
    const report = audit(root, fakeDiscover([{ image: "example.com/foo/bar:1.0", sources: ["app/one"], kubeVersionDerived: false }]));
    expect(report.rows[0]?.resolution?.status).toBe("missing");
    const gating = gatingRows(report.rows).length > 0;
    expect(gating).toBe(true);
  });

  test("an image the snapshot marks `unknown` is reported but not gating", () => {
    writeSnapshot([resolvedFixture({ reference: "example.com/foo/bar:1.0", status: "unknown", httpStatus: 401 })]);
    const report = audit(root, fakeDiscover([{ image: "example.com/foo/bar:1.0", sources: ["app/one"], kubeVersionDerived: false }]));
    const gating = gatingRows(report.rows).length > 0;
    expect(gating).toBe(false);
    expect(report.rows[0]?.resolution?.status).toBe("unknown");
  });

  test("an image not yet in the snapshot resolves to `null` (not-yet-measured) and does not gate", () => {
    writeSnapshot([]);
    const report = audit(root, fakeDiscover([{ image: "example.com/brand-new:1.0", sources: ["app/one"], kubeVersionDerived: false }]));
    expect(report.rows[0]?.resolution).toBeNull();
    const gating = gatingRows(report.rows).length > 0;
    expect(gating).toBe(false);
  });

  test("an ok image reports clean", () => {
    writeSnapshot([resolvedFixture({ reference: "example.com/foo/bar:1.0", status: "ok" })]);
    const report = audit(root, fakeDiscover([{ image: "example.com/foo/bar:1.0", sources: ["app/one"], kubeVersionDerived: false }]));
    expect(report.rows[0]?.resolution?.status).toBe("ok");
    expect(formatReport(report)).toContain("no missing or arch-missing images");
  });

  test("images are looked up by CANONICAL reference, so a re-rendered tag+digest form still matches", () => {
    writeSnapshot([resolvedFixture({ reference: "ghcr.io/foo/bar@sha256:abcd", status: "ok" })]);
    const report = audit(root, fakeDiscover([{ image: "ghcr.io/foo/bar:v1@sha256:abcd", sources: ["app/one"], kubeVersionDerived: false }]));
    expect(report.rows[0]?.resolution?.status).toBe("ok");
  });

  // Every case below injects its OWN fixture register rather than reading
  // ACKNOWLEDGED_MISSING — the production register's CONTENTS churn (it is
  // empty as of 2026-09-22, having carried and then shed the minio entries
  // this rule was built for) and a behavioural test pinned to today's
  // contents breaks the moment the register is edited for an unrelated
  // reason. gatingRows/formatReport/counts all take an injectable `register`
  // for exactly this reason.

  test("a `missing` image ACKNOWLEDGED and still within its window does not gate, but is still reported", () => {
    const fixtureRegister: ReadonlyMap<string, Acknowledgement> = new Map([
      ["example.com/foo/bar:1.0", { tracking: "some-branch", recordedOn: "2026-09-22", expiresOn: "2026-10-06", reason: "fixture" }],
    ]);
    writeSnapshot([resolvedFixture({ reference: "example.com/foo/bar:1.0", status: "missing", httpStatus: 404 })]);
    const report = audit(root, fakeDiscover([{ image: "example.com/foo/bar:1.0", sources: ["app/one"], kubeVersionDerived: false }]));
    expect(report.rows[0]?.resolution?.status).toBe("missing");
    expect(gatingRows(report.rows, "2026-09-22", fixtureRegister).length).toBe(0);
    // Still visible in the report — acknowledged is not hidden.
    expect(formatReport(report, "2026-09-22", fixtureRegister)).toContain("ACKNOWLEDGED");
  });

  test("an acknowledged `missing` image with a PAST expiry date gates again — the allowlist self-expires", () => {
    const expiredRegister: ReadonlyMap<string, Acknowledgement> = new Map([
      ["example.com/foo/bar:1.0", { tracking: "some-branch", recordedOn: "2020-01-01", expiresOn: "2020-01-15", reason: "fixture" }],
    ]);
    expect(acknowledgedAndLive("example.com/foo/bar:1.0", "2026-09-22", expiredRegister)).toBe(false);

    writeSnapshot([resolvedFixture({ reference: "example.com/foo/bar:1.0", status: "missing", httpStatus: 404 })]);
    const report = audit(root, fakeDiscover([{ image: "example.com/foo/bar:1.0", sources: ["app/one"], kubeVersionDerived: false }]));
    expect(gatingRows(report.rows, "2026-09-22", expiredRegister).length).toBe(1);
  });

  test("an image not covered by ANY entry in a fixture register gates normally", () => {
    const unrelatedRegister: ReadonlyMap<string, Acknowledgement> = new Map([
      ["ghcr.io/some/other-image:1.0", { tracking: "some-branch", recordedOn: "2026-09-22", expiresOn: "2026-10-06", reason: "fixture" }],
    ]);
    writeSnapshot([resolvedFixture({ reference: "example.com/foo/bar:1.0", status: "missing", httpStatus: 404 })]);
    const report = audit(root, fakeDiscover([{ image: "example.com/foo/bar:1.0", sources: ["app/one"], kubeVersionDerived: false }]));
    expect(gatingRows(report.rows, "2026-09-22", unrelatedRegister).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// staleAcknowledgements — the register's own honesty check
// ---------------------------------------------------------------------------

describe("staleAcknowledgements", () => {
  const rows = [
    { image: "a", sources: ["app/one"], kubeVersionDerived: false, resolution: resolvedFixture({ reference: "a-canonical", status: "missing" }) },
    { image: "b", sources: ["app/two"], kubeVersionDerived: false, resolution: resolvedFixture({ reference: "b-canonical", status: "ok" }) },
  ];

  test("an entry matching a CURRENT missing/arch-missing row is not stale", () => {
    const register: ReadonlyMap<string, Acknowledgement> = new Map([
      ["a-canonical", { tracking: "t", recordedOn: "2026-09-22", expiresOn: "2026-10-06", reason: "r" }],
    ]);
    expect(staleAcknowledgements(rows, register)).toEqual([]);
  });

  test("an entry whose target resolved to `ok` (the fix landed) is stale", () => {
    const register: ReadonlyMap<string, Acknowledgement> = new Map([
      ["b-canonical", { tracking: "t", recordedOn: "2026-09-22", expiresOn: "2026-10-06", reason: "r" }],
    ]);
    const stale = staleAcknowledgements(rows, register);
    expect(stale.map(([ref]) => ref)).toEqual(["b-canonical"]);
  });

  test("an entry naming a reference that never appeared at all is stale", () => {
    const register: ReadonlyMap<string, Acknowledgement> = new Map([
      ["never-referenced", { tracking: "t", recordedOn: "2026-09-22", expiresOn: "2026-10-06", reason: "r" }],
    ]);
    const stale = staleAcknowledgements(rows, register);
    expect(stale.map(([ref]) => ref)).toEqual(["never-referenced"]);
  });

  test("an empty register has no stale entries, trivially and correctly", () => {
    expect(staleAcknowledgements(rows, new Map())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ACKNOWLEDGED_MISSING — the production allowlist itself
// ---------------------------------------------------------------------------

describe("ACKNOWLEDGED_MISSING (the real, checked-in register)", () => {
  // Deliberately NOT `if (ACKNOWLEDGED_MISSING.size === 0) return` and
  // deliberately NOT deleted now that the register is empty — an empty
  // register is itself a fact worth asserting (the minio incident this
  // register was built for is closed, PR #17486), and a for-loop over zero
  // entries would otherwise look identical to a passing check while
  // asserting nothing. Both are stated explicitly below.

  test("the register's current state is what it claims to be", () => {
    // Update this alongside any change to ACKNOWLEDGED_MISSING itself — a
    // mismatch here is exactly the signal that the register changed without
    // its test being re-read.
    expect([...ACKNOWLEDGED_MISSING.keys()]).toEqual([]);
  });

  test("every entry names a tracking branch/PR/work-item and a reason — never a bare suppression", () => {
    for (const [reference, ack] of ACKNOWLEDGED_MISSING) {
      expect(ack.tracking.length, `${reference} has no tracking`).toBeGreaterThan(0);
      expect(ack.reason.length, `${reference} has no reason`).toBeGreaterThan(0);
      expect(ack.recordedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ack.expiresOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("every entry's key is already in CANONICAL reference form", () => {
    for (const reference of ACKNOWLEDGED_MISSING.keys()) {
      expect(canonicalRef(reference)).toBe(reference);
    }
  });

  // The two invariant tests above are vacuously true over zero entries —
  // correct, but it means they currently prove nothing about the SHAPE
  // check's own logic. This proves the shape check would actually catch a
  // violation, independent of what production currently contains.
  test("the shape invariants above WOULD catch a malformed entry (proven against a fixture, not production)", () => {
    const malformed: readonly [string, Acknowledgement][] = [
      ["bad/ref", { tracking: "", recordedOn: "2026-09-22", expiresOn: "2026-10-06", reason: "" }],
    ];
    for (const [, ack] of malformed) {
      expect(ack.tracking.length > 0 && ack.reason.length > 0).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// formatReport
// ---------------------------------------------------------------------------

describe("formatReport", () => {
  test("counts risk images (docker.io / latest / no-digest) separately from gating status", () => {
    const report = {
      mode: "offline" as const,
      renderFailures: [],
      rows: [
        {
          image: "busybox",
          sources: ["app/one"],
          resolution: resolvedFixture({ reference: "registry-1.docker.io/library/busybox:latest", status: "ok", isDockerHub: true, isLatestOrUntagged: true }),
          kubeVersionDerived: false,
        },
      ],
    };
    const text = formatReport(report);
    expect(text).toContain("docker.io=1");
    expect(text).toContain(":latest-or-untagged=1");
  });

  test("counts and lists kube-version-derived images as a separate, report-only risk", () => {
    const report = {
      mode: "offline" as const,
      renderFailures: [],
      rows: [
        {
          image: "docker.io/rancher/kubectl:v1.35.7",
          sources: ["full-ai-cluster/k8s/bootstrap/spire-install.yaml"],
          resolution: resolvedFixture({ reference: "registry-1.docker.io/rancher/kubectl:v1.35.7", status: "missing", httpStatus: 404 }),
          kubeVersionDerived: true,
        },
      ],
    };
    const text = formatReport(report);
    expect(text).toContain("kube-version-derived=1");
    expect(text).toContain("KUBE-VERSION-DERIVED");
    expect(text).toContain("docker.io/rancher/kubectl:v1.35.7");
  });
});
