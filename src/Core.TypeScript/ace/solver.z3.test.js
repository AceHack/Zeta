/**
 * Z3 differential test: cross-checks our TS solver against Z3 SMT as a satisfiability oracle.
 *
 * z3-solver@4.16.0 uses Emscripten-compiled WASM with pthreads (worker_threads).
 * Bun 1.3.12 does not support the Emscripten pthread WASM model — init() resolves
 * but the WASM assertion fails in the worker thread on WASM instance receipt.
 * Exact error: "Aborted(Assertion failed)" at z3-built.js:848 (removeRunDependency → assert).
 *
 * Resolution (no skip — per .claude/rules/automated-tests-are-the-shield-assert-dont-skip.md):
 * We spawn a Node.js subprocess for each Z3 query. The test file itself runs under Bun;
 * Z3 actually executes and returns a verdict (sat/unsat); assertions are made in Bun.
 * This is NOT a graceful skip — the test FAILS if Node is unavailable or Z3 crashes.
 *
 * Corpus scope: version-INDEPENDENT-dep graphs only (each package has one version, or
 * identical deps across versions), so the static SMT encoding is faithful to what solve()
 * discovers by fetching.
 */
import { describe, test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { solve } from "./solver.js";
import { packageHash } from "./package-hash.js";
import { contentHash } from "./store.js";
import { satisfies } from "./semver.js";
// ---- helpers mirrored from solver.test.ts -----------------------------------
function pkgAt(name, version, deps = []) {
    const files = { "f.txt": `${name}@${version}` };
    return {
        manifest: {
            format_version: 1,
            name,
            version,
            content_hash: contentHash(new TextEncoder().encode(JSON.stringify(files))),
            dependencies: deps,
        },
        files,
    };
}
const regEdge = (name, range) => ({ kind: "registry", name, version: range });
function fetchOf(map) {
    return async (url) => {
        const p = map[url];
        if (!p)
            throw new Error("404 " + url);
        return JSON.stringify(p);
    };
}
/** Build registry + fetch from {pkg, url} list. */
function world(entries) {
    const registry = new Map();
    const fetchMap = {};
    for (const { pkg, url } of entries) {
        const n = pkg.manifest.name, v = pkg.manifest.version;
        if (!registry.has(n))
            registry.set(n, new Map());
        registry.get(n).set(v, { url, package_hash: packageHash(pkg) });
        fetchMap[url] = pkg;
    }
    return { registry, fetch: fetchOf(fetchMap) };
}
/**
 * Ask Z3 (via Node subprocess) whether a satisfying assignment exists for the given
 * dependency graph. Returns "sat" | "unsat" | throws on error.
 *
 * We spawn Node because z3-solver@4.16.0's Emscripten pthread WASM crashes in Bun 1.3.12
 * (see module-level comment). The subprocess is a real assertion — not a skip.
 */
function queryZ3(graph) {
    // Build the Node.js script inline; graph is JSON-serialized.
    const graphJson = JSON.stringify(graph);
    const nodeScript = `
const { init } = require('z3-solver/build/node.js');
const graph = ${graphJson};

function encVer(v) {
  const [ma, mi, pa] = v.split('.').map(Number);
  return ma * 1_000_000 + mi * 1_000 + (pa || 0);
}

(async () => {
  const { Context } = await init();
  const { Solver, Int, Or, And } = new Context('main');
  const solver = new Solver();

  // Create one Int const per package (the chosen encoded version).
  const vars = {};
  for (const [name, versions] of Object.entries(graph.packages)) {
    vars[name] = Int.const(name);
    // Constrain to one of the available encoded versions (OR of equalities).
    const choices = versions.map(v => vars[name].eq(Int.val(encVer(v))));
    if (choices.length === 0) {
      // Empty availability → unsat for any edge to this name
      solver.add(Int.val(0).eq(Int.val(1)));
    } else if (choices.length === 1) {
      solver.add(choices[0]);
    } else {
      solver.add(Or(...choices));
    }
  }

  // Add edge constraints. "root" is a pseudo-source with no variable; edges from "root"
  // apply directly to the target. Edges from other packages apply unconditionally (version-
  // independent corpus: same deps regardless of which version is picked for the source).
  for (const edge of graph.edges) {
    if (!vars[edge.to]) {
      // Target not in packages → unsat (missing package)
      solver.add(Int.val(0).eq(Int.val(1)));
      continue;
    }
    const target = vars[edge.to];
    const s = edge.range.trim();
    if (s === '*' || s === '' || s === 'x' || s === 'X') continue; // no constraint

    if (s.startsWith('^')) {
      const ver = s.slice(1);
      const enc = encVer(ver);
      const parts = ver.split('.').map(Number);
      const major = parts[0], minor = parts[1];
      let upperEnc;
      if (major > 0) upperEnc = encVer((major + 1) + '.0.0');
      else if (minor > 0) upperEnc = encVer('0.' + (minor + 1) + '.0');
      else upperEnc = enc + 1;
      solver.add(target.ge(Int.val(enc)));
      solver.add(target.lt(Int.val(upperEnc)));
      continue;
    }

    const m = /^(>=|<=|>|<|=)?(.+)$/.exec(s);
    if (!m) throw new Error('Cannot parse range: ' + s);
    const op = m[1] || '=';
    const enc = encVer(m[2]);
    if (op === '>=') solver.add(target.ge(Int.val(enc)));
    else if (op === '>') solver.add(target.gt(Int.val(enc)));
    else if (op === '<') solver.add(target.lt(Int.val(enc)));
    else if (op === '<=') solver.add(target.le(Int.val(enc)));
    else solver.add(target.eq(Int.val(enc)));
  }

  const result = await solver.check();
  process.stdout.write(result + '\\n');
  process.exit(0);
})().catch(e => { process.stderr.write(e.message + '\\n'); process.exit(1); });
`;
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- "node" is a trusted PATH runtime lookup; Z3's Emscripten-pthread WASM can't init under Bun (see file header), so each query shells to Node. argv carries only a fixed nodeScript template — no untrusted input.
    const result = spawnSync("node", ["-e", nodeScript], {
        encoding: "utf-8",
        timeout: 25000,
        cwd: process.cwd(),
    });
    if (result.status !== 0) {
        throw new Error(`Z3 subprocess failed (status ${result.status ?? "null"}):\n${result.stderr ?? ""}`.trimEnd());
    }
    const out = (result.stdout ?? "").trim();
    if (out !== "sat" && out !== "unsat") {
        throw new Error(`Z3 subprocess returned unexpected output: ${JSON.stringify(out)}`);
    }
    return out;
}
// ---- corpus case helpers ----------------------------------------------------
/**
 * Assert agreement between solve() and Z3 oracle, and (for ok cases) self-consistency
 * of the returned versions map.
 */
async function assertAgreement(graph, root, registry, fetch) {
    const [solveResult, z3Verdict] = await Promise.all([
        solve(root, fetch, registry),
        Promise.resolve().then(() => queryZ3(graph)), // sync spawnSync, wrapped in promise
    ]);
    const solveOk = solveResult.ok;
    const z3Sat = z3Verdict === "sat";
    expect(solveOk, `solve() and Z3 disagree: solve=${solveOk ? "ok" : "fail"}, Z3=${z3Verdict}. ` +
        (!solveOk ? `solve reason: ${solveResult.reason}` : "")).toBe(z3Sat);
    // Extra self-consistency check for ok cases: every range in the graph that targets
    // a solved package must be satisfied by the chosen version.
    if (solveResult.ok) {
        for (const edge of graph.edges) {
            if (edge.from === "root" || edge.to in graph.packages) {
                const chosenVer = solveResult.versions.get(edge.to);
                if (chosenVer !== undefined) {
                    expect(satisfies(chosenVer, edge.range), `Self-consistency: solve() chose ${edge.to}@${chosenVer} but range ${edge.range} not satisfied`).toBe(true);
                }
            }
        }
    }
}
// ---- corpus -----------------------------------------------------------------
describe("solver Z3 differential — SAT oracle cross-check", () => {
    // Generous timeout: Z3 WASM init + subprocess spawn + check can take a few seconds.
    const TIMEOUT = 30_000;
    test("corpus 1: SAT diamond (root→A^1.0.0, root→B^1.0.0; A and B are leaves)", async () => {
        // Registry: A{1.0.0}, B{1.0.0}
        const A = pkgAt("A", "1.0.0");
        const B = pkgAt("B", "1.0.0");
        const root = pkgAt("root", "1.0.0", [regEdge("A", "^1.0.0"), regEdge("B", "^1.0.0")]);
        const { registry, fetch } = world([
            { pkg: A, url: "u/A/1.0.0" },
            { pkg: B, url: "u/B/1.0.0" },
        ]);
        const graph = {
            packages: { A: ["1.0.0"], B: ["1.0.0"] },
            edges: [
                { from: "root", to: "A", range: "^1.0.0" },
                { from: "root", to: "B", range: "^1.0.0" },
            ],
        };
        await assertAgreement(graph, root, registry, fetch);
    }, TIMEOUT);
    test("corpus 2: UNSAT shared-dep (A and B demand incompatible C versions)", async () => {
        // A@1.0.0 dep C>=2.0.0, B@1.0.0 dep C<2.0.0; registry C{1.0.0, 2.0.0}
        const C10 = pkgAt("C", "1.0.0");
        const C20 = pkgAt("C", "2.0.0");
        const A = pkgAt("A", "1.0.0", [regEdge("C", ">=2.0.0")]);
        const B = pkgAt("B", "1.0.0", [regEdge("C", "<2.0.0")]);
        const root = pkgAt("root", "1.0.0", [regEdge("A", "*"), regEdge("B", "*")]);
        const { registry, fetch } = world([
            { pkg: A, url: "u/A/1.0.0" },
            { pkg: B, url: "u/B/1.0.0" },
            { pkg: C10, url: "u/C/1.0.0" },
            { pkg: C20, url: "u/C/2.0.0" },
        ]);
        const graph = {
            packages: { A: ["1.0.0"], B: ["1.0.0"], C: ["1.0.0", "2.0.0"] },
            edges: [
                { from: "root", to: "A", range: "*" },
                { from: "root", to: "B", range: "*" },
                // Version-independent: A's single version requires C>=2.0.0
                { from: "A", to: "C", range: ">=2.0.0" },
                // Version-independent: B's single version requires C<2.0.0
                { from: "B", to: "C", range: "<2.0.0" },
            ],
        };
        await assertAgreement(graph, root, registry, fetch);
    }, TIMEOUT);
    test("corpus 3: SAT with real pick (root→A>=1.2.0; registry A{1.0.0,1.2.0,1.5.0})", async () => {
        const A10 = pkgAt("A", "1.0.0");
        const A12 = pkgAt("A", "1.2.0");
        const A15 = pkgAt("A", "1.5.0");
        const root = pkgAt("root", "1.0.0", [regEdge("A", ">=1.2.0")]);
        const { registry, fetch } = world([
            { pkg: A10, url: "u/A/1.0.0" },
            { pkg: A12, url: "u/A/1.2.0" },
            { pkg: A15, url: "u/A/1.5.0" },
        ]);
        const graph = {
            packages: { A: ["1.0.0", "1.2.0", "1.5.0"] },
            edges: [{ from: "root", to: "A", range: ">=1.2.0" }],
        };
        // Also verify the specific choice is >=1.2.0 (self-consistency check inside assertAgreement).
        await assertAgreement(graph, root, registry, fetch);
    }, TIMEOUT);
});
