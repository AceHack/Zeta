import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { e8Roots, gossetEdges } from "./clifford-e8-coxeter-projection.ts";
import { triangleFaces } from "./clifford-e8-face-lattice.ts";
import { buildScene } from "./clifford-e8-browser-scene.ts";
import { buildBvh, cameraFromRoot, DEFAULT_HALF_WIDTH, MISS, renderFrame } from "./clifford-e8-raytrace.ts";
import { BUNDLE_BANNER, BUNDLE_FILE, buildBundle, PAGE_DIRECTORY } from "./build-clifford-e8-page.ts";

const REPO = join(new URL(".", import.meta.url).pathname, "..", "..", "..");
const HTML = readFileSync(join(REPO, PAGE_DIRECTORY, "index.html"), "utf8");
const BUNDLE = readFileSync(join(REPO, PAGE_DIRECTORY, BUNDLE_FILE), "utf8");

/**
 * The page with its comments removed.
 *
 * Every NEGATIVE source assertion below reads this and not `HTML`. Writing them against the
 * raw file is a trap this test fell into on its first run: the comment explaining *why* the
 * `appendChild(typeof part === "string" ? ...)` shape was removed contains that shape, so
 * the guard fired on its own explanation. A source check must match the CALL, never the
 * prose about the call.
 */
const HTML_CODE = HTML.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/**
 * Run the committed bundle exactly as a browser would — a classic script that assigns one
 * global — and hand back what the page would see.
 */
function loadCommittedBundle(): Record<string, (...args: never[]) => unknown> {
  const slot = globalThis as unknown as Record<string, unknown>;
  const previous = slot["CliffordE8"];
  // eslint-disable-next-line no-new-func -- the point of the test is to execute the artefact.
  new Function(BUNDLE)();
  const api = slot["CliffordE8"] as Record<string, (...args: never[]) => unknown>;
  slot["CliffordE8"] = previous;
  return api;
}

const PAGE_API = loadCommittedBundle();

describe("the viewable page — the committed artefact, executed", () => {
  // ── FALSIFIER 1: THE PAGE SHIPS NO GEOMETRY ───────────────────────────────
  it("carries a derivation and not a coordinate table", () => {
    // No authored vertex data anywhere in the page or its bundle: nothing that looks like a
    // numeric array of any length. The whole claim of this rung is that the picture is
    // derived, and a smuggled table is exactly how that claim would quietly become false.
    const numericTable = /\[\s*(-?\d+(\.\d+)?\s*,\s*){20,}/;
    expect(HTML_CODE).not.toMatch(numericTable);
    expect(BUNDLE).not.toMatch(numericTable);
    // Control: the detector must be able to fire. A table of 20 numbers is caught.
    expect("var t = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];").toMatch(numericTable);
    // Size, stated rather than implied. The bundle is smaller than any encoding of its own
    // output: the position buffer alone is 2,177,280 bytes.
    expect(BUNDLE.length).toBeLessThan(60_000);
    expect(HTML.length).toBeLessThan(60_000);
    expect(BUNDLE.length + HTML.length).toBeLessThan(2_177_280);
  });

  // ── FALSIFIER 2: THE COMMITTED BUNDLE IS THE SUBSTRATE, NOT A PORT ────────
  it("produces byte-identical buffers to the TypeScript modules", () => {
    const roots = e8Roots();
    const faces = triangleFaces(roots);
    const scene = buildScene(0, roots, faces);

    const pageRoots = PAGE_API["e8Roots"]?.() as number[][];
    const pageFaces = PAGE_API["triangleFaces"]?.() as number[][];
    const pageEdges = PAGE_API["gossetEdges"]?.() as unknown[];
    expect(pageRoots.length).toBe(240);
    expect(pageFaces.length).toBe(60480);
    expect(pageEdges.length).toBe(gossetEdges(roots).length);
    expect(pageRoots).toEqual(roots as number[][]);

    const pageScene = (PAGE_API["buildScene"] as (n: number) => ReturnType<typeof buildScene>)(0);
    expect(pageScene.faceCount).toBe(scene.faceCount);
    expect(pageScene.levelNumerators).toEqual(scene.levelNumerators);
    expect(pageScene.histogram).toEqual(scene.histogram);
    expect(pageScene.denominatorSquared).toBe(scene.denominatorSquared);
    expect(pageScene.radius).toBe(scene.radius);
    expect(pageScene.positions).toEqual(scene.positions);
    expect(pageScene.levels).toEqual(scene.levels);
    expect([...pageScene.brightness]).toEqual([...scene.brightness]);
    expect(PAGE_API["MISS"] as unknown).toBe(MISS);
    expect(PAGE_API["DEFAULT_HALF_WIDTH"] as unknown).toBe(DEFAULT_HALF_WIDTH);
  });

  // ── FALSIFIER 3: THE PAGE'S TRACER IS THIS TRACER ─────────────────────────
  it("ray traces to the same image as the module under test", () => {
    const roots = e8Roots();
    const scene = buildScene(0, roots);
    const bvh = buildBvh(scene.positions);
    const camera = cameraFromRoot(0, 3, DEFAULT_HALF_WIDTH, roots);
    const expected = renderFrame(scene.positions, scene.levels, bvh, camera, 32, 32);

    const pageScene = (PAGE_API["buildScene"] as (n: number) => ReturnType<typeof buildScene>)(0);
    const pageBvh = (PAGE_API["buildBvh"] as (p: Float32Array) => ReturnType<typeof buildBvh>)(pageScene.positions);
    const pageCamera = (PAGE_API["cameraFromRoot"] as (i: number) => ReturnType<typeof cameraFromRoot>)(0);
    const actual = (
      PAGE_API["renderFrame"] as (
        p: Float32Array,
        l: Uint8Array,
        b: ReturnType<typeof buildBvh>,
        c: ReturnType<typeof cameraFromRoot>,
        w: number,
        h: number,
      ) => ReturnType<typeof renderFrame>
    )(pageScene.positions, pageScene.levels, pageBvh, pageCamera, 32, 32);

    expect(actual.pixels).toEqual(expected.pixels);
    expect(actual.hits).toBe(expected.hits);
    // Control: an image of nothing would make the equality above vacuous.
    expect(expected.hits).toBeGreaterThan(150);
    expect(new Set([...expected.pixels]).size).toBeGreaterThan(2);
  });

  // ── FALSIFIER 4: THE BUNDLE IS CURRENT ────────────────────────────────────
  it("matches a fresh bundle of the same sources, behaviourally", async () => {
    const fresh = await buildBundle(REPO);
    expect(fresh.startsWith(BUNDLE_BANNER)).toBe(true);
    expect(BUNDLE.startsWith(BUNDLE_BANNER)).toBe(true);
    expect(BUNDLE).not.toContain("sourceMappingURL");

    // Behaviour, not bytes. Byte equality would also pin the bundler's version, which turns
    // a Bun patch bump into a red gate that says nothing about this rung -- and this repo
    // already names the failure it would cause: a check that fires for a reason unrelated to
    // what it claims to check trains people to ignore it. What matters is the BROKEN METER
    // case (a bundle that has silently drifted from its sources), and every exported
    // function is compared above and here.
    const slot = globalThis as unknown as Record<string, unknown>;
    const previous = slot["CliffordE8"];
    new Function(fresh)();
    const freshApi = slot["CliffordE8"] as Record<string, (...a: never[]) => unknown>;
    slot["CliffordE8"] = previous;
    expect(Object.keys(freshApi).sort()).toEqual(Object.keys(PAGE_API).sort());
    const freshScene = (freshApi["buildScene"] as (n: number) => ReturnType<typeof buildScene>)(7);
    const committedScene = (PAGE_API["buildScene"] as (n: number) => ReturnType<typeof buildScene>)(7);
    expect(freshScene.positions).toEqual(committedScene.positions);
    expect(freshScene.levels).toEqual(committedScene.levels);
    expect(freshScene.histogram).toEqual(committedScene.histogram);
  });

  // ── FALSIFIER 5: THREE BACKENDS, AND NONE OF THEM CULLS ───────────────────
  it("declares three backends and disables culling on every one", () => {
    for (const backend of ["webgpu", "webgl2", "canvas2d"]) expect(HTML).toContain(`backends.${backend} =`);
    expect(HTML).toContain('var order = ["webgpu", "webgl2", "canvas2d"];');
    // 27 faces per edge means there is no inside; a culled pass would silently delete half
    // the surface and still look like a picture.
    expect(HTML).toContain('cullMode: "none"');
    expect(HTML).toContain("gl.disable(gl.CULL_FACE)");
    // The Canvas 2D path must not sort: a painter's order over this surface is undefined.
    expect(HTML_CODE).not.toContain(".sort(");
    expect(HTML).toContain('ctx.globalCompositeOperation = "lighter"');
    // The uniform must be visible to the fragment stage. Declaring VERTEX alone made the
    // WebGPU additive pass silently black -- found by looking at it, fixed here, pinned now.
    expect(HTML).toContain("GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT");
  });

  // ── FALSIFIER 6: THE SHADER CONSUMES LEVELS, IT DOES NOT COMPUTE LIGHT ────
  it("evaluates no lighting in either shader", () => {
    // The whole shading model in the WGSL and in the GLSL is one array index.
    expect(HTML).toContain("o.shade = u.palette[u32(lvl)].x;");
    expect(HTML).toContain("vShade = uPalette[int(aLevel)];");
    // No lighting arithmetic: no normals, no dot products, no exponents in either shader.
    const shaderText = HTML.slice(HTML.indexOf("struct U {"), HTML.indexOf("backends.canvas2d"));
    expect(shaderText).not.toContain("normalize(");
    expect(shaderText).not.toContain("dot(");
    expect(shaderText).not.toContain("pow(");
    expect(shaderText).not.toContain("reflect(");
    // Control: the slice really does contain both shaders.
    expect(shaderText).toContain("@fragment");
    expect(shaderText).toContain("#version 300 es");
  });

  // ── FALSIFIER 7: NO HTML SINK TAKES A DYNAMIC VALUE ───────────────────────
  it("never assigns markup, so there is no XSS-through-DOM sink to reason about", () => {
    // CodeQL `js/xss-through-dom` (high) fired on the first version of this page: a <select>
    // value reached `overlay.innerHTML`. It was not exploitable — the options are authored
    // three lines away — and that is exactly the argument that stops being true when someone
    // adds a fourth option or interpolates an error message. So the sink class is gone, not
    // excused, and this pins it: every dynamic value reaches the document as a text node.
    expect(HTML_CODE).not.toMatch(/\.innerHTML\s*=/);
    expect(HTML_CODE).not.toMatch(/\.outerHTML\s*=/);
    expect(HTML_CODE).not.toContain("insertAdjacentHTML");
    expect(HTML_CODE).not.toContain("document.write");
    expect(HTML_CODE).not.toContain("eval(");
    // Control: the detector fires on the shape it is meant to catch.
    expect('overlay.innerHTML = "<b>" + mode;').toMatch(/\.innerHTML\s*=/);
    // And the replacement is actually present, so this is not a page that renders nothing.
    expect(HTML).toContain("node.textContent = String(o.text)");
    expect(HTML).toContain("document.createTextNode(String(value))");
    // And the sink takes NODES ONLY. The first fix branched at `appendChild` between a text
    // node and a raw value, which CodeQL then flagged as `js/xss-through-exception` — taint
    // cannot be tracked through the ternary. Narrowing the parameter removed the union
    // rather than the warning, so this pins the narrow shape, not the alert's absence.
    expect(HTML).toContain("for (var i = 0; i < nodes.length; i++) node.appendChild(nodes[i]);");
    expect(HTML_CODE).not.toMatch(/appendChild\(typeof/);
    // Control: the stripper removed prose and kept code. Without this, every negative
    // assertion above would pass on an empty string.
    expect(HTML_CODE).toContain("function fill(node, nodes)");
    expect(HTML_CODE.length).toBeGreaterThan(10_000);
    expect(HTML_CODE.length).toBeLessThan(HTML.length);
  });

  // ── FALSIFIER 8: THE PAGE LOADS THE ARTEFACT THIS SCRIPT WRITES ───────────
  it("references the generated bundle by its generated name", () => {
    expect(HTML).toContain(`<script src="./${BUNDLE_FILE}"></script>`);
    expect(PAGE_DIRECTORY).toBe("demo/clifford-e8");
    // A missing global must say so rather than render an empty canvas in silence.
    expect(HTML).toContain("did not load");
  });
});
