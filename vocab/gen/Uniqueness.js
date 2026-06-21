// Vocabulary uniqueness enforcer (Aaron, 2026-06-09): canonical homes are the TYPE folders
// (words/, letters/, shapes/, colors/, temperatures/ — real files); grams/ and travelers/ are
// symlink views. Enforces: one canonical home per term; all symlinks resolve; travelers/
// intake discipline; multi-sense terms carry a discriminator. Run: bun vocab/gen/Uniqueness.ts
import { readdirSync, lstatSync, existsSync, realpathSync, readFileSync, readlinkSync } from "node:fs";
import { join, basename, relative, dirname } from "node:path";
const VOCAB = new URL("../", import.meta.url).pathname;
const CANON = ["words", "letters", "shapes", "colors", "temperatures", "personas"]; // canonical type homes (real)
const VIEWS = ["grams", "travelers"]; // symlink views
const violations = [];
const v = (m) => violations.push(m);
const realpathSafe = (p) => { try {
    return realpathSync(p);
}
catch {
    return "/__missing__";
} };
const readlinkSafe = (p) => { try {
    return readlinkSync(p);
}
catch {
    return "";
} };
const lstatSafe = (p) => { try {
    return lstatSync(p);
}
catch {
    return null;
} };
function walk(dir) {
    const out = [];
    if (!existsSync(dir))
        return out;
    for (const name of readdirSync(dir)) {
        if (name === "README.md" || name === "INDEX.md")
            continue;
        const p = join(dir, name);
        const st = lstatSync(p);
        if (st.isSymbolicLink())
            out.push({ path: p, link: true });
        else if (st.isDirectory())
            out.push(...walk(p));
        else if (name.endsWith(".md"))
            out.push({ path: p, link: false });
    }
    return out;
}
// 1) No dangling symlinks in the views (grams, travelers) or the top-level type aliases.
for (const root of [...VIEWS, ...CANON])
    for (const e of walk(join(VOCAB, root)))
        if (e.link && !existsSync(realpathSafe(e.path)))
            v(`dangling symlink: docs/${relative(VOCAB, e.path)}`);
// 2) Canonical uniqueness: a term basename is a real file in at most one canonical home.
const canonTerms = new Map();
const homeRealTerms = new Set();
for (const home of CANON)
    for (const e of walk(join(VOCAB, home))) {
        if (e.link)
            continue;
        const term = basename(e.path, ".md");
        homeRealTerms.add(term);
        const arr = canonTerms.get(term) ?? [];
        arr.push(relative(VOCAB, e.path));
        canonTerms.set(term, arr);
    }
for (const [term, paths] of canonTerms)
    if (paths.length > 1)
        v(`term not unique across canonical homes: "${term}" in ${paths.join(", ")} (add a discriminator / pick one home)`);
// 3) travelers/ discipline: a symlink must resolve into a canonical home; a real intake file
//    must NOT duplicate a homed term (once homed it becomes a symlink).
for (const e of walk(join(VOCAB, "travelers"))) {
    const term = basename(e.path, ".md");
    if (e.link) {
        if (!CANON.some((h) => realpathSafe(e.path).includes(`/vocab/${h}/`)))
            v(`travelers symlink not into a canonical home: docs/${relative(VOCAB, e.path)}`);
    }
    else if (homeRealTerms.has(term)) {
        v(`travelers intake "${term}" duplicates a homed term — move to symlink: docs/${relative(VOCAB, e.path)}`);
    }
}
// 4) Discriminator: a term with >1 carved sentence (>1 sense) needs context-policy/discriminator/senses.
for (const home of CANON)
    for (const e of walk(join(VOCAB, home))) {
        if (e.link)
            continue;
        const body = readFileSync(e.path, "utf8");
        if (body.split("\n").filter((l) => l.startsWith("> ")).length > 1) {
            const fm = body.startsWith("---") ? body.slice(3, Math.max(3, body.indexOf("\n---", 3))) : "";
            if (!/(^|\n)\s*(context-policy|discriminator|senses)\s*:/.test(fm))
                v(`multi-sense term needs a discriminator (frontmatter context-policy/discriminator/senses): docs/${relative(VOCAB, e.path)}`);
        }
    }
// 5) DAG invariant (Aaron): the ZetaId owner = the canonical node; a symlink = a directed edge INTO
//    canonical. Every view symlink must resolve (no ELOOP = no cycle) AND its immediate target must be
//    a REAL canonical file (no symlink->symlink chains) — so the reference graph is a DAG (views are
//    sources, canonical homes are the sink layer; "who owns the ZetaId" vs "who is the symlink").
for (const view of ["grams", "travelers"])
    for (const e of walk(join(VOCAB, view))) {
        if (!e.link)
            continue;
        const immediate = realpathSafe(join(dirname(e.path), readlinkSafe(e.path)));
        if (!existsSync(immediate)) {
            v(`DAG: symlink resolves nowhere: ${relative(VOCAB, e.path)}`);
            continue;
        }
        if (lstatSafe(immediate)?.isSymbolicLink())
            v(`DAG: symlink points to another symlink (chain, not an edge into canonical): ${relative(VOCAB, e.path)}`);
    }
if (violations.length) {
    console.error(`vocab-uniqueness: ${violations.length} violation(s):`);
    for (const m of violations)
        console.error("  - " + m);
    process.exit(1);
}
console.log("vocab-uniqueness: OK — canonical homes unique; symlinks resolve; travelers + discriminator clean.");
