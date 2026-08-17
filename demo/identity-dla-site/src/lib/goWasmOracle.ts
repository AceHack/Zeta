/**
 * Go WASM oracle availability — DERIVED FROM THE ARTIFACT, never asserted.
 *
 * Oracle 10's Go substrate is the one module that is NOT committed: at ~1.9 MB it is
 * built during the Pages build (`actions/setup-go` → `build-substrates.mjs --only=Go`)
 * and staged into the artifact. That makes its presence a *runtime fact about the
 * deployed artifact*, not a property of the source tree — so the page must ask the
 * artifact rather than carry a hardcoded verdict.
 *
 * Before this module, `OracleWASM.tsx` carried the opposite of a hardcoded "ready":
 * a hardcoded `"pending: Pages build does not yet produce the Go module"`, which was
 * true when written and would have stayed on screen forever after the build started
 * producing it. Both directions are the same defect — a status that cannot change when
 * the thing it describes changes. `probeGoOracle` is the fix in the only form that
 * survives: it reports what it found, and it finds it by fetching.
 *
 * Two files must BOTH be present, and the pairing is not incidental:
 *   - `wasm/dla-go.wasm`   the module (Go runtime + DLA kernel)
 *   - `wasm/wasm_exec.js`  the Go runtime's own JS bridge, emitted by the same
 *                          toolchain version that compiled the module
 * A module without its bridge cannot instantiate (its imports are all `gojs.*`), and a
 * bridge without a module has nothing to run — so "available" means the pair, and a
 * half-staged artifact reports unavailable rather than failing mid-run.
 */

/** A neutral fact about the artifact — the caller decides how to render it. */
export type GoOracleAvailability =
  | Readonly<{ available: true; moduleBytes: ArrayBuffer; bridgeSource: string }>
  | Readonly<{ available: false; reason: string }>;

export type FetchLike = (input: string) => Promise<{ readonly ok: boolean; readonly status: number; arrayBuffer(): Promise<ArrayBuffer>; text(): Promise<string> }>;

const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d] as const;

function hasWasmMagic(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < WASM_MAGIC.length) return false;
  const head = new Uint8Array(bytes, 0, WASM_MAGIC.length);
  return WASM_MAGIC.every((value, index) => head[index] === value);
}

/**
 * Asks the deployed artifact whether the Go oracle shipped.
 *
 * Every negative branch names WHICH half is missing, because "pending" without a
 * subject is what let the old hardcoded string survive unexamined for so long.
 */
export async function probeGoOracle(
  fetchImpl: FetchLike,
  moduleUrl: string,
  bridgeUrl: string,
): Promise<GoOracleAvailability> {
  let moduleBytes: ArrayBuffer;
  try {
    const response = await fetchImpl(moduleUrl);
    if (!response.ok) {
      return { available: false, reason: `pending: Pages artifact has no Go module at ${moduleUrl} (HTTP ${String(response.status)})` };
    }
    moduleBytes = await response.arrayBuffer();
  } catch (error) {
    return { available: false, reason: `pending: Go module fetch failed at ${moduleUrl} (${String(error)})` };
  }

  // A 404 that a host answers with an HTML error page is `ok: true` on some static
  // hosts. The magic check is what makes "present" mean "a WebAssembly module".
  if (!hasWasmMagic(moduleBytes)) {
    return { available: false, reason: `teaching error: ${moduleUrl} is not a WebAssembly module (${String(moduleBytes.byteLength)} bytes)` };
  }

  let bridgeSource: string;
  try {
    const response = await fetchImpl(bridgeUrl);
    if (!response.ok) {
      return { available: false, reason: `pending: Go module shipped without its runtime bridge at ${bridgeUrl} (HTTP ${String(response.status)})` };
    }
    bridgeSource = await response.text();
  } catch (error) {
    return { available: false, reason: `pending: Go runtime bridge fetch failed at ${bridgeUrl} (${String(error)})` };
  }

  // `wasm_exec.js` is a classic script whose whole job is to define `globalThis.Go`.
  // If what came back does not define it, evaluating it would fail later with a
  // confusing `Go is not a constructor`; say so here instead.
  if (!bridgeSource.includes("globalThis.Go")) {
    return { available: false, reason: `teaching error: ${bridgeUrl} does not define the Go runtime bridge` };
  }

  return { available: true, moduleBytes, bridgeSource };
}

/**
 * Evaluates the bridge into the page realm exactly once.
 *
 * `wasm_exec.js` ships as a classic script — its entire contract is the side effect
 * `globalThis.Go = class Go {…}` — so it is evaluated rather than imported. The realm is
 * injected as a *parameter named `globalThis`*, which shadows the real global binding
 * inside the evaluated body. In the page that parameter IS `globalThis`, so behaviour
 * matches a `<script>` tag exactly; in a test it is a plain object, which is what makes
 * this branch falsifiable instead of unreachable inside a component.
 *
 * KNOWN LIMIT: `new Function` needs `script-src 'unsafe-eval'`. The site ships no CSP
 * (checked 2026-08-17 — no meta tag, and GitHub Pages sets no policy header), so this
 * works today. If a policy is ever added, this becomes an injected `<script src>` tag
 * and the probe keeps its fetch only for the availability check.
 */
export function installGoRuntimeBridge(
  bridgeSource: string,
  realm: Record<string, unknown> = globalThis as unknown as Record<string, unknown>,
): void {
  if (typeof realm["Go"] === "function") return;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function("globalThis", bridgeSource)(realm);
  if (typeof realm["Go"] !== "function") {
    throw new Error("teaching error: the Go runtime bridge evaluated without defining Go");
  }
}

/**
 * The DLA reading, once the module has run.
 *
 * `clusterSize < 2` is NOT rendered as `D_f = 0.000`: a cluster that never grew has no
 * fractal dimension to report, and printing a number there would manufacture a Z-7
 * datapoint out of a failure. It is a degenerate run and says so.
 */
export type GoOracleReading =
  | Readonly<{ kind: "measured"; clusterSize: number; df: number }>
  | Readonly<{ kind: "degenerate"; clusterSize: number; reason: string }>;

export function readGoOracle(clusterSize: number, computeDf: (size: number) => number): GoOracleReading {
  if (!Number.isFinite(clusterSize) || clusterSize < 2) {
    return {
      kind: "degenerate",
      clusterSize,
      reason: `Go module ran but the cluster did not grow (size ${String(clusterSize)}) — no D_f`,
    };
  }
  return { kind: "measured", clusterSize, df: computeDf(clusterSize) };
}
