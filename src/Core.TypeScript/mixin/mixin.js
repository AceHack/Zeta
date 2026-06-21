/**
 * Thread-safe and GC-safe weak-keyed identity table for attaching state to objects.
 */
export class WeakMapWrapper {
    map = new WeakMap();
    /**
     * Attach a state value to the key. Overwrites if it already exists.
     */
    set(key, value) {
        this.map.set(key, value);
    }
    /**
     * Try to get the state value associated with the key.
     */
    get(key) {
        return this.map.get(key);
    }
    /**
     * Check if an entry exists for the key.
     */
    has(key) {
        return this.map.has(key);
    }
    /**
     * Delete the entry associated with the key. Returns true if removed, false otherwise.
     */
    delete(key) {
        return this.map.delete(key);
    }
}
