/**
 * priority-config.test.ts — unit tests for PriorityFerryThrottlerConfig types
 * and validatePriorityConfig.
 */
import { describe, expect, it } from "bun:test";
import { DETERMINISTIC_PRIORITY_CONFIG, validatePriorityConfig, } from "./priority-config";
// ─── DETERMINISTIC_PRIORITY_CONFIG shape ────────────────────────────────────
describe("DETERMINISTIC_PRIORITY_CONFIG", () => {
    it("has maxDegreeOfParallelism = 1", () => {
        expect(DETERMINISTIC_PRIORITY_CONFIG.maxDegreeOfParallelism).toBe(1);
    });
    it("has 2 lanes", () => {
        expect(DETERMINISTIC_PRIORITY_CONFIG.lanes).toHaveLength(2);
    });
    it("has strict draining policy", () => {
        expect(DETERMINISTIC_PRIORITY_CONFIG.drainingPolicy.kind).toBe("strict");
    });
    it("has defaultPriority = 1 (low lane)", () => {
        expect(DETERMINISTIC_PRIORITY_CONFIG.defaultPriority).toBe(1);
    });
    it("has defaultMaxBatchSize = 256", () => {
        expect(DETERMINISTIC_PRIORITY_CONFIG.defaultMaxBatchSize).toBe(256);
    });
    it("lane priorities are 0 (high) and 1 (low)", () => {
        expect(DETERMINISTIC_PRIORITY_CONFIG.lanes[0].priority).toBe(0);
        expect(DETERMINISTIC_PRIORITY_CONFIG.lanes[1].priority).toBe(1);
    });
    it("passes validation without throwing", () => {
        expect(() => validatePriorityConfig(DETERMINISTIC_PRIORITY_CONFIG)).not.toThrow();
    });
});
// ─── Valid configs ──────────────────────────────────────────────────────────
describe("validatePriorityConfig — valid configs", () => {
    it("accepts a minimal single-lane strict config", () => {
        const config = {
            maxDegreeOfParallelism: 1,
            defaultMaxBatchSize: 1,
            defaultMaxBatchBytes: undefined,
            lanes: [{ priority: 0 }],
            defaultPriority: 0,
            drainingPolicy: { kind: "strict" },
        };
        expect(() => validatePriorityConfig(config)).not.toThrow();
    });
    it("accepts a multi-lane weighted-fair config with weights", () => {
        const weights = new Map([[0, 3], [1, 2], [2, 1]]);
        const policy = { kind: "weighted-fair", weights };
        const config = {
            maxDegreeOfParallelism: 4,
            defaultMaxBatchSize: 128,
            defaultMaxBatchBytes: 65536,
            lanes: [
                { priority: 0, weight: 3, maxBatchSize: 64 },
                { priority: 1, weight: 2, maxBatchBytes: 32768 },
                { priority: 2, weight: 1, maxQueueSize: 1000 },
            ],
            defaultPriority: 1,
            drainingPolicy: policy,
        };
        expect(() => validatePriorityConfig(config)).not.toThrow();
    });
    it("accepts config with all per-lane overrides set", () => {
        const config = {
            maxDegreeOfParallelism: 2,
            defaultMaxBatchSize: 100,
            defaultMaxBatchBytes: 4096,
            lanes: [
                { priority: 10, maxBatchSize: 50, maxBatchBytes: 2048, maxQueueSize: 500 },
            ],
            defaultPriority: 10,
            drainingPolicy: { kind: "strict" },
        };
        expect(() => validatePriorityConfig(config)).not.toThrow();
    });
});
// ─── Invalid configs ────────────────────────────────────────────────────────
describe("validatePriorityConfig — invalid configs", () => {
    function baseConfig(overrides = {}) {
        return {
            maxDegreeOfParallelism: 2,
            defaultMaxBatchSize: 128,
            defaultMaxBatchBytes: undefined,
            lanes: [{ priority: 0 }, { priority: 1 }],
            defaultPriority: 0,
            drainingPolicy: { kind: "strict" },
            ...overrides,
        };
    }
    it("throws RangeError when maxDegreeOfParallelism < 1", () => {
        expect(() => validatePriorityConfig(baseConfig({ maxDegreeOfParallelism: 0 }))).toThrow(RangeError);
        expect(() => validatePriorityConfig(baseConfig({ maxDegreeOfParallelism: -1 }))).toThrow(RangeError);
    });
    it("throws RangeError when lanes is empty", () => {
        expect(() => validatePriorityConfig(baseConfig({ lanes: [] }))).toThrow(RangeError);
        expect(() => validatePriorityConfig(baseConfig({ lanes: [] }))).toThrow(/at least one lane/);
    });
    it("throws RangeError on duplicate priority levels", () => {
        const config = baseConfig({ lanes: [{ priority: 5 }, { priority: 5 }] });
        expect(() => validatePriorityConfig(config)).toThrow(RangeError);
        expect(() => validatePriorityConfig(config)).toThrow(/duplicate priority/);
    });
    it("throws RangeError when defaultMaxBatchSize < 1", () => {
        expect(() => validatePriorityConfig(baseConfig({ defaultMaxBatchSize: 0 }))).toThrow(RangeError);
        expect(() => validatePriorityConfig(baseConfig({ defaultMaxBatchSize: -5 }))).toThrow(RangeError);
    });
    it("throws RangeError when defaultMaxBatchBytes is defined and < 1", () => {
        expect(() => validatePriorityConfig(baseConfig({ defaultMaxBatchBytes: 0 }))).toThrow(RangeError);
        expect(() => validatePriorityConfig(baseConfig({ defaultMaxBatchBytes: -1 }))).toThrow(RangeError);
    });
    it("throws RangeError when a lane's maxBatchSize is defined and < 1", () => {
        const config = baseConfig({ lanes: [{ priority: 0, maxBatchSize: 0 }, { priority: 1 }] });
        expect(() => validatePriorityConfig(config)).toThrow(RangeError);
        expect(() => validatePriorityConfig(config)).toThrow(/maxBatchSize/);
    });
    it("throws RangeError when a lane's maxBatchBytes is defined and < 1", () => {
        const config = baseConfig({ lanes: [{ priority: 0, maxBatchBytes: -1 }, { priority: 1 }] });
        expect(() => validatePriorityConfig(config)).toThrow(RangeError);
        expect(() => validatePriorityConfig(config)).toThrow(/maxBatchBytes/);
    });
    it("throws RangeError when a lane's maxQueueSize is defined and < 1", () => {
        const config = baseConfig({ lanes: [{ priority: 0, maxQueueSize: 0 }, { priority: 1 }] });
        expect(() => validatePriorityConfig(config)).toThrow(RangeError);
        expect(() => validatePriorityConfig(config)).toThrow(/maxQueueSize/);
    });
    it("throws RangeError when defaultPriority doesn't match any lane", () => {
        const config = baseConfig({ defaultPriority: 99 });
        expect(() => validatePriorityConfig(config)).toThrow(RangeError);
        expect(() => validatePriorityConfig(config)).toThrow(/does not match/);
    });
    it("throws RangeError when weighted-fair policy but lane is missing weight", () => {
        const weights = new Map([[0, 1], [1, 2]]);
        const config = baseConfig({
            lanes: [{ priority: 0, weight: 1 }, { priority: 1 }], // lane 1 missing weight
            drainingPolicy: { kind: "weighted-fair", weights },
        });
        expect(() => validatePriorityConfig(config)).toThrow(RangeError);
        expect(() => validatePriorityConfig(config)).toThrow(/weight must be > 0/);
    });
    it("throws RangeError when weighted-fair policy but lane has weight <= 0", () => {
        const weights = new Map([[0, 1], [1, 0]]);
        const config = baseConfig({
            lanes: [{ priority: 0, weight: 1 }, { priority: 1, weight: 0 }],
            drainingPolicy: { kind: "weighted-fair", weights },
        });
        expect(() => validatePriorityConfig(config)).toThrow(RangeError);
        expect(() => validatePriorityConfig(config)).toThrow(/weight must be > 0/);
    });
    it("throws RangeError with negative weight on weighted-fair", () => {
        const weights = new Map([[0, 1], [1, -2]]);
        const config = baseConfig({
            lanes: [{ priority: 0, weight: 1 }, { priority: 1, weight: -2 }],
            drainingPolicy: { kind: "weighted-fair", weights },
        });
        expect(() => validatePriorityConfig(config)).toThrow(RangeError);
        expect(() => validatePriorityConfig(config)).toThrow(/weight must be > 0/);
    });
});
// ─── Serialization round-trip ───────────────────────────────────────────────
import { serializeConfig, deserializeConfig } from "./priority-config";
describe("serializeConfig / deserializeConfig", () => {
    it("round-trips DETERMINISTIC_PRIORITY_CONFIG with deep equality", () => {
        const json = serializeConfig(DETERMINISTIC_PRIORITY_CONFIG);
        const restored = deserializeConfig(json);
        expect(restored.maxDegreeOfParallelism).toBe(DETERMINISTIC_PRIORITY_CONFIG.maxDegreeOfParallelism);
        expect(restored.defaultMaxBatchSize).toBe(DETERMINISTIC_PRIORITY_CONFIG.defaultMaxBatchSize);
        expect(restored.defaultMaxBatchBytes).toBe(DETERMINISTIC_PRIORITY_CONFIG.defaultMaxBatchBytes);
        expect(restored.defaultPriority).toBe(DETERMINISTIC_PRIORITY_CONFIG.defaultPriority);
        expect(restored.drainingPolicy).toEqual(DETERMINISTIC_PRIORITY_CONFIG.drainingPolicy);
        expect(restored.lanes).toEqual(DETERMINISTIC_PRIORITY_CONFIG.lanes);
    });
    it("round-trips a weighted-fair config with 3 lanes including the Map", () => {
        const weights = new Map([[0, 5], [1, 3], [2, 1]]);
        const original = {
            maxDegreeOfParallelism: 3,
            defaultMaxBatchSize: 64,
            defaultMaxBatchBytes: 8192,
            lanes: [
                { priority: 0, weight: 5, maxBatchSize: 32 },
                { priority: 1, weight: 3, maxQueueSize: 500 },
                { priority: 2, weight: 1, maxBatchBytes: 4096 },
            ],
            defaultPriority: 1,
            drainingPolicy: { kind: "weighted-fair", weights },
        };
        const json = serializeConfig(original);
        const restored = deserializeConfig(json);
        expect(restored.maxDegreeOfParallelism).toBe(3);
        expect(restored.defaultMaxBatchSize).toBe(64);
        expect(restored.defaultMaxBatchBytes).toBe(8192);
        expect(restored.defaultPriority).toBe(1);
        expect(restored.lanes).toEqual(original.lanes);
        expect(restored.drainingPolicy.kind).toBe("weighted-fair");
        // Verify the Map was correctly reconstructed
        const restoredPolicy = restored.drainingPolicy;
        expect(restoredPolicy.weights).toBeInstanceOf(Map);
        expect(restoredPolicy.weights.size).toBe(3);
        expect(restoredPolicy.weights.get(0)).toBe(5);
        expect(restoredPolicy.weights.get(1)).toBe(3);
        expect(restoredPolicy.weights.get(2)).toBe(1);
    });
    it("throws on malformed JSON", () => {
        expect(() => deserializeConfig("not json")).toThrow("Invalid config JSON");
    });
    it("throws on missing required fields (empty object)", () => {
        expect(() => deserializeConfig("{}")).toThrow("Invalid config JSON");
    });
    it("throws when lanes is not an array", () => {
        const bad = JSON.stringify({
            maxDegreeOfParallelism: 1,
            defaultMaxBatchSize: 128,
            defaultPriority: 0,
            lanes: "not-an-array",
            drainingPolicy: { kind: "strict" },
        });
        expect(() => deserializeConfig(bad)).toThrow("Invalid config JSON");
    });
});
