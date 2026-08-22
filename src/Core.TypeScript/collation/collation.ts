/**
 * collation.ts — Database-style named collation selection for TypeScript (081KT07NV0008QG0R001YDB73K).
 * Maps database collation name strings to their corresponding string comparator functions.
 */

export type Compare<T> = (a: T, b: T) => number;

/**
 * Ascending Unicode code-point order. Handles surrogate pairs correctly by splitting the string
 * into code points via the spread operator and comparing the resulting code point values.
 */
export const stringCompare: Compare<string> = (a, b) => {
  if (a === b) return 0;
  const arrA = [...a];
  const arrB = [...b];
  const len = Math.min(arrA.length, arrB.length);
  for (let i = 0; i < len; i++) {
    const cpA = (arrA[i] as string).codePointAt(0) ?? 0;
    const cpB = (arrB[i] as string).codePointAt(0) ?? 0;
    if (cpA < cpB) return -1;
    if (cpA > cpB) return 1;
  }
  if (arrA.length < arrB.length) return -1;
  if (arrA.length > arrB.length) return 1;
  return 0;
};

/** Case-insensitive Unicode comparison using lower-case folding. */
export const stringCompareCI: Compare<string> = (a, b) => {
  return stringCompare(a.toLowerCase(), b.toLowerCase());
};

export const invariantCompare: Compare<string> = stringCompare;
export const invariantCompareCI: Compare<string> = stringCompareCI;

/**
 * Named string collation catalog mapping DB collation names (case-insensitive keys)
 * to their respective TS comparison functions.
 */
export const catalog: Record<string, Compare<string>> = {
  "binary": stringCompare,
  "ordinal": stringCompare,
  "ordinal-ci": stringCompareCI,
  "invariant": invariantCompare,
  "invariant-ci": invariantCompareCI,

  // Postgres / Standard SQL aliases
  "c": stringCompare,
  "posix": stringCompare,
  "utf8_bin": stringCompare,
  "utf8mb4_bin": stringCompare,

  // SQLite alias
  "nocase": stringCompareCI,

  // MySQL aliases
  "utf8_general_ci": stringCompareCI,
  "utf8mb4_general_ci": stringCompareCI,
  "utf8_unicode_ci": stringCompareCI,
  "utf8mb4_unicode_ci": stringCompareCI,

  // SQL Server aliases. See
  // docs/research/2026-08-15-canonical-collation-is-utf8-byte-order-sql-servers-bin2-utf8-not-nvarchar-bin2.md
  //
  // EXACT: _BIN2_UTF8 stores as UTF-8, which has no surrogates, so its BIN2 sort is TRUE
  // code-point order (Unicode Standard 2.5.3). This is the one SQL Server name that denotes
  // exactly our canonical collation — it is what a DBA should be told to use.
  "latin1_general_100_bin2_utf8": stringCompare,
  // APPROXIMATE — agrees on the BMP, DIVERGES above it. BIN2 over nvarchar (UTF-16) compares
  // per WCHAR, i.e. by UTF-16 code UNIT, not code point. Legacy _BIN is weaker still: first
  // character by code point, then raw byte-by-byte.
  "latin1_general_100_bin2": stringCompare,
  "latin1_general_bin": stringCompare,
  "latin1_general_ci_as": stringCompareCI,
  "latin1_general_cs_as": stringCompare
};

export const defaultName = "binary";

/** Resolve a named collation from the catalog, or undefined if unknown. */
export function tryByName(name: string): Compare<string> | undefined {
  return catalog[name.toLowerCase()];
}

/** Resolve a named collation, falling back to the "binary" default. */
export function byNameOrDefault(name: string): Compare<string> {
  return tryByName(name) ?? stringCompare;
}

/**
 * Resolves the default comparer for type T given a named collation.
 * If T is string, uses the collation; otherwise, uses standard `<` and `>` operators.
 */
export function forKey<T>(collationName: string = defaultName): Compare<T> {
  const stringComp = tryByName(collationName) ?? stringCompare;
  return ((a: T, b: T): number => {
    if (typeof a === "string" && typeof b === "string") {
      return stringComp(a, b);
    }
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }) as Compare<T>;
}
