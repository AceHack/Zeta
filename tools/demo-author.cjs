#!/usr/bin/env node
/**
 * demo-author.cjs — a stand-in for the agent that writes a phase's document.
 *
 * WHAT THIS IS FOR: `--artifact-cmd` is the seam where a real model-backed author plugs in, and
 * until you have seen one run there is no way to tell what a wired one would put in front of a
 * reviewer. This writes a genuine markdown file per phase and prints its path, which is exactly the
 * contract `commandArtifactProducer` expects — so the dashboard renders a real document rather than
 * "nothing was produced", and you can see what the surface looks like when it is fed.
 *
 * It is a FIXTURE and says so in its own output. Swap the body for a model call and nothing else in
 * the chain changes.
 *
 *   argv: <gate> <workId> [prior artifact paths...]
 *   out : one path per line, on stdout
 */

const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const [gate, workId, ...priors] = process.argv.slice(2);
if (!gate || !workId) {
  process.stderr.write("usage: demo-author.cjs <gate> <workId> [prior...]\n");
  process.exit(2);
}

const dir = resolve(process.env.DEMO_DOCS_DIR || join(process.cwd(), ".org-docs"), workId);
mkdirSync(dir, { recursive: true });
const path = join(dir, `${gate}.md`);

const TITLES = {
  business_context_grooming: "Business context",
  customer_rfp_review: "Customer and RFP review",
  brd_approval: "Business requirements",
  peer_review: "Peer read of the requirements",
  architecture_design: "Architecture",
  architecture_approval: "Architecture, for approval",
  cost_approval: "Cost",
  adversarial_review: "Adversarial read",
};

// ── WHAT THE TICKET ACTUALLY SAYS ─────────────────────────────────────
// The BRIEF arrives as the first context path. Before it existed this fixture wrote the same
// canned text about session archival whatever the ticket was — which is how the gap was noticed,
// on a document for "/model luna & terra". A wired model was in exactly the same position and
// would have invented something DIFFERENT each time, which is harder to spot and no better.
let brief = null;
for (const prior of priors) {
  if (prior.indexOf(".briefs") < 0) continue;
  try {
    brief = readFileSync(prior, "utf-8");
    break;
  } catch {
    // Unreadable brief = no brief. The document then SAYS so rather than inventing around it.
  }
}

function section(text, heading) {
  if (text === null) return null;
  const at = text.indexOf(heading);
  if (at < 0) return null;
  const rest = text.slice(at + heading.length);
  const end = rest.indexOf("\n## ");
  return (end < 0 ? rest : rest.slice(0, end)).trim();
}

const briefTitle = brief === null ? null : (/^# (.+)$/m.exec(brief) || [])[1] || null;
const says = section(brief, "## What the request says");
const descriptionMissing = says !== null && says.indexOf("description is EMPTY") >= 0;

const body = `# ${TITLES[gate] || gate} — ${briefTitle || workId}

_Written by the ${gate} phase. This is a FIXTURE document from \`tools/demo-author.cjs\`; a wired
author replaces it with a real one and nothing downstream changes._

## What this phase was given

${brief === null
  ? "**No brief was supplied.** This phase was told a gate name and a work id and nothing else, so anything specific below would be invented. It is not."
  : `The request, as the source system holds it:\n\n${says || "(nothing)"}`}

## What this phase concluded

${descriptionMissing
  ? "- The request carries a title and NO description, so there is nothing here to derive requirements from.\n- Anything written below this line would be this organisation's invention rather than the customer's requirement, and is therefore not written.\n- The next step is a person adding a description to the ticket, not another document."
  : brief === null
    ? "- Nothing, for the reason above."
    : "- The request is understood as stated above.\n- This fixture does not reason about it; a wired author is where the analysis comes from."}

## Acceptance

${descriptionMissing || brief === null
  ? "None can be written. Acceptance criteria derived from an absent description would be unfalsifiable by construction."
  : "1. Whatever the request asks for is delivered, as stated above.\n2. A reviewer can check that against the request without asking the author what it meant."}

${priors.length > 0 ? `## Read before writing this\n\n${priors.map((p) => `- \`${p}\``).join("\n")}\n` : ""}`;

// WHAT THIS STEP SAID IT WOULD DO. Lines beginning "- " are the plan; every other line is a
// reference to something produced. See `commandArtifactProducer`.
const PLANS = {
  business_context_grooming: ["Read the defect report and the admin screenshots", "Locate the archival code path", "Record what is not known"],
  customer_rfp_review: ["Compare the report against what was asked for", "Flag the mislabelled button as in scope"],
  brd_approval: ["State the problem in the customer's terms", "Write three testable acceptance criteria", "Put multi-tenant retention out of scope"],
  peer_review: ["Re-read the acceptance criteria against the defect", "Check nothing was invented"],
  architecture_design: ["Name the components that change", "Decide where the blob write goes", "Say what could go wrong"],
  architecture_approval: ["Judge the design against the requirement"],
  cost_approval: ["Price it at two engineer-days"],
  adversarial_review: ["Attack the ordering of the blob write and the row update", "Try to lose a session between them"],
};
for (const item of PLANS[gate] || []) process.stdout.write("- " + item + "\n");

writeFileSync(path, body, "utf-8");
process.stderr.write(`wrote ${gate} for ${workId} (${body.length} bytes)\n`);
process.stdout.write(path + "\n");

// ── WHAT IT WAS TOLD, AND WHETHER IT USED ANY OF IT ─────────────────────────
// One of the prior paths may be this hat's recalled memory. A real author would read it and decide;
// this fixture reads it and cites the heaviest line, which is enough to prove the circuit turns:
// injection → citation → utility → weight.
//
// Citing NOTHING is an equally legitimate outcome and is what happens when no memory was handed
// over or the file cannot be read. Inventing an id would be the exact fabrication the citation
// clamp exists to catch, and the run would refuse the whole batch for it.
let citedId = null;
for (const prior of priors) {
  if (prior.indexOf(".recall") < 0) continue;
  try {
    const recall = readFileSync(prior, "utf-8");
    const first = /^- \[([^\]]+)\]/m.exec(recall);
    if (first && first[1]) {
      citedId = first[1];
      break;
    }
  } catch {
    // Unreadable recall = no citation. Silence here is correct.
  }
}
if (citedId) process.stdout.write(`relied on [${citedId}]\n`);

// WHAT IT SPENT. A real model-backed author prints what its own SDK reported — this process never
// sees the model call, so that is the only place the number can honestly come from. The fixture
// derives a plausible figure from the document it just wrote and names its model `fixture-author`
// so nothing mistakes it for a real one. The shape is the contract that `parseUsageLine` reads:
//
//   usage: model=<id> in=<tokens> out=<tokens>
const inTokens = Math.round((priors.join("").length + gate.length + 400) / 4);
const outTokens = Math.round(body.length / 4);
process.stdout.write(`usage: model=fixture-author in=${inTokens} out=${outTokens}\n`);
