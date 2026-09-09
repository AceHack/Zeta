#!/usr/bin/env bun
// src/Core.TypeScript/git/ref-prefix.ts
//
// STRIP A `<remote>/` PREFIX FROM A REF NAME, WITHOUT BUILDING A REGEX.
//
// THE DEFECT THIS EXISTS FOR. Two callers wrote the same line:
//
//   branch.replace(new RegExp(`^${remote}/`), "")
//
// -- `forge-host/github/consume-pr-archives.ts:82` and
// `hygiene/triage-orphan-branches.ts:135`, CodeQL `js/regex-injection`
// alerts 246 and 450. In both, `remote` arrives from `--remote` on argv, so it
// is not a literal and the pattern is not the pattern the author wrote:
//
//   * `--remote o.i` compiles `^o.i/`, where `.` is any character, so the ref
//     `oXi/main` is stripped and `oXi/` was never a remote.
//   * `--remote 'a|b'` compiles `^a|b/`, and `|` has lower precedence than the
//     anchor, so the pattern means "starts with a, OR contains b/" -- it strips
//     from the MIDDLE of a ref whose name happens to contain `b/`.
//   * `--remote '('` throws `SyntaxError` from deep inside a `.map`, which is
//     the failure mode this repository calls a check that did not run.
//
// WHY ESCAPING IS THE WRONG FIX, and this is the point of the module rather
// than a one-line patch. `escapeRegExp(remote)` closes the injection and leaves
// a regular expression compiled once per branch to answer a question
// `String.prototype.startsWith` already answers exactly. The right observation
// is that a PREFIX STRIP IS A STRING OPERATION and never needed a regex: there
// is no pattern here, only a literal. A fix that keeps the regex keeps a
// machine whose behaviour depends on characters in a CLI argument, and the next
// author to copy the line copies the hazard back.
//
// Anchor (Beacon): CWE-1333 / OWASP's regular-expression-injection class, and
// the general principle Bishop names for TOCTTOU and which transfers intact --
// prefer the operation that answers the question directly over the one that
// asks a question whose answer depends on how the input was spelled.

/**
 * `ref` with a single leading `<remote>/` removed, or `ref` unchanged.
 *
 * Total: every input has an answer, no throw, no compilation. `remote` is
 * treated as LITERAL TEXT, which is what every caller meant.
 *
 * Only ONE prefix is removed, and only at the start. `origin/origin/main` with
 * remote `origin` yields `origin/main` -- a repeated strip would be a different
 * operation, and a caller that wants it can say so twice.
 */
export function stripRemotePrefix(ref: string, remote: string): string {
  if (remote === "") return ref;
  const prefix = remote + "/";
  return ref.startsWith(prefix) ? ref.slice(prefix.length) : ref;
}
