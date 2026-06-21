/**
 * priority-config.ts — configuration types and validation for PriorityFerryThrottler.
 *
 * Defines the lane-based priority model: N lanes with distinct priority levels,
 * a shared ferry pool (`maxDegreeOfParallelism`), and a draining policy that
 * controls how ferries pick work across lanes (strict = highest priority first;
 * weighted-fair = proportional to assigned weights).
 *
 * The `DETERMINISTIC_PRIORITY_CONFIG` constant gives a single-ferry, two-lane,
 * strict-draining setup suitable for deterministic simulation testing (DST).
 */
// ─── Deterministic default ──────────────────────────────────────────────────
/** Deterministic two-lane config for DST replay: one ferry, strict draining. */
export const DETERMINISTIC_PRIORITY_CONFIG = {
    maxDegreeOfParallelism: 1,
    defaultMaxBatchSize: 256,
    defaultMaxBatchBytes: undefined,
    lanes: [
        { priority: 0 }, // high
        { priority: 1 }, // low
    ],
    defaultPriority: 1,
    drainingPolicy: { kind: "strict" },
};
// ─── Validation ─────────────────────────────────────────────────────────────
/**
 * Validates a PriorityFerryThrottlerConfig, throwing `RangeError` on any
 * constraint violation. Call this at construction time before building the
 * throttler's internal state.
 */
export function validatePriorityConfig(config) {
    if (config.maxDegreeOfParallelism < 1) {
        throw new RangeError("maxDegreeOfParallelism must be >= 1");
    }
    if (config.defaultMaxBatchSize < 1) {
        throw new RangeError("defaultMaxBatchSize must be >= 1");
    }
    if (config.defaultMaxBatchBytes !== undefined && config.defaultMaxBatchBytes < 1) {
        throw new RangeError("defaultMaxBatchBytes, if set, must be >= 1");
    }
    if (config.lanes.length === 0) {
        throw new RangeError("lanes must contain at least one lane");
    }
    // Check for duplicate priorities
    const seen = new Set();
    for (const lane of config.lanes) {
        if (seen.has(lane.priority)) {
            throw new RangeError(`duplicate priority level: ${lane.priority}`);
        }
        seen.add(lane.priority);
    }
    // Per-lane field validation
    for (const lane of config.lanes) {
        if (lane.maxBatchSize !== undefined && lane.maxBatchSize < 1) {
            throw new RangeError(`lane priority=${lane.priority}: maxBatchSize, if set, must be >= 1`);
        }
        if (lane.maxBatchBytes !== undefined && lane.maxBatchBytes < 1) {
            throw new RangeError(`lane priority=${lane.priority}: maxBatchBytes, if set, must be >= 1`);
        }
        if (lane.maxQueueSize !== undefined && lane.maxQueueSize < 1) {
            throw new RangeError(`lane priority=${lane.priority}: maxQueueSize, if set, must be >= 1`);
        }
    }
    // defaultPriority must match a lane
    if (!config.lanes.some((lane) => lane.priority === config.defaultPriority)) {
        throw new RangeError(`defaultPriority ${config.defaultPriority} does not match any lane's priority`);
    }
    // Weighted-fair policy requires every lane to have a positive weight
    if (config.drainingPolicy.kind === "weighted-fair") {
        for (const lane of config.lanes) {
            if (lane.weight === undefined || lane.weight <= 0) {
                throw new RangeError(`lane priority=${lane.priority}: weight must be > 0 when draining policy is weighted-fair`);
            }
        }
    }
}
/**
 * Serialize a `PriorityFerryThrottlerConfig` to a JSON string.
 *
 * The `ReadonlyMap<PriorityLevel, number>` in weighted-fair's `weights` is
 * serialized as a plain object `{ [priority: string]: number }`.
 */
export function serializeConfig(config) {
    let plainPolicy;
    if (config.drainingPolicy.kind === "strict") {
        plainPolicy = { kind: "strict" };
    }
    else {
        const weightsObj = {};
        for (const [key, value] of config.drainingPolicy.weights) {
            weightsObj[String(key)] = value;
        }
        plainPolicy = { kind: "weighted-fair", weights: weightsObj };
    }
    const plain = {
        maxDegreeOfParallelism: config.maxDegreeOfParallelism,
        defaultMaxBatchSize: config.defaultMaxBatchSize,
        ...(config.defaultMaxBatchBytes !== undefined ? { defaultMaxBatchBytes: config.defaultMaxBatchBytes } : {}),
        lanes: config.lanes.map((lane) => {
            const out = { priority: lane.priority };
            if (lane.maxBatchSize !== undefined)
                out["maxBatchSize"] = lane.maxBatchSize;
            if (lane.maxBatchBytes !== undefined)
                out["maxBatchBytes"] = lane.maxBatchBytes;
            if (lane.maxQueueSize !== undefined)
                out["maxQueueSize"] = lane.maxQueueSize;
            if (lane.weight !== undefined)
                out["weight"] = lane.weight;
            return out;
        }),
        defaultPriority: config.defaultPriority,
        drainingPolicy: plainPolicy,
    };
    return JSON.stringify(plain);
}
/**
 * Deserialize a JSON string into a `PriorityFerryThrottlerConfig`.
 *
 * Throws `Error("Invalid config JSON: <reason>")` if the JSON is malformed,
 * missing required fields, or contains wrong types. After reconstruction,
 * calls `validatePriorityConfig()` to enforce domain constraints.
 */
export function deserializeConfig(json) {
    let raw;
    try {
        raw = JSON.parse(json);
    }
    catch {
        throw new Error("Invalid config JSON: malformed JSON");
    }
    if (raw === null || typeof raw !== "object") {
        throw new Error("Invalid config JSON: expected an object");
    }
    const obj = raw;
    // Required top-level fields
    if (typeof obj["maxDegreeOfParallelism"] !== "number") {
        throw new Error("Invalid config JSON: maxDegreeOfParallelism must be a number");
    }
    if (typeof obj["defaultMaxBatchSize"] !== "number") {
        throw new Error("Invalid config JSON: defaultMaxBatchSize must be a number");
    }
    if (typeof obj["defaultPriority"] !== "number") {
        throw new Error("Invalid config JSON: defaultPriority must be a number");
    }
    // Optional defaultMaxBatchBytes
    if (obj["defaultMaxBatchBytes"] !== undefined && obj["defaultMaxBatchBytes"] !== null && typeof obj["defaultMaxBatchBytes"] !== "number") {
        throw new Error("Invalid config JSON: defaultMaxBatchBytes must be a number or undefined");
    }
    // lanes
    if (!Array.isArray(obj["lanes"])) {
        throw new Error("Invalid config JSON: lanes must be an array");
    }
    const lanes = [];
    for (let i = 0; i < obj["lanes"].length; i++) {
        const laneRaw = obj["lanes"][i];
        if (laneRaw === null || typeof laneRaw !== "object") {
            throw new Error(`Invalid config JSON: lanes[${String(i)}] must be an object`);
        }
        const l = laneRaw;
        if (typeof l["priority"] !== "number") {
            throw new Error(`Invalid config JSON: lanes[${String(i)}].priority must be a number`);
        }
        const lane = {
            priority: l["priority"],
            maxBatchSize: typeof l["maxBatchSize"] === "number" ? l["maxBatchSize"] : undefined,
            maxBatchBytes: typeof l["maxBatchBytes"] === "number" ? l["maxBatchBytes"] : undefined,
            maxQueueSize: typeof l["maxQueueSize"] === "number" ? l["maxQueueSize"] : undefined,
            weight: typeof l["weight"] === "number" ? l["weight"] : undefined,
        };
        lanes.push(lane);
    }
    // drainingPolicy
    if (obj["drainingPolicy"] === null || obj["drainingPolicy"] === undefined || typeof obj["drainingPolicy"] !== "object") {
        throw new Error("Invalid config JSON: drainingPolicy must be an object");
    }
    const policyRaw = obj["drainingPolicy"];
    if (policyRaw["kind"] !== "strict" && policyRaw["kind"] !== "weighted-fair") {
        throw new Error("Invalid config JSON: drainingPolicy.kind must be 'strict' or 'weighted-fair'");
    }
    let drainingPolicy;
    if (policyRaw["kind"] === "strict") {
        drainingPolicy = { kind: "strict" };
    }
    else {
        if (policyRaw["weights"] === null || policyRaw["weights"] === undefined || typeof policyRaw["weights"] !== "object" || Array.isArray(policyRaw["weights"])) {
            throw new Error("Invalid config JSON: drainingPolicy.weights must be an object");
        }
        const weightsRaw = policyRaw["weights"];
        const weights = new Map();
        for (const [key, value] of Object.entries(weightsRaw)) {
            const numKey = Number(key);
            if (!Number.isFinite(numKey)) {
                throw new Error(`Invalid config JSON: drainingPolicy.weights key '${key}' is not a valid number`);
            }
            if (typeof value !== "number") {
                throw new Error(`Invalid config JSON: drainingPolicy.weights['${key}'] must be a number`);
            }
            weights.set(numKey, value);
        }
        drainingPolicy = { kind: "weighted-fair", weights };
    }
    const config = {
        maxDegreeOfParallelism: obj["maxDegreeOfParallelism"],
        defaultMaxBatchSize: obj["defaultMaxBatchSize"],
        defaultMaxBatchBytes: typeof obj["defaultMaxBatchBytes"] === "number" ? obj["defaultMaxBatchBytes"] : undefined,
        lanes,
        defaultPriority: obj["defaultPriority"],
        drainingPolicy,
    };
    // Validate the reconstructed config (throws RangeError on constraint violation)
    validatePriorityConfig(config);
    return config;
}
