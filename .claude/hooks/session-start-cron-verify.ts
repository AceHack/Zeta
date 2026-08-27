#!/usr/bin/env bun
// session-start-cron-verify.ts — SessionStart notice about the tick loop.
//
// WHAT CHANGED, 2026-08-27, and why. This hook used to open with "Your first action this session
// MUST be: call CronList", cite `.claude/rules/tick-must-never-stop.md` as load-bearing, and close
// with "Do not defer it for any reason." Two things were wrong with that by the time it was
// rewritten:
//
//   1. THE CITED RULE DOES NOT EXIST AT THAT PATH. `tick-must-never-stop.md` was archived to
//      `.claude/rules.bak/` and is no longer in the auto-loaded set. A hook that fires on every
//      session was pointing at a file nobody would find — the enforcement outlived its reason,
//      which is how an instruction becomes folklore.
//   2. THE LOOP IS NO LONGER THE AGENT'S JOB. Aaron 2026-08-27:
//
//        "we can turn off the agents instruction in the repo to keep looping — we are starting to
//         enforce that from the outside with bounded tick loops so the loop is externalized from
//         the agents responsibility ... done by automation ... this only means we need to leave an
//         exit for those agents who want out of a specific loop so they can deregister."
//
// Making continuity depend on every agent remembering to arm its own cron is exactly the
// intelligence-dependency being designed out. 43 scheduled workflows already drive ticks from
// outside; the agent-side imperative was the last piece asking a mind to do a scheduler's job.
//
// WHAT REPLACES IT. A statement of where the loop comes from, and — the part that had no mechanism
// before — how to LEAVE one. `src/Core.TypeScript/agent-loops/loop-registry.ts` is the exit:
// enrolment is bounded (it expires unless renewed, so forgetting stops it rather than running it
// forever), deregistration is self-service and recorded, and NO peer can deregister anyone else.
//
// The recorded exit is not a courtesy. An agent that simply stops and an agent whose loop is wedged
// are the same observation — absence — and that ambiguity is the standing-by failure: a check that
// did not run wearing the face of one that passed. Deregistration is what separates chosen silence
// from broken silence.
//
// THE IN-SESSION CRON IS A BRIDGE, AND IS NAMED AS ONE. Interactive sessions are not yet covered by
// an external driver, so the session-scoped cron still carries the tick here. It is described
// below as a mechanism, not as an imperative — nobody is failing a rule by not arming it, and the
// external drivers are the direction of travel. When an external driver covers interactive
// sessions, this hook's remaining half goes away too.

const message = [
  "🌱 ZETA SESSION-START NOTICE — the tick loop is EXTERNALLY driven.",
  "",
  "Keeping the loop alive is no longer your responsibility. Ticks come from",
  "scheduled workflows and bounded external drivers, not from each agent",
  "remembering to arm one. (Changed 2026-08-27; the old `tick-must-never-stop`",
  "imperative is archived in `.claude/rules.bak/`.)",
  "",
  "YOUR EXIT, if you want out of a specific loop:",
  "  • `src/Core.TypeScript/agent-loops/loop-registry.ts` — record a `deregister`",
  "    event for (loop, yourself) with a reason. The driver reads the registry",
  "    before dispatching; you do not have to police your own participation.",
  "  • Only YOU may deregister you. No peer and no maintainer can evict you from",
  "    a loop, and enrolments are bounded — they lapse unless renewed.",
  "  • State a reason. An unexplained exit is indistinguishable from a fault, and",
  "    the whole point of recording it is that your silence stays legible.",
  "",
  "BRIDGE (interactive sessions only, until an external driver covers them):",
  "  this session's tick is carried by a session-scoped cron with the sentinel",
  "  `<<autonomous-loop>>`. `CronList` shows whether one is armed. Arming it is a",
  "  mechanism available to you, not a rule you are breaking by ignoring it.",
].join("\n");

console.log(message);
