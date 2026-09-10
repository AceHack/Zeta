/**
 * emit-golden.ts — the TYPESCRIPT oracle's emission of the Clifford/E8 rendering byte-lock.
 *
 * `src/Core.FSharp.E8Render/E8GoldenVector.fs` emits the same document from an independent
 * F# construction. The committed
 * `clifford-e8-rendering.golden.json` beside this file is the treaty between them, and the
 * falsifier is byte equality on both sides:
 *
 *   - TypeScript: `bun tests/cross-verification/clifford-e8-rendering/emit-golden.ts --check`
 *   - F#: `Tests.FSharp` → `E8 rendering oracle` → "emits the committed golden vector byte
 *     for byte"
 *
 * Run without `--check` to print the document (that is how the committed file is produced;
 * `--write` writes it in place).
 *
 * **This file imports the rung modules and modifies none of them.** The rungs are the
 * subject of the measurement, not part of the harness.
 *
 * The canonical serialisation, which both oracles must reproduce exactly: a record's fields
 * are joined with `,`, records are joined with `;`, the string is encoded UTF-8 and hashed
 * with SHA-256, rendered lowercase hex. The document layout is two-space indent, one key per
 * line, integer arrays inline with `", "`, census arrays one pair per line, LF endings, one
 * trailing newline.
 *
 * What is deliberately NOT locked here is the 3D embedding's coordinates: an eigenvector is
 * defined up to sign, so locking one would lock an arbitrary gauge. The Coxeter ring COUNT
 * and points-per-ring are rotation- and precision-invariant, and those are locked instead.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  e8Roots,
  gossetEdges,
  GOSSET_EDGE_INNER_PRODUCT,
  type Root,
} from "../../../src/Core.TypeScript/research/clifford-e8-coxeter-projection.ts";
import { eigenLayers } from "../../../src/Core.TypeScript/research/clifford-e8-eigenlayer-tessellation.ts";
import {
  eulerAlternatingSum,
  fVector,
  triangleFaces,
  type Face,
} from "../../../src/Core.TypeScript/research/clifford-e8-face-lattice.ts";
import {
  EDGE_FACE_INCIDENCE,
  edgeFaceIncidence,
  faceNormal8d,
  FACE_BIVECTOR_NORM_SQUARED,
  FACE_NORMAL_NORM_SQUARED,
  intensityHistogram,
  LAMBERT_DENOMINATOR_SQUARED,
  lightFromRootIndex,
  planeIllumination,
  ROOT_NORM_SQUARED,
  shadeFaces,
} from "../../../src/Core.TypeScript/research/clifford-e8-shading.ts";

const GOLDEN_PATH = join(import.meta.dir, "clifford-e8-rendering.golden.json");

/** Fields joined by `,`, records joined by `;` — the canonical serialisation. */
const canonical = (records: ReadonlyArray<ReadonlyArray<number>>): string =>
  records.map((record) => record.join(",")).join(";");

/** SHA-256 of the canonical serialisation, lowercase hex. */
const digest = (records: ReadonlyArray<ReadonlyArray<number>>): string =>
  createHash("sha256").update(canonical(records), "utf8").digest("hex");

const ints = (xs: ReadonlyArray<number>): string => `[${xs.join(", ")}]`;

const pairs = (indent: string, xs: ReadonlyArray<readonly [number, number]>): string => {
  const body = xs.map(([k, v]) => `${indent}  [${k}, ${v}]`).join(",\n");
  return `[\n${body}\n${indent}]`;
};

const census = (values: ReadonlyArray<number>): Array<readonly [number, number]> => {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0] - b[0]);
};

/** The Coxeter-plane ring census: radii rounded to 6 decimals, then counted. */
function coxeterRings(roots: readonly Root[]): Array<readonly [number, number]> {
  const layer = eigenLayers()[0];
  if (layer === undefined) throw new Error("eigenLayers() produced no layers");
  const dot = (a: readonly number[], b: readonly number[]): number => a.reduce((s, x, k) => s + x * (b[k] ?? 0), 0);
  const counts = new Map<number, number>();
  for (const r of roots) {
    const x = dot(r, layer.e1);
    const y = dot(r, layer.e2);
    const radius = Math.round(Math.hypot(x, y) * 1e6) / 1e6;
    counts.set(radius, (counts.get(radius) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0] - b[0]);
}

export function emitGolden(): string {
  const roots = e8Roots();
  const edges = gossetEdges(roots);
  const faces: Face[] = triangleFaces(roots);
  const light = lightFromRootIndex(0, roots);
  const shaded = shadeFaces(light, faces, roots);
  const incidence = edgeFaceIncidence(faces);
  const f = fVector(roots);
  const rings = coxeterRings(roots);
  const ringCounts = [...new Set(rings.map(([, n]) => n))];

  const twoTwoZero = roots.filter((r) => r.some((x) => Math.abs(x) === 2)).length;
  const firstRoot = roots[0] ?? [];
  const lastRoot = roots[roots.length - 1] ?? [];
  const firstFace = faces[0] ?? ([0, 0, 0] as const);
  const lastFace = faces[faces.length - 1] ?? ([0, 0, 0] as const);

  const lines = [
    "{",
    '  "schema": "clifford-e8-rendering-golden/v1",',
    '  "frame": "doubled integer coordinates; root norm squared 8",',
    `  "canonicalSerialisation": "fields joined by ',', records joined by ';', UTF-8, SHA-256 lowercase hex",`,
    `  "rootCount": ${roots.length},`,
    `  "rootSplit": ${ints([twoTwoZero, roots.length - twoTwoZero])},`,
    `  "rootNormSquared": ${ROOT_NORM_SQUARED},`,
    `  "rootsSha256": "${digest(roots.map((r) => [...r]))}",`,
    `  "firstRoot": ${ints(firstRoot)},`,
    `  "lastRoot": ${ints(lastRoot)},`,
    `  "gossetEdgeInnerProduct": ${GOSSET_EDGE_INNER_PRODUCT},`,
    `  "edgeCount": ${edges.length},`,
    `  "edgesSha256": "${digest(edges.map((e) => [e.a, e.b]))}",`,
    `  "faceCount": ${faces.length},`,
    `  "facesSha256": "${digest(faces.map((x) => [x[0], x[1], x[2]]))}",`,
    `  "firstFace": ${ints([firstFace[0], firstFace[1], firstFace[2]])},`,
    `  "lastFace": ${ints([lastFace[0], lastFace[1], lastFace[2]])},`,
    `  "fVector": ${ints(f)},`,
    `  "eulerAlternatingSum": ${eulerAlternatingSum(f)},`,
    `  "edgeFaceIncidence": ${ints([incidence.edges, incidence.min, incidence.max])},`,
    `  "faceNormalNormSquared": ${FACE_NORMAL_NORM_SQUARED},`,
    `  "faceBivectorNormSquared": ${FACE_BIVECTOR_NORM_SQUARED},`,
    `  "faceNormalsSha256": "${digest(faces.map((x) => faceNormal8d(x, roots)))}",`,
    `  "lambertDenominatorSquared": ${LAMBERT_DENOMINATOR_SQUARED},`,
    `  "lambertCensus": ${pairs("  ", census(shaded.map((s) => s.lambert.numerator)))},`,
    `  "twoSidedCensus": ${pairs("  ", [...intensityHistogram(shaded).entries()])},`,
    `  "brightnessLevels": ${ints([...intensityHistogram(shaded).keys()])},`,
    `  "planeIlluminationCensus": ${pairs(
      "  ",
      census(faces.map((x) => planeIllumination(x, light, roots).numerator)),
    )},`,
    `  "coxeterRingCount": ${rings.length},`,
    `  "coxeterPointsPerRing": ${ringCounts.length === 1 ? ringCounts[0] : -1}`,
    "}",
    "",
  ];

  // `EDGE_FACE_INCIDENCE` is imported and asserted here rather than emitted twice: the
  // document already carries the measured min and max, and a constant that agrees with
  // nothing is a constant nobody checks.
  if (incidence.min !== EDGE_FACE_INCIDENCE || incidence.max !== EDGE_FACE_INCIDENCE) {
    throw new Error(`edge-face incidence is not ${EDGE_FACE_INCIDENCE}: ${incidence.min}..${incidence.max}`);
  }

  return lines.join("\n");
}

if (import.meta.main) {
  const document = emitGolden();
  const mode = process.argv[2];
  if (mode === "--write") {
    writeFileSync(GOLDEN_PATH, document, "utf8");
    process.stdout.write(`wrote ${GOLDEN_PATH}\n`);
  } else if (mode === "--check") {
    const onDisk = readFileSync(GOLDEN_PATH, "utf8");
    if (onDisk !== document) {
      process.stderr.write("TypeScript oracle disagrees with the committed golden vector\n");
      process.exit(1);
    }
    process.stdout.write("TypeScript oracle matches the committed golden vector byte for byte\n");
  } else {
    process.stdout.write(document);
  }
}
