// Vocabulary uniqueness enforcer (Aaron, 2026-06-09): "enforced uniqueness for our
// model" across the date-agnostic vocabulary folders. A traveler is either a real
// intake file in travelers/, OR a real file in exactly one category home (grams/<n>,
// letters/<lang>, shapes, colors, temperatures) — never duplicated — and every symlink
// resolves. Run: bun tools/hygiene/vocab-uniqueness.ts   (exit 1 on any violation)
import { readdirSync, lstatSync, existsSync, realpathSync } from "node:fs";
import { join, basename, relative } from "node:path";

const DOCS = new URL("../../docs/", import.meta.url).pathname;
const HOMES = ["grams", "letters", "shapes", "colors", "temperatures"]; // canonical category roots
const violations: string[] = [];
const v = (m: string) => violations.push(m);

/** Recursively list entries; returns {file|symlink, path}. Skips READMEs and the words symlink dir. */
function walk(dir: string): { path: string; link: boolean }[] {
  const out: { path: string; link: boolean }[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "README.md") continue;
    const p = join(dir, name);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) out.push({ path: p, link: true });
    else if (st.isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".md")) out.push({ path: p, link: false });
  }
  return out;
}

// 1) No dangling symlinks anywhere under docs/ vocab (words, travelers, any).
for (const root of [...HOMES, "travelers", "words"]) {
  for (const e of walk(join(DOCS, root))) {
    if (e.link && !existsSync(realpathSafe(e.path))) v(`dangling symlink: docs/${relative(DOCS, e.path)}`);
  }
}
function realpathSafe(p: string): string { try { return realpathSync(p); } catch { return "/__missing__"; } }

// 2) grams term global uniqueness: a term basename is a real file in at most one grams/<n>.
const gramsTerms = new Map<string, string[]>();
for (const e of walk(join(DOCS, "grams"))) {
  if (e.link) continue;
  const term = basename(e.path, ".md");
  (gramsTerms.get(term) ?? gramsTerms.set(term, []).get(term)!).push(relative(DOCS, e.path));
}
for (const [term, paths] of gramsTerms) if (paths.length > 1) v(`grams term not unique: "${term}" in ${paths.join(", ")}`);

// 3) travelers/ discipline: a symlink must resolve INTO a category home; a real file is
//    allowed (intake) but then that term must NOT also be a real file in a category home.
const homeRealTerms = new Set<string>();
for (const home of HOMES) for (const e of walk(join(DOCS, home))) if (!e.link) homeRealTerms.add(basename(e.path, ".md"));
for (const e of walk(join(DOCS, "travelers"))) {
  const term = basename(e.path, ".md");
  if (e.link) {
    const tgt = realpathSafe(e.path);
    const underHome = HOMES.some((h) => tgt.includes(`/docs/${h}/`));
    if (!underHome) v(`travelers symlink does not point into a category home: docs/${relative(DOCS, e.path)} -> ${tgt}`);
  } else {
    // real intake file: must not already be homed (would be a duplicate, not intake)
    if (homeRealTerms.has(term)) v(`travelers intake "${term}" duplicates a homed term — move to symlink: docs/${relative(DOCS, e.path)}`);
  }
}

if (violations.length) {
  console.error(`vocab-uniqueness: ${violations.length} violation(s):`);
  for (const m of violations) console.error("  - " + m);
  process.exit(1);
}
console.log("vocab-uniqueness: OK — every traveler has one canonical home; all symlinks resolve.");
