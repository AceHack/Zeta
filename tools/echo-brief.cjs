// A probe, not an agent: records what the organization actually handed this step.
const fs = require("node:fs");
const answers = JSON.parse(process.env.ORG_ANSWERS || "[]");
const log = process.env.PROBE_LOG;
const line = "gate=" + process.argv[2] + " work=" + process.argv[3] +
  " title=" + JSON.stringify(process.env.ORG_WORK_TITLE || "") +
  " answersReceived=" + answers.length +
  " feedbackReceived=" + JSON.parse(process.env.ORG_FEEDBACK || "[]").length +
  " skill=" + (process.env.ORG_SKILL || "-") +
  answers.map((a) => "\n     prior Q: " + a.question.slice(0,55) + "\n           A: " + a.answer.slice(0,55)).join("");
if (log) fs.appendFileSync(log, line + "\n");
process.stdout.write("probe-ok\n");
