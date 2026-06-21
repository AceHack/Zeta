import {} from "./types";
const coreKeys = new Set([
    "specversion",
    "id",
    "source",
    "type",
    "time",
    "subject",
    "datacontenttype",
    "dataschema",
    "data",
]);
/** Create a minimal valid event (specversion defaults to "1.0"). */
export function create(id, source, type, data) {
    return {
        id,
        source,
        specversion: "1.0",
        type,
        extensions: [],
        data,
    };
}
/** Validate the REQUIRED attributes are present and non-empty (CloudEvents v1.0 constraint). */
export function validate(e) {
    const missing = [];
    if (!e.id)
        missing.push("id");
    if (!e.source)
        missing.push("source");
    if (!e.specversion)
        missing.push("specversion");
    if (!e.type)
        missing.push("type");
    if (missing.length === 0) {
        return { ok: true };
    }
    return {
        ok: false,
        error: `CloudEvent missing required attribute(s): ${missing.join(", ")}`,
    };
}
/** Serialize to `DynamicValue.Object` (rides the canonical codecs). Attribute order is stable. */
export function toDynamic(e) {
    const pairs = [
        ["specversion", { t: "str", v: e.specversion }],
        ["id", { t: "str", v: e.id }],
        ["source", { t: "str", v: e.source }],
        ["type", { t: "str", v: e.type }],
    ];
    if (e.time !== undefined) {
        pairs.push(["time", { t: "str", v: e.time }]);
    }
    if (e.subject !== undefined) {
        pairs.push(["subject", { t: "str", v: e.subject }]);
    }
    if (e.datacontenttype !== undefined) {
        pairs.push(["datacontenttype", { t: "str", v: e.datacontenttype }]);
    }
    if (e.dataschema !== undefined) {
        pairs.push(["dataschema", { t: "str", v: e.dataschema }]);
    }
    for (const [k, v] of e.extensions) {
        pairs.push([k, { t: "str", v }]);
    }
    if (e.data !== undefined) {
        pairs.push(["data", e.data]);
    }
    return { t: "obj", v: pairs };
}
/** Parse from a `DynamicValue.Object`. Unknown string-valued keys become extension attributes in order. */
export function ofDynamic(dv) {
    if (dv.t !== "obj") {
        return { ok: false, error: "CloudEvent must be a DynamicValue.Object" };
    }
    const kvs = dv.v;
    const str = (k) => {
        const found = kvs.find(([kk]) => kk === k);
        if (found && found[1].t === "str") {
            return found[1].v;
        }
        return undefined;
    };
    const id = str("id");
    const source = str("source");
    const type = str("type");
    if (id === undefined || source === undefined || type === undefined) {
        return {
            ok: false,
            error: "CloudEvent object missing required attribute(s): id / source / type",
        };
    }
    const specversion = str("specversion") ?? "1.0";
    const time = str("time");
    const subject = str("subject");
    const datacontenttype = str("datacontenttype");
    const dataschema = str("dataschema");
    const extensions = [];
    for (const [k, v] of kvs) {
        if (!coreKeys.has(k) && v.t === "str") {
            extensions.push([k, v.v]);
        }
    }
    const dataPair = kvs.find(([k]) => k === "data");
    const data = dataPair ? dataPair[1] : undefined;
    return {
        ok: true,
        value: {
            id,
            source,
            specversion,
            type,
            time,
            subject,
            datacontenttype,
            dataschema,
            extensions,
            data,
        },
    };
}
