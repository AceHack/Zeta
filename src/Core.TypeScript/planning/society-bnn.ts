/**
 * society-bnn.ts — load, observe, save the society-scale BNN across the 30-minute tick.
 *
 * `bnn-persistence.ts` already knew the path (`docs/observe-events/bnn-state.json`,
 * same G-set as the evolution events). `saveBnnState` / `loadBnnState` had zero
 * callers, so every society tick constructed a fresh prior, published nothing,
 * and `heatReadout.trend` was stuck at `indeterminate` (081M005CGB7087G0R0031328CY).
 *
 * This module solders both ends:
 *   1. load the file, or start from the constructor prior if it is absent
 *   2. absorb THIS generation as one `calibration` observation (not the event log —
 *      re-folding the log would double-count, because the persist format does not
 *      carry the idempotency guard)
 *   3. save only once an observation exists, so the file is never the prior in
 *      disguise
 *
 * The restored belief does not enter `evolve()` — that fold stays a function of
 * the event log. Trend is local display. PriorHints are published only for
 * dimensions with `obsCount > 0` (already the contract of `evidenceBackedPriorHints`).
 *
 * `local-time-never-enters-the-shared-fold`: the path is fixed, not "newest file
 * by mtime". `updatedAt` is metadata. `emittedAt` arrives from the CLI boundary.
 */
import { join } from "node:path";
import {
  deserializeBnn,
  loadBnnState,
  saveBnnState,
  serializeBnn,
  DEFAULT_BNN_STATE_PATH,
} from "../bayesian/bnn-persistence";
import { teachingError, type ErrorSeverity } from "../protocol/error-envelope";
import { absorbError, createDimensionalBnn, type DimensionalBnn } from "./error-bnn-bridge";
import type { Society } from "./society-evolution";

export const SOCIETY_BNN_FILENAME = "bnn-state.json";
export const SOCIETY_BNN_ZID = "society-runner";

export function societyBnnPath(eventDir: string): string {
  return join(eventDir, SOCIETY_BNN_FILENAME);
}

/** Default path named in `bnn-persistence.ts`, kept so the two cannot drift. */
export const SOCIETY_BNN_DEFAULT_PATH = DEFAULT_BNN_STATE_PATH;

export interface LoadedSocietyBnn {
  readonly bnn: DimensionalBnn;
  /** Transport belief from the restored file, only if that dimension has observations. */
  readonly previousTransport?: { readonly mu: number; readonly sigma: number };
  readonly loaded: boolean;
}

export function societyBnnPathOrDefault(eventDir?: string): string {
  return eventDir === undefined ? SOCIETY_BNN_DEFAULT_PATH : societyBnnPath(eventDir);
}

/**
 * Severity of one generation as a calibration observation.
 *
 * Fitness is already the runner's calibration proxy (`mu = min(0.95, fitness)`).
 * The cuts are quartiles of that unit interval, not the heat-band thresholds:
 * below a quarter is a miss (`error`), below half is a weak tick (`warn`),
 * otherwise the society produced a generation (`info`).
 */
export function generationSeverity(meanFitness: number): ErrorSeverity {
  if (!Number.isFinite(meanFitness) || meanFitness < 0.25) return "error";
  if (meanFitness < 0.5) return "warn";
  return "info";
}

export async function loadSocietyBnn(eventDir: string): Promise<LoadedSocietyBnn> {
  const persisted = await loadBnnState(societyBnnPath(eventDir));
  if (persisted === null) {
    return { bnn: createDimensionalBnn(), loaded: false };
  }
  const { bnn } = deserializeBnn(persisted);
  const transport = bnn.states.get("transport");
  // Omit the key when transport has no observations. Under
  // exactOptionalPropertyTypes, `previousTransport?: T` is "absent or T",
  // never "present as undefined". Absence is the persistence meaning:
  // nothing to take a derivative against. An explicit undefined would be
  // a different shape and would not survive a JSON tick boundary anyway.
  if (transport !== undefined && transport.obsCount > 0) {
    return {
      bnn,
      previousTransport: { mu: transport.posterior.mu, sigma: Math.sqrt(transport.posterior.sigma2) },
      loaded: true,
    };
  }
  return { bnn, loaded: true };
}

/**
 * Absorb this generation. Correlation is the event id, so a replay of the same
 * tick is one update (the envelope guard), and a later tick with a new id is
 * another. Returns whether a new observation landed.
 */
export function absorbGeneration(
  bnn: DimensionalBnn,
  society: Pick<Society, "generation" | "meanFitness" | "geneticDiversity">,
  generationId: string,
  emittedAt: string,
): boolean {
  const envelope = teachingError(
    generationId,
    {
      what: `society.generation.${society.generation}`,
      why: `meanFitness=${society.meanFitness.toFixed(6)} diversity=${society.geneticDiversity.toFixed(6)}`,
      howToFix: "inspect docs/observe-events for the generation event; do not republish a prior",
      dimension: "calibration",
      severity: generationSeverity(society.meanFitness),
      teacherZid: SOCIETY_BNN_ZID,
    },
    emittedAt,
  );
  return absorbError(bnn, envelope) !== null;
}

/** Persist only if something has been absorbed — never write the constructor prior. */
export async function saveSocietyBnn(bnn: DimensionalBnn, eventDir: string): Promise<boolean> {
  let total = 0;
  for (const state of bnn.states.values()) total += state.obsCount;
  if (total === 0) return false;
  await saveBnnState(serializeBnn(bnn, SOCIETY_BNN_ZID), societyBnnPath(eventDir));
  return true;
}
