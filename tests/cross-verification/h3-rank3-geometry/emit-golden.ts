/**
 * emit-golden.ts — the TYPESCRIPT oracle's emission of the H3 rank-3 byte-lock.
 *
 * `src/Core.FSharp.E8Render/H3GoldenVector.fs` emits the same document from an independent F#
 * construction. The committed `h3-rank3-geometry.golden.json` beside this file is the treaty
 * between them, and the falsifier is byte equality on both sides:
 *
 *   - TypeScript: `bun tests/cross-verification/h3-rank3-geometry/emit-golden.ts --check`
 *   - F#: `Tests.FSharp` → `H3 rank-3 oracle` → "emits the committed golden vector byte for
 *     byte", and `cross-verify.ts`, which runs both and compares them to each other.
 *
 * **This file imports the module and modifies none of it.** The derivation is the subject of
 * the measurement, not part of the harness.
 *
 * ## What the two oracles do DIFFERENTLY — the independence being measured
 *
 * Agreement is worth exactly as much as the independence behind it, so it is enumerated
 * rather than asserted:
 *
 * | quantity | TypeScript | F# |
 * |---|---|---|
 * | facets | argmax over the 62 derived weight-orbit directions | exhaustive supporting-plane search over all vertex triples |
 * | `zSqrt` | search `q`, solve `p^2 = a - q^2` | search `p`, solve `q^2 + 2pq - b = 0` |
 * | facet cyclic order | gift-wrap by an exact orientation sign | sort by an exact half-plane + cross-product comparator |
 * | orbit closure | breadth-first by rounds, with a frontier | a worklist stack |
 *
 * Everything below that is shared mathematics — the ring, the Gram matrix, the vertex-sum
 * normal — so agreement there is evidence in proportion to the four rows above and no more.
 *
 * ## Why the document contains NO floating point at all
 *
 * Every quantity locked here is an integer or a `Z[phi]` pair rendered as two decimal
 * integers. There is nothing to round, so there is no formatting treaty to negotiate between
 * a `Number` and a `System.Double` — the class of divergence
 * `.claude/rules/culture-invariant-by-default.md` exists for cannot arise. The one irrational
 * the model admits, `sqrt 3`, appears as the integer `3` under `cosineRadicand`.
 *
 * The canonical serialisation, which both oracles must reproduce exactly: a record's fields
 * are joined with `,`, records are joined with `;`, the string is encoded UTF-8 and hashed
 * with SHA-256, rendered lowercase hex. The document layout is two-space indent, one key per
 * line, integer arrays inline with `", "`, LF endings, one trailing newline.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  H3_INTEGRAL_LIGHT,
  H3_SOLIDS,
  h3FundamentalWeights,
  h3NormalRadical,
  h3Polytope,
  h3RootLight,
  h3Roots,
  h3ShadeFacets,
  h3ShadingField,
  h3SimpleRoots,
  h3Triangulate,
  zDot,
  type H3Solid,
  type VecZphi,
  type Zphi,
} from "../../../src/Core.TypeScript/research/h3-rank3-geometry.ts";

const GOLDEN_PATH = join(import.meta.dir, "h3-rank3-geometry.golden.json");

/** Fields joined by `,`, records joined by `;` — the canonical serialisation. */
const canonical = (records: ReadonlyArray<ReadonlyArray<bigint | number>>): string =>
  records.map((record) => record.map((x) => x.toString()).join(",")).join(";");

/** SHA-256 of the canonical serialisation, lowercase hex. */
const digest = (records: ReadonlyArray<ReadonlyArray<bigint | number>>): string =>
  createHash("sha256").update(canonical(records), "utf8").digest("hex");

/** A `Z[phi]` element as its two integer coefficients: `a + b*phi`. */
const zPair = (x: Zphi): [bigint, bigint] => [x[0], x[1]];

/** A `Z[phi]` vector flattened to its six integer coefficients. */
const zFlat = (v: VecZphi): bigint[] => v.flatMap((c) => [c[0], c[1]]);

const ints = (xs: ReadonlyArray<bigint | number>): string => `[${xs.map((x) => x.toString()).join(", ")}]`;

/** `"a+b*phi"` rendered as the two-integer array the F# side also emits. */
const zText = (x: Zphi): string => ints(zPair(x));

function solidBlock(solid: H3Solid): string[] {
  const polytope = h3Polytope(solid);
  const triangles = h3Triangulate(polytope.points, polytope.facets);
  const rootLight = h3RootLight(0);

  // Facet types, ascending by size: the normal norm, its radical, and the field the cosine
  // closes over under each of the two lights.
  const bySize = new Map<number, { count: number; normalNormSquared: Zphi; normal: VecZphi }>();
  for (const facet of polytope.facets) {
    const existing = bySize.get(facet.vertices.length);
    if (existing === undefined)
      bySize.set(facet.vertices.length, {
        count: 1,
        normalNormSquared: facet.normalNormSquared,
        normal: facet.normal,
      });
    else existing.count++;
  }
  const facetTypes = [...bySize.entries()].sort((a, b) => a[0] - b[0]);

  const rootCensus = h3ShadeFacets(rootLight, polytope.facets);
  const integralCensus = h3ShadeFacets(H3_INTEGRAL_LIGHT, polytope.facets);

  const typeLines = facetTypes.map(([size, info]) => {
    const radical = h3NormalRadical(info.normalNormSquared);
    const rootField = h3ShadingField(rootLight, info.normal);
    const integralField = h3ShadingField(H3_INTEGRAL_LIGHT, info.normal);
    return (
      `      { "facetSize": ${size}, "facets": ${info.count}, ` +
      `"normalNormSquared": ${zText(info.normalNormSquared)}, ` +
      `"normalRadicand": ${radical === null ? "null" : radical.radicand.toString()}, ` +
      `"normalRadicalCoefficient": ${radical === null ? "null" : zText(radical.coefficient)}, ` +
      `"rootLightCosineRadicand": ${rootField.cosineRadicand === null ? "null" : rootField.cosineRadicand.toString()}, ` +
      `"integralLightCosineRadicand": ${integralField.cosineRadicand === null ? "null" : integralField.cosineRadicand.toString()} }`
    );
  });

  return [
    `    "${solid}": {`,
    `      "seed": ${ints(zFlat(polytope.seed))},`,
    `      "fVector": ${ints(polytope.fVector)},`,
    `      "euler": ${polytope.euler},`,
    `      "nonIntegralReflections": ${polytope.nonIntegralReflections},`,
    `      "facetSizeCensus": ${ints(polytope.facetSizeCensus.flat())},`,
    `      "edgeFacetIncidence": ${ints([polytope.incidence.edges, polytope.incidence.min, polytope.incidence.max])},`,
    `      "triangles": ${triangles.length},`,
    `      "verticesSha256": "${digest(polytope.points.map(zFlat))}",`,
    `      "facetsSha256": "${digest(polytope.facets.map((f) => [...f.vertices]))}",`,
    `      "facetNormalsSha256": "${digest(polytope.facets.map((f) => zFlat(f.normal)))}",`,
    `      "edgesSha256": "${digest(polytope.edges.map((e) => [e.a, e.b]))}",`,
    `      "trianglesSha256": "${digest(triangles.map((t) => [...t]))}",`,
    `      "facetTypes": [`,
    typeLines.join(",\n"),
    `      ],`,
    `      "rootLightSignedLevels": ${rootCensus.signedLevels.length},`,
    `      "rootLightAbsoluteLevels": ${rootCensus.absoluteLevels.length},`,
    `      "rootLightLitLevels": ${rootCensus.litLevels.length},`,
    `      "rootLightTerminatorFacets": ${rootCensus.terminatorFacets},`,
    `      "rootLightCensusSha256": "${digest(rootCensus.census.map(([v, c]) => [v[0], v[1], BigInt(c)]))}",`,
    `      "integralLightSignedLevels": ${integralCensus.signedLevels.length},`,
    `      "integralLightAbsoluteLevels": ${integralCensus.absoluteLevels.length},`,
    `      "integralLightTerminatorFacets": ${integralCensus.terminatorFacets},`,
    `      "integralLightCensusSha256": "${digest(integralCensus.census.map(([v, c]) => [v[0], v[1], BigInt(c)]))}"`,
    `    }`,
  ];
}

export function emitGolden(): string {
  const roots = h3Roots();
  const [a1, a2, a3] = h3SimpleRoots();
  const [w1, w2, w3] = h3FundamentalWeights();

  const solidBlocks = H3_SOLIDS.map(solidBlock);

  const lines = [
    "{",
    '  "schema": "h3-rank3-geometry-golden/v1",',
    '  "frame": "Z[phi] coordinates, phi^2 = phi + 1; H3 root norm squared 4; RANK 3, NO PROJECTION",',
    `  "canonicalSerialisation": "fields joined by ',', records joined by ';', UTF-8, SHA-256 lowercase hex",`,
    '  "floatingPoint": "none — every locked quantity is an integer or a Z[phi] pair of integers",',
    `  "rootCount": ${roots.length},`,
    `  "rootNormSquared": ${zText(zDot(roots[0] as VecZphi, roots[0] as VecZphi))},`,
    `  "rootsSha256": "${digest(roots.map(zFlat))}",`,
    `  "simpleRoots": ${ints([...zFlat(a1), ...zFlat(a2), ...zFlat(a3)])},`,
    `  "simpleGram": ${ints([...zPair(zDot(a1, a2)), ...zPair(zDot(a2, a3)), ...zPair(zDot(a1, a3))])},`,
    `  "fundamentalWeights": ${ints([...zFlat(w1), ...zFlat(w2), ...zFlat(w3)])},`,
    `  "weightNormsSquared": ${ints([...zPair(zDot(w1, w1)), ...zPair(zDot(w2, w2)), ...zPair(zDot(w3, w3))])},`,
    `  "rootLight": ${ints(zFlat(h3RootLight(0)))},`,
    `  "integralLight": ${ints(zFlat(H3_INTEGRAL_LIGHT))},`,
    `  "integralLightNormSquared": ${zText(zDot(H3_INTEGRAL_LIGHT, H3_INTEGRAL_LIGHT))},`,
    '  "solids": {',
    solidBlocks.map((block) => block.join("\n")).join(",\n"),
    "  }",
    "}",
    "",
  ];

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
