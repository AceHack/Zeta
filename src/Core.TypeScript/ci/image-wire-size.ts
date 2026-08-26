#!/usr/bin/env bun
// image-wire-size.ts -- how many bytes does a registry actually SERVE for this image?
//
// WHY THIS EXISTS
// ---------------
// `docker image inspect .Size` reports the EXTRACTED size -- the sum of uncompressed layer
// tars. What crosses the wire on a `docker pull` is the COMPRESSED size: `config.size` plus
// every `layers[].size` in the registry manifest. Those two numbers differ by a factor that
// depends entirely on what is in the image, and this repo has already been bitten by
// standing one in for the other: `image-pull-measurement.yml` exists because on-disk figures
// were being derived from compressed ones through "an aggregate ratio measured by gunzipping
// four unrelated images", and a CUDA/torch image does not compress like a Go binary.
//
// So: do not multiply. Push the image to a registry and read what the registry says. That is
// the exact number, it costs one local container, and it needs no network.
//
// SCOPE, said out loud. This is the TRANSFER SIZE, not the pull TIME. Pull time is
// bytes / throughput plus extraction, and only a real cold pull on a real runner measures it
// -- which is what the `pull-measure` job in `ci-runtime-image.yml` does against the
// published digest. This file supplies the numerator and nothing else.
//
// Usage:
//   bun src/Core.TypeScript/ci/image-wire-size.ts <manifest.json> [--json]

export interface WireSize {
  readonly configBytes: number;
  readonly layerBytes: number;
  readonly totalBytes: number;
  readonly layerCount: number;
}

/**
 * Sum the bytes a registry serves for ONE image manifest.
 *
 * Throws rather than returns a number for a manifest LIST / OCI INDEX. That is the whole
 * reason this is a function and not an inline `jq` expression: an index has no `layers`
 * array, `jq` would sum nothing, and the caller would report a multi-gigabyte image as
 * `0 bytes` -- a measurement that looks like a measurement and is the absence of one. The
 * index case is real (multi-arch pushes produce it), so it is refused by name.
 */
export function sumWireBytes(manifest: unknown): WireSize {
  if (manifest === null || typeof manifest !== "object") {
    throw new Error("image-wire-size: manifest is not an object");
  }
  const m = manifest as Record<string, unknown>;
  const mediaType = typeof m["mediaType"] === "string" ? (m["mediaType"] as string) : "";
  if (Array.isArray(m["manifests"])) {
    throw new Error(
      `image-wire-size: this is a manifest INDEX (${mediaType || "no mediaType"}), not an image manifest. ` +
        "It lists per-architecture manifests and carries no layers of its own; summing it would report 0 bytes " +
        "for a real image. Resolve the index to the platform manifest first.",
    );
  }
  const layers = m["layers"];
  if (!Array.isArray(layers)) {
    throw new Error("image-wire-size: manifest has no `layers` array — nothing to measure, and 0 is not the answer");
  }
  const config = m["config"];
  const configBytes =
    config !== null && typeof config === "object" && typeof (config as Record<string, unknown>)["size"] === "number"
      ? ((config as Record<string, unknown>)["size"] as number)
      : 0;

  let layerBytes = 0;
  for (const raw of layers) {
    if (raw === null || typeof raw !== "object") {
      throw new Error("image-wire-size: a layer entry is not an object");
    }
    const size = (raw as Record<string, unknown>)["size"];
    if (typeof size !== "number") {
      // A layer with no size is not a zero-byte layer. Refusing beats under-reporting.
      throw new Error("image-wire-size: a layer entry has no numeric `size` — refusing to treat it as zero");
    }
    layerBytes += size;
  }
  return { configBytes, layerBytes, totalBytes: configBytes + layerBytes, layerCount: layers.length };
}

export function humanBytes(n: number): string {
  const gib = n / 1024 ** 3;
  return gib >= 1 ? `${gib.toFixed(2)} GiB` : `${(n / 1024 ** 2).toFixed(1)} MiB`;
}

async function main(argv: readonly string[]): Promise<number> {
  const path = argv.find((a) => !a.startsWith("--"));
  if (path === undefined) {
    console.error("usage: bun src/Core.TypeScript/ci/image-wire-size.ts <manifest.json> [--json]");
    return 2;
  }
  const { readFile } = await import("node:fs/promises");
  const manifest: unknown = JSON.parse(await readFile(path, "utf8"));
  const w = sumWireBytes(manifest);
  if (argv.includes("--json")) {
    console.log(JSON.stringify(w));
    return 0;
  }
  console.log("=== what a registry SERVES for this image (compressed, measured, not derived) ===");
  console.log(`layers:        ${String(w.layerCount)}`);
  console.log(`config bytes:  ${String(w.configBytes)}`);
  console.log(`layer bytes:   ${String(w.layerBytes)}`);
  console.log(`WIRE BYTES:    ${String(w.totalBytes)}  (${humanBytes(w.totalBytes)})`);
  console.log("");
  console.log("This is the TRANSFER size. It is NOT the pull time — see the `pull-measure` job.");
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
