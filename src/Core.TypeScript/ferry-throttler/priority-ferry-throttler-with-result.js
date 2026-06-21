/**
 * priority-ferry-throttler-with-result.ts — multi-lane priority ferry throttler (request/response arity).
 *
 * Composes N lane queues (one `InternalChannel<FerryRequest<T, R>>` per lane), a
 * `LaneNotifier` for shared notification when any lane gets work, a `DrainScheduler`
 * that picks which lane to drain, and M ferry loops (shared ferry pool).
 *
 * Each lane has its own backpressure (bounded queue), batch size, and byte budget.
 * Ferries are self-clocked, anti-Nagle: they drain whatever is available NOW,
 * never wait to fill a boat.
 *
 * At `maxDegreeOfParallelism = 1` with strict draining, this is deterministic and
 * DST-replayable — the FoundationDB single-thread shape extended to priority lanes,
 * with per-item result alignment.
 */
import { createInternalChannel } from "./internal-channel.js";
import { createLaneNotifier } from "./lane-notifier.js";
import { createStrictPriorityScheduler, createWeightedFairScheduler, } from "./drain-scheduler.js";
import { validatePriorityConfig } from "./priority-config.js";
// ─── PriorityFerryThrottlerWithResult ───────────────────────────────────────
/**
 * Multi-lane priority ferry throttler — request/response arity.
 *
 * Producers call `process(item, priority?, signal?)` and receive a promise that
 * resolves with the item's aligned result once the boat containing it is
 * processed. Boats are batched per-lane with configurable max-batch-size and
 * byte budget. Ferries drain lanes according to the configured draining policy
 * (strict priority or weighted-fair).
 */
export class PriorityFerryThrottlerWithResult {
    _lanes;
    _priorityToLane;
    _scheduler;
    _notifier;
    _abortController;
    _ferryTasks;
    _sizeOf;
    _config;
    _processBatch;
    constructor(config, processBatch, itemSizeBytes) {
        // 1. Validate config
        validatePriorityConfig(config);
        // 2. Check byte budget requires sizer
        if (config.defaultMaxBatchBytes !== undefined && itemSizeBytes === undefined) {
            throw new RangeError("itemSizeBytes is required when defaultMaxBatchBytes is set");
        }
        for (const lane of config.lanes) {
            if (lane.maxBatchBytes !== undefined && itemSizeBytes === undefined) {
                throw new RangeError("itemSizeBytes is required when any lane sets maxBatchBytes");
            }
        }
        this._config = config;
        this._processBatch = processBatch;
        this._sizeOf = itemSizeBytes ?? (() => 0);
        // 3. Create lanes sorted by priority ascending (index 0 = highest priority)
        const sortedLanes = [...config.lanes].sort((a, b) => a.priority - b.priority);
        this._lanes = sortedLanes.map((laneCfg) => ({
            channel: createInternalChannel(laneCfg.maxQueueSize),
            maxBatchSize: laneCfg.maxBatchSize ?? config.defaultMaxBatchSize,
            maxBatchBytes: laneCfg.maxBatchBytes ?? config.defaultMaxBatchBytes,
            priority: laneCfg.priority,
            bytesQueued: 0,
            drainCount: 0,
            pending: undefined,
        }));
        // Build priority → lane index map
        this._priorityToLane = new Map();
        for (let i = 0; i < this._lanes.length; i++) {
            const lane = this._lanes[i];
            this._priorityToLane.set(lane.priority, i);
        }
        // 4. Create DrainScheduler
        if (config.drainingPolicy.kind === "strict") {
            this._scheduler = createStrictPriorityScheduler();
        }
        else {
            const weights = sortedLanes.map((l) => l.weight);
            this._scheduler = createWeightedFairScheduler(weights);
        }
        // 5. Create LaneNotifier
        this._notifier = createLaneNotifier();
        // 6. Create AbortController for ferry cancellation
        this._abortController = new AbortController();
        // 7. Start ferry loops
        this._ferryTasks = Array.from({ length: config.maxDegreeOfParallelism }, () => this._runFerry());
    }
    // ─── Ferry loop ─────────────────────────────────────────────────────────
    _allChannelsClosed = false;
    async _runFerry() {
        const signal = this._abortController.signal;
        try {
            while (true) {
                // Check if any lane has work right now (level-triggered check)
                const laneIndex = this._selectReadyLane();
                if (laneIndex !== -1) {
                    // Collect a boat from the selected lane
                    const { items, requests, bytes } = this._collectBoat(laneIndex);
                    if (items.length > 0) {
                        try {
                            const results = await this._processBatch(items, signal);
                            if (results.length !== items.length) {
                                const ex = new Error(`PriorityFerryThrottlerWithResult result count mismatch: processor returned ${String(results.length)} results for ${String(items.length)} items.`);
                                for (const r of requests)
                                    r.reject(ex);
                            }
                            else {
                                for (let i = 0; i < results.length; i++) {
                                    requests[i].resolve(results[i]);
                                }
                            }
                        }
                        catch (e) {
                            if (isAbortError(e)) {
                                for (const r of requests)
                                    r.reject(new AbortError());
                            }
                            else {
                                for (const r of requests)
                                    r.reject(e);
                            }
                        }
                        this._scheduler.recordDrain(laneIndex, items.length, bytes);
                        const lane = this._lanes[laneIndex];
                        lane.drainCount++;
                        lane.bytesQueued -= bytes;
                    }
                    continue; // Check for more work immediately
                }
                // No work available — check if all lanes are completed
                if (this._allChannelsClosed && this._allLanesEmpty())
                    break;
                // Wait until any lane has work or channels close
                await this._notifier.wait(signal);
            }
        }
        catch (e) {
            if (!isAbortError(e))
                throw e;
        }
    }
    _selectReadyLane() {
        const snapshots = this._lanes.map((lane) => ({
            hasWork: lane.pending !== undefined || lane.channel.queueDepth > 0,
            queueDepth: lane.channel.queueDepth + (lane.pending !== undefined ? 1 : 0),
            bytesQueued: lane.bytesQueued,
            drainCount: lane.drainCount,
        }));
        return this._scheduler.selectLane(snapshots);
    }
    _allLanesEmpty() {
        for (const lane of this._lanes) {
            if (lane.pending !== undefined || lane.channel.queueDepth > 0)
                return false;
        }
        return true;
    }
    // ─── collectBoat logic ──────────────────────────────────────────────────
    _collectBoat(laneIndex) {
        const lane = this._lanes[laneIndex];
        const maxBatch = lane.maxBatchSize;
        const byteBudget = lane.maxBatchBytes;
        const items = [];
        const requests = [];
        let bytes = 0;
        // Start with any pending request deferred from previous boat
        if (lane.pending !== undefined) {
            const req = lane.pending;
            lane.pending = undefined;
            if (!req.cancelled) {
                const sz = this._trySizeRequest(req);
                if (sz !== undefined) {
                    items.push(req.item);
                    requests.push(req);
                    bytes = sz;
                }
            }
        }
        // tryRead() from the lane's channel — skip cancelled requests
        let draining = true;
        while (draining && items.length < maxBatch) {
            const req = this._tryTakeActive(lane);
            if (req === undefined) {
                draining = false;
            }
            else {
                const sz = this._trySizeRequest(req);
                if (sz === undefined)
                    continue; // sizer threw, request already rejected
                if (byteBudget !== undefined && items.length > 0 && bytes + sz > byteBudget) {
                    // Defer this request to next boat
                    lane.pending = req;
                    draining = false;
                }
                else {
                    items.push(req.item);
                    requests.push(req);
                    bytes += sz;
                }
            }
        }
        return { items, requests, bytes };
    }
    /** Read from lane channel, skipping cancelled requests. */
    _tryTakeActive(lane) {
        for (;;) {
            const req = lane.channel.tryRead();
            if (req === undefined)
                return undefined;
            if (req.cancelled)
                continue; // skip cancelled
            return req;
        }
    }
    /** Try to compute item size; on failure reject the request and return undefined. */
    _trySizeRequest(req) {
        try {
            return this._sizeOf(req.item);
        }
        catch (e) {
            req.reject(e);
            return undefined;
        }
    }
    // ─── Public API ─────────────────────────────────────────────────────────
    /**
     * Submit one item for batch processing with an explicit priority level.
     * Returns a promise that resolves with the item's aligned result once the
     * boat containing it is processed.
     */
    process(item, priority, signal) {
        const level = priority ?? this._config.defaultPriority;
        const laneIndex = this._priorityToLane.get(level);
        if (laneIndex === undefined) {
            return Promise.reject(new RangeError(`Priority level ${String(level)} is not a configured lane`));
        }
        if (signal?.aborted) {
            return Promise.reject(signal.reason);
        }
        const lane = this._lanes[laneIndex];
        return new Promise((resolve, reject) => {
            const req = { item, resolve, reject, cancelled: false };
            if (signal) {
                signal.addEventListener("abort", () => {
                    req.cancelled = true;
                    reject(signal.reason);
                }, { once: true });
            }
            lane.channel.write(req, signal).then(() => {
                lane.bytesQueued += this._sizeOf(item);
                this._notifier.notify();
            }).catch((err) => {
                req.cancelled = true;
                reject(err);
            });
        });
    }
    /**
     * Signal completion, await all ferries draining all lanes.
     */
    async complete() {
        for (const lane of this._lanes) {
            lane.channel.complete();
        }
        this._allChannelsClosed = true;
        // Wake all sleeping ferries
        for (let i = 0; i < this._config.maxDegreeOfParallelism; i++) {
            this._notifier.notify();
        }
        await Promise.all(this._ferryTasks);
    }
    /**
     * Abort all ferries, reject all queued requests.
     */
    dispose() {
        this._abortController.abort();
        for (const lane of this._lanes) {
            lane.channel.complete();
            // Drain remaining requests and reject them
            for (;;) {
                const req = lane.channel.tryRead();
                if (req === undefined)
                    break;
                req.reject(new AbortError());
            }
            if (lane.pending !== undefined) {
                lane.pending.reject(new AbortError());
                lane.pending = undefined;
            }
        }
        this._allChannelsClosed = true;
    }
}
// ─── Utilities ──────────────────────────────────────────────────────────────
class AbortError extends Error {
    name = "AbortError";
    constructor() {
        super("The operation was aborted");
    }
}
function isAbortError(e) {
    if (e instanceof DOMException && e.name === "AbortError")
        return true;
    if (e instanceof AbortError)
        return true;
    if (e instanceof Error && e.name === "AbortError")
        return true;
    return false;
}
