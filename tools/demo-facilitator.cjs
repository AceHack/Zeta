#!/usr/bin/env node
/**
 * demo-facilitator.cjs — a stand-in for whoever runs a meeting.
 *
 * WHAT THIS IS FOR: `--meeting-cmd` is the seam where a real facilitator plugs in. Until you have
 * seen one run there is no way to tell what a meeting in this organisation would actually produce,
 * or what an empty one looks like on the page.
 *
 *   in  : the meeting proposal, as JSON on stdin
 *   out : what came out of it, on stdout. EMPTY OUTPUT IS A VALID ANSWER and is recorded as
 *         "produced nothing", which is the finding a meeting register exists to surface.
 *
 * It is a FIXTURE and says so in its own output. It answers from the meeting's stated REASON, so
 * the output at least addresses what the meeting was called for; a wired facilitator replaces the
 * body and nothing else in the chain changes.
 */

let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  let meeting;
  try {
    meeting = JSON.parse(raw);
  } catch {
    // Unreadable input produces NOTHING rather than a plausible sentence. A facilitator that
    // invents an outcome it did not have is worse than one that admits it could not run.
    process.stderr.write("could not read the meeting proposal\n");
    process.exit(0);
  }

  const attendees = (meeting.attendeeHatIds || []).join(", ");

  // ── DELIBERATELY NOT ALWAYS AN OUTCOME ──────────────────────────────────
  // A fixture that always produced something would make "every meeting achieves its purpose" true
  // by construction, which is exactly the claim `meetingProducedNothing` exists to be able to
  // refute. The conflicting-memory case returns nothing on purpose: reconciling two beliefs needs
  // a judgement this fixture does not have, and saying so is the honest output.
  const BY_REASON = {
    repeated_rejection:
      `Agreed with ${attendees}: the acceptance criterion is what the reviewer stated in the ` +
      `rejection, written into the document before the next attempt. Escalation not needed.`,
    stalled_on_a_person:
      `${attendees} agreed to ask the named approver directly and to re-raise it at the next ` +
      `checkpoint if there is no answer. No decision was taken in their absence.`,
    unresolved_blocker:
      `${attendees} could not clear it inside the organisation and agreed to raise it out, with ` +
      `the blocker's own text as the question.`,
    conflicting_memory: "",
  };

  const produced = BY_REASON[meeting.reason];
  if (produced === undefined || produced === "") {
    process.stderr.write(`no outcome for '${String(meeting.reason)}'\n`);
    process.exit(0);
  }

  process.stdout.write(
    `${produced}\n\n_Recorded by \`tools/demo-facilitator.cjs\` — a FIXTURE. A wired facilitator ` +
      `replaces this with what was actually said._\n`,
  );
});
