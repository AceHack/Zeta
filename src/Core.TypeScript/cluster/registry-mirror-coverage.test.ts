// registry-mirror-coverage.test.ts — the reference parser, and that both
// single-source files it reads (registry-mirrors.json, and the
// image-resolvability.json shape it expects) parse the way the script
// assumes.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildManifestUrl,
  isValidMirrorBaseUrl,
  isValidRepo,
  isValidTagOrDigest,
  KNOWN_SAFE_MIRROR_HOSTNAMES,
  parseDockerHubReference,
} from "./registry-mirror-coverage.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const MIRROR_CONFIG_PATH = join(REPO_ROOT, "full-ai-cluster", "k8s", "registry-mirrors.json");

describe("parseDockerHubReference", () => {
  test("library image with a tag", () => {
    expect(parseDockerHubReference("registry-1.docker.io/library/alpine:latest")).toEqual({
      reference: "registry-1.docker.io/library/alpine:latest",
      repo: "library/alpine",
      tag: "latest",
    });
  });

  test("namespaced image with a tag", () => {
    expect(parseDockerHubReference("registry-1.docker.io/grafana/loki:3.7.7")).toEqual({
      reference: "registry-1.docker.io/grafana/loki:3.7.7",
      repo: "grafana/loki",
      tag: "3.7.7",
    });
  });

  test("digest reference uses the digest as the manifest lookup key", () => {
    const ref = "registry-1.docker.io/library/busybox@sha256:deadbeef";
    expect(parseDockerHubReference(ref)).toEqual({
      reference: ref,
      repo: "library/busybox",
      tag: "sha256:deadbeef",
    });
  });

  test("no tag defaults to latest", () => {
    expect(parseDockerHubReference("registry-1.docker.io/library/nginx")).toEqual({
      reference: "registry-1.docker.io/library/nginx",
      repo: "library/nginx",
      tag: "latest",
    });
  });
});

// The allow-list that closes the CodeQL "file data in outbound network
// request" finding: repo/tag/mirror values from parsed JSON must match the
// OCI distribution-spec grammar before reaching `fetch`'s URL.
describe("isValidRepo", () => {
  test.each([
    ["library/alpine", true],
    ["grafana/loki", true],
    ["temporalio/admin-tools", true],
    ["a", true],
    ["", false],
    ["Library/Alpine", false], // uppercase is not valid in a docker repo name
    ["../../etc/passwd", false],
    ["library/alpine@evil.com", false],
    ["library//alpine", false],
    ["library/alpine?x=1", false],
  ])("%s -> %s", (repo, expected) => {
    expect(isValidRepo(repo)).toBe(expected);
  });
});

describe("isValidTagOrDigest", () => {
  test.each([
    ["latest", true],
    ["3.7.7", true],
    ["v1.35.6", true],
    ["sha256:deadbeef".padEnd(7 + 64, "0"), true],
    ["", false],
    ["../etc", false],
    ["latest/../../x", false],
    ["tag with spaces", false],
  ])("%s -> %s", (tag, expected) => {
    expect(isValidTagOrDigest(tag)).toBe(expected);
  });
});

describe("isValidMirrorBaseUrl", () => {
  test.each([
    ["https://mirror.gcr.io", true],
    ["https://mirror.gcr.io:443", true],
    ["http://mirror.gcr.io", false], // not https
    ["https://mirror.gcr.io/v2", false], // no path allowed
    ["https://mirror.gcr.io?x=1", false], // no query allowed
    ["https://user@mirror.gcr.io", false], // no userinfo allowed
    ["not-a-url", false],
  ])("%s -> %s", (url, expected) => {
    expect(isValidMirrorBaseUrl(url)).toBe(expected);
  });
});

describe("buildManifestUrl — the actual fetch target, host- and path-barriered", () => {
  test("known-safe mirror + valid repo/tag builds the expected URL", () => {
    const url = buildManifestUrl("https://mirror.gcr.io", {
      reference: "registry-1.docker.io/library/alpine:latest",
      repo: "library/alpine",
      tag: "latest",
    });
    expect(url).toBeInstanceOf(URL);
    expect(url!.toString()).toBe("https://mirror.gcr.io/v2/library/alpine/manifests/latest");
  });

  test("refuses a mirror hostname outside KNOWN_SAFE_MIRROR_HOSTNAMES, even with a valid repo/tag", () => {
    expect(KNOWN_SAFE_MIRROR_HOSTNAMES.has("evil.example.com")).toBe(false);
    const url = buildManifestUrl("https://evil.example.com", {
      reference: "x",
      repo: "library/alpine",
      tag: "latest",
    });
    expect(url).toBeUndefined();
  });

  test("refuses an http (non-TLS) mirror", () => {
    const url = buildManifestUrl("http://mirror.gcr.io", {
      reference: "x",
      repo: "library/alpine",
      tag: "latest",
    });
    expect(url).toBeUndefined();
  });

  test("refuses a repo/tag that fails OCI-grammar validation, without ever calling `new URL`", () => {
    expect(
      buildManifestUrl("https://mirror.gcr.io", { reference: "x", repo: "../../etc/passwd", tag: "latest" }),
    ).toBeUndefined();
    expect(
      buildManifestUrl("https://mirror.gcr.io", { reference: "x", repo: "library/alpine", tag: "../evil" }),
    ).toBeUndefined();
  });

  test("a tag containing URL-structural characters cannot escape the manifest path segment", () => {
    // Rejected by isValidTagOrDigest's charset (TAG_PATTERN has no "/" or "?" or "#"), so this
    // never reaches encodeURIComponent/new URL at all -- the charset barrier is the first line.
    const url = buildManifestUrl("https://mirror.gcr.io", {
      reference: "x",
      repo: "library/alpine",
      tag: "latest/../../../admin?x=1",
    });
    expect(url).toBeUndefined();
  });
});

describe("registry-mirrors.json — the single source this script and the nix module both read", () => {
  test("exists, parses, and declares a docker.io mirror with an https endpoint", () => {
    // No existsSync check-then-use: readFileSync itself is the existence
    // check, and a missing file throws ENOENT here, failing the test with a
    // clear error rather than a stale pre-check.
    const parsed = JSON.parse(readFileSync(MIRROR_CONFIG_PATH, "utf8")) as {
      mirrors: Record<string, { endpoint: string[] }>;
    };
    expect(parsed.mirrors["docker.io"]).toBeDefined();
    expect(parsed.mirrors["docker.io"]!.endpoint.length).toBeGreaterThan(0);
    for (const endpoint of parsed.mirrors["docker.io"]!.endpoint) {
      expect(endpoint.startsWith("https://")).toBe(true);
    }
  });

  test("every registry key is a bare hostname (the nix module hand-renders YAML with no escaping)", () => {
    const parsed = JSON.parse(readFileSync(MIRROR_CONFIG_PATH, "utf8")) as { mirrors: Record<string, unknown> };
    for (const name of Object.keys(parsed.mirrors)) {
      expect(name).toMatch(/^[a-z0-9.-]+$/);
    }
  });
});
