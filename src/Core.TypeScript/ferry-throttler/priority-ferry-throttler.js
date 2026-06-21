/**
 * priority-ferry-throttler.ts — multi-lane priority ferry throttler (fire-and-forget arity).
 *
 * Composes N lane queues (one `InternalChannel<T>` per lane), a `LaneNotifier`
 * for shared notification when any lane gets work, a `DrainScheduler` that picks
 * which lane to drain, and M ferry loops (shared ferry pool).
 *
 * Each lane has its own backpressure (bounded queue), batch size, and byte budget.
 * Ferries are self-clocked, anti-Nagle: they drain whatever is available NOW,
 * never wait to fill a boat.
 *
 * At `maxDegreeOfParallelism = 1` with strict draining, this is deterministic and
 * DST-replayable — the FoundationDB single-thread shape extended to priority lanes.
 */
import { createInternalChannel } from "./internal-channel.js";
import { createLaneNotifier } from "./lane-notifier.js";
import { createStrictPriorityScheduler, createWeightedFairScheduler, } from "./drain-scheduler.js";
import { validatePriorityConfig, } from "./priority-config.js";
// ─── PriorityFerryThrottler ─────────────────────────────────────────────────
/**
 * Multi-lane priority ferry throttler — fire-and-forget arity.
 *
 * Items are enqueued with an explicit priority level (defaults to
 * `config.defaultPriority`). Each priority level maps to a lane with its own
 * bounded queue, batch size, and byte budget. Ferries drain lanes according to
 * the configured draining policy (strict priority or weighted-fair).
 */
export class PriorityFerryThrottler {
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
            hasPending: false,
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
                    const { boat, bytes } = this._collectBoat(laneIndex);
                    if (boat.length > 0) {
                        await this._processBatch(boat, signal);
                        this._scheduler.recordDrain(laneIndex, boat.length, bytes);
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
            hasWork: lane.hasPending || lane.channel.queueDepth > 0,
            queueDepth: lane.channel.queueDepth + (lane.hasPending ? 1 : 0),
            bytesQueued: lane.bytesQueued,
            drainCount: lane.drainCount,
        }));
        return this._scheduler.selectLane(snapshots);
    }
    _allLanesEmpty() {
        for (const lane of this._lanes) {
            if (lane.hasPending || lane.channel.queueDepth > 0)
                return false;
        }
        return true;
    }
    // ─── collectBoat logic ──────────────────────────────────────────────────
    _collectBoat(laneIndex) {
        const lane = this._lanes[laneIndex];
        const maxBatch = lane.maxBatchSize;
        const byteBudget = lane.maxBatchBytes;
        const boat = [];
        let bytes = 0;
        // Start with any pending item deferred from previous boat
        if (lane.hasPending) {
            const item = lane.pending;
            boat.push(item);
            bytes = this._sizeOf(item);
            lane.hasPending = false;
            lane.pending = undefined;
        }
        // tryRead() from the lane's channel until constraints
        let draining = true;
        while (draining && boat.length < maxBatch) {
            const item = lane.channel.tryRead();
            if (item === undefined) {
                draining = false;
            }
            else {
                const sz = this._sizeOf(item);
                if (byteBudget !== undefined && boat.length > 0 && bytes + sz > byteBudget) {
                    // Defer this item to next boat
                    lane.pending = item;
                    lane.hasPending = true;
                    draining = false;
                }
                else {
                    boat.push(item);
                    bytes += sz;
                }
            }
        }
        return { boat, bytes };
    }
    // ─── Public API ─────────────────────────────────────────────────────────
    /**
     * Enqueue with explicit priority (defaults to config.defaultPriority).
     * Per-lane backpressure: the promise resolves when the item is accepted into
     * the target lane's queue.
     */
    async enqueue(item, priority, signal) {
        const level = priority ?? this._config.defaultPriority;
        const laneIndex = this._priorityToLane.get(level);
        if (laneIndex === undefined) {
            throw new RangeError(`Priority level ${String(level)} is not a configured lane`);
        }
        const lane = this._lanes[laneIndex];
        await lane.channel.write(item, signal);
        lane.bytesQueued += this._sizeOf(item);
        this._notifier.notify();
    }
    /**
     * Try-enqueue without waiting. Returns false if the target lane's queue is full.
     */
    tryEnqueue(item, priority) {
        const level = priority ?? this._config.defaultPriority;
        const laneIndex = this._priorityToLane.get(level);
        if (laneIndex === undefined) {
            throw new RangeError(`Priority level ${String(level)} is not a configured lane`);
        }
        const lane = this._lanes[laneIndex];
        const accepted = lane.channel.tryWrite(item);
        if (accepted) {
            lane.bytesQueued += this._sizeOf(item);
            this._notifier.notify();
        }
        return accepted;
    }
    /**
     * Signal completion, await all ferries draining all lanes.
     */
    async complete() {
        for (const lane of this._lanes) {
            lane.channel.complete();
        }
        this._allChannelsClosed = true;
        // Wake all sleeping ferries (each notify wakes one waiter)
        for (let i = 0; i < this._config.maxDegreeOfParallelism; i++) {
            this._notifier.notify();
        }
        await Promise.all(this._ferryTasks);
    }
    /**
     * Abort all ferries, complete all channels.
     */
    dispose() {
        for (const lane of this._lanes) {
            lane.channel.complete();
        }
        this._allChannelsClosed = true;
        this._abortController.abort();
        // Fire-and-forget — ferries will catch the abort.
    }
}
// ─── Utilities ──────────────────────────────────────────────────────────────
function isAbortError(e) {
    if (e instanceof DOMException && e.name === "AbortError")
        return true;
    if (e instanceof Error && e.name === "AbortError")
        return true;
    return false;
}
