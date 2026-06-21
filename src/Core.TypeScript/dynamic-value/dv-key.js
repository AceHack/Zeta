import {} from "./types";
import { canonicalCbor } from "./cbor";
/**
 * **Content-addressed, COMPARABLE key for a `Tagged` (DynamicValue) row.**
 *
 * Conforms to F#'s `DvKey`. Wraps a value with its canonical CBOR bytes
 * and orders/compares by those bytes (ordinal, lexicographical).
 */
export class DvKey {
    value;
    canonical;
    constructor(value, canonical) {
        this.value = value;
        this.canonical = canonical;
    }
    /** Wrap a `Tagged` value as a comparable, content-addressed row key. */
    static ofValue(value) {
        const canonicalResult = canonicalCbor(value);
        if (!canonicalResult.ok) {
            throw new Error(`Failed to encode value to canonical CBOR: ${canonicalResult.error}`);
        }
        return new DvKey(value, new Uint8Array(canonicalResult.value));
    }
    /** Lexicographical ordinal comparison of two byte arrays. */
    static compareBytes(a, b) {
        const len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i++) {
            if (a[i] < b[i])
                return -1;
            if (a[i] > b[i])
                return 1;
        }
        if (a.length < b.length)
            return -1;
        if (a.length > b.length)
            return 1;
        return 0;
    }
    equals(other) {
        if (!(other instanceof DvKey))
            return false;
        return DvKey.compareBytes(this.canonical, other.canonical) === 0;
    }
    getHashCode() {
        // 32-bit FNV-1a over the canonical bytes.
        let h = 2166136261;
        for (let i = 0; i < this.canonical.length; i++) {
            h ^= this.canonical[i];
            h = Math.imul(h, 16777619);
        }
        return h | 0;
    }
    compareTo(other) {
        return DvKey.compareBytes(this.canonical, other.canonical);
    }
}
