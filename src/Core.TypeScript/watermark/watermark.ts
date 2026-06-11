// Watermark — the event-time watermark of Akidau et al. (The Dataflow Model, VLDB 2015), TypeScript oracle.
// Conforms to the F# canonical shape (src/Core/Watermark.fs) by agreeing on the shared seed
// (./golden-vectors.json) that the C#/F#/Rust oracles also verify. All integer arithmetic — no floats,
// byte-lockable in the safe-integer range (the .NET/Rust oracles use int64).

export type Strategy = "monotonic" | "bounded" | "periodic";

export class Watermark {
  readonly EventTime: number;
  readonly Source: number;
  constructor(eventTime: number, source: number) {
    this.EventTime = eventTime;
    this.Source = source;
  }

  static readonly MinValue = new Watermark(-9223372036854775808, 0);
  static readonly MaxValue = new Watermark(9223372036854775807, 0);
}

export class Timestamped<T> {
  readonly Value: T;
  readonly EventTime: number;
  constructor(value: T, eventTime: number) {
    this.Value = value;
    this.EventTime = eventTime;
  }
}

export type WatermarkStrategy =
  | { readonly type: "monotonic" }
  | { readonly type: "bounded"; readonly maxLatenessMs: number }
  | { readonly type: "periodic"; readonly intervalMs: number; readonly latenessMs: number };

export class WatermarkTracker {
  private _maxSeen = -9223372036854775808;
  private _lastEmitted = -9223372036854775808;
  readonly strategy: WatermarkStrategy;

  constructor(strategy: WatermarkStrategy) {
    this.strategy = strategy;
  }

  private candidateFor(observedMax: number): number {
    switch (this.strategy.type) {
      case "monotonic":
        return observedMax;
      case "bounded": {
        const lateness = this.strategy.maxLatenessMs;
        if (observedMax <= -9223372036854775808 + lateness) {
          return -9223372036854775808;
        }
        return observedMax - lateness;
      }
      case "periodic": {
        const lateness = this.strategy.latenessMs;
        if (observedMax <= -9223372036854775808 + lateness) {
          return -9223372036854775808;
        }
        return observedMax - lateness;
      }
    }
  }

  /**
   * Observe a new event timestamp. Returns the new watermark (may be
   * unchanged from the previous value).
   */
  public Observe(eventTime: number): number {
    if (eventTime > this._maxSeen) {
      this._maxSeen = eventTime;
    }
    const candidate = this.candidateFor(this._maxSeen);
    if (candidate > this._lastEmitted) {
      this._lastEmitted = candidate;
    }
    return this._lastEmitted;
  }

  public get Current(): number {
    return this._lastEmitted;
  }

  public get MaxObserved(): number {
    return this._maxSeen;
  }
}

/**
 * The WatermarkTracker fold: returns the emitted watermark after each observed event time.
 * maxSeen = running max; candidate = maxSeen (monotonic) or maxSeen - lateness (bounded); clamped
 * monotone non-decreasing. The seed stays within the safe-integer range, so the MinValue sentinel
 * never surfaces in outputs.
 */
export function observe(strategy: Strategy, lateness: number, events: number[]): number[] {
  let maxSeen = -9223372036854775808;
  let lastEmitted = -9223372036854775808;
  const out: number[] = [];
  for (const e of events) {
    if (e > maxSeen) maxSeen = e;
    let candidate = maxSeen;
    if (strategy === "bounded" || strategy === "periodic") {
      if (maxSeen <= -9223372036854775808 + lateness) {
        candidate = -9223372036854775808;
      } else {
        candidate = maxSeen - lateness;
      }
    }
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
  let min = 9223372036854775807;
  let any = false;
  for (const s of sources) {
    any = true;
    if (s < min) min = s;
  }
  return any ? min : -9223372036854775808;
}

