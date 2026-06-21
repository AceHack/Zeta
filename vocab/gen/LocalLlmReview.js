// Dogfood: the room maintains its CoreDORA vocabulary via a LOCAL LLM (Aaron, 2026-06-09:
// "dogfood that test now with local LLMs"). The LLM's SHAPE is the interface, not the
// implementation (Aaron) — `Llm` is a port (prompt -> text, a SoftValue text generator);
// the ollama call is one adapter (local); a remote model would be another. SoftValue:
// LLM output is inherently soft (uncertain) until cross-checked / SolidGround found.
//   bun tools/hygiene/vocab-llm-review.ts [model] [count]
import { readdirSync, lstatSync, existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
const ollama = (model) => async (prompt) => {
    const r = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.2, num_predict: 120 } }),
    });
    if (!r.ok)
        throw new Error(`ollama ${r.status}`);
    return (await r.json()).response.trim();
};
// --- pick a sample of canonical vocab files ---
const VOCAB = new URL("../", import.meta.url).pathname;
function walk(dir) {
    const out = [];
    if (!existsSync(dir))
        return out;
    for (const n of readdirSync(dir).sort()) {
        if (n === "README.md")
            continue;
        const p = join(dir, n);
        const st = lstatSync(p);
        if (st.isSymbolicLink())
            continue;
        if (st.isDirectory())
            out.push(...walk(p));
        else if (n.endsWith(".md"))
            out.push(p);
    }
    return out;
}
function carved(f) {
    return (readFileSync(f, "utf8").split("\n").find((l) => l.startsWith("> ")) ?? "").slice(2).trim();
}
const model = process.argv[2] ?? "qwen2.5:0.5b";
const count = Number(process.argv[3] ?? 5);
const llm = ollama(model);
const files = walk(join(VOCAB, "grams")).slice(0, count);
console.log(`vocab-llm-review (dogfood) — local LLM '${model}' reviewing ${files.length} CoreDORA entries\n`);
for (const f of files) {
    const term = basename(f, ".md"), sentence = carved(f);
    const prompt = `You are reviewing one vocabulary entry for a software project's glossary.\n` +
        `TERM: ${term}\nDEFINITION (one carved sentence): ${sentence}\n\n` +
        `In <=2 short lines: (1) is it ONE clear, self-contained sentence? (2) is it over-broad or vague? ` +
        `Answer plainly.`;
    try {
        const out = await llm(prompt);
        console.log(`### ${term}\n${out}\n`);
    }
    catch (e) {
        console.error(`### ${term} — LLM error: ${e.message}\n`);
    }
}
console.log("dogfood complete — local LLM (SoftValue text-gen behind the Llm port) reviewed the vocab.");
