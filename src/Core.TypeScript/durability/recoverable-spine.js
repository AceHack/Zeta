import { union, empty } from "../z-set/z-set";
/**
 * RecoverableSpine — ties an input IDeltaLog together with cadenced
 * snapshots (via a manifest-tracked ISnapshotStore) and a restore -> replay recovery path.
 */
export class RecoverableSpine {
    state;
    appliedSeq;
    cadence = 0;
    commitsSinceSnapshot = 0;
    latestSnapshotPointer = null;
    compare;
    log;
    snap;
    constructor(compare, log, snap, initialState, initialSeq) {
        this.compare = compare;
        this.log = log;
        this.snap = snap;
        this.state = initialState;
        this.appliedSeq = initialSeq;
    }
    /**
     * The current folded state (the "consolidated" view).
     */
    consolidate() {
        return this.state;
    }
    /**
     * Highest delta-log sequence folded into the current state.
     */
    getAppliedSeq() {
        return this.appliedSeq;
    }
    getLog() {
        return this.log;
    }
    getSnapshotStore() {
        return this.snap;
    }
    /**
     * The most recent snapshot pointer taken by this spine this session, or null.
     */
    getLatestSnapshot() {
        return this.latestSnapshotPointer;
    }
    /**
     * Take + GC a snapshot every N commits (0 disables).
     */
    getAutoSnapshotEvery() {
        return this.cadence;
    }
    setAutoSnapshotEvery(n) {
        this.cadence = Math.max(0, n);
    }
    /**
     * Persist the current consolidated state as a snapshot.
     */
    async snapshot() {
        const p = await this.snap.write(this.appliedSeq, this.state);
        this.latestSnapshotPointer = p;
        this.commitsSinceSnapshot = 0;
        return p;
    }
    /**
     * Commit one input delta: append it to the durable log, then fold it into
     * the live state. If cadence is set and the threshold is crossed, take a
     * snapshot and GC the log through it.
     */
    async commit(delta, captured = new Map()) {
        const seq = await this.log.append(delta, captured);
        this.state = union(this.compare, this.state, delta);
        this.appliedSeq = seq;
        this.commitsSinceSnapshot += 1;
        if (this.cadence > 0 && this.commitsSinceSnapshot >= this.cadence) {
            const p = await this.snapshot();
            await this.log.truncate(p.seq);
        }
        return seq;
    }
    /**
     * Fold a replayed delta into the state during recovery.
     */
    applyReplayed(delta, seq) {
        this.state = union(this.compare, this.state, delta);
        this.appliedSeq = seq;
    }
    /**
     * Recover a spine from durable state.
     */
    static async recover(compare, log, snap, pointer) {
        const resolved = pointer ? pointer : await snap.latest();
        let baseState = empty();
        let baseSeq = 0;
        if (resolved) {
            baseState = await snap.read(resolved);
            baseSeq = resolved.seq;
        }
        const spine = new RecoverableSpine(compare, log, snap, baseState, baseSeq);
        const tail = await log.replay(baseSeq);
        for (const e of tail) {
            spine.applyReplayed(e.delta, e.seq);
        }
        return spine;
    }
}
