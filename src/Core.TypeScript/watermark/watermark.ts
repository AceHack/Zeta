// Watermark — the event-time watermark of Akidau et al. (The Dataflow Model, VLDB 2015), TypeScript oracle.
// Conforms to the F# canonical shape (src/Core/Watermark.fs) by agreeing on the shared seed
// (./golden-vectors.json) that the C#/F#/Rust oracles also verify. All integer arithmetic — no floats,
// byte-lockable in the safe-integer range (the .NET/Rust oracles use int64).

export type Strategy = "monotonic" | "bounded";

/**
 * The WatermarkTracker fold: returns the emitted watermark after each observed event time.
 * maxSeen = running max; candidate = maxSeen (monotonic) or maxSeen - lateness (bounded); clamped
 * monotone non-decreasing. The seed stays within the safe-integer range, so the MinValue sentinel
 * never surfaces in outputs.
 */
export function observe(strategy: Strategy, lateness: number, events: number[]): number[] {
  let maxSeen = Number.NEGATIVE_INFINITY;
  let lastEmitted = Number.NEGATIVE_INFINITY;
  const out: number[] = [];
  for (const e of events) {
    if (e > maxSeen) maxSeen = e;
    const candidate = strategy === "monotonic" ? maxSeen : maxSeen - lateness;
    if (candidate > lastEmitted) lastEmitted = candidate;
    out.push(lastEmitted);
  }
  return out;
}

/** Is eventTime late according to the current watermark? */
export function isLate(wm: number, eventTime: number): boolean {
  return eventTime <= wm;
}

/** Combine per-source watermarks downstream: min (can't progress past the slowest input). */
export function combine(sources: number[]): number {
  let min = Number.POSITIVE_INFINITY;
  let any = false;
  for (const s of sources) {
    any = true;
    if (s < min) min = s;
  }
  return any ? min : Number.NEGATIVE_INFINITY;
}
