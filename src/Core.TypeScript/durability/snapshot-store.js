/**
 * In-memory snapshot store — the reference + test substrate.
 */
export class InMemorySnapshotStore {
    store = new Map();
    latestPointer = null;
    async write(seq, state) {
        const p = { handle: seq, seq };
        this.store.set(seq, state);
        this.latestPointer = p;
        return p;
    }
    async read(pointer) {
        const seq = pointer.handle;
        const state = this.store.get(seq);
        if (state === undefined) {
            throw new Error(`InMemorySnapshotStore.read: snapshot not found for seq ${seq}`);
        }
        return state;
    }
    async latest() {
        return this.latestPointer;
    }
}
