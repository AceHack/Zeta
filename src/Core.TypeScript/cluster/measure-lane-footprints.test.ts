// The registry handshake, given a falsifier.
//
// WHY THIS FILE EXISTS
// --------------------
// `measure-lane-footprints.ts` had no test at all. Its `measureImage` reaches
// 129 third-party registries, so nothing could exercise it offline, so the one
// thing it does that is easy to get wrong — the Docker Registry v2 anonymous
// token dance — shipped with no check able to notice its removal.
//
// That matters because of the failure mode it produces. The v2 API answers 401
// to an unauthenticated manifest read EVEN FOR A PUBLIC IMAGE; you are expected
// to walk the `WWW-Authenticate` challenge, fetch a free anonymous token from
// the realm it names, and retry. A tool that issues one bare request and reads
// the 401 as "private" would measure every public image by LUCK — correct only
// on a runner that happened to carry an ambient credential — and its verdict
// would then be a property of who ran it rather than of the image. Two people
// would get two different numbers and both would look like measurements.
//
// The code does perform the dance. Nothing proved it did. These tests do, with
// an in-memory ghcr.io emulator injected through `FetchLike` — no network, no
// port, no clock, so the proof replays deterministically (DST).
//
// WHAT EACH TEST WOULD CATCH (verified by breaking the code, one at a time)
//   1. `fetchAuthed` short-circuiting on 401  -> the public image goes unmeasurable
//   2. an ambient credential being presented  -> the recorded request headers show it
//   3. a refused grant rounded to a size      -> a number appears where a refusal belongs
//   4. a 404 read as anything but absence     -> the reason stops naming 404
//   5. an unchallenged 401 left indistinct    -> the artifact cannot tell the two apart
//
// THE LIVE INSTANCE, 2026-08-23
// -----------------------------
// `ghcr.io/lucent-financial-group/{zeta-portal,zeta-platform-controller}` sat in
// `lane-footprints.json` as `manifest HTTP 401` after they had been made public.
// The measurement code was CORRECT the whole time — re-running it prices both —
// and the row was simply never re-measured. The bare reason string is what let
// that stand: it is equally consistent with "private", "gone", and "this tool
// never asked", and a reader had no way to tell which. `refusalReason` now names
// the grant outcome, so the same mistake would be visible in the artifact.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type FetchLike,
  FOOTPRINTS_PATH,
  type LaneFootprints,
  measureImage,
  refusalReason,
} from "./measure-lane-footprints.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

const MANIFEST = {
  schemaVersion: 2,
  mediaType: "application/vnd.docker.distribution.manifest.v2+json",
  config: { size: 5866 },
  layers: [{ size: 1000 }, { size: 2000 }, { size: 3000 }],
};
/** config 5866 + 1000 + 2000 + 3000. The number a correct handshake must return. */
const MANIFEST_BYTES = 11866;

const ANON_TOKEN = "djE6bHVjZW50LWFub24";

interface Recorded {
  readonly url: string;
  readonly authorization: string | undefined;
}

type Disposition =
  /** Public: the registry grants an anonymous pull token. */
  | { readonly kind: "public" }
  /** Private OR nonexistent: ghcr answers the token endpoint 200 with an `errors` body. */
  | { readonly kind: "denied" }
  /** The tag genuinely is not there: 404, no challenge, nothing to walk. */
  | { readonly kind: "absent" }
  /** A 401 with no `WWW-Authenticate` at all — nothing to walk even in principle. */
  | { readonly kind: "unchallenged" };

/**
 * A ghcr.io emulator, faithful to the two behaviours that matter.
 *
 * (a) A public repository STILL answers 401 to a bare read — that is the whole
 *     trap, and a stub that served the manifest unauthenticated would make
 *     these tests pass against a tool that never learned to ask.
 * (b) A denied anonymous grant comes back HTTP **200** with `{"errors":[…]}`,
 *     not a non-2xx. Measured against the live registry on 2026-08-23. A stub
 *     that returned 403 there would let a `tokenRes.ok`-only check pass.
 */
function ghcrStub(disposition: Disposition): { fetch: FetchLike; log: Recorded[] } {
  const log: Recorded[] = [];
  const repo = "lucent-financial-group/zeta-portal";
  const challenge = `Bearer realm="https://ghcr.io/token",service="ghcr.io",scope="repository:${repo}:pull"`;
  const fetchImpl: FetchLike = (url, init) => {
    const authorization = init?.headers?.Authorization;
    log.push({ url, authorization });
    if (url.startsWith("https://ghcr.io/token")) {
      if (disposition.kind === "public") return Promise.resolve(Response.json({ token: ANON_TOKEN }));
      return Promise.resolve(
        Response.json({ errors: [{ code: "DENIED", message: "requested access to the resource is denied" }] }),
      );
    }
    if (disposition.kind === "absent") {
      return Promise.resolve(Response.json({ errors: [{ code: "MANIFEST_UNKNOWN" }] }, { status: 404 }));
    }
    if (disposition.kind === "unchallenged") {
      return Promise.resolve(new Response("", { status: 401 }));
    }
    if (authorization === `Bearer ${ANON_TOKEN}`) return Promise.resolve(Response.json(MANIFEST));
    return Promise.resolve(new Response("", { status: 401, headers: { "www-authenticate": challenge } }));
  };
  return { fetch: fetchImpl, log };
}

const PORTAL = "ghcr.io/lucent-financial-group/zeta-portal:latest";

describe("measureImage — the anonymous token dance is performed, not assumed", () => {
  test("a PUBLIC image that 401s a bare read is measured anyway", async () => {
    const stub = ghcrStub({ kind: "public" });
    const size = await measureImage(PORTAL, { fetch: stub.fetch, tokens: new Map() });

    // THE HEADLINE. A tool that reads the bare 401 as "private" returns
    // `{compressedBytes: null}` here, and this is the assertion that goes red.
    expect(size.compressedBytes).toBe(MANIFEST_BYTES);
    expect(size.unmeasurableReason).toBeUndefined();

    // And it got there the only way it could have: bare read -> challenge ->
    // token realm -> retry with the token. Pinned as a SEQUENCE because the
    // size alone would also be produced by a stub that never asked.
    expect(stub.log.map((r) => r.url)).toEqual([
      "https://ghcr.io/v2/lucent-financial-group/zeta-portal/manifests/latest",
      "https://ghcr.io/token?service=ghcr.io&scope=repository%3Alucent-financial-group%2Fzeta-portal%3Apull",
      "https://ghcr.io/v2/lucent-financial-group/zeta-portal/manifests/latest",
    ]);
  });

  test("the only credential ever presented is the registry's own anonymous grant", async () => {
    // If this tool reached for an ambient `GITHUB_TOKEN` or a docker credential,
    // "unmeasurable" would mean "unmeasurable BY WHOEVER RAN IT" — the number
    // would change identity with its author and two people would get two
    // answers, both looking like measurements. This pins the wire side of that:
    // the first request goes out bare, and the ONLY Authorization header in the
    // whole exchange is the token the registry itself just issued.
    const stub = ghcrStub({ kind: "public" });
    await measureImage(PORTAL, { fetch: stub.fetch, tokens: new Map() });
    expect(stub.log[0]?.authorization).toBeUndefined();
    expect(stub.log.map((r) => r.authorization).filter((a) => a !== undefined)).toEqual([`Bearer ${ANON_TOKEN}`]);
  });

  test("the module names no credential environment variable at all", () => {
    // The source half of the same property, and it is here rather than as an
    // env-mutation test ON PURPOSE. Setting `GITHUB_TOKEN` in this process to
    // prove it is ignored would hoist a credential into an environment every
    // child inherits — which `lint-no-ambient-credential-hoist.ts` refuses, and
    // rightly: a test that demonstrates a safety property by performing the
    // unsafe act is not a proof, it is the act.
    //
    // So the claim is checked where it can be checked without doing it. An
    // `if (process.env.GITHUB_TOKEN)` added to the fetch path fails here, which
    // is the mutation this is for.
    const source = readFileSync(resolve(import.meta.dir, "measure-lane-footprints.ts"), "utf8");
    // Comments are stripped, because the module's own header NAMES these vars in
    // order to say it does not read them. Scanning prose would make the check
    // fail on the documentation of the property it is checking — and, worse,
    // would pass the moment someone deleted that paragraph.
    const code = source
      .split("\n")
      .filter((line) => {
        const t = line.trimStart();
        return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
      })
      .join("\n");
    const forbidden = ["GITHUB_TOKEN", "GH_TOKEN", "DOCKER_CONFIG", "REGISTRY_PASSWORD", "NPM_TOKEN"];
    expect(forbidden.filter((name) => code.includes(name))).toEqual([]);
    // And nothing reads the environment by any other name either.
    expect(code.includes("process.env")).toBe(false);
    expect(code.includes("Bun.env")).toBe(false);
  });

  test("a REFUSED anonymous grant stays a refusal, and says so", async () => {
    const stub = ghcrStub({ kind: "denied" });
    const size = await measureImage(PORTAL, { fetch: stub.fetch, tokens: new Map() });
    expect(size.compressedBytes).toBeNull();
    expect(size.unmeasurableReason).toContain("HTTP 401");
    expect(size.unmeasurableReason).toContain("REFUSED an anonymous pull token");
    // It must NOT resolve the ambiguity it cannot resolve. ghcr answers 401 for
    // an unknown repository on purpose, so "does not exist" and "private" are
    // genuinely indistinguishable here and the reason says both.
    expect(size.unmeasurableReason).toContain("private or does not exist");
    // The dance WAS attempted — a refusal is only honest if something was asked.
    expect(stub.log.some((r) => r.url.startsWith("https://ghcr.io/token"))).toBe(true);
  });

  test("a genuine 404 is reported as 404 and never becomes a size", async () => {
    const stub = ghcrStub({ kind: "absent" });
    const size = await measureImage(PORTAL, { fetch: stub.fetch, tokens: new Map() });
    expect(size.compressedBytes).toBeNull();
    expect(size.unmeasurableReason).toBe("manifest HTTP 404");
    // Absence needs no token, so none was fetched. Conflating the two directions
    // — asking when told "gone", or not asking when told "authenticate" — is the
    // same defect twice.
    expect(stub.log.some((r) => r.url.startsWith("https://ghcr.io/token"))).toBe(false);
  });

  test("a 401 with no challenge is distinguishable from a refused grant", async () => {
    const stub = ghcrStub({ kind: "unchallenged" });
    const size = await measureImage(PORTAL, { fetch: stub.fetch, tokens: new Map() });
    expect(size.compressedBytes).toBeNull();
    expect(size.unmeasurableReason).toContain("no parseable WWW-Authenticate challenge");
    expect(size.unmeasurableReason).not.toContain("REFUSED");
  });
});

describe("refusalReason — the four 401 readings are not one reading", () => {
  test("only a 401 is elaborated; every other status is reported bare", () => {
    expect(refusalReason("manifest", 404, "not-required")).toBe("manifest HTTP 404");
    expect(refusalReason("manifest", 429, "not-required")).toBe("manifest HTTP 429");
    expect(refusalReason("child manifest", 500, "granted")).toBe("child manifest HTTP 500");
  });

  test("a 401 AFTER a successful grant is a different finding from a refused one", () => {
    // This is the case a bare status erases: the registry issued us a token and
    // then still said no. That is not "private" — it is a scope problem or a
    // registry bug, and it is worth being able to see.
    expect(refusalReason("manifest", 401, "granted")).toContain("WITH an anonymous pull token");
    expect(refusalReason("manifest", 401, "granted")).not.toContain("REFUSED");
    expect(refusalReason("manifest", 401, "refused")).toContain("REFUSED");
  });
});

describe("the checked-in artifact carries the grant outcome, not a bare status", () => {
  const footprints = JSON.parse(readFileSync(resolve(REPO_ROOT, FOOTPRINTS_PATH), "utf8")) as LaneFootprints;

  test("no 401 row is recorded as a bare `manifest HTTP 401`", () => {
    // The artifact-level half of the falsifier. A test can only catch a
    // regression that someone runs; this catches one that someone COMMITS —
    // re-measure with a short-circuited handshake and every ghcr row comes back
    // bare, which fails here even though the tool exited 0.
    const bare: string[] = [];
    for (const [ref, size] of Object.entries(footprints.imageSizes)) {
      const reason = size.unmeasurableReason;
      if (reason === undefined) continue;
      if (!reason.includes("HTTP 401")) continue;
      const named =
        reason.includes("REFUSED an anonymous pull token") ||
        reason.includes("no parseable WWW-Authenticate challenge") ||
        reason.includes("WITH an anonymous pull token");
      if (!named) bare.push(`${ref} — ${reason}`);
    }
    expect(bare).toEqual([]);
  });

  test("every unmeasurable row names a reason; none is a silent null", () => {
    for (const [ref, size] of Object.entries(footprints.imageSizes)) {
      if (size.compressedBytes === null) expect(size.unmeasurableReason, ref).toBeDefined();
      else expect(size.compressedBytes).toBeGreaterThan(0);
    }
  });
});
