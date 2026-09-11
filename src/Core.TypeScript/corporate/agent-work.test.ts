/**
 * agent-work.test.ts — an agent may act, and may not judge its own action.
 *
 * The fourth boundary was: *the model chooses; it doesn't work. Its authority is exactly one
 * clamped integer wide, deliberately.* This closes it at the seam rather than by widening that
 * authority — the agent now performs, and a verifier it does not control decides whether the
 * performance worked.
 *
 * One property carries the file, and every test here is a way of failing it:
 *
 *   THE AGENT PROPOSES. THE VERIFIER DECIDES. They are never the same party.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { agentWorkExecutor, modelProposal, type AgentAttempt } from "./adapters";
import { Fidelity } from "./providers";
import { WorkState, WorkType, type CascadeNode } from "./goal-cascade";

const scratch = (label: string) => mkdtempSync(join(tmpdir(), `agentwork-${label}-`));
const SELF = process.execPath;

const node = (workId = "task-7"): CascadeNode => ({
  workId,
  workType: WorkType.Task,
  title: "stop the coupon double-apply",
  state: WorkState.Open,
  ownerHatId: "tech_lead",
  assigneeHatId: "backend_implementer",
});

const attempt = (summary = "I fixed it"): AgentAttempt => ({ summary, artifacts: ["src/coupon.ts"] });

const exec = (args: readonly string[], perform: () => AgentAttempt | Promise<AgentAttempt> = () => attempt()) =>
  agentWorkExecutor({
    perform,
    verify: { command: SELF, argsFor: () => [...args], cwd: scratch("v") },
  });

describe("THE VERIFIER DECIDES, NOT THE AGENT", () => {
  test("the SAME confident attempt succeeds or fails purely on the exit code", async () => {
    // Measured against a real model first: qwen2.5:0.5b produced byte-identical prose for both
    // runs — "you can implement a feature that prevents the application of a coupon twice" — while
    // `succeeded` flipped. Confidence and correctness are decoupled here by construction.
    const claim = () => attempt("I have completely fixed the defect");

    const passed = await exec(["-e", "process.exit(0)"], claim).execute(node(), { branch: "b" });
    expect(passed.ok && passed.value.succeeded).toBe(true);

    const failed = await exec(["-e", "process.exit(1)"], claim).execute(node(), { branch: "b" });
    expect(failed.ok).toBe(true);
    if (failed.ok) {
      expect(failed.value.succeeded).toBe(false);
      // The claim survives in the record beside the verdict, so the two can disagree in the open.
      expect(failed.value.summary).toContain("completely fixed");
      expect(failed.value.summary).toContain("exited 1");
    }
  });

  test("AN AGENT CANNOT VOTE — a smuggled `succeeded` is ignored", async () => {
    // `AgentAttempt` has no such field, and this is the runtime half of that type-level guarantee:
    // even handed one, the executor reads the verifier.
    const smuggled = () => ({ summary: "trust me", artifacts: [], succeeded: true }) as AgentAttempt;
    const r = await exec(["-e", "process.exit(1)"], smuggled).execute(node(), { branch: "b" });
    expect(r.ok && r.value.succeeded).toBe(false);
  });

  test("what the agent SAID is kept as evidence, separately from the verdict", async () => {
    const r = await exec(["-e", "console.log('build ok'); process.exit(0)"], () => attempt("I rewrote the coupon guard"))
      .execute(node(), { branch: "b" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The TESTIMONY, not merely a labelled placeholder: asserting on the prefix alone would pass
    // for `agent-said:` with the summary thrown away, which is the whole point of keeping it.
    expect(r.evidence.some((e) => e.ref === "agent-said:I rewrote the coupon guard")).toBe(true);
    expect(r.evidence.some((e) => e.ref === "verify-exit:0")).toBe(true);
    expect(r.evidence.some((e) => e.ref.includes("build ok"))).toBe(true);
    // The artifacts are the agent's, passed through unjudged.
    expect(r.value.artifacts).toEqual(["src/coupon.ts"]);
  });

  test("the executor is labelled REAL — it runs a process", () => {
    expect(exec(["-e", "process.exit(0)"]).meta.fidelity).toBe(Fidelity.Real);
    expect(exec(["-e", "process.exit(0)"]).meta.describes).toContain("decides whether it worked");
  });
});

describe("the refusals — which are NOT failures", () => {
  test("AN AGENT THAT THREW REFUSES; it does not report failed work", async () => {
    // "The model timed out" and "the change does not build" are different facts, and collapsing
    // them would file a defect against code the agent never touched.
    const r = await exec(["-e", "process.exit(0)"], () => {
      throw new Error("the model timed out");
    }).execute(node(), { branch: "b" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain("timed out");
      expect(r.reason).toContain("task-7");
    }
  });

  test("A VERIFIER THAT COULD NOT RUN REFUSES — a missing build is not a verdict", async () => {
    const port = agentWorkExecutor({
      perform: () => attempt(),
      verify: { command: join(scratch("missing"), "no-such-build"), argsFor: () => [], cwd: scratch("missing-cwd") },
    });
    const r = await port.execute(node(), { branch: "b" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("could not run");
  });

  test("the work item reaches BOTH the agent and the verifier", async () => {
    const seenByAgent: string[] = [];
    const seenByVerifier: string[] = [];
    const port = agentWorkExecutor({
      perform: (n, ctx) => {
        seenByAgent.push(`${n.workId}@${ctx.branch}`);
        return attempt();
      },
      verify: {
        command: SELF,
        argsFor: (n) => {
          seenByVerifier.push(n.workId);
          return ["-e", "process.exit(0)"];
        },
        cwd: scratch("both"),
      },
    });
    await port.execute(node("task-42"), { branch: "work/task-42" });
    expect(seenByAgent).toEqual(["task-42@work/task-42"]);
    expect(seenByVerifier).toEqual(["task-42"]);
  });
});

describe("modelProposal — honest about its own reach", () => {
  const backend = (response: string) => ({
    name: "fake",
    complete: async () => response,
  });

  test("the model's text becomes the attempt's summary", async () => {
    const perform = modelProposal(backend("  add an idempotency key on the coupon  "), (n) => `fix: ${n.title}`);
    const a = await perform(node());
    expect(a.summary).toBe("add an idempotency key on the coupon");
    expect(a.artifacts).toEqual(["proposal:task-7"]);
  });

  test("the work item reaches the PROMPT — otherwise every item gets the same proposal", async () => {
    const prompts: string[] = [];
    const perform = modelProposal(
      { name: "fake", complete: async (p: string) => { prompts.push(p); return "ok"; } },
      (n) => `fix: ${n.title} (${n.workId})`,
    );
    await perform(node("task-9"));
    expect(prompts).toEqual(["fix: stop the coupon double-apply (task-9)"]);
  });

  test("AN EMPTY RESPONSE THROWS — and so becomes a refusal, never silent success", async () => {
    // An empty summary beside a passing verifier would read as work done quietly. Through the
    // executor this surfaces as a refusal rather than as a green with nothing behind it.
    const perform = modelProposal(backend("   "), () => "p");
    expect(perform(node())).rejects.toThrow("returned nothing");

    const port = agentWorkExecutor({
      perform,
      verify: { command: SELF, argsFor: () => ["-e", "process.exit(0)"], cwd: scratch("empty") },
    });
    const r = await port.execute(node(), { branch: "b" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("returned nothing");
  });
});

describe("A VERIFIER THAT SAYS NO SAYS WHY", () => {
  // MEASURED on AIAGENT-1662: the verifier named 23 newly failing tests and the record kept
  // "verifier exited 1", so the next attempt knew it was refused and not what it had broken.
  test("the verifier's last lines travel with a failed attempt; a passing one adds nothing", async () => {
    const named = "process.stderr.write('[verify] NEW FAILURE introduced by this change: AzureBlob > uploads\n');process.exit(1)";
    const failed = await exec(["-e", named]).execute(node(), { branch: "b" });
    expect(failed.ok && failed.value.succeeded).toBe(false);
    if (failed.ok) expect(failed.value.summary).toContain("NEW FAILURE introduced by this change: AzureBlob > uploads");
    const passed = await exec(["-e", "process.stderr.write('noise');process.exit(0)"]).execute(node(), { branch: "b" });
    if (passed.ok) expect(passed.value.summary).not.toContain("the verifier said");
  });
});
