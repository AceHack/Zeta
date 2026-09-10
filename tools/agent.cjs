#!/usr/bin/env node
/**
 * agent.cjs — a model-backed agent for whatever SDLC step the organization hands it.
 *
 * ── WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT ────────────────────────────
 * This is a MODEL CLIENT, not a process. It knows how to be invoked, how to read the brief the
 * organization put in its environment, how to talk to a model, and how to answer in the line
 * protocol the artifact port expects. It knows NOTHING about software delivery: no list of gates,
 * no idea what a BRD contains, no opinion about when a requirement is ambiguous, no questions of
 * its own. Every one of those is the model's to decide, from the step name it was given.
 *
 * That distinction is the whole point. An earlier attempt at "the organization interviews you"
 * encoded ten questions and a regular-expression ambiguity score into the substrate — which meant
 * the org could only ever ask what its author had thought of, and a differently-configured company
 * with different SDLC steps would get the same ten questions. Here, changing the gate chain changes
 * what the agents do, because the gate name is what the agent is told and everything else follows
 * from it.
 *
 * ── THE PROTOCOL ─────────────────────────────────────────────────────────────
 * argv: <gate> <workId> [prior artifact paths...] [context document paths...]
 * env : ORG_WORK_TITLE, ORG_WORK_TYPE, ORG_WORK_ID, ORG_WORK_OWNER, ORG_ANSWERS (JSON)
 *
 * stdout, one per line, per `commandArtifactProducer`:
 *   <path>         a document it produced
 *   - <item>       something it undertook to do
 *   relied on <r>  a document it read
 *   ask: <q>       something only a person can answer; REFUSES the gate until answered
 *   usage: ...     tokens spent
 *
 * A step that asks produces nothing. That is enforced by the port and is right: an agent that
 * writes the document AND asks what should have been in it has produced a guess, and the guess
 * would reach a reviewer with the uncertainty stripped off.
 */
"use strict";
const { writeFileSync, mkdirSync, readFileSync, existsSync } = require("node:fs");
const { join, resolve } = require("node:path");

const MODEL = process.env.ORG_MODEL || "qwen2.5:7b";
const HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const OUT_DIR = process.env.ORG_DOCS_DIR || join(process.cwd(), ".org-docs");

const [gate, workId, ...refs] = process.argv.slice(2);
if (!gate || !workId) {
  process.stderr.write("usage: agent.cjs <gate> <workId> [prior/context paths...]\n");
  process.exit(2);
}

const title = process.env.ORG_WORK_TITLE || "";
const workType = process.env.ORG_WORK_TYPE || "work item";
const owner = process.env.ORG_WORK_OWNER || "";
/** How many more times the organization will let this work come back with questions. */
const rounds = process.env.ORG_ASK_ROUNDS_LEFT || "unbounded";
/** The requester's own words about why this matters and what done looks like. */
const brief = process.env.ORG_WORK_BRIEF || "";

// ── THE SKILL THIS ORGANIZATION SAYS PERFORMS THIS STEP ────────────────────
// `ORG_SKILL` names it; `ORG_SKILL_SOURCE` says where it comes from; `ORG_SKILL_WHY` says why this
// one. An unbound gate resolves to the repository's own skills, which is a real answer and not an
// absence - so when nothing is named, look in the checkout for what it provides.
/** Named, because an escape in this file keeps being eaten before it reaches disk. */
const NEWLINE = String.fromCharCode(10);
const NEWLINE_SPLIT = new RegExp(String.fromCharCode(92) + "r?" + String.fromCharCode(92) + "n");
// ── THE MODEL WRITES MARKDOWN, AND THESE ARE STILL PROTOCOL LINES ─────────
// MEASURED on a real ELERA epic: the model answered with `**ASK:** ...` and `**LEARNED:** ...`,
// bolded like the rest of its prose. A parser anchored on a bare `ASK:` matched neither, so a good
// grounded question reached nobody and a hard-won fact never became a memory — both were sitting in
// the document, which is the one place they are useless.
//
// Leading bullet and emphasis are stripped before matching, and a trailing `**` after the colon is
// tolerated. Being generous here costs nothing; being strict silently drops the two things the
// whole channel exists to carry.
// Regex LITERALS, not strings: `"\s"` in a JS string is just `s`, which built `^[s>*_-]***s*` and
// threw "Nothing to repeat" at load. `node --check` parses that file happily — the failure is at
// runtime, so a syntax check is not the falsifier here.
// `#` too: MEASURED, the model wrote `### ASK:` as a heading on one gate and `**ASK:**` as bold on
// another. Every leading decoration a markdown writer reaches for has to be tolerated, because the
// alternative is that a good question stays in the document, which is the one place it is useless.
const LEARNED_RE = /^[\s>*_#-]*\**\s*LEARNED:?\**\s*:?\s*/i;
const ASK_RE = /^[\s>*_#-]*\**\s*ASK:?\**\s*:?\s*/i;
const skillName = process.env.ORG_SKILL || "";
const skillSource = process.env.ORG_SKILL_SOURCE || "repo";
const skillWhy = process.env.ORG_SKILL_WHY || "";

/** Skills the checkout itself ships, as `.claude/skills/<name>/SKILL.md`. */
function repoSkills(root) {
  const dir = join(root, ".claude", "skills");
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of require("node:fs").readdirSync(dir)) {
    for (const file of ["SKILL.md", "skill.md"]) {
      const at = join(dir, name, file);
      if (existsSync(at)) { out.push({ name, path: at }); break; }
    }
  }
  return out;
}

const available = repoSkills(process.env.ORG_WORKDIR || process.cwd());
// The named one first when the checkout has it; otherwise everything it offers, so the model can
// pick. Capped, because a repository with forty skills would otherwise fill the prompt with them.
const chosen = skillName === ""
  ? available.slice(0, 4)
  : available.filter((sk) => sk.name === skillName).concat(available.filter((sk) => sk.name !== skillName)).slice(0, 3);
const skillText = chosen
  .map((sk) => {
    try { return "--- skill: " + sk.name + " ---" + NEWLINE + readFileSync(sk.path, "utf-8").slice(0, 4000); }
    catch { return ""; }
  })
  .filter((t) => t !== "")
  .join(NEWLINE);

/** What a person has already told this work. The other half of `ask:`. */
let answered = [];
try {
  answered = JSON.parse(process.env.ORG_ANSWERS || "[]");
} catch {
  answered = [];
}

/** Documents the organization gave this step to work from. Read, never invented. */
const context = [];
for (const r of refs) {
  try {
    const at = resolve(r);
    if (existsSync(at)) context.push({ ref: r, text: readFileSync(at, "utf-8").slice(0, 6000) });
  } catch {
    /* a path that will not open is context this step did not get; it says so below by omission */
  }
}

const prompt = [
  "You are an agent inside a software organization, working one step of its delivery process.",
  "",
  "THE STEP YOU ARE WORKING: " + gate,
  "THE WORK: " + workType + " " + workId + " - " + title,
  brief ? "WHAT THE REQUESTER SAID ABOUT IT: " + brief : "",
  skillName === "" ? "" : "THE SKILL THIS ORGANIZATION USES FOR THIS STEP: " + skillName + " (" + skillSource + ") - " + skillWhy,
  skillText === ""
    ? ""
    : "SKILLS THIS REPOSITORY PROVIDES - follow them where they apply; they are how this codebase expects this work to be done:" + NEWLINE + skillText,
  owner ? "ACCOUNTABLE HAT: " + owner : "",
  "",
  answered.length > 0
    ? "WHAT A PERSON HAS ALREADY TOLD YOU (do not ask these again):\n" +
      answered.map((a) => "Q: " + a.question + "\nA: " + a.answer).join("\n")
    : "Nobody has told you anything beyond the line above.",
  "",
  context.length > 0
    ? "DOCUMENTS YOU WERE GIVEN:\n" + context.map((c) => "--- " + c.ref + " ---\n" + c.text).join("\n")
    : "You were given no documents.",
  "",
  "Decide for yourself what this step requires and whether you can do it with what you have.",
  "",
  "FIRST WORK OUT WHAT ALREADY EXISTS. The documents above are this organization's own record. Say",
  "what is already built that this touches, and whether the request EXTENDS it, CHANGES it, or is",
  "new ground. A document listing terms that matched nothing is telling you those things have never",
  "been written about here - do not assume a system you cannot find.",
  "",
  "You are the business side of this company, not an order-taker. A good question is one whose",
  "answer would change what gets built: a boundary, a rule that only the requester knows, a case",
  "the request does not cover, a conflict with something that already exists. A bad question asks",
  "for something already stated above, or something you could decide yourself, or a preference that",
  "would not change the work. Ask about the thing you would get wrong.",
  "",
  "If anything above describes a system that OVERLAPS this request, your first question must be",
  "about that overlap - name the existing thing and ask whether this replaces it, extends it, or",
  "runs beside it. Two systems doing the same job is the most expensive mistake available here, and",
  "it is decided now or not at all.",
  "",
  rounds === "0"
    ? "You have NO consultation rounds left. You must do this step now, on your own best reading, and"
      + " state any assumption you had to make inside the document. Do not ask anything."
    : "If something is genuinely missing that ONLY A PERSON can settle - a business decision, an"
      + " intention, a constraint nobody wrote down - then ask. Reply with ONLY question lines:\n"
      + "ASK: <one question>\n"
      + "You have " + rounds + " round(s) of questions left for this work in total, so ask only about"
      + " what would actually change what you build. Prefer to proceed and state an assumption over"
      + " asking something you could reasonably decide. Never re-ask anything answered above.",
  "",
  "Otherwise DO the step: write the document this step is supposed to produce.",
  "",
  "ANSWER AS JSON with exactly these fields:",
  "  questions - things only a person can settle. EMPTY if you can do the step.",
  "  title     - a short title for the document.",
  "  document  - the document this step produces, in markdown. EMPTY if you are asking.",
  "  learned   - things you worked out that were not obvious, as {key, lesson}. Usually empty.",
  "Asking and producing are exclusive: if questions is non-empty, document must be empty.",
  "Be concrete and specific to this work.",
  "",
  "EITHER WAY, if you worked something out that was NOT obvious and that the next person doing a",
  "step like this would otherwise have to rediscover - a tool that behaves unexpectedly here, a",
  "flag that turns out to be required, an order things must be done in - record it on its own line:",
  "LEARNED: <short-key> :: <the lesson, in a sentence or two>",
  "Only for things that cost you effort. A lesson everyone already knows is noise in the next",
  "agent's context, and this goes into their prompt.",
].filter((l) => l !== "").join("\n");

async function main() {
  let said = "";
  let usage;
  try {
    const res = await fetch(HOST + "/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.2, num_predict: 1200 },
        // ── THE SHAPE, NOT THE STYLING ──────────────────────────────────────
        // MEASURED across one real ELERA run: the same model reported the same thing three ways —
        // `**ASK:** ...`, then `### ASK: ...`, then `### Question`. Each time the parser was
        // widened it bought exactly one gate, and matching `### Question` would both over-fit to
        // one model's prose AND misread a heading inside a genuine document as a question.
        //
        // Ollama constrains generation to this schema, so "did it use the right prefix" stops being
        // a question anyone has to ask. The line protocol the ORGANIZATION speaks is unchanged;
        // this translates into it.
        format: {
          type: "object",
          properties: {
            questions: { type: "array", items: { type: "string" } },
            title: { type: "string" },
            document: { type: "string" },
            learned: {
              type: "array",
              items: {
                type: "object",
                properties: { key: { type: "string" }, lesson: { type: "string" } },
                required: ["key", "lesson"],
              },
            },
          },
          required: ["questions", "title", "document", "learned"],
        },
      }),
    });
    if (!res.ok) {
      process.stderr.write("[agent] model returned " + res.status + "\n");
      process.exit(3);
    }
    const body = await res.json();
    said = String(body.response || "").trim();
    usage = { in: body.prompt_eval_count, out: body.eval_count };
  } catch (err) {
    // A MODEL THAT CANNOT BE REACHED IS NOT A STEP THAT PASSED. Exiting non-zero refuses the gate,
    // which is the honest outcome - the alternative is an empty document with an approval on it.
    process.stderr.write("[agent] could not reach " + HOST + ": " + String(err && err.message) + "\n");
    process.exit(4);
  }

  // ── WHAT IT ANSWERED, AS A STRUCTURE ─────────────────────────────────────
  // The schema constrains generation, so this normally parses. When it does not — a server too old
  // to honour `format` — the text scan below still applies and SAYS SO, because a fallback nobody
  // can see firing is the vacuity class.
  let structured;
  try {
    const parsed = JSON.parse(said);
    if (parsed !== null && typeof parsed === "object" && Array.isArray(parsed.questions)) structured = parsed;
  } catch {
    structured = undefined;
  }
  if (structured === undefined) {
    process.stderr.write("[agent] no structured reply; falling back to a text scan\n");
  }

  // ── QUESTIONS WIN ────────────────────────────────────────────────────────
  // If the model asked anything, that is the answer for this step, whatever else it wrote.
  const asks = (structured !== undefined
    ? structured.questions.map((q) => String(q).trim())
    : said
        .split(NEWLINE_SPLIT)
        .map((l) => l.trim())
        .filter((l) => ASK_RE.test(l))
        .map((l) => l.replace(ASK_RE, "").trim())
  )
    .filter((q) => q.length > 0)
    .slice(0, 3);

  // A step that ASKED can still have learned something, and so can a step that produced a
  // document. Emitted in the port's own lower-case form either way.
  const lessons = (structured !== undefined
    ? structured.learned.map((l) => "learned: " + String(l.key).trim() + " :: " + String(l.lesson).trim())
    : said
        .split(NEWLINE_SPLIT)
        .map((l) => l.trim())
        .filter((l) => LEARNED_RE.test(l))
        .map((l) => "learned: " + l.replace(LEARNED_RE, "").trim())
  ).filter((l) => l.length > 12);

  if (asks.length > 0) {
    for (const q of asks) process.stdout.write("ask: " + q + "\n");
    for (const l of lessons) process.stdout.write(l + "\n");
    if (usage && usage.out) process.stdout.write("usage: in=" + usage.in + " out=" + usage.out + " model=" + MODEL + "\n");
    return;
  }

  // ── OTHERWISE IT MADE SOMETHING ──────────────────────────────────────────
  mkdirSync(join(OUT_DIR, workId), { recursive: true });
  const path = join(OUT_DIR, workId, gate + ".md");
  const heading = structured !== undefined
    ? String(structured.title).trim() || gate + " for " + workId
    : (said.match(/^TITLE:\s*(.+)$/im) || [])[1] || gate + " for " + workId;
  const body = structured !== undefined
    ? String(structured.document).trim()
    : said.replace(/^TITLE:.*$/im, "").trim();
  writeFileSync(
    path,
    "# " + heading + "\n\n_Step: " + gate + " | Work: " + workId + " - " + title + "_\n\n" + body + "\n",
    "utf-8",
  );
  process.stdout.write(path + "\n");
  for (const l of lessons) process.stdout.write(l + "\n");
  for (const c of context) process.stdout.write("relied on " + c.ref + "\n");
  if (usage && usage.out) process.stdout.write("usage: in=" + usage.in + " out=" + usage.out + " model=" + MODEL + "\n");
}

main().catch((err) => {
  process.stderr.write("[agent] " + String(err && err.stack) + "\n");
  process.exit(1);
});
