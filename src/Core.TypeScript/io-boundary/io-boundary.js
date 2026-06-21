/**
 * io-boundary.ts — typed inside/outside boundary for the signed-ledger-to-grow-only transition.
 *
 * `Inside` holds a signed Z-set ledger where emissions and retractions can cancel before
 * observation. `Outside` holds only the fused G-set view: monotone presence, with
 * multiplicity, negative evidence, and the path that produced the result kept behind the boundary.
 *
 * Mirroring the F# canonical shape (src/Core/IoBoundary.fs).
 */
import * as ZSet from "../z-set/z-set";
import * as GSet from "../g-set/g-set";
// Unexported symbols to keep internal states inaccessible from outside this file
export const ledgerSymbol = Symbol("ledger");
export const viewSymbol = Symbol("view");
/**
 * Inside boundary wrapper: holds a signed Z-set ledger.
 */
export class Inside {
    /** @internal */
    [ledgerSymbol];
    constructor(ledger) {
        this[ledgerSymbol] = ledger;
    }
}
/**
 * Outside boundary wrapper: holds the public fused G-set view.
 */
export class Outside {
    /** @internal */
    [viewSymbol];
    constructor(view) {
        this[viewSymbol] = view;
    }
}
/** The empty Inside boundary. */
export function emptyInside() {
    return new Inside(ZSet.empty());
}
/** The empty Outside boundary. */
export function emptyOutside() {
    return new Outside(GSet.empty());
}
/** Enter the boundary with an already-composed signed ledger. */
export function input(z) {
    return new Inside(z);
}
/** Enter the boundary with add-only genesis facts. */
export function genesis(compare, keys) {
    return new Inside(ZSet.ofArray(compare, keys));
}
/** One positive internal event. */
export function emit(key) {
    return new Inside(ZSet.singleton(key, 1));
}
/** One negative internal event. */
export function retract(key) {
    return new Inside(ZSet.singleton(key, -1));
}
/** Compose signed interiors before any exterior observation occurs. */
export function compose(compare, left, right) {
    return new Inside(ZSet.union(compare, left[ledgerSymbol], right[ledgerSymbol]));
}
/** Compose a sequence of signed interiors. */
export function composeAll(compare, insides) {
    let acc = ZSet.empty();
    for (const inside of insides) {
        acc = ZSet.union(compare, acc, inside[ledgerSymbol]);
    }
    return new Inside(acc);
}
/** Cross the I/O boundary: only positive support becomes exterior identity. */
export function fuse(inside) {
    const ledger = inside[ledgerSymbol];
    const view = [];
    for (const entry of ledger) {
        if (entry.w > 0) {
            view.push(entry.e);
        }
    }
    // The resulting view is guaranteed to be GSet-compliant (sorted and unique)
    // because the source ZSet entries are already sorted and unique by key.
    return new Outside(view);
}
/** Leave the boundary with the public grow-only view. */
export function output(outside) {
    return outside[viewSymbol];
}
/** Return the exterior view as a fresh array. */
export function toArray(outside) {
    return [...outside[viewSymbol]];
}
/** Return the exterior view as a fresh list array (matching F# toList). */
export function toList(outside) {
    return [...outside[viewSymbol]];
}
/** Membership: check if the key is present in the GSet view. */
export function contains(compare, key, outside) {
    return GSet.contains(compare, outside[viewSymbol], key);
}
/** Count of elements in the exterior view. */
export function count(outside) {
    return outside[viewSymbol].length;
}
/** Check if the exterior view is empty. */
export function isEmpty(outside) {
    return outside[viewSymbol].length === 0;
}
