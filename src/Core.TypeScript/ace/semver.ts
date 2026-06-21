// Pure semver subset for Ace slice 5.2 (no pre-release / build-metadata / unions / hyphen — see 081KT07NV0008QG0R002WK9064).
export interface Version { readonly major: number; readonly minor: number; readonly patch: number }
export type Comparator = { readonly op: ">=" | "<=" | ">" | "<" | "="; readonly v: Version };
// A Range is a conjunction (AND) of comparators. `*` / `x` → empty conjunction (matches all).
export type Range = { readonly comparators: ReadonlyArray<Comparator> };
export type RangeOrError = Range | { readonly error: string };

const VER = /^(\d+)\.(\d+)\.(\d+)$/;
export function parseVersion(s: string): Version | null {
  const m = VER.exec(s.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}
export function compareVersions(a: string | Version, b: string | Version): -1 | 0 | 1 {
  const pa = typeof a === "string" ? parseVersion(a) : a;
  const pb = typeof b === "string" ? parseVersion(b) : b;
  if (pa === null || pb === null) throw new Error("compareVersions: invalid version");
  for (const k of ["major", "minor", "patch"] as const) {
    if (pa[k] < pb[k]) return -1;
    if (pa[k] > pb[k]) return 1;
  }
  return 0;
}
function cmp(a: Version, op: Comparator["op"], b: Version): boolean {
  const c = compareVersions(a, b);
  switch (op) {
    case "=": return c === 0;
    case ">": return c === 1;
    case "<": return c === -1;
    case ">=": return c >= 0;
    case "<=": return c <= 0;
  }
}

export function parseRange(s: string): RangeOrError {
  const trimmed = s.trim();
  if (trimmed === "" || trimmed === "*" || trimmed === "x" || trimmed === "X") return { comparators: [] };
  const out: Comparator[] = [];
  for (const tokenRaw of trimmed.split(/\s+/)) {
    const sub = parseComparatorToken(tokenRaw);
    if ("error" in sub) return sub;
    out.push(...sub.comparators);
  }
  return { comparators: out };
}

// Parse one comparator token: ^/~ (caret/tilde desugar to a >= / < pair), an exact x.y.z, an op-prefixed (>= <= > < =) version, or a * / x wildcard.
function parseComparatorToken(token: string): RangeOrError {
  if (token.startsWith("^") || token.startsWith("~")) {
    const v = parseVersion(token.slice(1));
    if (v === null) return { error: `bad version in range: ${token}` };
    const lower: Comparator = { op: ">=", v };
    let upper: Version;
    if (token.startsWith("~")) upper = { major: v.major, minor: v.minor + 1, patch: 0 };
    else if (v.major > 0) upper = { major: v.major + 1, minor: 0, patch: 0 };
    else if (v.minor > 0) upper = { major: 0, minor: v.minor + 1, patch: 0 };
    else upper = { major: 0, minor: 0, patch: v.patch + 1 };
    return { comparators: [lower, { op: "<", v: upper }] };
  }
  if (token === "*" || token === "x" || token === "X") return { comparators: [] };
  const m = /^(>=|<=|>|<|=)?(.+)$/.exec(token);
  if (!m) return { error: `bad comparator: ${token}` };
  const op = (m[1] ?? "=") as Comparator["op"];
  const v = parseVersion(m[2]!);
  if (v === null) return { error: `bad version in comparator: ${token}` };
  return { comparators: [{ op, v }] };
}

export function satisfies(version: string, range: string | Range): boolean {
  const v = parseVersion(version);
  if (v === null) return false;
  const r = typeof range === "string" ? parseRange(range) : range;
  if ("error" in r) return false;
  return r.comparators.every((c) => cmp(v, c.op, c.v));
}

export function maxSatisfying(versions: ReadonlyArray<string>, range: string | Range): string | null {
  let best: string | null = null;
  for (const ver of versions) {
    if (!satisfies(ver, range)) continue;
    if (best === null || compareVersions(ver, best) === 1) best = ver;
  }
  return best;
}
