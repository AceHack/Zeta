function quote(s) {
    let out = '"';
    for (const ch of s) {
        switch (ch) {
            case "\\":
                out += "\\\\";
                break;
            case '"':
                out += '\\"';
                break;
            case "\n":
                out += "\\n";
                break;
            case "\t":
                out += "\\t";
                break;
            case "\r":
                out += "\\r";
                break;
            case "\0":
                out += "\\0";
                break;
            default: out += ch;
        }
    }
    return out + '"';
}
/** Inline rendering of a scalar value, or null for a container. */
function scalar(v) {
    switch (v.t) {
        case "Null": return "null";
        case "Bool": return v.value ? "true" : "false";
        case "Int": return v.value.toString();
        case "Float": {
            const r = v.value.toString(); // JS Number.toString is culture-invariant
            return /[.eE]/.test(r) ? r : r + ".0";
        }
        case "Str": return quote(v.value);
        // Empty collections render INLINE as flow `{}` / `[]` (081KT7YW00008QG0R002T1XNWT): block style
        // cannot represent an empty map/seq, so without this `{}`, `[]`, and null all
        // collapse to a bare `key:` → null. The one necessary flow exception; non-empty
        // containers still render as block (return null → recurse).
        case "Map": return v.entries.length === 0 ? "{}" : null;
        case "Seq": return v.items.length === 0 ? "[]" : null;
        default: return null;
    }
}
function emit(indent, v, lines) {
    const pad = " ".repeat(indent);
    if (v.t === "Map") {
        for (const [k, child] of v.entries) {
            const key = quote(k);
            const s = scalar(child);
            if (s !== null)
                lines.push(`${pad}${key}: ${s}`);
            else {
                lines.push(`${pad}${key}:`);
                emit(indent + 2, child, lines);
            }
        }
    }
    else if (v.t === "Seq") {
        for (const child of v.items) {
            const s = scalar(child);
            if (s !== null)
                lines.push(`${pad}- ${s}`);
            else {
                lines.push(`${pad}-`);
                emit(indent + 2, child, lines);
            }
        }
    }
    else {
        lines.push(pad + scalar(v));
    }
}
/** Canonical YAML rendering — byte-identical to the F# encoder. */
export function encode(v) {
    const lines = [];
    emit(0, v, lines);
    return lines.join("\n") + "\n";
}
