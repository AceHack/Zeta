#!/usr/bin/env bun
// audit-coauthor-identity-collides.ts — AH005: a committed identity that GitHub resolves
// to somebody who is not us.
//
// The rule this enforces
// ----------------------
// GitHub renders a `Co-authored-by:` trailer, and a commit's author/committer identity, by
// resolving the EMAIL to an account. For the `users.noreply.github.com` domain there are
// three shapes, and exactly one of them is unsafe:
//
//   <id>+<username>@users.noreply.github.com   SAFE  — the numeric id must match the
//                                                      username, so it cannot be squatted.
//   <username>[bot]@users.noreply.github.com   SAFE  — a GitHub username cannot contain
//                                                      `[`, so it resolves to nobody.
//   <username>@users.noreply.github.com        UNSAFE — the LEGACY plain form. GitHub
//                                                      resolves it directly to whoever
//                                                      owns that username, today.
//
// A persona name that is also an ordinary first name therefore attributes our work to a
// stranger. This is not hypothetical: two personas of ours shipped commits under the plain
// form and both local-parts are live accounts belonging to uninvolved private individuals
// (one registered 2008, one 2011). 15 commits under one, 2 under the other. Neither person
// did anything; we named them. That is the whole harm, and it is a real one even though
// nothing was compromised — no breach, no false contribution in the REST
// `/contributors` payload, but the repository's Contributors sidebar (which DOES aggregate
// trailer co-authors, where the REST endpoint does not) renders them.
//
// The `[bot]` suffix is what the fleet's machine lanes already use, and it is safe for a
// structural reason rather than a lucky one: a GitHub username CANNOT contain `[`, so
// `otto[bot]@users.noreply.github.com` can never resolve to an account. That is the form
// to standardise on, and this audit accepts it.
//
// TWO CLASSES, NOT ONE. Do not conflate them:
//
//   COLLIDES  (class 1) — `<name>@users.noreply.github.com`, no `+`, no `[`. HARMFUL:
//                         resolves to a real stranger. This is the defect that was found.
//   FABRICATED(class 2) — an invented, unresolvable namespace (`@zeta.agents`,
//                         `@zeta.local`, `.invalid`, ...). LESSER: GitHub can match it to
//                         nobody, so it misattributes to no one. It is an inconsistency,
//                         and it is reported separately for that reason.
//
// Scope, and its limitation — say this out loud
// ---------------------------------------------
// This audit scans the SOURCES THAT GENERATE identities. It does NOT scan git history, on
// purpose. The offending commits are already on `main`; correcting them would mean
// rewriting published history and force-pushing the default branch, which is forbidden
// here. An audit pointed at history would therefore be permanently red over a set of
// commits nobody is allowed to fix — and a check that can never go green is a check
// somebody eventually disables. So the fix is FORWARD-ONLY and so is the check: the past
// stays as it is, and no NEW generator can introduce the form.
//
// The cost of that scoping, stated rather than hidden: a trailer typed by hand into a PR
// body or a squash message, with no generator in the tree, is invisible here. The
// convention surfaces that agents copy from (the PR template, the harness bootstraps, the
// skills) ARE in scope, which is the reachable half.
//
// Also out of scope by design, each for a reason a reviewer can check:
//   * `*.test.ts` / `*.spec.ts` — fixtures reproduce the defect on purpose (including this
//     audit's own), and flagging them would make the falsifier unwritable. Tests do not
//     push commits.
//   * comment lines in shell / YAML / TS (`#`, `//`, `*`) — a lane must be able to DOCUMENT
//     the banned form beside the code that avoids it. NOT applied to markdown, where `#` is
//     a heading and `*` a bullet, and where a bullet showing a trailer to copy is precisely
//     the generator class this exists to catch.
//   * `SELF_EXEMPT` — one file, this one, which must print the offending form in its own
//     findings text. The test pins that the list has exactly that one entry.
//
// The vacuity this closes
// -----------------------
// `agency-signature-identity-roster.json` already enumerates machine-lane identities, and
// `audit-agencysignature-main-tip.ts` already reasons about co-author trailers — but both
// ask WHO signed, never whether the address they signed with points at somebody else. An
// identity check that validates every field except the one that decides attribution reads
// as coverage and constrains nothing.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules.bak/rule-0-no-sh-files.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-coauthor-identity-collides.ts
//   bun src/Core.TypeScript/hygiene/audit-coauthor-identity-collides.ts --json
//
// Exit codes:
//   0   every generated identity is unambiguous
//   1   at least one generator emits a colliding or fabricated identity
//   2   configuration error (no scan root resolved)

import { type Dirent, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export const DRIFT_CLASS = "AH005";

function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

/**
 * The enumerable roster of scan roots. Explicit rather than "the whole tree" so that the
 * scope is reviewable and so that historical records (docs/history, workitems, memory,
 * docs/research) — which legitimately quote the bad form while describing it — are outside
 * by construction rather than by an allowlist that drifts.
 */
export const SCAN_ROOTS: readonly string[] = [
  ".github/workflows",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/copilot-instructions.md",
  ".claude/agents",
  ".claude/commands",
  ".claude/rules",
  ".claude/skills",
  ".codex/AGENTS.md",
  "src/Core.TypeScript",
  "tools",
  "full-ai-cluster/usb-nixos-installer",
  "registry",
  "AGENTS.md",
  "CLAUDE.md",
  "CODEX.md",
  "CURSOR.md",
  "GEMINI.md",
  "KIRO.md",
];

const SCANNED_EXT = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".yml", ".yaml", ".md", ".sh", ".json"];

const NOREPLY_DOMAIN = "users.noreply.github.com";

/**
 * Namespaces this project invented, plus the reserved special-use TLDs. Deliberately a
 * closed list of things we KNOW are ours-and-unresolvable — an "is this domain real?"
 * heuristic would need DNS, which a pre-merge floor check must not do, and would guess
 * wrong about third-party vendor mailboxes (`noreply@anthropic.com`, `noreply@kiro.dev`)
 * that are correct and must never be flagged.
 */
export const FABRICATED_SUFFIXES: readonly string[] = [
  ".agents",
  ".local",
  ".invalid",
  ".internal",
  ".zeta",
  ".factory",
];
export const FABRICATED_EXACT: readonly string[] = ["zeta.dev", "zeta.agents"];

export type Verdict = "safe-bot-noreply" | "safe-id-noreply" | "collides-plain-noreply" | "fabricated-domain" | "ok";

/**
 * Pure classifier — the whole rule, in one function, so the test can pin it directly
 * against the live strings taken off `main`.
 */
export function classifyEmail(raw: string): Verdict {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0) return "ok";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (domain === NOREPLY_DOMAIN) {
    // Any `+` in the local part. A GitHub username cannot contain `+`, so this form can
    // never BE a bare username — which is the property that matters. The literal case is
    // `578953+acehack@...`; the interpolated case is `${OP_ID}+${MAINTAINER}@...`, which a
    // digits-only test would reject even though it is exactly the fix being asked for.
    // Tested FIRST because it is the stronger statement: `41898282+github-actions[bot]@...`
    // satisfies both and should report as id-verified, not merely as a bot name.
    if (local.includes("+")) return "safe-id-noreply";
    // A GitHub username cannot contain `[`, so the bot form can never resolve to a person.
    if (local.includes("[")) return "safe-bot-noreply";
    return "collides-plain-noreply";
  }

  if (FABRICATED_EXACT.includes(domain)) return "fabricated-domain";
  if (FABRICATED_SUFFIXES.some((s) => domain.endsWith(s))) return "fabricated-domain";
  return "ok";
}

export interface Finding {
  file: string;
  line: number;
  email: string;
  verdict: Verdict;
  klass: 1 | 2;
  origin: "co-author-trailer" | "git-identity";
  snippet: string;
}

export interface AuditResult {
  driftClass: string;
  filesScanned: number;
  identitiesSeen: number;
  findings: Finding[];
}

/**
 * `Co-authored-by: Name <email>` in any carrier — a markdown template, a YAML `run:` block,
 * or a TypeScript template literal where the surrounding newlines are `\n` escapes. Anchored
 * on the token rather than on line start for exactly that last case.
 */
const TRAILER = /co-authored-by:[^\n"'`]*/gi;
/** Every `<...>` inside a matched trailer; the address is the last one carrying an `@`. */
const ANGLED = /<([^<>\n]+)>/g;

/**
 * The author/committer identity a lane configures for itself. Same harm, different
 * syntactic position: `git config user.email "<name>@users.noreply.github.com"` puts the
 * stranger in the author field instead of the trailer.
 */
const GIT_IDENTITY = /(?:user\.email[=\s]+|GIT_(?:AUTHOR|COMMITTER)_EMAIL\s*=\s*)["']?([^"'\s;]+)/gi;

/**
 * Any occurrence of the GitHub noreply domain, wherever it appears. Needed because the
 * address is often built into an intermediate shell variable several lines away from the
 * `git config` that consumes it — which is exactly how the USB installer's site evaded the
 * two positional patterns above. The domain is unambiguous: it has no use other than as a
 * commit identity, so a bare match is a real identity reference and not a coincidence.
 */
const BARE_NOREPLY = /([A-Za-z0-9_.+$#{}[\]|-]+)@users\.noreply\.github\.com/g;

/**
 * The ONE self-exemption, by exact path, because this file necessarily prints the
 * offending form in its own findings text. Enumerable rather than a pattern, so it cannot
 * quietly widen; the test pins that it contains exactly this one entry. `*.test.ts` is
 * already excluded by `isScannable`, which is what lets the falsifier hold real fixtures.
 */
export const SELF_EXEMPT: readonly string[] = ["src/Core.TypeScript/hygiene/audit-coauthor-identity-collides.ts"];

/**
 * A line that cannot execute and cannot be copied into a commit: a shell/YAML `#` comment
 * or a TS/JS `//`, `*`, `/*` comment. Same carve-out AH002 makes, and for the same reason —
 * a lane must be able to DOCUMENT the banned form next to the code that avoids it.
 *
 * Deliberately NOT applied to markdown: `#` is a heading and `*` a bullet there, and a
 * markdown bullet showing a trailer to copy is precisely the generator class this audit
 * exists to catch (the PR template is one).
 */
const COMMENTABLE = [".sh", ".yml", ".yaml", ".ts", ".tsx", ".js", ".mjs", ".cjs"];
export function isCommentLine(relPath: string, line: string): boolean {
  if (!COMMENTABLE.some((e) => relPath.endsWith(e))) return false;
  return /^\s*(#|\/\/|\*|\/\*)/.test(line);
}

function lineOf(src: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === "\n") n++;
  return n;
}

function snippetAt(src: string, index: number): string {
  const start = src.lastIndexOf("\n", index) + 1;
  let end = src.indexOf("\n", index);
  if (end < 0) end = src.length;
  return src.slice(start, end).trim().slice(0, 200);
}

export function auditText(relPath: string, src: string): { findings: Finding[]; identities: number } {
  const findings: Finding[] = [];
  let identities = 0;

  const consider = (email: string, index: number, origin: Finding["origin"]) => {
    if (!email.includes("@")) return;
    if (isCommentLine(relPath, snippetAt(src, index))) return;
    identities++;
    const verdict = classifyEmail(email);
    if (verdict === "ok" || verdict === "safe-bot-noreply" || verdict === "safe-id-noreply") return;
    findings.push({
      file: relPath,
      line: lineOf(src, index),
      email,
      verdict,
      klass: verdict === "collides-plain-noreply" ? 1 : 2,
      origin,
      snippet: snippetAt(src, index),
    });
  };

  for (const m of src.matchAll(TRAILER)) {
    // `Co-authored-by: <persona> <persona@zeta.agents>` — the NAME may itself be an angled
    // placeholder, so take the last bracketed run that looks like an address rather than
    // assuming the first one is the name.
    const angled = [...(m[0] ?? "").matchAll(ANGLED)].map((a) => a[1] ?? "").filter((v) => v.includes("@"));
    const addr = angled[angled.length - 1];
    if (addr !== undefined) consider(addr, m.index ?? 0, "co-author-trailer");
  }
  for (const m of src.matchAll(GIT_IDENTITY)) consider(m[1] ?? "", m.index ?? 0, "git-identity");
  for (const m of src.matchAll(BARE_NOREPLY)) {
    consider(`${m[1] ?? ""}@${NOREPLY_DOMAIN}`, m.index ?? 0, "git-identity");
  }

  // Same address reached by more than one extractor is one defect, not three.
  const seen = new Set<string>();
  const deduped = findings.filter((f) => {
    const k = `${f.line}\u0000${f.email}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { findings: deduped, identities };
}

export function isScannable(relPath: string): boolean {
  if (SELF_EXEMPT.includes(relPath.split("\\").join("/"))) return false;
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(relPath)) return false;
  return SCANNED_EXT.some((e) => relPath.endsWith(e));
}

function walk(abs: string, out: string[]): void {
  // `withFileTypes` so the entry KIND arrives with the listing. A `readdir` then `stat`
  // pair asks the filesystem twice and races in between (TOCTOU, CWE-367) — and the
  // listing already knew the answer.
  let entries: Dirent[];
  try {
    entries = readdirSync(abs, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const child = join(abs, entry.name);
    if (entry.isDirectory()) walk(child, out);
    else if (entry.isFile()) out.push(child);
  }
}

export function runAudit(roots: readonly string[] = SCAN_ROOTS): AuditResult {
  const root = repoRoot();
  const files: string[] = [];
  for (const r of roots) {
    const abs = resolve(root, r);
    const before = files.length;
    walk(abs, files);
    // `walk` returns empty for a non-directory (readdir throws ENOTDIR) and for a path that
    // does not exist. A root that is a single FILE is the first case, so offer it directly
    // and let the read decide — no stat to race against. A missing root is not a finding.
    if (files.length === before) files.push(abs);
  }

  const findings: Finding[] = [];
  let identitiesSeen = 0;
  let filesScanned = 0;
  for (const abs of files.sort()) {
    const rel = relative(root, abs);
    if (!isScannable(rel)) continue;
    let src: string;
    try {
      src = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    filesScanned++;
    const r = auditText(rel, src);
    identitiesSeen += r.identities;
    findings.push(...r.findings);
  }

  // Ordinal, never `localeCompare`: linguistic collation is locale/ICU-dependent, so two
  // machines can order the same findings differently. `.claude/rules/culture-invariant-by-default.md`.
  const ordinal = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);
  findings.sort((a, b) => a.klass - b.klass || ordinal(a.file, b.file) || a.line - b.line);
  return { driftClass: DRIFT_CLASS, filesScanned, identitiesSeen, findings };
}

export function renderHuman(r: AuditResult): string {
  const head = `${r.filesScanned} generator file(s), ${r.identitiesSeen} identity reference(s)`;
  if (r.findings.length === 0) {
    return `coauthor-identity-collides: OK — ${head}; every generated identity is unambiguous.`;
  }
  const c1 = r.findings.filter((f) => f.klass === 1);
  const c2 = r.findings.filter((f) => f.klass === 2);
  const out: string[] = [`coauthor-identity-collides: ${r.findings.length} finding(s) — ${head}`, ""];
  if (c1.length > 0) {
    out.push(
      `CLASS 1 — COLLIDES WITH A REAL ACCOUNT (${c1.length}). HARMFUL.`,
      "  `<name>@users.noreply.github.com` resolves DIRECTLY to whoever owns that username",
      "  on github.com today. Use `<name>[bot]@users.noreply.github.com` (a username cannot",
      "  contain `[`, so it can never collide) or the id-verified",
      "  `<id>+<name>@users.noreply.github.com`.",
      "",
      ...c1.map((f) => `  ${f.file}:${f.line}  [${f.origin}] ${f.email}\n    ${f.snippet}`),
      "",
    );
  }
  if (c2.length > 0) {
    out.push(
      `CLASS 2 — FABRICATED, UNRESOLVABLE NAMESPACE (${c2.length}). LESSER: misattributes to`,
      "  nobody, because GitHub can match it to nobody. Inconsistent, not harmful. Same fix.",
      "",
      ...c2.map((f) => `  ${f.file}:${f.line}  [${f.origin}] ${f.email}\n    ${f.snippet}`),
      "",
    );
  }
  out.push(
    "Scope note: this audit reads GENERATORS, never git history. Commits already on `main`",
    "carry the old form and are not rewritable (that would mean force-pushing the default",
    "branch). The fix is forward-only; so is the check.",
  );
  return out.join("\n");
}

export function main(argv: string[]): number {
  const root = repoRoot();
  const r = runAudit();
  // Configuration error, derived from what was actually READ rather than from a prior
  // stat: if not one file under any of the roots could be opened, the audit did not run
  // and must not report a clean result. A check that did not run is not one that passed.
  if (r.filesScanned === 0) {
    process.stderr.write(`error: no file readable under any of the ${SCAN_ROOTS.length} scan roots (ROOT=${root})\n`);
    return 2;
  }
  process.stdout.write((argv.includes("--json") ? JSON.stringify(r, null, 2) : renderHuman(r)) + "\n");
  return r.findings.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
