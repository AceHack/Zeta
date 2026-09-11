#!/usr/bin/env node
/**
 * demo-reviser.cjs — a stand-in for the agent that rewrites a document in a room.
 *
 * WHAT THIS IS FOR: `--room-cmd` is the seam where a real model-backed author plugs in. Until you
 * have watched one round trip there is no way to tell whether the room actually works, so this
 * makes a real, visible edit and prints the whole new document — exactly the contract
 * `commandReviser` expects.
 *
 * It is a FIXTURE and says so in what it writes. Swap the body for a model call and nothing else in
 * the chain changes.
 *
 *   stdin : the RevisionRequest as JSON
 *   stdout: the new document
 *   exit  : 0 produced a revision, non-zero produced nothing
 */

let input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (d) => { input += d; });
process.stdin.on("end", () => {
  let request;
  try {
    request = JSON.parse(input);
  } catch (err) {
    process.stderr.write(`could not read the request: ${err.message}\n`);
    process.exit(2);
  }

  const asked = String(request.askedFor || "").trim();
  const current = String(request.currentText || "");
  if (asked === "") {
    // Nothing was asked, so there is nothing to answer. Exiting non-zero is honest: the room
    // records "could not revise" rather than a draft that pretends to address a question.
    process.stderr.write("no question to answer\n");
    process.exit(1);
  }

  // A REAL EDIT, in the place a reader will look for it. Appending a section named after what was
  // asked is enough to prove the round trip end to end, and it is obviously a fixture.
  const heading = `## ${asked.slice(0, 70)}`;
  const stamp = new Date(Number(process.env.DEMO_NOW_MS || Date.now())).toISOString();
  const addition = [
    "",
    heading,
    "",
    `_Added by \`tools/demo-reviser.cjs\` in room ${request.roomId}, answering revision ` +
      `${request.currentRevision}. A wired author replaces this with real reasoning._`,
    "",
    "- The blob write is awaited, so a storage failure leaves the row unarchived.",
    "- A row write that fails after a successful blob write leaves an orphaned blob; the",
    "  next archival of the same session overwrites it, so the orphan is bounded.",
    "- Only the BLOB write is retried. The row write is not, because a retry there would",
    "  mark archived a session whose payload may not have landed.",
    "",
    `_revised ${stamp}_`,
  ].join("\n");

  process.stdout.write(`${current.trimEnd()}\n${addition}\n`);
  process.stderr.write(`revised ${request.documentPath} for ${request.roomId}\n`);
});
