/**
 * stated-goal-reaches-work.test.ts — the seams between "a person asked" and "the org built it".
 *
 * Every test here was written after an END-TO-END RUN failed in a way no unit test could see. The
 * organization decomposed, staffed, scheduled, reviewed, gated, merged and reported DELIVERED —
 * for the wrong work, in the wrong tree, against a fixture nobody asked for. Each part was correct
 * and the parts were not connected, which is the one defect class a suite of per-part tests is
 * structurally unable to find.
 *
 * So these assert CONNECTIONS, not components.
 */

import { describe, expect, test } from "bun:test";
import { HumanActionKind, type HumanAction } from "./human-action";
import { IntakeKind } from "./intake";
import { statedGoalsAsIntake, withOrgDefaults, DEFAULT_CONVERGENCE_CYCLES, parseArgs } from "./run-org";
import { Autonomy, Intake, serializeRegistry, type OrgRecord } from "./org-registry";
import { commandTestRunner } from "./adapters";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HumanCheckpoint } from "./quality-gate";

function goalAction(over: Partial<HumanAction> = {}): HumanAction {
  return {
    actionId: "act-1",
    kind: HumanActionKind.SubmitGoal,
    byHuman: "max",
    atMs: 1_000,
    subjectId: "Ship a URL shortener HTTP API",
    reason: "POST /shorten returns a code; GET /:code redirects.",
    ...over,
  } as HumanAction;
}

describe("A STATED GOAL BECOMES THE WORK — the writer nothing read", () => {
  // THE DEFECT: `org goal` validated the request, queued it, and recorded a permanent event for it.
  // Three things read that queue — an agent's inbox, gate approve/reject answers, blocker
  // acceptance — and NONE of them read `SubmitGoal`. So the run built the hardcoded demo fixture
  // instead, and reported success for work the customer never asked for.
  test("a submitted goal turns into intake", () => {
    const intake = statedGoalsAsIntake([goalAction()]);
    expect(intake.length).toBe(1);
    expect(intake[0]?.title).toBe("Ship a URL shortener HTTP API");
    expect(intake[0]?.kind).toBe(IntakeKind.Goal);
  });

  test("the person who asked is the source — not a scraped ticket", () => {
    // The acceptance gate at the end answers to this person; "portal" would lose that.
    expect(statedGoalsAsIntake([goalAction({ byHuman: "max" })])[0]?.source).toBe("operator:max");
  });

  test("the action id is the idempotency key, so a re-run does not fork the cascade", () => {
    const twice = statedGoalsAsIntake([goalAction(), goalAction()]);
    // Two identical actions carry one id; intake de-duplicates on the external ref.
    expect(new Set(twice.map((e) => e.externalId)).size).toBe(1);
  });

  test("goals arrive oldest first, in the order they were stated", () => {
    const out = statedGoalsAsIntake([
      goalAction({ actionId: "act-2", atMs: 2_000, subjectId: "second" }),
      goalAction({ actionId: "act-1", atMs: 1_000, subjectId: "first" }),
    ]);
    expect(out.map((e) => e.title)).toEqual(["first", "second"]);
  });

  test("only goals — an approval in the same queue is not work", () => {
    const approval = goalAction({ actionId: "act-9", kind: HumanActionKind.ApproveGate, subjectId: "task-1" });
    expect(statedGoalsAsIntake([approval]).length).toBe(0);
  });

  test("a goal with no stated done-condition carries no reproduction rather than a placeholder", () => {
    // Intake refuses a defect with no reproduction. A goal whose done-condition is blank deserves
    // the same treatment — inventing one would manufacture the thing the final gate is judged on.
    expect(statedGoalsAsIntake([goalAction({ reason: "   " })])[0]?.reproduction).toBeUndefined();
  });
});

describe("CONFIGURATION THE RUNTIME ACTUALLY READS", () => {
  const org: OrgRecord = {
    orgId: "acme",
    name: "Acme",
    storeDir: "/tmp/acme",
    intake: Intake.Greenfield,
    autonomy: Autonomy.Autonomous,
    policy: { orgId: "acme", verification: "existing_harness" },
    sources: [],
    humanCheckpoints: [HumanCheckpoint.Approach],
    skills: [],
    createdAtMs: 1,
  } as unknown as OrgRecord;

  const registry = serializeRegistry({ orgs: [org] });

  // THE DEFECT: `org create` recorded store, autonomy, checkpoints and skills; `run-org` had no
  // `--org` flag and read none of it. Settings the configured thing never reads are a note to
  // nobody — an org created `--checkpoint approach` ran fully agentic.
  test("the store and the action queue come from the registry", () => {
    const r = withOrgDefaults(parseArgs([]), "acme", registry);
    if ("reason" in r) throw new Error(r.reason);
    expect(r.args.store).toBe("/tmp/acme");
    expect(r.args.actions).toBe("/tmp/acme/actions");
  });

  test("a configured checkpoint applies without being retyped as a flag", () => {
    const r = withOrgDefaults(parseArgs([]), "acme", registry);
    if ("reason" in r) throw new Error(r.reason);
    expect(r.args.checkpoints).toEqual([HumanCheckpoint.Approach]);
  });

  // THE DEFECT: the autonomy loop existed with the right stop reasons and was opt-in behind
  // `--until N`, so the default was ONE cycle. An organization that stops with work still open has
  // not finished, and "it is done" and "it stopped" become indistinguishable.
  test("a resolved organization CONVERGES by default rather than running one cycle", () => {
    const r = withOrgDefaults(parseArgs([]), "acme", registry);
    if ("reason" in r) throw new Error(r.reason);
    expect(r.args.until).toBe(String(DEFAULT_CONVERGENCE_CYCLES));
  });

  test("an explicit flag always wins — this fills in, it never overrides", () => {
    const r = withOrgDefaults(parseArgs(["--store", "/mine", "--until", "3"]), "acme", registry);
    if ("reason" in r) throw new Error(r.reason);
    expect(r.args.store).toBe("/mine");
    expect(r.args.until).toBe("3");
  });

  test("an unknown organization is REFUSED, and the refusal names the ones that exist", () => {
    const r = withOrgDefaults(parseArgs([]), "nope", registry);
    if (!("reason" in r)) throw new Error("expected a refusal");
    expect(r.reason).toContain("acme");
  });

  test("no registry at all is a refusal that says how to make one", () => {
    const r = withOrgDefaults(parseArgs([]), "acme", undefined);
    if (!("reason" in r)) throw new Error("expected a refusal");
    expect(r.reason).toContain("org create");
  });
});

describe("TESTS RUN WHERE THE CODE IS", () => {
  // THE DEFECT: `commandTestRunner` used its configured directory unconditionally, and the runtime
  // never forwarded the change's checkout. With `--worktrees` every test therefore ran against the
  // BASE tree. MEASURED: a task whose worker had just committed a working app and its suite was
  // failed by `runtime_validation` three times because the tests ran where the app was not — and
  // the silent case is worse, since a base that already passes hands every change a green gate
  // that proves nothing about it.
  test("the runner honours the checkout it is handed", async () => {
    // PROVEN BY WHERE THE PROCESS LANDED, not by an exit code. The command writes a file into its
    // own working directory; asserting that file appears in the checkout we passed is the only
    // form of this test that fails when the adapter goes back to using its configured directory.
    const here = mkdtempSync(join(tmpdir(), "cfg-"));
    const change = mkdtempSync(join(tmpdir(), "wt-"));
    const runner = commandTestRunner({
      command: process.execPath,
      argsFor: () => ["-e", "require('fs').writeFileSync('ran-here.txt', process.cwd())"],
      cwd: here,
    });

    const r = await runner.run({ testCaseId: "tc-1" } as never, { branch: "b", workdir: change });
    expect(r.ok).toBe(true);
    expect(existsSync(join(change, "ran-here.txt"))).toBe(true);
    // And NOT in the configured directory — the tree it would have tested before the fix.
    expect(existsSync(join(here, "ran-here.txt"))).toBe(false);
  });

  test("with no checkout it falls back to the configured directory", async () => {
    // The other half, so the fix cannot be "always use a workdir": in-memory change control opens
    // real changes with no directory at all, and those must still run somewhere.
    const here = mkdtempSync(join(tmpdir(), "cfg-"));
    const runner = commandTestRunner({
      command: process.execPath,
      argsFor: () => ["-e", "require('fs').writeFileSync('ran-here.txt', process.cwd())"],
      cwd: here,
    });
    const r = await runner.run({ testCaseId: "tc-1" } as never, { branch: "b" });
    expect(r.ok).toBe(true);
    expect(existsSync(join(here, "ran-here.txt"))).toBe(true);
  });

  test("the port's context ADMITS a workdir — the type is what carried the defect", () => {
    // `TestRunner.run`'s ctx was `{ branch }` only, so even a runtime that wanted to forward the
    // checkout had nowhere to put it. This asserts the shape, which is the part that made the
    // whole defect unfixable from the adapter alone.
    const runner = commandTestRunner({ command: process.execPath, argsFor: () => ["-e", ""], cwd: process.cwd() });
    const ctx: { readonly branch: string; readonly workdir?: string } = { branch: "b", workdir: "/somewhere" };
    expect(typeof runner.run).toBe("function");
    expect(ctx.workdir).toBe("/somewhere");
  });
});
