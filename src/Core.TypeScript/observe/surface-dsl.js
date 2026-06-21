#!/usr/bin/env bun
// surface-dsl.ts — compile carved-sentence surfaces into a DSL the observe.ts
// loop executes (B-1016 refinement C, Aaron 2026-06-04: "once we compress this we
// can use this as DSL into observe.ts where very little intelligence is needed
// except at the choose point after simulate").
//
// THE INSIGHT: a minimized surface (a rule = carved sentence + pointers) is no
// longer prose only a model can interpret — it is a DIRECTIVE the deterministic
// controller can read. observe.ts is already sense → observe() (deterministic) →
// chooseAction (model) → simulate (deterministic). This compiles the rule corpus
// into the compact DSL fed to the model AT THE CHOOSE POINT ONLY; every other leg
// is model-free. And the DSL's compression is measurable by the byte-cost meter
// (the same B-1016 unit) — so "less intelligence needed" is a measured claim.
//
// NCI: reads + compiles surfaces; removes nothing.
import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { measureText } from "../byte-cost/byte-cost";
const stem = (path) => path.replace(/^.*\//, "").replace(/\.md$/, "");
/** Parse one surface into a Directive (pure, deterministic — no model). */
export function parseSurface(path, text) {
    const lines = text.split("\n");
    const title = (lines.find((l) => l.startsWith("# ")) ?? `# ${stem(path)}`).slice(2).trim();
    // Carved sentence = the blockquote immediately following a "Carved sentence:" line,
    // else the first blockquote in the file.
    const carvedAnchor = lines.findIndex((l) => /carved sentence:/i.test(l));
    const start = carvedAnchor >= 0 ? carvedAnchor + 1 : 0;
    const quote = [];
    for (let i = start; i < lines.length; i++) {
        const l = lines[i];
        if (l.trim().startsWith(">"))
            quote.push(l.trim().replace(/^>\s?/, ""));
        else if (quote.length > 0)
            break; // blockquote ended
    }
    const carved = quote.join(" ").replace(/\s+/g, " ").trim();
    // Pointers = markdown link targets + bare backtick paths under a Pointers section.
    const pointers = new Set();
    for (const m of text.matchAll(/\]\(([^)]+\.md)\)/g))
        pointers.add(m[1]);
    for (const m of text.matchAll(/`([a-zA-Z0-9_./-]+\.md)`/g))
        pointers.add(m[1]);
    return { id: stem(path), title, carved, pointers: [...pointers].sort() };
}
/** Compile a set of surfaces into the DSL (sorted by id; pure). */
export function compile(surfaces) {
    return surfaces.map((s) => parseSurface(s.path, s.text)).sort((a, b) => a.id.localeCompare(b.id));
}
/** The compact DSL string the MODEL reads at the choose-point — carved sentences
 *  only, pointers dropped (the model needs the directive, not the detail; detail
 *  is one hop away if a chosen action needs it). This is the token-saving payload. */
export function toChoosePrompt(directives) {
    return directives.map((d) => `- ${d.id}: ${d.carved}`).join("\n");
}
// ── CLI ───────────────────────────────────────────────────────────────────────
const MANIFEST = [".claude/rules/*.md"];
if (import.meta.main) {
    const paths = MANIFEST.flatMap((g) => [...new Glob(g).scanSync({ cwd: ".", dot: true })]).sort();
    const surfaces = paths.map((p) => ({ path: p, text: readFileSync(p, "utf8") }));
    const dsl = compile(surfaces);
    const prompt = toChoosePrompt(dsl);
    const rawCost = measureText(surfaces.map((s) => s.text).join("\n")).bytes;
    const dslCost = measureText(prompt).bytes;
    const args = new Set(Bun.argv.slice(2));
    if (args.has("--emit")) {
        console.log(prompt);
        process.exit(0);
    }
    console.log(`surface-DSL: compiled ${dsl.length} directives from ${surfaces.length} surfaces`);
    for (const d of dsl)
        console.log(`  ${d.id} (${d.pointers.length} pointers): ${d.carved.slice(0, 72)}${d.carved.length > 72 ? "…" : ""}`);
    const pct = rawCost === 0 ? 0 : (1 - dslCost / rawCost) * 100;
    console.log(`\nchoose-point payload: ${dslCost}B vs raw surfaces ${rawCost}B — ${pct.toFixed(1)}% smaller.\n` +
        `The model reads ${dslCost}B at the choose-point; the deterministic legs (parse/observe/simulate) read 0B of model context.`);
    process.exit(0);
}
