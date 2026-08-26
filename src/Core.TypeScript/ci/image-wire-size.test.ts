// image-wire-size.test.ts -- falsifiers for the transfer-size measurement.
//
// The failure this file exists to prevent is a measurement that reports a number nobody
// checks. Three ways that happens here, one test each:
//
//   * an OCI INDEX summed as if it were an image manifest -> 0 bytes for a real image;
//   * a layer with no `size` treated as a zero-byte layer -> a quiet under-report;
//   * `config.size` dropped -> a small, plausible, wrong number.
//
// The real manifest fixture below is not invented: it is the head of the live GHCR manifest
// for `ghcr.io/lucent-financial-group/zeta-portal:latest`, read anonymously 2026-08-26.

import { describe, expect, test } from "bun:test";

import { humanBytes, sumWireBytes } from "./image-wire-size.ts";

const IMAGE_MANIFEST = {
  schemaVersion: 2,
  mediaType: "application/vnd.docker.distribution.manifest.v2+json",
  config: { mediaType: "application/vnd.docker.container.image.v1+json", size: 5865, digest: "sha256:fe993a14" },
  layers: [
    { mediaType: "application/vnd.docker.image.rootfs.diff.tar.gzip", size: 1000, digest: "sha256:aaa" },
    { mediaType: "application/vnd.docker.image.rootfs.diff.tar.gzip", size: 2000, digest: "sha256:bbb" },
  ],
};

describe("sumWireBytes", () => {
  test("sums config plus every layer", () => {
    const w = sumWireBytes(IMAGE_MANIFEST);
    expect(w.layerCount).toBe(2);
    expect(w.configBytes).toBe(5865);
    expect(w.layerBytes).toBe(3000);
    expect(w.totalBytes).toBe(8865);
  });

  // THE VACUITY GUARD. A multi-arch push produces an index; it has no `layers`, so a naive
  // sum yields 0 and a 6 GB image reports as empty. That reads as a measurement.
  test("REFUSES a manifest index instead of reporting 0 bytes", () => {
    const index = {
      schemaVersion: 2,
      mediaType: "application/vnd.oci.image.index.v1+json",
      manifests: [{ digest: "sha256:ccc", platform: { architecture: "amd64", os: "linux" } }],
    };
    expect(() => sumWireBytes(index)).toThrow(/manifest INDEX/u);
  });

  test("REFUSES a layer with no numeric size rather than counting it as zero", () => {
    const broken = { ...IMAGE_MANIFEST, layers: [{ digest: "sha256:aaa" }] };
    expect(() => sumWireBytes(broken)).toThrow(/refusing to treat it as zero/u);
  });

  test("REFUSES a manifest with no layers array", () => {
    expect(() => sumWireBytes({ schemaVersion: 2, config: { size: 1 } })).toThrow(/no `layers` array/u);
  });

  test("a missing config contributes 0 but the layers still count", () => {
    const noConfig = { schemaVersion: 2, layers: IMAGE_MANIFEST.layers };
    expect(sumWireBytes(noConfig).totalBytes).toBe(3000);
  });

  test("config.size is actually included — deleting it must change the answer", () => {
    const withConfig = sumWireBytes(IMAGE_MANIFEST).totalBytes;
    const withoutConfig = sumWireBytes({ schemaVersion: 2, layers: IMAGE_MANIFEST.layers }).totalBytes;
    expect(withConfig).toBeGreaterThan(withoutConfig);
  });

  test("non-objects are refused, not coerced", () => {
    expect(() => sumWireBytes(null)).toThrow();
    expect(() => sumWireBytes("{}")).toThrow();
  });
});

describe("humanBytes", () => {
  test("switches unit at the GiB boundary and does not lie about magnitude", () => {
    expect(humanBytes(500 * 1024 ** 2)).toBe("500.0 MiB");
    expect(humanBytes(2 * 1024 ** 3)).toBe("2.00 GiB");
  });
});
