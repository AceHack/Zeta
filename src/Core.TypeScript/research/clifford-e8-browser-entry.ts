/**
 * clifford-e8-browser-entry.ts — the bundle entry the viewable page loads.
 *
 * This file exists so the browser runs **our modules**, not a port of them. There is no
 * second implementation of the root system, the face lattice, the embedding or the shading
 * anywhere in `demo/clifford-e8/`: the page loads `clifford-e8-substrate.js`, which is this
 * entry bundled by `build-clifford-e8-page.ts`, which is the rung 1-7 TypeScript with its
 * types erased. A page that re-derived the geometry in hand-written JavaScript would be a
 * *duplicated implementation of a tested thing* — the exact defect rung 6 found inside
 * itself — and no amount of care would keep the copy in step.
 *
 * The surface is deliberately small: whatever the page needs, exported by its real name.
 */

import { e8Roots, gossetEdges } from "./clifford-e8-coxeter-projection.ts";
import { triangleFaces } from "./clifford-e8-face-lattice.ts";
import { EDGE_FACE_INCIDENCE } from "./clifford-e8-shading.ts";
import { buildEdgeLines, buildScene, EXPECTED_LEVEL_COUNT } from "./clifford-e8-browser-scene.ts";
import { buildBvh, cameraFromRoot, DEFAULT_HALF_WIDTH, MISS, renderFrame } from "./clifford-e8-raytrace.ts";

/** The API the page sees, under one global so a classic `<script src>` can carry it. */
export const api = {
  e8Roots,
  gossetEdges,
  triangleFaces,
  buildScene,
  buildEdgeLines,
  buildBvh,
  cameraFromRoot,
  renderFrame,
  DEFAULT_HALF_WIDTH,
  EDGE_FACE_INCIDENCE,
  EXPECTED_LEVEL_COUNT,
  MISS,
};

(globalThis as unknown as Record<string, unknown>)["CliffordE8"] = api;
