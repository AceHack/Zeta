// src/Core.TypeScript/corporate/safe-path-segment.ts
//
// ONE PREDICATE, USED EVERYWHERE A CALLER-SUPPLIED STRING BECOMES A FILENAME.
//
// This lived as a private `isSafeInboxKey` in `serve-work.ts`, written to close
// a `js/path-injection` alert on an externally-supplied ticket key. CodeQL then
// found the SAME SHAPE again in `uat-three-criteria.ts`, where a work id reaches
// `join(dir, \`uat-${id}.json\`)` — a second author writing the second copy of a
// guard that already existed and could not be reached.
//
// That is the argument `io/safe-io.ts` makes about forty authors each writing
// the same racy read once, and the remedy is the same: write it once, in a
// place both callers can see, so the third site imports rather than reinvents.
//
// TEST AND REFUSE, NEVER MANGLE — and this is measured, not stylistic. On
// CodeQL 2.27.0 a regex TEST that gates a branch is a recognised sanitizer
// (`SanitizingRegExpTest`), while `.replace()` is a barrier only when it
// replaces with the EMPTY STRING: `.replace(x, "")` is silent and
// `.replace(x, "-")` is loud. So a mangling form could never have closed the
// alert however strict it was. Refusing is also the better design — a caller
// that sent a bad key learns it did, instead of silently addressing a
// different file than it named.

/**
 * Is this a single, safe path segment?
 *
 * Must start alphanumeric, then up to 99 more of `[A-Za-z0-9._-]`. That
 * excludes `/`, `\`, `..`, NUL, control bytes, spaces and every absolute-path
 * prefix by construction rather than by enumerating what to strip — an
 * allowlist cannot be out-argued by an escape nobody thought of.
 *
 * The leading-alphanumeric requirement is load-bearing on its own: it rejects
 * `.`, `..` and `.git` while `[A-Za-z0-9._-]{1,100}` alone would accept all
 * three.
 */
export function isSafePathSegment(key: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u.test(key);
}
