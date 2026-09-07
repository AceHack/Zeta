/**
 * corporate/adapters.ts — the concrete ends of the ports.
 *
 * ── TWO FAMILIES, AND THE LABEL IS THE WHOLE POINT ───────────────────────────
 * The `simulated*` adapters are what the register did all along: an inbound fixture, a work item
 * that completes by being marked complete, planned test outcomes, a change that merges because
 * nothing stopped it. Nothing about that behaviour changes here. What changes is that it now SAYS
 * it is a simulation, so a report can tell a run that shipped something from a run that decided it
 * had.
 *
 * The `real*` adapters actually reach: a directory of inbound events, a shell command whose exit
 * code decides the outcome, a git branch and merge. They are constructed explicitly and are never a
 * default — see `providers.ts` on why `resolve` refuses rather than falling back.
 *
 * ── THE COMMAND ADAPTER IS A REAL CAPABILITY ─────────────────────────────────
 * `commandWorkExecutor` runs a process. That is the point — it is how an organization builds
 * anything — and it is also the sharpest edge in this file, so:
 *
 *   - the command is supplied by the CALLER. There is no default command, no shell string
 *     interpolation of work titles, and no way for a work item's content to become the command.
 *   - arguments are passed as an ARRAY, never a shell line, so nothing in a work item can inject a
 *     second command.
 *   - the exit code decides success. Not stdout, not the absence of stderr — a build that prints
 *     "error" and exits 0 succeeded, and one that prints nothing and exits 1 did not.
 *   - stdout and stderr are captured as evidence, truncated, and the truncation is visible.
 *
 * ── EVERY ADAPTER RETURNS A RESULT ───────────────────────────────────────────
 * A provider that throws takes the organization down with it; one that swallows its error reports
 * success it did not have. Both are refusals here, with the reason carried out.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  Fidelity,
  Port,
  type ChangeControlPort,
  type IntakeSource,
  type PortResult,
  type ReviewPort,
  type ReviewRequest,
  type ReviewVerdict,
  type TestRunner,
  type WorkContext,
  type WorkExecutor,
  type WorkOutcome,
} from "./providers";
import { GateOutcome } from "./quality-gate";
import { RunOutcome, type TestCase } from "./qa";
import type { ExternalEvent } from "./intake";
import type { CascadeNode } from "./goal-cascade";

// ─── Simulated: what the register already did, now labelled ─────────────────

/** Inbound events handed over as a fixture. Exactly the previous behaviour, said out loud. */
export function simulatedIntake(events: readonly ExternalEvent[], name = "fixture"): IntakeSource {
  return {
    meta: {
      port: Port.Intake,
      name,
      fidelity: Fidelity.Simulated,
      describes: `${events.length} fixed inbound event(s)`,
    },
    poll: async () => ({ ok: true, value: events, evidence: [{ kind: "document", ref: `fixture:${String(events.length)}` }] }),
  };
}

/**
 * Work that completes by being marked complete.
 *
 * `succeeds` is REQUIRED rather than defaulted to true: a simulation whose default is success turns
 * "nobody decided what this should do" into a green, which is the same defect `createPlannedExecutor`
 * already refuses for tests.
 */
export function simulatedWorkExecutor(succeeds: boolean, name = "assumed"): WorkExecutor {
  return {
    meta: {
      port: Port.WorkExecution,
      name,
      fidelity: Fidelity.Simulated,
      describes: `assumes every work item ${succeeds ? "succeeds" : "fails"}; performs nothing`,
    },
    execute: async (node) => ({
      ok: true,
      value: {
        workId: node.workId,
        succeeded: succeeds,
        artifacts: [],
        summary: `assumed ${succeeds ? "complete" : "failed"} — no work was performed`,
      },
      evidence: [{ kind: "trace", ref: `assumed:${node.workId}:${succeeds ? "ok" : "failed"}` }],
    }),
  };
}

/** Planned test outcomes. The `TestExecutor` behaviour `qa.ts` already had, behind the port. */
export function simulatedTestRunner(
  plan: ReadonlyMap<string, RunOutcome>,
  fallback: RunOutcome,
  name = "planned",
): TestRunner {
  return {
    meta: {
      port: Port.TestExecution,
      name,
      fidelity: Fidelity.Simulated,
      describes: `${plan.size} planned outcome(s), falling back to '${fallback}'`,
    },
    run: async (testCase: TestCase) => {
      const outcome = plan.get(testCase.testCaseId) ?? fallback;
      return {
        ok: true,
        value: { outcome },
        evidence: [{ kind: "trace", ref: `planned:${testCase.testCaseId}:${outcome}` }],
      };
    },
  };
}

/**
 * A gate that approves because nothing stopped it.
 *
 * EXACTLY the behaviour the register already had, and the reason this port exists. Six of the seven
 * gates returned `Approved` with the reason "reviewed" — a constant — and nothing said so: the run
 * reported four honest adapters and rubber-stamped its own architecture review in silence.
 *
 * Nothing about that behaviour changes here. What changes is that `describes` now says it, so a run
 * that stamps its own homework says it is doing that.
 */
export function autoApproveReview(name = "auto-approve"): ReviewPort {
  return {
    meta: {
      port: Port.Review,
      name,
      fidelity: Fidelity.Simulated,
      describes: "approves every gate it is asked about; reads no evidence and consults nobody",
    },
    review: async (request) => ({
      ok: true,
      value: { outcome: GateOutcome.Approved, reason: "auto-approved — nothing reviewed this" },
      evidence: [{ kind: "trace", ref: `auto-approved:${request.gate}:${request.workId}` }],
    }),
  };
}

/**
 * A gate decided by a queue of filed verdicts — the human-review shape.
 *
 * Reads `<dir>/<workId>/<gate>.json` as `{ outcome, reason }`.
 *
 * A MISSING VERDICT IS A REFUSAL, never an approval. That is the whole difference between a review
 * queue and a rubber stamp: "nobody has looked at this yet" must block, and the tempting shortcut —
 * treat absence as consent so the pipeline keeps moving — turns the queue into the thing it
 * replaced. An unreadable or malformed file is refused BY PATH for the same reason `directoryIntake`
 * refuses one: a broken verdict and no verdict must not look alike.
 */
export function directoryReview(dir: string, name = "queue"): ReviewPort {
  return {
    meta: {
      port: Port.Review,
      name,
      fidelity: Fidelity.Real,
      describes: `reads filed gate verdicts from ${dir}; an unreviewed gate blocks`,
    },
    review: async (request) => {
      const path = join(dir, request.workId, `${request.gate}.json`);
      // ONE SYSCALL. `existsSync(path)` then `readFileSync(path)` is a check-then-use race
      // (TOCTOU, CWE-367): the verdict can be filed, or removed, between the two, so the answer the
      // check gave is already stale when the read runs. A MISSING verdict and an unreadable one are
      // still different answers — the first is "nobody has reviewed this", the second is a real
      // fault — so `ENOENT` is separated from everything else rather than collapsed into it.
      let raw: string;
      try {
        raw = readFileSync(path, "utf-8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          return { ok: false, reason: `no verdict filed for '${request.gate}' on ${request.workId} (expected ${path})` };
        }
        return { ok: false, reason: `could not read the verdict for '${request.gate}' on ${request.workId}: ${err instanceof Error ? err.message : String(err)}` };
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        return { ok: false, reason: `${path} is not valid JSON: ${err instanceof Error ? err.message : String(err)}` };
      }
      const shaped = parsed as Partial<ReviewVerdict>;
      if (typeof shaped.outcome !== "string" || !GATE_OUTCOMES.includes(shaped.outcome as GateOutcome)) {
        return { ok: false, reason: `${path} has no recognised outcome (have: ${GATE_OUTCOMES.join(", ")})` };
      }
      if (typeof shaped.reason !== "string" || shaped.reason.trim() === "") {
        // A verdict with no reason is a vote, not a review — and the gate record would carry a bare
        // word that nobody downstream can act on.
        return { ok: false, reason: `${path} has no reason; a verdict without one is not a review` };
      }
      return {
        ok: true,
        value: { outcome: shaped.outcome as GateOutcome, reason: shaped.reason },
        evidence: [{ kind: "document", ref: path }],
      };
    },
  };
}

/**
 * A gate decided by running an external check.
 *
 * Same rules as the other command adapters: no shell, arguments as an array, and the EXIT CODE
 * decides — 0 approves, non-zero rejects. A check that could not run is a REFUSAL rather than a
 * rejection, because "the linter is missing" is not a finding about the code.
 */
export function commandReview(input: {
  readonly command: string;
  readonly argsFor: (request: ReviewRequest) => readonly string[];
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly name?: string;
}): ReviewPort {
  return {
    meta: {
      port: Port.Review,
      name: input.name ?? "command",
      fidelity: Fidelity.Real,
      describes: `runs '${input.command}' per gate in ${input.cwd}; its exit code is the verdict`,
    },
    review: async (request) => {
      const run = spawnSync(input.command, [...input.argsFor(request)], {
        cwd: input.cwd,
        encoding: "utf-8",
        timeout: input.timeoutMs ?? 120_000,
        shell: false,
      });
      if (run.error !== undefined) {
        return { ok: false, reason: `'${input.command}' could not run: ${run.error.message}` };
      }
      const approved = run.status === 0;
      const said = (run.stdout ?? "").trim();
      return {
        ok: true,
        value: {
          outcome: approved ? GateOutcome.Approved : GateOutcome.Rejected,
          reason: said === "" ? `${input.command} exited ${String(run.status)}` : capture("said", said),
        },
        evidence: [
          { kind: "trace", ref: `exit:${String(run.status)}` },
          { kind: "log", ref: capture("stdout", run.stdout ?? "") },
        ],
      };
    },
  };
}

/**
 * A gate decided by an agent — a model, or anything else that judges outside this process.
 *
 * LABELLED REAL, deliberately, even though the function handed in might be pure. An adapter that
 * delegates to caller-supplied judgement cannot know whether that judgement is deterministic, and
 * the two possible mistakes are not symmetric: calling a model `simulated` would let a run report
 * itself replayable while a network decided its gates, whereas calling a pure function `real` only
 * costs an unnecessary "not replayable". Conservative in the direction that cannot mislead.
 *
 * The judgement is CLAMPED to the outcomes a gate actually admits — same discipline as the menu:
 * the code computes the legal set, the agent picks within it.
 */
export function agentReview(
  judge: (request: ReviewRequest) => Promise<ReviewVerdict> | ReviewVerdict,
  name = "agent",
): ReviewPort {
  return {
    meta: {
      port: Port.Review,
      name,
      fidelity: Fidelity.Real,
      describes: "a judgement made outside this process decides each gate",
    },
    review: async (request) => {
      let verdict: ReviewVerdict;
      try {
        verdict = await judge(request);
      } catch (err) {
        // A reviewer that threw did not approve. Letting the exception escape would take the whole
        // organization down over one opinion.
        return { ok: false, reason: `the reviewer failed on '${request.gate}': ${err instanceof Error ? err.message : String(err)}` };
      }
      if (!GATE_OUTCOMES.includes(verdict.outcome)) {
        return { ok: false, reason: `the reviewer returned '${String(verdict.outcome)}', which is not a gate outcome` };
      }
      if (verdict.reason.trim() === "") {
        return { ok: false, reason: `the reviewer gave no reason for '${request.gate}'` };
      }
      return { ok: true, value: verdict, evidence: [{ kind: "trace", ref: `agent:${request.gate}:${verdict.outcome}` }] };
    },
  };
}

/** A change that opens and merges because nothing stopped it. */
export function simulatedChangeControl(name = "in-memory"): ChangeControlPort {
  return {
    meta: {
      port: Port.ChangeControl,
      name,
      fidelity: Fidelity.Simulated,
      describes: "opens and merges changes in memory; touches no repository",
    },
    open: async (node, ctx) => ({
      ok: true,
      value: { changeId: `change-${node.workId}`, branch: ctx.branch },
      evidence: [{ kind: "trace", ref: `opened:${node.workId}` }],
    }),
    merge: async (handle) => ({
      ok: true,
      value: handle,
      evidence: [{ kind: "trace", ref: `merged:${handle.changeId}` }],
    }),
  };
}

// ─── Real: adapters that actually reach ─────────────────────────────────────

/**
 * The inbox's reading order: `.json` files only, ordinal ascending.
 *
 * Extracted and exported rather than inlined at the `readdirSync` call because otherwise it is
 * UNFALSIFIABLE. Most filesystems already hand back entries in alphabetical order, so a test that
 * writes files and reads them through the adapter passes identically whether the sort is there or
 * not — a check that cannot fail. Here the ordering is a function over a list, and a list can be
 * handed over backwards.
 *
 * Ordinal, per `.claude/rules/culture-invariant-by-default.md`: JavaScript's default array sort
 * compares UTF-16 code units, and `localeCompare` would make the run's event order depend on the
 * machine's locale.
 */
export function inboxOrder(entries: readonly string[]): readonly string[] {
  // No defensive copy: `filter` already returns a new array, so the caller's listing is untouched.
  // Spreading first would be a copy that cannot be observed — the vacuity class, in one line.
  return entries.filter((e) => e.endsWith(".json")).sort();
}

/**
 * Inbound events read from a directory of JSON files.
 *
 * Real I/O, and the least dangerous kind: it reads. A file that is not valid JSON, or does not look
 * like an `ExternalEvent`, is REFUSED with its path — dropping it would make a malformed ticket
 * indistinguishable from no ticket, and the queue would be quietly short.
 *
 * A missing directory is an EMPTY poll rather than an error: an inbox nobody has written to is a
 * normal state.
 */
export function directoryIntake(dir: string, name = "directory"): IntakeSource {
  return {
    meta: {
      port: Port.Intake,
      name,
      fidelity: Fidelity.Real,
      describes: `reads inbound events from ${dir}`,
    },
    poll: async () => {
      // Attempted, not checked first: `existsSync(dir)` followed by `readdirSync(dir)` is the same
      // check-then-use race. An absent inbox is a normal answer here — nothing has arrived — so it
      // stays a success with no events; anything else is a real fault and is reported as one rather
      // than read as an empty queue, which would make a broken mount look like a quiet morning.
      let entries: readonly string[];
      try {
        entries = readdirSync(dir);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ENOENT") return { ok: true, value: [], evidence: [{ kind: "document", ref: `empty:${dir}` }] };
        return { ok: false, reason: `could not read the inbox at ${dir}: ${err instanceof Error ? err.message : String(err)}` };
      }
      const events: ExternalEvent[] = [];
      const refs: string[] = [];
      for (const entry of inboxOrder(entries)) {
        const path = join(dir, entry);
        let parsed: unknown;
        try {
          parsed = JSON.parse(readFileSync(path, "utf-8"));
        } catch (err) {
          return { ok: false, reason: `${path} is not valid JSON: ${err instanceof Error ? err.message : String(err)}` };
        }
        const shaped = parsed as Partial<ExternalEvent>;
        // Shape-checked here rather than trusted: `intake.normalize` will refuse a malformed event
        // anyway, but its refusal would name a field, not the FILE, and a directory of tickets needs
        // to say which one is broken.
        if (typeof shaped.source !== "string" || typeof shaped.externalId !== "string" || typeof shaped.title !== "string") {
          return { ok: false, reason: `${path} is missing source, externalId or title` };
        }
        events.push(shaped as ExternalEvent);
        refs.push(path);
      }
      return { ok: true, value: events, evidence: refs.map((ref) => ({ kind: "document" as const, ref })) };
    },
  };
}

/**
 * Every outcome a gate may carry, derived from the enum rather than retyped.
 *
 * A hand-written copy would drift the moment an outcome is added: the new one would be refused at
 * the boundary while working everywhere else, which reads as a broken reviewer rather than a stale
 * list.
 */
const GATE_OUTCOMES: readonly GateOutcome[] = Object.values(GateOutcome);

/**
 * Inbound events fetched over HTTP — the Jira/portal shape.
 *
 * The connector the register never had. Note what is NOT here: no Jira-specific field names, no
 * knowledge of any one tracker's schema. A tracker differs from every other tracker in exactly one
 * place — how its JSON maps onto an `ExternalEvent` — so that is the only thing a caller supplies.
 * Adding Jira, or a portal, or a spreadsheet export, is a `mapper` function; it is not a redesign.
 *
 * ── EVERY FAILURE IS A REFUSAL, AND NAMES WHICH ITEM ─────────────────────────
 * A non-2xx response, an unparseable body, a payload that is not a list, a mapper that rejects one
 * item: all refusals, and the item-level one says WHICH index and id. Dropping a bad ticket would
 * make it indistinguishable from no ticket, and the queue would be quietly short — the same defect
 * `directoryIntake` refuses by path.
 *
 * An EMPTY list is a normal poll, not an error. A quiet morning is not an outage.
 *
 * `fetchImpl` is injectable so the refusals can be exercised without a network, and the tests still
 * run the happy path against a real listening server — a mocked-only connector proves nothing about
 * whether it can reach anything.
 */
export function httpIntake(input: {
  readonly url: string;
  /** Where the array of items lives in the response. Absent means the body IS the array. */
  readonly itemsAt?: (body: unknown) => unknown;
  /**
   * One item to one event. THROW to refuse it.
   *
   * No index parameter: the poll already names WHICH item failed in its refusal, so a second copy
   * of that position here would be a parameter no mapper needs — and one nothing could exercise,
   * which is how a signature grows something unfalsifiable.
   */
  readonly mapper: (item: unknown) => ExternalEvent;
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly name?: string;
  readonly fetchImpl?: typeof fetch;
}): IntakeSource {
  return {
    meta: {
      port: Port.Intake,
      name: input.name ?? "http",
      fidelity: Fidelity.Real,
      describes: `fetches inbound events from ${input.url}`,
    },
    poll: async () => {
      const doFetch = input.fetchImpl ?? fetch;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 30_000);
      let body: unknown;
      try {
        const res = await doFetch(input.url, {
          headers: { accept: "application/json", ...input.headers },
          signal: controller.signal,
        });
        if (!res.ok) {
          // The status, not a generic "could not fetch": a 401 and a 503 need different actions,
          // and an operator reading the refusal is the one who has to take them.
          return { ok: false, reason: `${input.url} answered HTTP ${String(res.status)}` };
        }
        body = await res.json();
      } catch (err) {
        return { ok: false, reason: `${input.url} could not be read: ${err instanceof Error ? err.message : String(err)}` };
      } finally {
        clearTimeout(timer);
      }

      const items = input.itemsAt === undefined ? body : input.itemsAt(body);
      if (!Array.isArray(items)) {
        return { ok: false, reason: `${input.url} did not return a list of items` };
      }
      const events: ExternalEvent[] = [];
      for (let i = 0; i < items.length; i++) {
        try {
          events.push(input.mapper(items[i]));
        } catch (err) {
          return {
            ok: false,
            reason: `${input.url} item ${String(i)} could not be read: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }
      return { ok: true, value: events, evidence: [{ kind: "document", ref: `${input.url}#${String(events.length)}` }] };
    },
  };
}

/** How much of a command's output is kept as evidence before it is truncated. */
export const MAX_CAPTURED_OUTPUT = 4_000;

function capture(label: string, text: string): string {
  if (text.length <= MAX_CAPTURED_OUTPUT) return `${label}:${text}`;
  // Truncation is VISIBLE. Silently clipping evidence makes a long failure look like a short one.
  return `${label}:${text.slice(0, MAX_CAPTURED_OUTPUT)}…[truncated ${String(text.length - MAX_CAPTURED_OUTPUT)} chars]`;
}

/**
 * Work performed by running a command.
 *
 * The command and its arguments come from the CALLER as an array — never a shell line, and never
 * built from a work item's own text. A work item is untrusted input to this process: it arrives
 * from intake, which may be a directory somebody else writes to, so letting its title reach a shell
 * would be a command-injection seam wearing an org chart.
 *
 * `argsFor` may use the node to choose ARGUMENTS (a path, an id). Those are passed as separate
 * argv entries, so a title containing `; rm -rf /` is one argument called `; rm -rf /` and not a
 * second command.
 */
export function commandWorkExecutor(input: {
  readonly command: string;
  readonly argsFor: (node: CascadeNode) => readonly string[];
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly name?: string;
}): WorkExecutor {
  return {
    meta: {
      port: Port.WorkExecution,
      name: input.name ?? "command",
      fidelity: Fidelity.Real,
      describes: `runs '${input.command}' in ${input.cwd}`,
    },
    execute: async (node, ctx): Promise<PortResult<WorkOutcome>> => {
      const args = [...input.argsFor(node)];
      const run = spawnSync(input.command, args, {
        // The change's own checkout when it has one, else the configured directory. This is what
        // lets a worktree-per-change adapter actually isolate the work rather than merely name it.
        cwd: ctx.workdir ?? input.cwd,
        encoding: "utf-8",
        timeout: input.timeoutMs ?? 120_000,
        // No shell. The whole safety argument above depends on this line.
        shell: false,
      });
      if (run.error !== undefined) {
        return { ok: false, reason: `'${input.command}' could not run: ${run.error.message}` };
      }
      // THE EXIT CODE DECIDES. Not stdout, not the presence of the word "error": a build that
      // prints warnings and exits 0 succeeded, and a silent one that exits 1 did not.
      const succeeded = run.status === 0;
      return {
        ok: true,
        value: {
          workId: node.workId,
          succeeded,
          artifacts: args,
          summary: `${input.command} exited ${String(run.status)}`,
        },
        evidence: [
          { kind: "trace", ref: `exit:${String(run.status)}` },
          { kind: "log", ref: capture("stdout", run.stdout ?? "") },
          { kind: "log", ref: capture("stderr", run.stderr ?? "") },
        ],
      };
    },
  };
}

/**
 * What an agent produced when handed a work item.
 *
 * THERE IS NO `succeeded` FIELD, and that absence is the entire design. An agent asked whether its
 * own work succeeded is the least reliable witness available: it has every incentive to say yes,
 * no independent view of the tree it just changed, and — being the thing under test — cannot be
 * the thing that judges. So the type does not offer it the option.
 *
 * It reports what it DID (a summary, the artifacts it touched). Whether that worked is decided
 * downstream by something the agent does not control.
 */
export interface AgentAttempt {
  /** What the agent says it did. Carried into the trace as testimony, never as a verdict. */
  readonly summary: string;
  /** Paths, refs, ids it claims to have produced. Unverified at this point. */
  readonly artifacts: readonly string[];
}

/**
 * Work performed by an AGENT, judged by a VERIFIER the agent does not control.
 *
 * The fourth boundary, closed at the seam rather than by widening the model's authority. Until now
 * a model's whole reach into this register was one clamped integer — it picked from a menu the code
 * computed. This lets it *act*, and pairs that with the only discipline that makes acting safe:
 *
 *   THE AGENT PROPOSES. THE VERIFIER DECIDES. They are never the same party.
 *
 * `perform` runs the agent. `verify` is a command whose EXIT CODE is the sole source of
 * `succeeded` — a build, a test run, a type-check. The agent's summary is recorded as testimony
 * beside the verdict, so a run can show a confident claim next to a failing build and let the two
 * disagree in the open.
 *
 * A verifier that could not run is a REFUSAL, not a failure: nothing was learned about the work,
 * and reporting "the build is missing" as "the agent failed" blames the wrong party.
 *
 * Note what this does NOT do: give the agent a shell. Whatever `perform` can reach is decided by
 * the caller who supplies it, and the verifier's command comes from the caller too — never from
 * the work item, and never from anything the agent said.
 */
export function agentWorkExecutor(input: {
  readonly perform: (node: CascadeNode, ctx: { readonly branch: string }) => Promise<AgentAttempt> | AgentAttempt;
  readonly verify: {
    readonly command: string;
    readonly argsFor: (node: CascadeNode) => readonly string[];
    readonly cwd: string;
    readonly timeoutMs?: number;
  };
  readonly name?: string;
}): WorkExecutor {
  return {
    meta: {
      port: Port.WorkExecution,
      name: input.name ?? "agent",
      fidelity: Fidelity.Real,
      describes: `an agent performs each item; '${input.verify.command}' decides whether it worked`,
    },
    execute: async (node, ctx): Promise<PortResult<WorkOutcome>> => {
      let attempt: AgentAttempt;
      try {
        attempt = await input.perform(node, ctx);
      } catch (err) {
        // An agent that threw did not do the work. Letting the exception escape would take the
        // organization down over one failed attempt.
        return { ok: false, reason: `the agent failed on ${node.workId}: ${err instanceof Error ? err.message : String(err)}` };
      }

      const run = spawnSync(input.verify.command, [...input.verify.argsFor(node)], {
        cwd: ctx.workdir ?? input.verify.cwd,
        encoding: "utf-8",
        timeout: input.verify.timeoutMs ?? 120_000,
        shell: false,
      });
      if (run.error !== undefined) {
        return { ok: false, reason: `the verifier '${input.verify.command}' could not run: ${run.error.message}` };
      }

      // THE VERIFIER DECIDES. `attempt` contributes evidence and prose and never touches this line.
      const succeeded = run.status === 0;
      return {
        ok: true,
        value: {
          workId: node.workId,
          succeeded,
          artifacts: attempt.artifacts,
          summary: `agent: ${attempt.summary} — verifier exited ${String(run.status)}`,
        },
        evidence: [
          { kind: "trace", ref: `agent-said:${attempt.summary}` },
          { kind: "trace", ref: `verify-exit:${String(run.status)}` },
          { kind: "log", ref: capture("stdout", run.stdout ?? "") },
        ],
      };
    },
  };
}

/**
 * Turn a text-completion model into a `perform` for the executor above.
 *
 * Honest about its own reach: a model that can only emit text cannot change a repository. What it
 * produces here is a PROPOSAL, recorded as the attempt's summary, and the verifier then judges the
 * tree as it actually stands. That is useful exactly where a proposal is the deliverable — a plan,
 * a diagnosis, a chosen approach — and it is not a code-writing agent wearing a costume.
 *
 * A model that returns nothing is a REFUSAL rather than an empty proposal, because an empty summary
 * beside a passing verifier would read as work that was done silently.
 */
export function modelProposal(
  backend: { readonly name: string; complete(prompt: string, opts?: { readonly maxTokens?: number }): Promise<string> },
  promptFor: (node: CascadeNode) => string,
  maxTokens = 120,
): (node: CascadeNode) => Promise<AgentAttempt> {
  return async (node) => {
    const said = (await backend.complete(promptFor(node), { maxTokens })).trim();
    if (said === "") throw new Error(`${backend.name} returned nothing for ${node.workId}`);
    return { summary: said, artifacts: [`proposal:${node.workId}`] };
  };
}

/**
 * An agent that is a COMMAND: whatever it prints is its proposal.
 *
 * The `perform` half of `agentWorkExecutor` in the shape an operator can reach from a command line
 * — a script, a coding agent, anything that writes to stdout. It still cannot vote on itself: the
 * verifier decides, and this side only ever produces testimony.
 *
 * A non-zero exit THROWS, which the executor turns into a refusal. An agent that failed to run is
 * not an agent that produced an empty proposal, and the difference has to survive: the second reads
 * as work quietly done.
 *
 * IT RUNS IN `ctx.workdir` WHEN THERE IS ONE, exactly as the verifier does. The first version of
 * this adapter ignored the context and ran in a fixed directory, and the very first end-to-end run
 * caught it: the agent wrote its file into the shared repository while the verifier looked in the
 * change's worktree, so every item failed with the agent confidently reporting success. The two
 * halves must judge the SAME tree or the verdict is about nothing.
 */
export function commandProposal(input: {
  readonly command: string;
  readonly argsFor: (node: CascadeNode) => readonly string[];
  readonly cwd: string;
  readonly timeoutMs?: number;
}): (node: CascadeNode, ctx: WorkContext) => AgentAttempt {
  return (node, ctx) => {
    const run = spawnSync(input.command, [...input.argsFor(node)], {
      cwd: ctx.workdir ?? input.cwd,
      encoding: "utf-8",
      timeout: input.timeoutMs ?? 120_000,
      shell: false,
    });
    if (run.error !== undefined) throw new Error(`'${input.command}' could not run: ${run.error.message}`);
    if (run.status !== 0) {
      throw new Error(`'${input.command}' exited ${String(run.status)}: ${(run.stderr ?? "").trim()}`);
    }
    const said = (run.stdout ?? "").trim();
    if (said === "") throw new Error(`'${input.command}' produced no proposal for ${node.workId}`);
    return { summary: capture("said", said), artifacts: [...input.argsFor(node)] };
  };
}

/**
 * A gate judged by a MODEL.
 *
 * The judgement is clamped the same way the menu is: the model is asked for one of two words, and
 * anything else is a REFUSAL rather than a default. That refusal direction is the whole design —
 * defaulting an unparseable answer to `Approved` would make a confused model the fastest path to
 * shipping, and defaulting it to `Rejected` would let a flaky endpoint silently halt an
 * organization while looking like a quality signal. Neither is a verdict, so neither is returned.
 *
 * Labelled REAL: it reaches a model, so the run is not replayable.
 */
export function modelReview(
  backend: { readonly name: string; complete(prompt: string, opts?: { readonly maxTokens?: number }): Promise<string> },
  promptFor: (request: ReviewRequest) => string,
  name = "model",
): ReviewPort {
  return {
    meta: {
      port: Port.Review,
      name,
      fidelity: Fidelity.Real,
      describes: `${backend.name} judges each gate; an unparseable answer is refused, never defaulted`,
    },
    review: async (request) => {
      let said: string;
      try {
        said = (await backend.complete(promptFor(request), { maxTokens: 24 })).trim();
      } catch (err) {
        return { ok: false, reason: `${backend.name} failed on '${request.gate}': ${err instanceof Error ? err.message : String(err)}` };
      }
      // Ordinal lowercase — a locale-sensitive fold would decide gates differently per machine.
      const word = said.toLowerCase();
      const approves = word.includes("approve");
      const rejects = word.includes("reject");
      if (approves === rejects) {
        // Both or neither. "approve" and "reject" in one answer is not a verdict either.
        return { ok: false, reason: `${backend.name} gave no clear verdict on '${request.gate}': ${capture("said", said)}` };
      }
      return {
        ok: true,
        value: {
          outcome: approves ? GateOutcome.Approved : GateOutcome.Rejected,
          reason: capture(`${backend.name} said`, said),
        },
        evidence: [{ kind: "trace", ref: `model:${request.gate}:${approves ? "approved" : "rejected"}` }],
      };
    },
  };
}

/**
 * Tests run by a command, one invocation per case.
 *
 * Same rules as the work executor: no shell, arguments as an array, exit code decides. A non-zero
 * exit is `Failed` rather than an error — a failing test is a RESULT, and reporting it as a broken
 * runner would hide the thing the suite exists to find.
 */
export function commandTestRunner(input: {
  readonly command: string;
  readonly argsFor: (testCase: TestCase) => readonly string[];
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly name?: string;
}): TestRunner {
  return {
    meta: {
      port: Port.TestExecution,
      name: input.name ?? "command",
      fidelity: Fidelity.Real,
      describes: `runs '${input.command}' per test case in ${input.cwd}`,
    },
    run: async (testCase) => {
      const run = spawnSync(input.command, [...input.argsFor(testCase)], {
        cwd: input.cwd,
        encoding: "utf-8",
        timeout: input.timeoutMs ?? 120_000,
        shell: false,
      });
      if (run.error !== undefined) {
        // The RUNNER broke, which is not the same as the test failing. Reporting this as `Failed`
        // would blame the code for a missing binary.
        return { ok: false, reason: `'${input.command}' could not run: ${run.error.message}` };
      }
      return {
        ok: true,
        value: { outcome: run.status === 0 ? RunOutcome.Passed : RunOutcome.Failed },
        evidence: [
          { kind: "trace", ref: `exit:${String(run.status)}` },
          { kind: "log", ref: capture("stdout", run.stdout ?? "") },
        ],
      };
    },
  };
}

/**
 * How many commits `branch` has that `HEAD` does not.
 *
 * THE DEFECT THIS EXISTS FOR. `git merge --no-ff <branch>` where the branch points at the same
 * commit as HEAD prints "Already up to date." and **exits 0** — measured, not assumed. Both git
 * adapters read that zero as a merge and returned `merged:<branch>` as evidence. So a run whose
 * work produced no commit reported real delivery over a repository nothing had happened in, and
 * `deliveryRate.deliveredForReal` counted it.
 *
 * That is the vacuity class in the one adapter whose entire purpose is to touch something real: a
 * check that cannot fail, wearing the word "merged". Every unit test committed inside the change
 * before merging, so the empty case was never constructed and 12 of 12 mutants passed over a branch
 * no test reached.
 *
 * EXPORTED so both of its unknown paths are reachable. Through an adapter only one of them is:
 * a branch that does not exist makes `rev-list` exit non-zero, and no adapter call can make git exit
 * 0 with an unparseable count. The second guard would then be unreachable defensive code — which
 * is the vacuity class, and the reason this takes its runner as a parameter rather than closing
 * over `spawnSync`.
 *
 * Returns `undefined` when git could not answer, which is NOT zero — an unanswerable question must
 * not read as "nothing to merge".
 */
export function commitsAhead(
  run: (args: readonly string[]) => { readonly status: number | null; readonly stdout?: string },
  branch: string,
): number | undefined {
  const counted = run(["rev-list", "--count", `HEAD..${branch}`]);
  if (counted.status !== 0) return undefined;
  const n = Number.parseInt((counted.stdout ?? "").trim(), 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Changes as real git branches.
 *
 * `open` creates a branch; `merge` merges it back. Both refuse on a non-zero exit rather than
 * reporting a merge that did not happen — the one thing change control cannot do is claim a merge.
 *
 * MERGE IS `--no-ff` ON PURPOSE: a fast-forward leaves no record that a change existed, and this
 * port's whole job is that the record and the repository agree.
 */
export function gitChangeControl(input: {
  readonly cwd: string;
  readonly baseBranch: string;
  readonly name?: string;
}): ChangeControlPort {
  // ── A MISSING DIRECTORY MUST NOT BECOME THE CURRENT ONE ─────────────────
  // `spawnSync` treats `cwd: undefined` as "wherever this process is standing", so an adapter
  // constructed without one branches, commits and MERGES in whatever repository the caller
  // happens to be in. TypeScript already requires the field — and that is not enough, because
  // `bun test` does not typecheck: a test that passed `repoDir` instead of `cwd` compiled with an
  // error nobody had run yet and executed against THIS repository, leaving it checked out on a
  // `work/task-013` branch it had created and merged.
  //
  // So the guard is at RUNTIME, where the damage happens. It throws rather than returning a
  // refusing port: a change-control adapter that cannot say which repository it writes to is
  // misconfigured, and every later call would be a fresh chance to write somewhere unintended.
  if (typeof input.cwd !== "string" || input.cwd.trim() === "") {
    throw new Error(
      "gitChangeControl needs an explicit `cwd`: without one git would run in the current " +
        "process directory, which is a repository nobody chose",
    );
  }
  const git = (args: readonly string[]) =>
    spawnSync("git", [...args], { cwd: input.cwd, encoding: "utf-8", shell: false });
  return {
    meta: {
      port: Port.ChangeControl,
      name: input.name ?? "git",
      fidelity: Fidelity.Real,
      describes: `branches from ${input.baseBranch} in ${input.cwd}`,
    },
    open: async (node, ctx) => {
      const made = git(["checkout", "-b", ctx.branch, input.baseBranch]);
      if (made.error !== undefined) return { ok: false, reason: `git could not run: ${made.error.message}` };
      if (made.status !== 0) return { ok: false, reason: `could not branch ${ctx.branch}: ${(made.stderr ?? "").trim()}` };
      return {
        ok: true,
        value: { changeId: `${ctx.branch}@${node.workId}`, branch: ctx.branch },
        evidence: [{ kind: "trace", ref: `branch:${ctx.branch}` }],
      };
    },
    merge: async (handle) => {
      const back = git(["checkout", input.baseBranch]);
      if (back.status !== 0) return { ok: false, reason: `could not return to ${input.baseBranch}: ${(back.stderr ?? "").trim()}` };
      const ahead = commitsAhead(git, handle.branch);
      if (ahead === undefined) return { ok: false, reason: `could not tell whether ${handle.branch} has anything to merge` };
      if (ahead === 0) {
        return { ok: false, reason: `${handle.branch} has no commits: there is nothing to merge, and a merge that moves nothing is not a merge` };
      }
      const merged = git(["merge", "--no-ff", "-m", `merge ${handle.changeId}`, handle.branch]);
      if (merged.error !== undefined) return { ok: false, reason: `git could not run: ${merged.error.message}` };
      if (merged.status !== 0) {
        return { ok: false, reason: `merge of ${handle.branch} refused: ${(merged.stderr ?? "").trim()}` };
      }
      return { ok: true, value: handle, evidence: [{ kind: "trace", ref: `merged:${handle.branch}` }] };
    },
  };
}

/**
 * A filesystem-safe directory name for a branch.
 *
 * `work/task-1` would otherwise nest a directory under `work/`, which quietly makes two changes
 * whose branches share a prefix into siblings inside one parent — and on Windows the slash is not
 * a legal name at all. Ordinal replacement, no locale involved.
 */
export function worktreeDirName(branch: string): string {
  return branch.replace(/[^A-Za-z0-9._-]/g, "-");
}

/**
 * Changes as real git branches, each in ITS OWN WORKTREE.
 *
 * `gitChangeControl` is correct and sequential-only: `checkout -b` moves the shared HEAD, so two
 * changes open at once in one repository would fight over which branch is checked out and whose
 * files are on disk. Today's runtime is sequential so nothing breaks — but "nothing breaks because
 * nobody has tried it concurrently yet" is a property held by an accident of the caller rather
 * than by the adapter, and that is the kind of limit that stops being true silently.
 *
 * A worktree gives each change its own directory and its own HEAD. The shared repository's checked
 * out branch never moves, so `open` is safe to call while another change is still in flight.
 *
 * `merge` merges into the base branch IN THE MAIN REPOSITORY and then removes the worktree —
 * `--no-ff`, for the same reason as the sibling adapter: a fast-forward leaves no record that a
 * change existed. Removal is part of merging rather than a separate cleanup step, because a
 * worktree left behind holds a lock on its branch and the next run's `open` would refuse.
 */
export function gitWorktreeChangeControl(input: {
  readonly cwd: string;
  readonly baseBranch: string;
  /** Where the per-change checkouts live. One directory per branch. */
  readonly worktreeRoot: string;
  readonly name?: string;
}): ChangeControlPort {
  const git = (args: readonly string[], at = input.cwd) =>
    spawnSync("git", [...args], { cwd: at, encoding: "utf-8", shell: false });
  return {
    meta: {
      port: Port.ChangeControl,
      name: input.name ?? "git-worktree",
      fidelity: Fidelity.Real,
      describes: `one worktree per change under ${input.worktreeRoot}, branched from ${input.baseBranch}`,
    },
    open: async (node, ctx) => {
      const workdir = join(input.worktreeRoot, worktreeDirName(ctx.branch));
      const made = git(["worktree", "add", "-b", ctx.branch, workdir, input.baseBranch]);
      if (made.error !== undefined) return { ok: false, reason: `git could not run: ${made.error.message}` };
      if (made.status !== 0) {
        return { ok: false, reason: `could not open a worktree for ${ctx.branch}: ${(made.stderr ?? "").trim()}` };
      }
      return {
        ok: true,
        value: { changeId: `${ctx.branch}@${node.workId}`, branch: ctx.branch, workdir },
        evidence: [{ kind: "trace", ref: `worktree:${workdir}` }],
      };
    },
    merge: async (handle) => {
      // BEFORE the merge, because afterwards the answer is always zero and the question is lost.
      const ahead = commitsAhead(git, handle.branch);
      if (ahead === undefined) return { ok: false, reason: `could not tell whether ${handle.branch} has anything to merge` };
      if (ahead === 0) {
        // The worktree may well hold files — the work ran. Uncommitted files are not a change, and
        // this adapter does not commit on the performer's behalf: doing so would put whatever else
        // is lying in that tree into a commit nobody wrote.
        return { ok: false, reason: `${handle.branch} has no commits: the work left nothing committed, and a merge that moves nothing is not a merge` };
      }
      const merged = git(["merge", "--no-ff", "-m", `merge ${handle.changeId}`, handle.branch]);
      if (merged.error !== undefined) return { ok: false, reason: `git could not run: ${merged.error.message}` };
      if (merged.status !== 0) {
        return { ok: false, reason: `merge of ${handle.branch} refused: ${(merged.stderr ?? "").trim()}` };
      }
      // Only after the merge SUCCEEDED. Removing it first would destroy the work if the merge then
      // refused, and the branch would be the only copy of something nobody could look at.
      const removed = git(["worktree", "remove", "--force", handle.workdir ?? worktreeDirName(handle.branch)]);
      if (removed.status !== 0) {
        // The change LANDED; the tidy-up did not. Reporting this as a failed merge would be a
        // second lie in the opposite direction, so it succeeds and says what is still on disk.
        return {
          ok: true,
          value: handle,
          evidence: [
            { kind: "trace", ref: `merged:${handle.branch}` },
            { kind: "trace", ref: `worktree-left-behind:${(removed.stderr ?? "").trim()}` },
          ],
        };
      }
      return { ok: true, value: handle, evidence: [{ kind: "trace", ref: `merged:${handle.branch}` }] };
    },
  };
}

/**
 * The set the register has always used, now nameable and labelled.
 *
 * Every port simulated, so a run built from these is replayable — which `fidelityOf` will say
 * rather than the caller having to remember.
 */
export function simulatedProviders(input: {
  readonly events: readonly ExternalEvent[];
  readonly workSucceeds: boolean;
  readonly testPlan?: ReadonlyMap<string, RunOutcome>;
  readonly testFallback: RunOutcome;
}) {
  return [
    simulatedIntake(input.events),
    simulatedWorkExecutor(input.workSucceeds),
    simulatedTestRunner(input.testPlan ?? new Map(), input.testFallback),
    autoApproveReview(),
    simulatedChangeControl(),
  ] as const;
}
