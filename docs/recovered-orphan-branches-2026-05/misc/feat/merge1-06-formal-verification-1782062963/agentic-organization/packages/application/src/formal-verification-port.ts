/**
 * Formal-verification seam — TLA+/TLC + Alloy model-checker port.
 *
 * Faithful port of `src/Core.TypeScript/formal-verification/run-tlc.ts`
 * (Merge1 §06). The room gains an optional `formalVerification` seam: real =
 * shell to TLC/Alloy; mock = cached/pass results for DST replay (MP-1). All
 * outcomes are discriminated-union Results (MP-7), never exceptions.
 */

/** The curated TLA+ spec catalogue (port of run-tlc.ts CATALOGUE). */
export const CATALOGUE: readonly string[] = [
  "SmokeCheck",
  "TickMonotonicity",
  "OperatorLifecycleRace",
  "TransactionInterleaving",
  "TwoPCSink",
  "InfoTheoreticSharder",
  "RecursiveCountingLFP",
  "FeatureFlagsResolution",
  "SocietyEmergence",
  "SocietyRuntimeRefinement",
  "DbspSpec",
  "CircuitRegistration",
  "SpineAsyncProtocol",
];

/**
 * TLC exit-code taxonomy (run-tlc.ts `ExitCode`):
 *   0 success · 1 invariant violation · 2 toolchain error · 3 usage error.
 */
export type TlaVerificationResult =
  | { readonly outcome: "pass"; readonly specName: string; readonly durationMs: number }
  | { readonly outcome: "fail"; readonly specName: string; readonly invariant: string; readonly counterexample: string }
  | { readonly outcome: "toolchain_error"; readonly reason: string }
  | { readonly outcome: "usage_error"; readonly reason: string };

export type AlloyVerificationResult =
  | { readonly outcome: "pass"; readonly modelName: string; readonly durationMs: number }
  | { readonly outcome: "fail"; readonly modelName: string; readonly counterexample: string }
  | { readonly outcome: "toolchain_error"; readonly reason: string };

export type ToolchainStatus =
  | { readonly ready: true; readonly javaVersion: string; readonly tlaVersion: string }
  | { readonly ready: false; readonly reason: string };

/** The room's formal-verification seam. */
export interface FormalVerificationPort {
  /** Run TLA+/TLC on a spec. */
  runTla(specName: string): Promise<TlaVerificationResult>;
  /** Run Alloy on a model. */
  runAlloy(modelName: string): Promise<AlloyVerificationResult>;
  /** Check toolchain readiness (java + tla2tools.jar). */
  checkToolchain(): Promise<ToolchainStatus>;
  /** List available specs in the catalogue. */
  listSpecs(): readonly string[];
}

/**
 * Mock formal-verification port for DST. Deterministic: same inputs → same
 * outputs (no clock, no spawn). A spec not present in `cachedResults` passes
 * with `durationMs: 0`. Unknown specs (not in the catalogue) surface a
 * `usage_error` so a catalogue drift is caught.
 */
export function createMockFormalVerification(
  cachedResults?: ReadonlyMap<string, TlaVerificationResult>,
): FormalVerificationPort {
  const known = new Set(CATALOGUE);
  return {
    runTla(specName: string): Promise<TlaVerificationResult> {
      const cached = cachedResults?.get(specName);
      if (cached) return Promise.resolve(cached);
      if (!known.has(specName)) {
        return Promise.resolve({ outcome: "usage_error", reason: `unknown spec: ${specName}` });
      }
      return Promise.resolve({ outcome: "pass", specName, durationMs: 0 });
    },
    runAlloy(modelName: string): Promise<AlloyVerificationResult> {
      return Promise.resolve({ outcome: "pass", modelName, durationMs: 0 });
    },
    checkToolchain(): Promise<ToolchainStatus> {
      return Promise.resolve({ ready: true, javaVersion: "mock", tlaVersion: "mock" });
    },
    listSpecs(): readonly string[] {
      return [...CATALOGUE];
    },
  };
}
