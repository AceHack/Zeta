import { T, F, N } from "./types";
import { fromBool, isLiving, isCertain, cooperate, measure, mapTri, bindTri, notTri, andTri, orTri, } from "./tri-boolean";
import { parse } from "../yaml/dom";
import { decode, fromValue, fromTrits } from "../tri-boolean-float/tri-boolean-float";
function toTrits(s) {
    return Array.from(s).map(toTri);
}
function tritsToStr(trits) {
    return trits.map(toStr).join("");
}
function asNumber(v) {
    if (v === undefined)
        return undefined;
    if (v.t === "Int")
        return Number(v.value);
    if (v.t === "Float")
        return v.value;
    return undefined;
}
function toTri(s) {
    switch (s) {
        case "T":
            return T;
        case "F":
            return F;
        case "N":
            return N;
        default:
            throw new Error(`unknown tri state: ${s}`);
    }
}
function toStr(t) {
    return t.s;
}
// Read the fixture through our YAML port.
function asMap(v, ctx) {
    if (v.t !== "Map")
        throw new Error(`expected Map at ${ctx}, got ${v.t}`);
    return v.entries;
}
function field(entries, key) {
    for (const [k, val] of entries)
        if (k === key)
            return val;
    return undefined;
}
function asStr(v) {
    return v !== undefined && v.t === "Str" ? v.value : undefined;
}
function _asBool(v) {
    return v !== undefined && v.t === "Bool" ? v.value : undefined;
}
// Re-export for future use (avoids TS6133 while keeping the helper available)
export { _asBool as asBool };
const yamlText = await Bun.file("../../../tests/cross-verification/tri-boolean/vectors.yaml").text();
const parsed = parse(yamlText);
if (!parsed.ok) {
    console.error(`YAML parse failed: ${JSON.stringify(parsed.feedback)}`);
    process.exit(1);
}
const root = asMap(parsed.value, "root");
const vectorsNode = field(root, "vectors");
if (vectorsNode === undefined || vectorsNode.t !== "Seq") {
    console.error("fixture: missing `vectors` sequence");
    process.exit(1);
}
const results = {};
for (const item of vectorsNode.items) {
    const e = asMap(item, "vector");
    const id = asStr(field(e, "id"));
    const type = asStr(field(e, "type"));
    if (type === "unary") {
        const stateStr = asStr(field(e, "state"));
        const t = toTri(stateStr);
        const mRes = measure(t);
        results[id] = {
            type: "unary",
            state: stateStr,
            isLiving: isLiving(t),
            isCertain: isCertain(t),
            notState: toStr(notTri(t)),
            cooperateState: toStr(cooperate(t)),
            measureOk: mRes.ok,
            measureValue: mRes.ok ? mRes.value : false,
            measureFeedback: mRes.ok ? "" : mRes.feedback.reason,
            mapNot: toStr(mapTri(t, (b) => !b)),
            bindNot: toStr(bindTri(t, (b) => fromBool(!b))),
            bindToT: toStr(bindTri(t, () => T)),
        };
    }
    else if (type === "binary") {
        const leftStr = asStr(field(e, "left"));
        const rightStr = asStr(field(e, "right"));
        const left = toTri(leftStr);
        const right = toTri(rightStr);
        results[id] = {
            type: "binary",
            left: leftStr,
            right: rightStr,
            expectedAnd: toStr(andTri(left, right)),
            expectedOr: toStr(orTri(left, right)),
        };
    }
    else if (type === "float") {
        const highStr = asStr(field(e, "high"));
        const decoderStr = asStr(field(e, "decoder"));
        const lowStr = asStr(field(e, "low"));
        const high = toTrits(highStr);
        const decoderVec = toTrits(decoderStr);
        const low = toTrits(lowStr);
        const f = fromTrits(high, decoderVec, low);
        const dRes = decode(f);
        const record = {
            type: "float",
            high: highStr,
            decoder: decoderStr,
            low: lowStr,
            expectedOk: dRes.ok,
            expectedValue: dRes.ok ? dRes.value : 0.0,
            expectedFeedback: dRes.ok ? "" : dRes.feedback.reason,
        };
        const encodeValNode = field(e, "encode_value");
        if (encodeValNode !== undefined) {
            const encodeValue = asNumber(encodeValNode);
            const encRes = fromValue(encodeValue, f.shape);
            record.encodeValue = encodeValue;
            record.expectedEncodeOk = encRes.ok;
            if (encRes.ok) {
                record.expectedEncodeHigh = tritsToStr(encRes.float.high);
                record.expectedEncodeDecoder = tritsToStr(encRes.float.decoder);
                record.expectedEncodeLow = tritsToStr(encRes.float.low);
            }
            else {
                record.expectedEncodeDetail = encRes.feedback.detail;
            }
        }
        results[id] = record;
    }
}
// Write outputs to tests/cross-verification/tri-boolean/ts-output.json
await Bun.write("../../../tests/cross-verification/tri-boolean/ts-output.json", JSON.stringify(results, null, 2) + "\n");
console.log(`TS cross-verify completed for ${vectorsNode.items.length} vectors.`);
