#!/usr/bin/env node
/**
 * demo-studier.cjs — a stand-in for the agent that reads the repository during free time.
 *
 * WHAT THIS IS FOR: `--study-cmd` is the seam where a real model-backed agent goes and looks at
 * something. This one actually looks — it reads a real file from the repository and reports one
 * true, checkable thing about it — because a fixture that invents a finding would make the memory
 * store fill with sentences nobody can verify, which is the failure the whole memory design is
 * built to avoid.
 *
 *   stdin : the SelfDirectedProposal as JSON
 *   stdout: what was learned, in one or two sentences
 *   exit  : 0 learned something, non-zero learned nothing
 */

const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join } = require("node:path");

let input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (d) => { input += d; });
process.stdin.on("end", () => {
  let proposal;
  try {
    proposal = JSON.parse(input);
  } catch (err) {
    process.stderr.write(`could not read the proposal: ${err.message}\n`);
    process.exit(2);
  }

  const root = process.env.STUDY_ROOT || join(process.cwd(), "src", "Core.TypeScript", "corporate");
  let files;
  try {
    files = readdirSync(root).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).sort();
  } catch (err) {
    // NOTHING WAS LEARNED, and that is what gets reported. Inventing a finding here is the one
    // thing this fixture must not do.
    process.stderr.write(`could not read ${root}: ${err.message}\n`);
    process.exit(1);
  }
  if (files.length === 0) {
    process.stderr.write(`${root} holds no modules to study\n`);
    process.exit(1);
  }

  // Which file this hat looks at is derived from its own id, so a hat studies its own corner and
  // two hats do not both write the same memory.
  let h = 0;
  for (const ch of String(proposal.hatId || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const name = files[h % files.length];
  const path = join(root, name);

  let text;
  try {
    text = readFileSync(path, "utf-8");
  } catch (err) {
    process.stderr.write(`could not read ${path}: ${err.message}\n`);
    process.exit(1);
  }

  // Real, checkable facts about a real file. A reader can open it and disagree.
  const lines = text.split(/\r?\n/);
  const exported = (text.match(/^export (?:function|const|interface|type) (\w+)/gm) || [])
    .map((m) => m.split(" ").pop())
    .slice(0, 6);
  const headline = (lines.find((l) => l.trim().startsWith("* ")) || "").replace(/^\s*\*\s*/, "").trim();

  if (exported.length === 0) {
    process.stderr.write(`${name} exports nothing worth recording\n`);
    process.exit(1);
  }

  const found =
    `${name} (${String(lines.length)} lines) — ${headline || "no summary line"}. ` +
    `It exports ${exported.join(", ")}${exported.length === 6 ? ", and more" : ""}. ` +
    `Read during free time by ${proposal.hatId}; a wired agent would say something sharper.`;

  process.stdout.write(`${found}\n`);
  process.stderr.write(`studied ${name} for ${proposal.hatId}\n`);
});
