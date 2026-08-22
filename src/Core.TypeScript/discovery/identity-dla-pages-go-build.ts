/**
 * Builds Oracle 10's Go WASM substrate for the Pages artifact.
 *
 * WHY THIS EXISTS. `OracleWASM.tsx` shipped seven compiler panels and the seventh —
 * Go — reported a hardcoded `"pending: Pages build does not yet produce the Go
 * module"`. That sentence was accurate: nothing in `pages-deploy.yml` compiled Go, so
 * the panel could never do anything else. This module is the missing half.
 *
 * WHY IT BUILDS THE *BYTELOCK* SOURCE, not `src/wasm-dla/go/main.go`. Both are
 * `//go:build js && wasm` DLA programs, but they are not the same algorithm:
 *
 *   - `src/wasm-dla/bytelock/dla-canonical.go` is the CANONICAL substrate (xorshift32,
 *     circle spawn, kill radius) — the same algorithm the committed WAT and
 *     AssemblyScript modules on this page implement, and the one judged against
 *     `testdata/golden-seed-*.json`. MEASURED 2026-08-17: seed 4, 800 walkers →
 *     cluster 345, byte-identical to the committed `dla-canonical-wat.wasm`.
 *   - `src/wasm-dla/go/main.go` uses the LCG `s = s*1664525 + 1013904223` and takes its
 *     step direction from `s % 4`. An LCG modulo a power of two has period 4 in its low
 *     two bits (multiplier ≡ 1, increment ≡ 3 mod 4), so the direction sequence cycles
 *     through four distinct moves and every walker returns to where it started. MEASURED
 *     the same day: seed 4, 800 walkers → cluster **1**. It does not diffuse.
 *
 * Compiling the second one would have satisfied "Pages produces the Go module" while
 * putting a degenerate point on a chart whose entire claim is that all substrates agree.
 * The canonical source is the one that makes Go a real seventh oracle.
 *
 * WHY `build-substrates.mjs` rather than a fresh `go build` here: it already checks the
 * exit status AND the emitted file's WebAssembly header, so a failed build cannot leave
 * a missing or non-module artefact behind while reporting success. It is the same recipe
 * `bytelock.yml` runs, which means the Pages module and the byte-locked module come from
 * one build path and cannot drift.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

/** Where the built module and the toolchain's own JS bridge land in the source tree. */
export const GO_ORACLE_MODULE = "src/wasm-dla/bytelock/dla-canonical-go.wasm";
export const GO_ORACLE_BRIDGE = "src/wasm-dla/bytelock/wasm-exec-pages.js";

export type GoOracleBuild =
  | Readonly<{ kind: "built"; module: string; bridge: string; moduleBytes: number; goRoot: string }>
  | Readonly<{ kind: "skipped"; reason: string }>;

function goRootOrNull(): string | null {
  const probe = spawnSync("go", ["env", "GOROOT"], { encoding: "utf8" });
  if (probe.error !== undefined || probe.status !== 0) return null;
  const root = (probe.stdout ?? "").trim();
  return root.length > 0 && existsSync(root) ? root : null;
}

/**
 * Builds the Go substrate and copies the bridge out of the SAME toolchain that compiled
 * it.
 *
 * The bridge pairing is not a nicety. `wasm_exec.js` is the Go runtime's own JS half:
 * every import of the module is `gojs.*`, satisfied only by that file, and it is
 * versioned with the compiler. `src/wasm-dla/bytelock/wasm_exec.js` is committed and
 * MEASURED 2026-08-17 to differ from Go 1.26.4's copy (older `fs.constants`, no `path`
 * shim, no `testExport` hooks) — it is a Go 1.22-era file that survived the toolchain
 * bump because nothing compared them. Taking the bridge from `$GOROOT` makes the pairing
 * true by construction instead of true by comment.
 *
 * `required` is the anti-vacuity switch. Locally, a machine with no Go skips and the
 * page then honestly reports the module absent. In `pages-deploy.yml`, where an explicit
 * `actions/setup-go` step guarantees the toolchain, `required` is set — so a broken
 * toolchain step FAILS THE BUILD instead of quietly shipping a six-oracle artifact that
 * looks fine.
 */
export function buildGoWasmOracle(repoRoot: string, required: boolean): GoOracleBuild {
  const goRoot = goRootOrNull();
  if (goRoot === null) {
    if (required) {
      throw new Error(
        "teaching error: the Go toolchain is required for this Pages build (ZETA_PAGES_REQUIRE_GO) but `go env GOROOT` did not answer",
      );
    }
    return { kind: "skipped", reason: "no Go toolchain on PATH — Oracle 10's Go panel will report the module absent" };
  }

  const bytelock = join(repoRoot, "src", "wasm-dla", "bytelock");
  const build = spawnSync("node", ["build-substrates.mjs", "--only=Go"], { cwd: bytelock, stdio: "inherit" });
  if (build.status !== 0) {
    throw new Error(`teaching error: the Go WASM substrate build failed with exit ${String(build.status)}`);
  }

  const modulePath = join(repoRoot, GO_ORACLE_MODULE);
  if (!existsSync(modulePath)) {
    throw new Error(`teaching error: the Go WASM build reported success but produced no ${GO_ORACLE_MODULE}`);
  }

  const bridgeSource = join(goRoot, "lib", "wasm", "wasm_exec.js");
  if (!existsSync(bridgeSource)) {
    throw new Error(`teaching error: this Go toolchain has no JS bridge at ${bridgeSource}`);
  }
  const bridgePath = join(repoRoot, GO_ORACLE_BRIDGE);
  mkdirSync(dirname(bridgePath), { recursive: true });
  copyFileSync(bridgeSource, bridgePath);

  return {
    kind: "built",
    module: GO_ORACLE_MODULE,
    bridge: GO_ORACLE_BRIDGE,
    moduleBytes: statSync(modulePath).size,
    goRoot,
  };
}
