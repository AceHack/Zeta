import { MAX_NESTING_DEPTH } from "./types";
export { MAX_NESTING_DEPTH };
import { parse as parseYaml } from "../yaml/dom";
import { encode as encodeYaml } from "../yaml/encoder";
function firstDeferred(n, depth) {
    if (depth > MAX_NESTING_DEPTH) {
        return "NestingTooDeep";
    }
    switch (n.t) {
        case "bytes":
            return "BytesDeferred";
        case "arr": {
            for (const item of n.v) {
                const err = firstDeferred(item, depth + 1);
                if (err !== null)
                    return err;
            }
            return null;
        }
        case "obj": {
            for (const [_, val] of n.v) {
                const err = firstDeferred(val, depth + 1);
                if (err !== null)
                    return err;
            }
            return null;
        }
        default:
            return null;
    }
}
function toYamlValue(n) {
    switch (n.t) {
        case "null":
            return { t: "Null" };
        case "bool":
            return { t: "Bool", value: n.v };
        case "int":
            return { t: "Int", value: BigInt(n.v) };
        case "float":
            return { t: "Float", value: Number(f64FromBitsHex(n.v)) };
        case "str":
            return { t: "Str", value: n.v };
        case "arr":
            return { t: "Seq", items: n.v.map(toYamlValue) };
        case "obj":
            return { t: "Map", entries: n.v.map(([k, val]) => [k, toYamlValue(val)]) };
        default:
            throw new Error(`Unreachable: bytes checked by firstDeferred`);
    }
}
function f64FromBitsHex(hex) {
    const dv = new DataView(new ArrayBuffer(8));
    dv.setBigUint64(0, BigInt("0x" + hex), false);
    return dv.getFloat64(0, false);
}
function f64BitsHex(v) {
    const dv = new DataView(new ArrayBuffer(8));
    dv.setFloat64(0, v, false);
    return dv.getBigUint64(0, false).toString(16).padStart(16, "0");
}
export function canonicalYaml(n) {
    const err = firstDeferred(n, 0);
    if (err !== null) {
        return { ok: false, error: err };
    }
    try {
        const yv = toYamlValue(n);
        const yaml = encodeYaml(yv);
        return { ok: true, value: yaml };
    }
    catch (ex) {
        return { ok: false, error: "BytesDeferred" };
    }
}
export function fromCanonicalYaml(yaml) {
    if (yaml === null || yaml === undefined) {
        return { ok: false, error: "NonCanonical" };
    }
    const parseResult = parseYaml(yaml);
    if (!parseResult.ok) {
        return { ok: false, error: "NonCanonical" };
    }
    const decodeResult = fromYamlValue(parseResult.value, 0);
    if (!decodeResult.ok) {
        return decodeResult;
    }
    // Strict canonical check: canonicalYaml(decoded) == yaml
    const reEncode = canonicalYaml(decodeResult.value);
    if (!reEncode.ok || reEncode.value !== yaml) {
        return { ok: false, error: "NonCanonical" };
    }
    return { ok: true, value: decodeResult.value };
}
export function fromYamlValue(yv, depth) {
    if (depth > MAX_NESTING_DEPTH) {
        return { ok: false, error: "NestingTooDeep" };
    }
    switch (yv.t) {
        case "Null":
            return { ok: true, value: { t: "null" } };
        case "Bool":
            return { ok: true, value: { t: "bool", v: yv.value } };
        case "Int":
            return { ok: true, value: { t: "int", v: yv.value.toString() } };
        case "Float":
            return { ok: true, value: { t: "float", v: f64BitsHex(yv.value) } };
        case "Str":
            return { ok: true, value: { t: "str", v: yv.value } };
        case "Seq": {
            const items = [];
            for (const item of yv.items) {
                const res = fromYamlValue(item, depth + 1);
                if (!res.ok)
                    return res;
                items.push(res.value);
            }
            return { ok: true, value: { t: "arr", v: items } };
        }
        case "Map": {
            const entries = [];
            for (const [k, val] of yv.entries) {
                const res = fromYamlValue(val, depth + 1);
                if (!res.ok)
                    return res;
                entries.push([k, res.value]);
            }
            return { ok: true, value: { t: "obj", v: entries } };
        }
        default:
            return { ok: false, error: "Unsupported" };
    }
}
