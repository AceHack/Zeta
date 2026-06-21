const VER = /^(\d+)\.(\d+)\.(\d+)$/;
export function parseVersion(s) {
    const m = VER.exec(s.trim());
    if (!m)
        return null;
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}
export function compareVersions(a, b) {
    const pa = typeof a === "string" ? parseVersion(a) : a;
    const pb = typeof b === "string" ? parseVersion(b) : b;
    if (pa === null || pb === null)
        throw new Error("compareVersions: invalid version");
    for (const k of ["major", "minor", "patch"]) {
        if (pa[k] < pb[k])
            return -1;
        if (pa[k] > pb[k])
            return 1;
    }
    return 0;
}
function cmp(a, op, b) {
    const c = compareVersions(a, b);
    switch (op) {
        case "=": return c === 0;
        case ">": return c === 1;
        case "<": return c === -1;
        case ">=": return c >= 0;
        case "<=": return c <= 0;
    }
}
export function parseRange(s) {
    const trimmed = s.trim();
    if (trimmed === "" || trimmed === "*" || trimmed === "x" || trimmed === "X")
        return { comparators: [] };
    const out = [];
    for (const tokenRaw of trimmed.split(/\s+/)) {
        const sub = parseComparatorToken(tokenRaw);
        if ("error" in sub)
            return sub;
        out.push(...sub.comparators);
    }
    return { comparators: out };
}
// Parse one comparator token: ^/~ (caret/tilde desugar to a >= / < pair), an exact x.y.z, an op-prefixed (>= <= > < =) version, or a * / x wildcard.
function parseComparatorToken(token) {
    if (token.startsWith("^") || token.startsWith("~")) {
        const v = parseVersion(token.slice(1));
        if (v === null)
            return { error: `bad version in range: ${token}` };
        const lower = { op: ">=", v };
        let upper;
        if (token.startsWith("~"))
            upper = { major: v.major, minor: v.minor + 1, patch: 0 };
        else if (v.major > 0)
            upper = { major: v.major + 1, minor: 0, patch: 0 };
        else if (v.minor > 0)
            upper = { major: 0, minor: v.minor + 1, patch: 0 };
        else
            upper = { major: 0, minor: 0, patch: v.patch + 1 };
        return { comparators: [lower, { op: "<", v: upper }] };
    }
    if (token === "*" || token === "x" || token === "X")
        return { comparators: [] };
    const m = /^(>=|<=|>|<|=)?(.+)$/.exec(token);
    if (!m)
        return { error: `bad comparator: ${token}` };
    const op = (m[1] ?? "=");
    const v = parseVersion(m[2]);
    if (v === null)
        return { error: `bad version in comparator: ${token}` };
    return { comparators: [{ op, v }] };
}
export function satisfies(version, range) {
    const v = parseVersion(version);
    if (v === null)
        return false;
    const r = typeof range === "string" ? parseRange(range) : range;
    if ("error" in r)
        return false;
    return r.comparators.every((c) => cmp(v, c.op, c.v));
}
export function maxSatisfying(versions, range) {
    let best = null;
    for (const ver of versions) {
        if (!satisfies(ver, range))
            continue;
        if (best === null || compareVersions(ver, best) === 1)
            best = ver;
    }
    return best;
}
