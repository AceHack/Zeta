// Vocabulary uniqueness enforcer (Aaron, 2026-06-09): canonical homes are the TYPE folders
// (words/, letters/, shapes/, colors/, temperatures/ — real files); grams/ and travelers/ are
// symlink views. Enforces: one canonical home per term; all symlinks resolve; travelers/
// intake discipline; multi-sense terms carry a discriminator. Run: bun tools/hygiene/vocab-uniqueness.ts
import { readdirSync, lstatSync, existsSync, realpathSync, readFileSync } from "node:fs";
import { join, basename, relative } from "node:path";

const DOCS = new URL("../../docs/", import.meta.url).pathname;
const CANON = ["words", "letters", "shapes", "colors", "temperatures", "personas"]; // canonical type homes (real)
const VIEWS = ["grams", "travelers"];                                    // symlink views
const violations: string[] = [];
const v = (m: string) => violations.push(m);
const realpathSafe = (p: string) => { try { return realpathSync(p); } catch { return "/__missing__"; } };

function walk(dir: string): { path: string; link: boolean }[] {
  const out: { path: string; link: boolean }[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "README.md" || name === "INDEX.md") continue;
    const p = join(dir, name); const st = lstatSync(p);
    if (st.isSymbolicLink()) out.push({ path: p, link: true });
    else if (st.isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".md")) out.push({ path: p, link: false });
  }
  return out;
}

// 1) No dangling symlinks in the views (grams, travelers) or the top-level type aliases.
for (const root of [...VIEWS, ...CANON]) for (const e of walk(join(DOCS, root)))
  if (e.link && !existsSync(realpathSafe(e.path))) v(`dangling symlink: docs/${relative(DOCS, e.path)}`);

// 2) Canonical uniqueness: a term basename is a real file in at most one canonical home.
const canonTerms = new Map<string, string[]>();
const homeRealTerms = new Set<string>();
for (const home of CANON) for (const e of walk(join(DOCS, home))) {
  if (e.link) continue;
  const term = basename(e.path, ".md");
  homeRealTerms.add(term);
  const arr = canonTerms.get(term) ?? []; arr.push(relative(DOCS, e.path)); canonTerms.set(term, arr);
}
for (const [term, paths] of canonTerms) if (paths.length > 1) v(`term not unique across canonical homes: "${term}" in ${paths.join(", ")} (add a discriminator / pick one home)`);

// 3) travelers/ discipline: a symlink must resolve into a canonical home; a real intake file
//    must NOT duplicate a homed term (once homed it becomes a symlink).
for (const e of walk(join(DOCS, "travelers"))) {
  const term = basename(e.path, ".md");
  if (e.link) {
    if (!CANON.some((h) => realpathSafe(e.path).includes(`/docs/${h}/`)))
      v(`travelers symlink not into a canonical home: docs/${relative(DOCS, e.path)}`);
  } else if (homeRealTerms.has(term)) {
    v(`travelers intake "${term}" duplicates a homed term — move to symlink: docs/${relative(DOCS, e.path)}`);
  }
}

// 4) Discriminator: a term with >1 carved sentence (>1 sense) needs context-policy/discriminator/senses.
for (const home of CANON) for (const e of walk(join(DOCS, home))) {
  if (e.link) continue;
  const body = readFileSync(e.path, "utf8");
  if (body.split("\n").filter((l) => l.startsWith("> ")).length > 1) {
    const fm = body.startsWith("---") ? body.slice(3, Math.max(3, body.indexOf("\n---", 3))) : "";
    if (!/(^|\n)\s*(context-policy|discriminator|senses)\s*:/.test(fm))
      v(`multi-sense term needs a discriminator (frontmatter context-policy/discriminator/senses): docs/${relative(DOCS, e.path)}`);
  }
}

if (violations.length) {
  console.error(`vocab-uniqueness: ${violations.length} violation(s):`);
  for (const m of violations) console.error("  - " + m);
  process.exit(1);
}
console.log("vocab-uniqueness: OK — canonical homes unique; symlinks resolve; travelers + discriminator clean.");
