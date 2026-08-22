// The adoption tripwire for the signed announce wire (BUGS.md RESIDUAL 1).
//
// #13466 built the membrane and proved it correct; the residual was that NOTHING TURNED IT ON.
// The measured state of the tree when this file was written is that **no production code
// constructs a Reticulum transport at all** — the only `createReticulumTransport` call sites in
// `src/`, `tools/` and `clis/` are this module's own tests. (The four files RESIDUAL 1 named as
// consumers — `dht-discovery.ts`, `reticulum-metered-transport.ts`, `mux-transport-bridge.ts`,
// `network-transport.ts` — do not construct one: three mention `reticulum-transport.ts` only in
// a docstring, and the fourth imports `destinationHash` and nothing else. That was checked, not
// assumed.)
//
// A migration whose domain is empty cannot be performed, so what closes the residual is making
// the NEXT construction site land on the right side by default: `announceAuth` is now a REQUIRED
// field, and this file is the standing guard that a production site never declares `"off"`.
//
// WHY THIS IS A GUARD AND NOT A VACUOUS CHECK. The quantified claim ("no production call site is
// off-mode") ranges over an empty set today, and an assertion over ∅ is the vacuity class in its
// purest form — it looks like compliance and constrains nothing. So two of the three tests below
// exist to make the third mean something: one falsifies the PREDICATE against a fixture that must
// be caught, and one proves the SCANNER actually sees the call sites that do exist. Empty then
// means empty, rather than "the scanner is broken" or "the rule cannot fire".

import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const SCAN_ROOTS = ["src", "tools", "clis"];
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "references", "obj", "bin"]);

/// A scan root that does not exist is not an error — the other roots still scan.
function safeReaddir(dir: string) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of safeReaddir(dir)) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith(".ts") && !e.name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

/// Lines that CONSTRUCT a transport — not the declaration, not an import, not a doc mention.
/// Deliberately line-based and dumb: a check a reader can reproduce with `grep` is a check a
/// reader can trust, and an AST pass here would be a second parser to keep honest.
export function constructionLines(text: string): readonly string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.includes("createReticulumTransport("))
    .filter((l) => !l.startsWith("//") && !l.startsWith("*") && !l.startsWith("/*"))
    .filter((l) => !l.startsWith("export function") && !l.startsWith("function"));
}

/// Does this file declare the legacy unsigned mode? Tolerant of formatting/quoting so it cannot
/// be slipped past with whitespace.
export function declaresOffMode(text: string): boolean {
  return /announceAuth\s*:\s*\{\s*mode\s*:\s*['"]off['"]\s*\}/.test(text);
}

const files = SCAN_ROOTS.flatMap((r) => walk(join(REPO_ROOT, r)));
const callers = files.filter((f) => constructionLines(readFileSync(f, "utf8")).length > 0);
const isTestOrDemo = (f: string): boolean => /\.(test|spec|proof\.test|demo)\.ts$/.test(f) || f.includes("/__tests__/");
const productionCallers = callers.filter((f) => !isTestOrDemo(f));

describe("announce-auth adoption — the tripwire, and the two tests that keep it honest", () => {
  it("the PREDICATE catches an off-mode production site (so the rule below can fire)", () => {
    const offSite = `const rt = createReticulumTransport({ zid: "z", announceAuth: { mode: "off" } }, lower, sched);`;
    expect(constructionLines(offSite)).toHaveLength(1);
    expect(declaresOffMode(offSite)).toBe(true);
    // ...and does NOT fire on a migrated site, or the rule would block the good outcome too.
    const onSite = `const rt = createReticulumTransport({ zid: "z", announceAuth: { mode: "required", sign, verify } }, lower, sched);`;
    expect(constructionLines(onSite)).toHaveLength(1);
    expect(declaresOffMode(onSite)).toBe(false);
  });

  it("the SCANNER sees the call sites that exist (so an empty production set means empty)", () => {
    const rel = callers.map((f) => f.slice(REPO_ROOT.length + 1));
    expect(rel).toContain("src/Core.TypeScript/discovery/reticulum-transport.test.ts");
    expect(rel).toContain("src/Core.TypeScript/discovery/reticulum-transport.adversarial.test.ts");
    expect(rel).toContain("src/Core.TypeScript/discovery/reticulum-announce-auth.test.ts");
    // The declaration itself must NOT be counted as a call site.
    expect(rel).not.toContain("src/Core.TypeScript/discovery/reticulum-transport.ts");
  });

  it("no PRODUCTION call site declares announceAuth 'off' (BUGS.md RESIDUAL 1)", () => {
    const offenders = productionCallers
      .filter((f) => declaresOffMode(readFileSync(f, "utf8")))
      .map((f) => f.slice(REPO_ROOT.length + 1));
    // If this fires: `{mode:"off"}` is the pre-fix wire — any peer can claim any identity (the
    // Eclipse primitive). Route the consumer through `off → dual → required`, exactly as
    // `llmtv-node.ts` walked it for the discovery wire, or record a `LIFTS WHEN:` in docs/BUGS.md
    // saying what blocks it. An off consumer that LOOKS migrated is worse than one that obviously
    // is not.
    expect(offenders).toEqual([]);
  });
});
