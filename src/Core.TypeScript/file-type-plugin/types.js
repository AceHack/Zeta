import { ofEntries } from "../z-set/z-set";
import { serialize as serializeBonsai, parse as parseBonsai } from "../bonsai/bonsai";
/**
 * A canonical comparator for two Tagged (DynamicValue) items.
 * Allows sorting ZSets of Tagged values deterministically.
 */
export function compareTagged(a, b) {
    if (a.t !== b.t) {
        return a.t.localeCompare(b.t);
    }
    switch (a.t) {
        case "null":
            return 0;
        case "bool": {
            const bv = b.v;
            return a.v === bv ? 0 : a.v ? 1 : -1;
        }
        case "int": {
            const bv = b.v;
            try {
                const ai = BigInt(a.v);
                const bi = BigInt(bv);
                return ai === bi ? 0 : ai > bi ? 1 : -1;
            }
            catch {
                return a.v.localeCompare(bv);
            }
        }
        case "float": {
            const bv = b.v;
            return a.v.localeCompare(bv);
        }
        case "str": {
            const bv = b.v;
            return a.v.localeCompare(bv);
        }
        case "bytes": {
            const bv = b.v;
            return a.v.localeCompare(bv);
        }
        case "arr": {
            const bv = b.v;
            const len = Math.min(a.v.length, bv.length);
            for (let i = 0; i < len; i++) {
                const cmp = compareTagged(a.v[i], bv[i]);
                if (cmp !== 0)
                    return cmp;
            }
            return a.v.length - bv.length;
        }
        case "obj": {
            const bv = b.v;
            const aSorted = [...a.v].sort((x, y) => x[0].localeCompare(y[0]));
            const bSorted = [...bv].sort((x, y) => x[0].localeCompare(y[0]));
            const len = Math.min(aSorted.length, bSorted.length);
            for (let i = 0; i < len; i++) {
                const kCmp = aSorted[i][0].localeCompare(bSorted[i][0]);
                if (kCmp !== 0)
                    return kCmp;
                const vCmp = compareTagged(aSorted[i][1], bSorted[i][1]);
                if (vCmp !== 0)
                    return vCmp;
            }
            return aSorted.length - bSorted.length;
        }
    }
}
/**
 * Encodes a ZSet of DynamicValues into a Tagged array format.
 */
export function zsetToTagged(zset) {
    return {
        t: "arr",
        v: zset.map(entry => ({
            t: "obj",
            v: [
                ["e", entry.e],
                ["w", { t: "int", v: entry.w.toString() }]
            ]
        }))
    };
}
/**
 * Decodes a Tagged array format back into a ZSet of DynamicValues.
 */
export function taggedToZSet(tagged) {
    if (tagged.t !== "arr")
        return [];
    const entries = [];
    for (const item of tagged.v) {
        if (item.t === "obj") {
            const e = item.v.find(([k]) => k === "e")?.[1];
            const wVal = item.v.find(([k]) => k === "w")?.[1];
            if (e && wVal && wVal.t === "int") {
                entries.push({ e, w: parseInt(wVal.v, 10) });
            }
        }
    }
    return ofEntries(compareTagged, entries);
}
/**
 * Serializes a FileTypePlugin object into a Tagged DynamicValue.
 */
export function pluginToTagged(plugin) {
    return {
        t: "obj",
        v: [
            ["fileType", { t: "str", v: plugin.fileType }],
            ["parserRef", { t: "str", v: plugin.parserRef }],
            ["serializerRef", { t: "str", v: plugin.serializerRef }],
            [
                "views",
                {
                    t: "arr",
                    v: plugin.views.map(view => {
                        const querySer = serializeBonsai(view.query);
                        const queryStr = querySer.ok ? querySer.value : "";
                        return {
                            t: "obj",
                            v: [
                                ["name", { t: "str", v: view.name }],
                                ["query", { t: "str", v: queryStr }]
                            ]
                        };
                    })
                }
            ]
        ]
    };
}
/**
 * Deserializes a Tagged DynamicValue back into a FileTypePlugin object.
 */
export function taggedToPlugin(tagged) {
    if (tagged.t !== "obj") {
        throw new Error("Invalid plugin: expected Tagged object");
    }
    const fileTypeVal = tagged.v.find(([k]) => k === "fileType")?.[1];
    const parserRefVal = tagged.v.find(([k]) => k === "parserRef")?.[1];
    const serializerRefVal = tagged.v.find(([k]) => k === "serializerRef")?.[1];
    const viewsVal = tagged.v.find(([k]) => k === "views")?.[1];
    if (!fileTypeVal || fileTypeVal.t !== "str" ||
        !parserRefVal || parserRefVal.t !== "str" ||
        !serializerRefVal || serializerRefVal.t !== "str") {
        throw new Error("Invalid plugin properties");
    }
    const views = [];
    if (viewsVal && viewsVal.t === "arr") {
        for (const viewObj of viewsVal.v) {
            if (viewObj.t === "obj") {
                const nameVal = viewObj.v.find(([k]) => k === "name")?.[1];
                const queryVal = viewObj.v.find(([k]) => k === "query")?.[1];
                if (nameVal && nameVal.t === "str" && queryVal && queryVal.t === "str") {
                    const parsed = parseBonsai(queryVal.v);
                    if (parsed.ok) {
                        views.push({
                            name: nameVal.v,
                            query: parsed.value
                        });
                    }
                }
            }
        }
    }
    return {
        fileType: fileTypeVal.v,
        parserRef: parserRefVal.v,
        serializerRef: serializerRefVal.v,
        views
    };
}
