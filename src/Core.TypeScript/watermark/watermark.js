// Watermark — the event-time watermark of Akidau et al. (The Dataflow Model, VLDB 2015), TypeScript oracle.
// Conforms to the F# canonical shape (src/Core/Watermark.fs) by agreeing on the shared seed
// (./golden-vectors.json) that the C#/F#/Rust oracles also verify. All integer arithmetic — no floats,
// byte-lockable in the safe-integer range (the .NET/Rust oracles use int64).
export class Watermark {
    EventTime;
    Source;
    constructor(eventTime, source) {
        this.EventTime = eventTime;
        this.Source = source;
    }
    static MinValue = new Watermark(Number.MIN_SAFE_INTEGER, 0);
    static MaxValue = new Watermark(Number.MAX_SAFE_INTEGER, 0);
}
export class Timestamped {
    Value;
    EventTime;
    constructor(value, eventTime) {
        this.Value = value;
        this.EventTime = eventTime;
    }
}
export class WatermarkTracker {
    _maxSeen = Number.MIN_SAFE_INTEGER;
    _lastEmitted = Number.MIN_SAFE_INTEGER;
    strategy;
    constructor(strategy) {
        this.strategy = strategy;
    }
    candidateFor(observedMax) {
        switch (this.strategy.type) {
            case "monotonic":
                return observedMax;
            case "bounded": {
                const lateness = this.strategy.maxLatenessMs;
                if (observedMax <= Number.MIN_SAFE_INTEGER + lateness) {
                    return Number.MIN_SAFE_INTEGER;
                }
                return observedMax - lateness;
            }
            case "periodic": {
                const lateness = this.strategy.latenessMs;
                if (observedMax <= Number.MIN_SAFE_INTEGER + lateness) {
                    return Number.MIN_SAFE_INTEGER;
                }
                return observedMax - lateness;
            }
        }
    }
    /**
     * Observe a new event timestamp. Returns the new watermark (may be
     * unchanged from the previous value).
     */
    Observe(eventTime) {
        if (eventTime > this._maxSeen) {
            this._maxSeen = eventTime;
        }
        const candidate = this.candidateFor(this._maxSeen);
        if (candidate > this._lastEmitted) {
            this._lastEmitted = candidate;
        }
        return this._lastEmitted;
    }
    get Current() {
        return this._lastEmitted;
    }
    get MaxObserved() {
        return this._maxSeen;
    }
}
/**
 * The WatermarkTracker fold: returns the emitted watermark after each observed event time.
 * maxSeen = running max; candidate = maxSeen (monotonic) or maxSeen - lateness (bounded); clamped
 * monotone non-decreasing. The seed stays within the safe-integer range, so the MinValue sentinel
 * never surfaces in outputs.
 */
export function observe(strategy, lateness, events) {
    let maxSeen = Number.MIN_SAFE_INTEGER;
    let lastEmitted = Number.MIN_SAFE_INTEGER;
    const out = [];
    for (const e of events) {
        if (e > maxSeen)
            maxSeen = e;
        let candidate = maxSeen;
        if (strategy === "bounded" || strategy === "periodic") {
            if (maxSeen <= Number.MIN_SAFE_INTEGER + lateness) {
                candidate = Number.MIN_SAFE_INTEGER;
            }
            else {
                candidate = maxSeen - lateness;
            }
        }
        if (candidate > lastEmitted)
            lastEmitted = candidate;
        out.push(lastEmitted);
    }
    return out;
}
/** Is eventTime late according to the current watermark? */
export function isLate(wm, eventTime) {
    return eventTime <= wm;
}
/** Combine per-source watermarks downstream: min (can't progress past the slowest input). */
export function combine(sources) {
    let min = Number.MAX_SAFE_INTEGER;
    let any = false;
    for (const s of sources) {
        any = true;
        if (s < min)
            min = s;
    }
    return any ? min : Number.MIN_SAFE_INTEGER;
}
