/**
 * configure-plan.test.ts — falsifiers for a guided setup an agent holds as a conversation.
 *
 * The failure a wizard makes and this shape must not: turning optional configuration into work you
 * have to decline. `complete` is decided by REQUIRED steps alone, and the test that matters most is
 * that a fully-agentic organization with no checkpoints and no skill bindings reports itself
 * configured — because that is the zero-config path the whole register is built to keep.
 *
 * The second property is that the plan is DERIVED. Nothing stores "step 3 of 5", so undoing
 * configuration must make its step pending again — a stored position would insist it was done.
 */

import { describe, expect, test } from "bun:test";
import { ConfigureStep, planFor, planForNothing } from "./configure-plan";
import { Autonomy, Intake, SourceKind, type OrgRecord } from "./org-registry";
import { basePolicy } from "./org-policy";
import { HumanCheckpoint, GateKind } from "./quality-gate";
import { SkillSource } from "./skill-binding";
import { commandNames } from "./cli-surface";

function org(over: Partial<OrgRecord> = {}): OrgRecord {
  return {
    orgId: "acme",
    name: "Acme",
    storeDir: "/store/acme",
    intake: Intake.Greenfield,
    autonomy: Autonomy.Directed,
    policy: basePolicy("acme", "existing_harness"),
    sources: [],
    humanCheckpoints: [],
    skills: [],
    createdAtMs: 1_000,
    ...over,
  };
}

function stepOf(plan: ReturnType<typeof planFor>, step: ConfigureStep) {
  const found = plan.steps.find((s) => s.step === step);
  if (found === undefined) throw new Error(`no step ${String(step)}`);
  return found;
}

describe("with nothing configured, the plan says how to start", () => {
  test("the first step is creating an organization", () => {
    const plan = planForNothing();
    expect(plan.complete).toBe(false);
    expect(plan.next?.step).toBe(ConfigureStep.Create);
  });

  test("it carries a runnable command, not just a question", () => {
    // An agent that got a question with no command would have to invent the flags, which is the
    // drift `describe` exists to prevent.
    expect(planForNothing().next?.command).toContain("org create");
    expect(planForNothing().next?.command).toContain("--verification");
  });

  test("it explains WHY, so the agent can answer 'why do you need that?'", () => {
    expect((planForNothing().next?.why ?? "").length).toBeGreaterThan(40);
  });
});

describe("OPTIONAL CONFIGURATION NEVER BLOCKS COMPLETION", () => {
  test("a greenfield org with work, no checkpoints and no skills is CONFIGURED", () => {
    // The zero-config path. If this reported incomplete, guided setup would be a questionnaire you
    // have to decline twice before it lets you go.
    const plan = planFor(org(), true);
    expect(plan.complete).toBe(true);
    expect(plan.next).toBeUndefined();
  });

  test("but the optional steps are still OFFERED, once, in their own list", () => {
    const plan = planFor(org(), true);
    const offered = plan.optional.map((s) => s.step);
    expect(offered).toContain(ConfigureStep.ChooseCheckpoints);
    expect(offered).toContain(ConfigureStep.BindSkills);
    expect(offered).toContain(ConfigureStep.ReceiveEvents);
  });

  test("an org that took the optional steps stops being offered them", () => {
    const configured = org({
      humanCheckpoints: [HumanCheckpoint.Grooming],
      skills: [{ gate: GateKind.QaUat, skill: "house-qa", source: SkillSource.Repo }],
      webhooks: [{ sourceId: "linear-eng", scheme: "hmac_sha256_hex", signatureHeader: "linear-signature", secretFile: "/s", map: ["title=title"] }],
    });
    expect(planFor(configured, true).optional).toEqual([]);
  });

  test("choosing NEITHER is described as a real answer, not as missing setup", () => {
    const current = stepOf(planFor(org(), true), ConfigureStep.ChooseCheckpoints).current;
    expect(current).toContain("fully agentic");
  });

  test("the unbound case says the repo's own skills are used", () => {
    const current = stepOf(planFor(org(), true), ConfigureStep.BindSkills).current;
    expect(current).toContain("repository");
  });
});

describe("sources are required only when the org syncs from them", () => {
  test("A SOURCE-SYNCED ORG WITH NO SOURCES IS INCOMPLETE", () => {
    const plan = planFor(org({ intake: Intake.SourceSynced }), true);
    expect(plan.complete).toBe(false);
    expect(plan.next?.step).toBe(ConfigureStep.ConnectSources);
  });

  test("a GREENFIELD org needs none, and says why rather than skipping silently", () => {
    const step = stepOf(planFor(org(), true), ConfigureStep.ConnectSources);
    expect(step.satisfied).toBe(true);
    expect(step.required).toBe(false);
    expect(step.current).toContain("you are the customer");
  });

  test("connecting a source satisfies it", () => {
    const synced = org({
      intake: Intake.SourceSynced,
      sources: [{ kind: "jira", id: "j", location: "https://jira.example" }],
    });
    expect(stepOf(planFor(synced, true), ConfigureStep.ConnectSources).satisfied).toBe(true);
  });

  test("THE SOURCE QUESTION ASKS FOR A PATH, NEVER A TOKEN", () => {
    // argv is world-readable, so an agent relaying this question must not ask for the secret
    // itself. The question is the only place that instruction reaches the person.
    const step = stepOf(planFor(org({ intake: Intake.SourceSynced }), true), ConfigureStep.ConnectSources);
    expect(step.ask.toLowerCase()).toContain("path");
    expect(step.ask.toLowerCase()).toContain("not the token");
    expect(step.why.toLowerCase()).toContain("read-only");
  });
});

describe("an organization with nothing to do is not finished", () => {
  test("no work means the plan asks for some", () => {
    const plan = planFor(org(), false);
    expect(plan.complete).toBe(false);
    expect(plan.next?.step).toBe(ConfigureStep.FirstWork);
  });

  test("a greenfield org is asked for a GOAL", () => {
    const step = stepOf(planFor(org(), false), ConfigureStep.FirstWork);
    // `goal`, NOT `org goal`. This assertion originally carried the spurious prefix and so
    // codified the defect the drift guard below later caught — a test can pin a bug just as
    // firmly as it pins a behaviour.
    expect(step.command.startsWith("goal ")).toBe(true);
    expect(step.ask.toLowerCase()).toContain("outcome");
  });

  test("a source-synced org is asked to PULL instead — it does not invent goals", () => {
    const synced = org({
      intake: Intake.SourceSynced,
      sources: [{ kind: "jira", id: "j", location: "https://jira.example" }],
    });
    const step = stepOf(planFor(synced, false), ConfigureStep.FirstWork);
    expect(step.command).toContain("demand");
    expect(step.ask.toLowerCase()).toContain("tracker");
  });

  test("sources come BEFORE work — you cannot pull from nothing", () => {
    const plan = planFor(org({ intake: Intake.SourceSynced }), false);
    expect(plan.next?.step).toBe(ConfigureStep.ConnectSources);
  });
});

describe("the plan is DERIVED, so it is resumable and cannot go stale", () => {
  test("removing configuration makes its step pending again", () => {
    // A stored "step 3 of 5" would insist the step was done after somebody undid it.
    const withSource = org({
      intake: Intake.SourceSynced,
      sources: [{ kind: "jira", id: "j", location: "https://jira.example" }],
    });
    expect(planFor(withSource, true).complete).toBe(true);
    const undone = { ...withSource, sources: [] };
    expect(planFor(undone, true).complete).toBe(false);
  });

  test("every step reports what the org looks like on it right now", () => {
    for (const step of planFor(org(), true).steps) {
      expect(step.current.length).toBeGreaterThan(10);
    }
  });

  test("every UNSATISFIED step carries a question and a command", () => {
    const plan = planFor(org({ intake: Intake.SourceSynced }), false);
    for (const step of plan.steps.filter((s) => !s.satisfied)) {
      expect(step.ask.length).toBeGreaterThan(20);
      expect(step.command.length).toBeGreaterThan(10);
      expect(step.why.length).toBeGreaterThan(20);
    }
  });

  test("`next` is always a REQUIRED step, never an optional one", () => {
    for (const hasWork of [true, false]) {
      for (const intake of [Intake.Greenfield, Intake.SourceSynced]) {
        const plan = planFor(org({ intake }), hasWork);
        if (plan.next !== undefined) expect(plan.next.required).toBe(true);
      }
    }
  });

  test("complete and next never disagree", () => {
    for (const hasWork of [true, false]) {
      for (const intake of [Intake.Greenfield, Intake.SourceSynced]) {
        const plan = planFor(org({ intake }), hasWork);
        expect(plan.complete).toBe(plan.next === undefined);
      }
    }
  });
});

describe("EVERY COMMAND THE PLAN GIVES IS A REAL COMMAND", () => {
  // Caught a live defect: the plan told an agent to run `org goal ...` when the command is
  // `goal ...`. Following the plan failed. Hardcoded command strings drift from the table exactly
  // as a hardcoded prompt drifts from the flags, which is what `describe` exists to prevent — so
  // the plan's strings are checked against the same table the parser uses.
  const cases = [
    planForNothing(),
    planFor(org(), false),
    planFor(org(), true),
    planFor(org({ intake: Intake.SourceSynced }), false),
    planFor(org({ intake: Intake.SourceSynced, sources: [{ kind: "jira", id: "j", location: "u" }] }), false),
  ];

  test("each non-empty command begins with a declared command name", () => {
    const names = commandNames();
    for (const plan of cases) {
      for (const step of plan.steps) {
        if (step.command === "") continue;
        const matched = names.some((n) => step.command === n || step.command.startsWith(`${n} `));
        expect(`${step.step}: ${step.command}`).toBe(
          matched ? `${step.step}: ${step.command}` : `${step.step}: <not a declared command>`,
        );
      }
    }
  });

  test("and the check can fail — a made-up command is not matched", () => {
    const names = commandNames();
    expect(names.some((n) => "org goal --title x".startsWith(`${n} `))).toBe(false);
    expect(names.some((n) => "goal --title x".startsWith(`${n} `))).toBe(true);
  });
});

describe("THE ORGANIZATION CAN BE TOLD, RATHER THAN ONLY ASKING", () => {
  const source = () => ({ kind: SourceKind.Linear, id: "linear-eng", location: "https://api.linear.app/graphql", authFile: "/secrets/linear.json" });
  const hook = (over: Partial<{ sourceId: string; scheme: string }> = {}) => ({
    sourceId: "linear-eng",
    scheme: "hmac_sha256_hex",
    signatureHeader: "linear-signature",
    secretFile: "/secrets/linear",
    map: ["externalId=identifier", "title=title"],
    ...over,
  });

  test("receiving is OPTIONAL — polling is a complete answer, even source-synced", () => {
    // A plan that treated pushing as outstanding work would make guided setup something you have to
    // decline, and every polled organization would report itself unconfigured forever.
    const synced = org({ intake: Intake.SourceSynced, sources: [source()] });
    const plan = planFor(synced, true);
    expect(stepOf(plan, ConfigureStep.ReceiveEvents).required).toBe(false);
    expect(plan.complete).toBe(true);
  });

  test("with no sources it says to connect one FIRST, because the command would refuse", () => {
    // `org webhook add` refuses a source id it does not recognise. Offering the command to somebody
    // with nothing connected sends them into a refusal that reads as the CLI being broken.
    const current = stepOf(planFor(org(), true), ConfigureStep.ReceiveEvents).current;
    expect(current).toContain("no sources");
  });

  test("with sources connected it names them as the things a hook could feed", () => {
    const current = stepOf(planFor(org({ sources: [source()] }), true), ConfigureStep.ReceiveEvents).current;
    expect(current).toContain("linear-eng");
    expect(current).not.toContain("no sources");
  });

  test("a configured hook reports the endpoint the provider should be pointed at", () => {
    const current = stepOf(planFor(org({ webhooks: [hook()] }), true), ConfigureStep.ReceiveEvents).current;
    expect(current).toContain("/hooks/linear-eng");
  });

  test("an UNVERIFIED hook is called that, every single time anybody looks", () => {
    // A decision nobody is reminded of is indistinguishable from an accident. This is the whole
    // reason `none` is allowed to exist at all.
    const current = stepOf(planFor(org({ webhooks: [hook({ scheme: "none" })] }), true), ConfigureStep.ReceiveEvents).current;
    expect(current).toContain("UNVERIFIED");
    expect(current).toContain("linear-eng");
  });

  test("a signed hook is NOT called unverified", () => {
    const current = stepOf(planFor(org({ webhooks: [hook()] }), true), ConfigureStep.ReceiveEvents).current;
    expect(current).not.toContain("UNVERIFIED");
  });

  test("the question names the outcome, never the mechanism", () => {
    // The operator is deciding whether their tracker should tell this organization something.
    // "Webhook" is the answer to a question they have not asked yet.
    const step = stepOf(planFor(org({ sources: [source()] }), true), ConfigureStep.ReceiveEvents);
    expect(step.ask.toLowerCase()).not.toContain("webhook");
    expect(step.ask.toLowerCase()).not.toContain("hmac");
    expect(step.ask.toLowerCase()).not.toContain("endpoint");
  });

  test("the reason says the secret is a PATH and that arrival is not execution", () => {
    // Both are decisions with consequences the operator cannot see from the command alone.
    const why = stepOf(planFor(org(), true), ConfigureStep.ReceiveEvents).why;
    expect(why).toContain("path to a file");
    expect(why).toContain("arrival is not execution");
  });

  test("the command it offers is one the CLI actually has", () => {
    const command = stepOf(planFor(org(), true), ConfigureStep.ReceiveEvents).command;
    expect(commandNames()).toContain(command.split(" --")[0]?.trim() ?? "");
  });
});
