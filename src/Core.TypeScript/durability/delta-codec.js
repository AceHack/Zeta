import { canonicalCbor, fromCanonicalCbor } from "../dynamic-value/cbor";
import { ofEntries } from "../z-set/z-set";
/**
 * ZSet <-> Tagged (DynamicValue) mapping.
 * A ZSet<K> becomes a Tagged arr of Tagged arr [key, Int weight] pairs.
 */
export function toDynamicValue(keyEnc, z) {
    return {
        t: "arr",
        v: z.map((entry) => ({
            t: "arr",
            v: [keyEnc(entry.e), { t: "int", v: entry.w.toString() }],
        })),
    };
}
export function ofDynamicValue(compare, keyDec, dv) {
    if (dv.t !== "arr") {
        throw new Error(`ZSetDynamic: expected Array, got ${dv.t}`);
    }
    const entries = dv.v.map((p) => {
        if (p.t !== "arr" || p.v.length !== 2) {
            throw new Error(`ZSetDynamic: expected [key, Int weight] pair`);
        }
        const k = p.v[0];
        const wDv = p.v[1];
        if (!k || !wDv || wDv.t !== "int") {
            throw new Error(`ZSetDynamic: expected [key, Int weight] pair`);
        }
        const weight = parseInt(wDv.v, 10);
        if (!Number.isSafeInteger(weight)) {
            throw new Error(`ZSetDynamic: weight is not a safe integer`);
        }
        return { e: keyDec(k), w: weight };
    });
    return ofEntries(compare, entries);
}
/**
 * Byte-verified canonical CBOR codec. Maps ZSet <-> Tagged via the supplied key codec,
 * then rides Tagged's golden-vector-locked CBOR.
 */
export class CborDeltaCodec {
    compare;
    keyEnc;
    keyDec;
    constructor(compare, keyEnc, keyDec) {
        this.compare = compare;
        this.keyEnc = keyEnc;
        this.keyDec = keyDec;
    }
    encode(z) {
        const dv = toDynamicValue(this.keyEnc, z);
        const enc = canonicalCbor(dv);
        if (!enc.ok) {
            throw new Error(`CborDeltaCodec.encode: failed to encode: ${enc.error}`);
        }
        return enc.value;
    }
    decode(bytes) {
        const res = fromCanonicalCbor(bytes);
        if (!res.ok) {
            throw new Error(`CborDeltaCodec.decode: non-decodable CBOR: ${res.error}`);
        }
        return ofDynamicValue(this.compare, this.keyDec, res.value);
    }
}
