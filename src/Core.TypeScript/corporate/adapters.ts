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
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  Fidelity,
  type ChangeRevision,
  Port,
  type ChangeControlPort,
  type ChangeHandle,
  type ChangeHandoff,
  type ChangeProposal,
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
import type { ChangedFileCount } from "./providers";
import type { PortUsage } from "./meter";
import { GateOutcome, type GateKind } from "./quality-gate";
import type { Artifact, PhaseContext, ProducerPort } from "./pipeline";
import { RunOutcome, type TestCase } from "./qa";
import type { ExternalEvent } from "./intake";
import type { CascadeNode } from "./goal-cascade";
import { parseRequestRef } from "./request";
import { keptOutPaths } from "./change-request";

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
        // The work's own checkout when the request names one; the configured directory otherwise.
        cwd: request.workdir ?? input.cwd,
        encoding: "utf-8",
        timeout: input.timeoutMs ?? 120_000,
        shell: false,
        maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
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
  /**
   * Static headers, or a function computing them PER POLL — which is how a credential read from a
   * file at call time reaches the request without ever being a value in argv.
   */
  readonly headers?: Readonly<Record<string, string>> | (() => Readonly<Record<string, string>>);
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
        const headers = typeof input.headers === "function" ? input.headers() : input.headers;
        const res = await doFetch(input.url, {
          headers: { accept: "application/json", ...headers },
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

/** The last `n` non-empty lines of a command's output, each capped — where a verdict's reasons are. */
export function tailLines(text: string, n: number): readonly string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
  const tail = lines.slice(-n).map((l) => (l.length > 300 ? `${l.slice(0, 300)}…` : l));
  return lines.length > n ? [`…(${String(lines.length - n)} earlier line(s))`, ...tail] : tail;
}

/**
 * How much a spawned command may print before the runner gives up on it.
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 * `spawnSync` buffers a child's output and defaults to ONE MEGABYTE. Past that it kills the child
 * and returns `ENOBUFS` — which arrives here indistinguishable from "the command could not run", so
 * the gate refuses and the reason names the tool rather than the truth.
 *
 * MEASURED against a real build: `mvn test` on one ELERA module exceeded it and the verification
 * came back as a spawn error, for a project whose tests had not yet been reached. Real builds print
 * megabytes; a verifier that fails on verbose output fails on the ones that matter most.
 *
 * Sixty-four megabytes: past any honest build log and still far short of exhausting memory. A
 * command that prints more than this has a problem of its own worth surfacing.
 */
export const MAX_COMMAND_OUTPUT_BYTES = 64 * 1024 * 1024;

/**
 * The line an author uses to say which memory it actually used: `relied on [<memoryId>]`.
 *
 * Named once, so the parser and any producer that wants to be understood agree by construction
 * rather than by two string literals that happen to match.
 */
export const CITED_PREFIX = "relied on ";

/**
 * How an agent says it needs a person, on any gate.
 *
 * A DECLARED LINE SHAPE, like `- ` and `relied on `, because the alternative is the organization
 * deciding for itself what an agent must be unsure about — which is a questionnaire compiled into
 * the substrate, and it can only ever ask what its author thought of.
 *
 * The agent doing the step knows what it is missing; nothing else does. So it says so, in its own
 * words, and this layer carries the sentence without reading it.
 */
export const ASK_PREFIX = "ask: ";

/**
 * How an agent records something it worked out, so the next agent does not work it out again.
 *
 * `learned: <key> :: <what>` - the key is what a later reader would search for, the rest is the
 * lesson. Split on the first `::` only, because a lesson may well contain another one.
 *
 * A DECLARED LINE like the others, and for the same reason: the agent doing the work is the only
 * thing that knows a procedure was hard-won. An organization that decided for itself what counted
 * as a lesson would record the things its author thought of - which is the questionnaire mistake
 * one layer down.
 */
export const LEARNED_PREFIX = "learned: ";

/** One thing an agent worked out. `key` is how it will be found again. */
export interface Learning {
  readonly key: string;
  readonly value: string;
}

/** Parse `learned:` lines. A line with no `::` is all lesson and gets a key derived from its start. */
export function learningsFrom(lines: readonly string[]): readonly Learning[] {
  return lines
    .filter((l) => l.startsWith(LEARNED_PREFIX))
    .map((l) => l.slice(LEARNED_PREFIX.length).trim())
    .filter((l) => l.length > 0)
    .map((body) => {
      const at = body.indexOf("::");
      if (at < 0) {
        // No key given: derive a stable one from the opening words, so the same lesson written twice
        // REINFORCES rather than accumulating near-duplicates nobody can find.
        const key = body.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2).slice(0, 6).join("-");
        return { key: key === "" ? "lesson" : key, value: body };
      }
      return { key: body.slice(0, at).trim(), value: body.slice(at + 2).trim() };
    })
    .filter((l) => l.value !== "");
}

/**
 * Something that MAKES the document a pre-code gate will judge.
 *
 * Eleven of the fourteen gates had no producer, so there was nothing at those phases for a reviewer
 * to read. A run therefore had two honest options — approve on nothing, or reject on nothing — and
 * both are the same failure wearing different clothes: the gate is not evaluating the work.
 *
 * This is the third spawn adapter and it keeps the two rules the others keep. THE EXIT CODE DECIDES
 * whether the phase produced anything; a command that prints apologies and exits 0 has produced
 * something, and one that prints a document and exits 1 has not. And `shell: false`, because a work
 * item's title arrives from intake and must never reach a shell.
 *
 * Its STDOUT is the reference list, one per line — the paths a reviewer can open. An empty list from
 * a zero exit is reported as produced-but-cited-nothing rather than smoothed into success, because a
 * gate whose evidence list is empty is exactly what an approval with nothing behind it looks like.
 *
 * `priorArtifacts` is passed on the command line, so the phase can build on the last: the BRD writer
 * is handed the RFP analysis, the architect the BRD, the cost reviewer the architecture.
 */
export function commandArtifactProducer(input: {
  readonly command: string;
  readonly gate: GateKind;
  readonly argsFor: (gate: GateKind, node: CascadeNode, ctx: PhaseContext) => readonly string[];
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly name?: string;
  /**
   * The organization's OWN documents, resolved to readable paths, for the author to work from.
   *
   * Without this an author writes a BRD from the three sentences in a defect report and nothing
   * else — so it invents the specifics it needs, and the reviewer rejects it for inventing them.
   * That loop is not a disagreement about quality; it is the author being asked to describe a
   * system it has never been shown.
   *
   * Absent means judgement-only, which is what these phases have always been. Supplying it does not
   * change what a gate ASKS, only what the author was given before answering.
   */
  readonly contextFor?: (gate: GateKind, node: CascadeNode) => readonly string[];
  /**
   * Answers to questions THIS producer asked on an earlier run, so it can carry on.
   *
   * The other half of the `ask:` protocol. Without it an agent that asked a question and got an
   * answer would ask the same question again forever, and the organization would look like it was
   * consulting a person while learning nothing from them.
   *
   * Supplied by whoever owns the channel out — this adapter neither reads the outbox nor knows what
   * an answer means.
   */
  readonly answersFor?: (node: CascadeNode) => readonly { readonly question: string; readonly answer: string }[];
  /**
   * How many more times this step may come back with questions instead of work.
   *
   * Told to the step, not enforced behind it: an agent that knows this is its last round spends it
   * on what matters, where one that is silently cut off just fails. When it reaches zero the step
   * must produce something or refuse - the organization stops offering the person as an option.
   *
   * Absent means unbounded, which is right for a caller that has no way to answer anyway.
   */
  readonly askRoundsLeft?: (node: CascadeNode) => number;
  /**
   * Which skill performs this step, as the organization configured it.
   *
   * Passed as environment rather than interpreted here: what a skill IS depends on the agent — a
   * slash command to one, a directory of instructions to another, a marketplace id to a third. This
   * layer carries the name, the source and the reason it was chosen, and reads none of them.
   *
   * The `because` travels too. An agent told "use whatever this repository provides, because no
   * binding covers this gate" behaves differently from one told nothing at all, and the difference
   * is the whole value of having a default that is stated.
   */
  readonly skillFor?: (node: CascadeNode) => {
    readonly bound: boolean;
    readonly skill?: string;
    readonly source?: string;
    readonly because: string;
  };
  /**
   * What a reviewer said when they turned this work back, newest first.
   *
   * Verbatim and uninterpreted, like `answersFor`. A layer that summarised a review would be
   * deciding which of a person's objections mattered, which is the reviewer's call and not this
   * adapter's.
   */
  readonly feedbackFor?: (node: CascadeNode) => readonly { readonly gate: string; readonly said: string }[];
  /**
   * HOW THIS ORGANIZATION WORKS, as the agent should be told it.
   *
   * Three strings, already rendered, because the consumer is a prompt and this adapter has no
   * business deciding how a process reads. ONE FUNCTION returning three fields rather than three
   * separate injections: a caller cannot then wire two and leave the third silently absent, which
   * is exactly how an optional member went missing from the provider wrapper for its whole life.
   *
   * Every field is optional and an absent one emits no variable at all — an agent must be able to
   * tell "this organization states no process" from "the process is empty".
   */
  readonly guidanceFor?: (
    gate: GateKind,
    node: CascadeNode,
  ) => {
    readonly practice?: string;
    readonly directives?: string;
    readonly repoSkills?: string;
  };
}): ProducerPort {
  return {
    meta: {
      port: Port.WorkExecution,
      name: input.name ?? "artifact",
      fidelity: Fidelity.Real,
      describes: `runs '${input.command}' to produce the artifact judged at '${String(input.gate)}'`,
    },
    produce: async (node, ctx): Promise<PortResult<Artifact>> => {
      const context = input.contextFor?.(input.gate, node) ?? [];
      const answered = input.answersFor?.(node) ?? [];
      const roundsLeft = input.askRoundsLeft?.(node);
      const skill = input.skillFor?.(node);
      const feedback = input.feedbackFor?.(node) ?? [];
      const run = spawnSync(input.command, [...input.argsFor(input.gate, node, ctx), ...context], {
        cwd: ctx.workdir ?? input.cwd,
        // THE BRIEF, and anything a person has already told this work. An author invoked with a
        // gate name and a work id knows neither what the work is nor what it was told last time —
        // which is how an agent ends up asking a question it has already had answered.
        env: {
          ...workBriefEnv(node, ctx),
          ...(answered.length === 0 ? {} : { ORG_ANSWERS: JSON.stringify(answered) }),
          ...(roundsLeft === undefined ? {} : { ORG_ASK_ROUNDS_LEFT: String(roundsLeft) }),
          ...(feedback.length === 0 ? {} : { ORG_FEEDBACK: JSON.stringify(feedback) }),
          ...(skill === undefined
            ? {}
            : {
                ORG_SKILL: skill.skill ?? "",
                ORG_SKILL_SOURCE: skill.source ?? "repo",
                ORG_SKILL_WHY: skill.because,
              }),
          // THE PROCESS. Each variable is omitted rather than emptied when the organization says
          // nothing, so an agent can tell silence from an empty statement.
          ...((g) => ({
            ...(g?.practice === undefined || g.practice === "" ? {} : { ORG_PRACTICE: g.practice }),
            ...(g?.directives === undefined || g.directives === "" ? {} : { ORG_DIRECTIVES: g.directives }),
            ...(g?.repoSkills === undefined || g.repoSkills === "" ? {} : { ORG_REPO_SKILLS: g.repoSkills }),
          }))(input.guidanceFor?.(input.gate, node)),
        },
        encoding: "utf-8",
        timeout: input.timeoutMs ?? 120_000,
        shell: false,
        maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
      });
      if (run.error !== undefined) {
        return { ok: false, reason: `'${input.command}' could not run: ${run.error.message}` };
      }
      if (run.status !== 0) {
        return {
          ok: false,
          reason: `'${input.command}' produced nothing for '${String(input.gate)}' (exit ${String(run.status)})`,
        };
      }
      // ── WHAT IT SAID IT WOULD DO, AND WHAT IT MADE ──────────────────────
      // A line beginning `- ` is a PLAN ITEM; everything else is a reference to something produced.
      // Backward compatible by construction: a producer that only prints paths declares no plan and
      // behaves exactly as it did. Declaring one is how a step stops being a name with a verdict
      // attached and becomes a list somebody can check the work against.
      const lines = String(run.stdout ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const plan = lines.filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim());
      // ── AND WHAT IT RELIED ON ─────────────────────────────────────────
      // A DECLARED line shape, not a leftover. Before this it fell into the else-branch below and
      // was filed as a produced document: counted as an artifact, and handed to the next phase as
      // a path to read. A line protocol whose last rule is "everything else is a file" turns every
      // line shape nobody anticipated into a fake file.
      const citations = lines
        .filter((l) => l.startsWith(CITED_PREFIX))
        .map((l) => l.slice(CITED_PREFIX.length).trim());
      // ── AND WHAT IT COULD NOT DECIDE ALONE ────────────────────────────
      // Questions REFUSE the phase rather than accompanying an artifact. An agent that produced a
      // document AND asked what it should have contained has produced a guess, and letting both
      // through would put that guess in front of a reviewer with the uncertainty stripped off.
      // WHAT THIS STEP WORKED OUT. Reported alongside whatever it produced: a lesson is not an
      // artifact and does not stand in for one, but a step that both did the work AND learned
      // something should not have to choose which to report.
      const learned = learningsFrom(lines);
      const questions = lines
        .filter((l) => l.startsWith(ASK_PREFIX))
        .map((l) => l.slice(ASK_PREFIX.length).trim())
        .filter((q) => q.length > 0);
      if (questions.length > 0) {
        // PAST THE BOUND, A QUESTION IS JUST A REFUSAL. Still a refusal - the step did not produce
        // what it owed - but no longer something a person is asked to resolve. Without this an
        // agent that always finds one more thing to ask would consult forever, and the work would
        // never reach anyone.
        if (roundsLeft !== undefined && roundsLeft <= 0) {
          return {
            ok: false,
            reason:
              `'${String(input.gate)}' still had questions after its consultation rounds were used up; ` +
              `it must proceed on stated assumptions or fail`,
          };
        }
        return {
          ok: false,
          reason:
            `'${String(input.gate)}' needs ${String(questions.length)} question(s) answered by a person`,
          questions,
        };
      }
      // ── AND WHAT IT SPENT ─────────────────────────────────────────────
      // A `usage:` line lets a model-backed author declare its own tokens, which is the only place
      // that number can honestly come from — this process never sees the model call. Absent means
      // not reported, and `meter.ts` keeps that distinct from zero all the way to the screen.
      const usage = parseUsageLine(lines.find((l) => l.startsWith("usage:")));
      const refs = lines.filter(
        (l) =>
          !l.startsWith("- ") &&
          !l.startsWith("usage:") &&
          !l.startsWith(CITED_PREFIX) &&
          !l.startsWith(ASK_PREFIX) &&
          !l.startsWith(LEARNED_PREFIX),
      );
      return {
        ok: true,
        value: {
          refs,
          summary:
            refs.length === 0
              ? `'${String(input.gate)}': the producer succeeded but cited nothing`
              : `'${String(input.gate)}': ${String(refs.length)} artifact(s)`,
          ...(citations.length === 0 ? {} : { citations }),
          ...(learned.length === 0 ? {} : { learned }),
        },
        evidence: [
          ...plan.map((item) => ({ kind: "trace" as const, ref: `plan:${item}` })),
          ...refs.map((ref) => ({ kind: "document" as const, ref })),
        ],
        ...(usage === undefined ? {} : { usage }),
      };
    },
  };
}

/**
 * Read a producer's own `usage: model=<m> in=<n> out=<n>` line.
 *
 * Returns `undefined` for anything it cannot fully understand, including a partially-parseable
 * line. A half-read usage line would report fewer tokens than were spent, and an under-count is
 * worse than an absence: the absence is visible in the total's denominator, the under-count is not.
 */
export function parseUsageLine(line: string | undefined): PortUsage | undefined {
  if (line === undefined) return undefined;
  const fields = new Map<string, string>();
  for (const part of line.slice("usage:".length).trim().split(/\s+/)) {
    const at = part.indexOf("=");
    if (at > 0) fields.set(part.slice(0, at), part.slice(at + 1));
  }
  const model = fields.get("model");
  if (model === undefined || model === "") return undefined;
  const num = (key: string): number | undefined => {
    const raw = fields.get(key);
    if (raw === undefined) return undefined;
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  };
  const tokensIn = num("in");
  const tokensOut = num("out");
  if (tokensIn === undefined && tokensOut === undefined) return undefined;
  return {
    model,
    ...(tokensIn === undefined ? {} : { tokensIn }),
    ...(tokensOut === undefined ? {} : { tokensOut }),
  };
}

/**
 * The BRIEF a worker is handed, as environment.
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 * A worker was invoked as `<exe> <args...> <workId>` and given nothing else. An opaque id is not a
 * work assignment: an agent handed `task-015` in an empty checkout has no way to learn what
 * `task-015` asks for, so the one thing the organization exists to do — get a specific piece of
 * work done — could not cross the port. The cascade node carries the title, the type and the state;
 * none of it reached the process that was supposed to act on it.
 *
 * Passed as ENVIRONMENT rather than argv on purpose. The argv contract is `<args...> <workId>` with
 * the id LAST, and several existing callers index it that way; appending a title would silently
 * move the id and break them. Environment is additive — a worker that ignores it behaves exactly
 * as before.
 *
 * `ORG_WORK_TITLE` is the sentence a human wrote about what this is. It is UNTRUSTED text as far as
 * the runner is concerned: it is handed over, never interpreted here, and never spliced into a
 * shell — `shell: false` on every spawn in this file is what keeps that true.
 */
export function workBriefEnv(node: CascadeNode, ctx: WorkContext): Record<string, string> {
  return {
    ...process.env as Record<string, string>,
    ORG_WORK_ID: node.workId,
    ORG_WORK_TITLE: node.title,
    // THE REQUESTER'S OWN WORDS. The title is a label; this is what they actually said about why it
    // matters and what done looks like. Absent when nobody wrote any, which is itself worth knowing.
    ...(node.brief === undefined ? {} : { ORG_WORK_BRIEF: node.brief }),
    ORG_WORK_TYPE: String(node.workType),
    ORG_WORK_STATE: String(node.state),
    ORG_WORK_OWNER: node.ownerHatId,
    ORG_BRANCH: ctx.branch,
    ...(node.parentWorkId === undefined ? {} : { ORG_PARENT_ID: node.parentWorkId }),
    ...(node.assigneeHatId === undefined ? {} : { ORG_ASSIGNEE: node.assigneeHatId }),
    ...(ctx.workdir === undefined ? {} : { ORG_WORKDIR: ctx.workdir }),
    // THE TICKET, by the name its tracker uses. `commit-carries-the-ticket` was unfollowable while
    // the only id an agent saw was this organization's internal one.
    ...((r) => (r === undefined ? {} : { ORG_TICKET: r.externalId, ORG_TICKET_SOURCE: r.source }))(
      node.requestRef === undefined ? undefined : parseRequestRef(node.requestRef),
    ),
    ...(ctx.priorPhases === undefined || ctx.priorPhases.length === 0
      ? {}
      : { ORG_PRIOR_ARTIFACTS: JSON.stringify(ctx.priorPhases) }),
  };
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
        // WHAT to build, not just which id. See `workBriefEnv`.
        env: workBriefEnv(node, ctx),
        encoding: "utf-8",
        timeout: input.timeoutMs ?? 120_000,
        // No shell. The whole safety argument above depends on this line.
        shell: false,
        maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
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
        maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
      });
      if (run.error !== undefined) {
        return { ok: false, reason: `the verifier '${input.verify.command}' could not run: ${run.error.message}` };
      }

      // THE VERIFIER DECIDES. `attempt` contributes evidence and prose and never touches this line.
      const succeeded = run.status === 0;
      // AND WHEN IT SAYS NO, IT SAYS WHY. MEASURED on AIAGENT-1662: the verifier reported 23 new
      // test failures and named every one - and the record kept "verifier exited 1", so the next
      // attempt, and anyone reading the item, knew the work was refused and not what broke. The
      // verifier's own last words are its reason; they travel with the refusal.
      const said = succeeded ? [] : tailLines(run.stderr ?? "", 25);
      return {
        ok: true,
        value: {
          workId: node.workId,
          succeeded,
          artifacts: attempt.artifacts,
          summary:
            `agent: ${attempt.summary} — verifier exited ${String(run.status)}` +
            (said.length === 0 ? "" : `\nthe verifier said:\n${said.join("\n")}`),
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
  /**
   * HOW THIS ORGANIZATION WORKS, for the agent writing the change: its practice, its standing
   * directives, what a reviewer said when this work came back. The document authors were told
   * all of it; the one agent that writes CODE was told a title and an id.
   */
  readonly envFor?: (node: CascadeNode) => Readonly<Record<string, string>>;
}): (node: CascadeNode, ctx: WorkContext) => AgentAttempt {
  return (node, ctx) => {
    const run = spawnSync(input.command, [...input.argsFor(node)], {
      cwd: ctx.workdir ?? input.cwd,
      env: { ...workBriefEnv(node, ctx), ...(input.envFor?.(node) ?? {}) },
      encoding: "utf-8",
      timeout: input.timeoutMs ?? 120_000,
      shell: false,
      maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
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
    run: async (testCase, ctx) => {
      const run = spawnSync(input.command, [...input.argsFor(testCase)], {
        // THE CHANGE'S OWN CHECKOUT WHEN IT HAS ONE. This adapter used `input.cwd` unconditionally,
        // so with `--worktrees` every test ran against the BASE tree instead of the branch under
        // test. MEASURED: a task whose worker had just committed a working app and its suite was
        // failed by `runtime_validation` three times, because the tests ran where the app was not.
        // The opposite case is worse and silent — a base that already passes hands every change a
        // green gate that proves nothing about it.
        cwd: ctx.workdir ?? input.cwd,
        encoding: "utf-8",
        timeout: input.timeoutMs ?? 120_000,
        shell: false,
        maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
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
 * Where a change's checkout records the work item that opened it.
 *
 * BESIDE the worktree, never inside it. A marker inside would be an untracked file in the tree a
 * work command runs in, and the first `git add -A` would commit it into somebody's change.
 */
export function ownerMarkerPath(workdir: string): string {
  return `${workdir}.owner`;
}

/** The work item that opened this checkout, or nothing if none is recorded. */
export function ownerOf(workdir: string): string | undefined {
  try {
    const raw = readFileSync(ownerMarkerPath(workdir), "utf-8").trim();
    return raw === "" ? undefined : raw;
  } catch {
    // ABSENT, not empty. A checkout with no marker was made by something that did not claim it,
    // and claiming it on its behalf is the reuse this exists to refuse.
    return undefined;
  }
}

/**
 * Whether a local branch exists.
 *
 * `rev-parse --verify` over `refs/heads/<name>` EXACTLY — not `<name>`, which also resolves a
 * tag, a remote-tracking ref, or a commit whose abbreviation happens to match. Creating a branch
 * only when one is absent is a decision, and a check that answers yes for a tag would skip the
 * creation and then cut the work from whatever that tag points at.
 */
export function branchExists(
  run: (args: readonly string[]) => { readonly status: number | null },
  branch: string,
): boolean {
  return run(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).status === 0;
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
  /**
   * What the branch is measured AGAINST. Defaults to `HEAD` for the caller that checks the base
   * out first, and must be named explicitly by the caller that deliberately does not -- there,
   * HEAD is the operator's own work and counting against it answers a different question.
   */
  into: string = "HEAD",
): number | undefined {
  const counted = run(["rev-list", "--count", `${into}..${branch}`]);
  if (counted.status !== 0) return undefined;
  const n = Number.parseInt((counted.stdout ?? "").trim(), 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Parse `git diff --numstat` into per-file counts.
 *
 * Two shapes matter and both are handled rather than smoothed:
 *   `12\t3\tsrc/a.ts`   an ordinary edit
 *   `-\t-\tassets/x.png` a BINARY file, where git reports a dash because "lines" is meaningless
 *
 * A binary file yields `0`/`0` and is still LISTED, because it changed. Dropping it would make a
 * commit that replaced an image look empty, and a reader would conclude nothing happened.
 */
export function parseNumstat(text: string): readonly ChangedFileCount[] {
  const out: ChangedFileCount[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const added = parts[0] === "-" ? 0 : Number.parseInt(parts[0] ?? "", 10);
    const removed = parts[1] === "-" ? 0 : Number.parseInt(parts[1] ?? "", 10);
    const path = parts.slice(2).join("\t").trim();
    // A row whose counts do not parse is DROPPED rather than counted as zero: zero is a
    // measurement ("this file changed by nothing"), and an unparsed row measured nothing at all.
    if (!Number.isFinite(added) || !Number.isFinite(removed) || path === "") continue;
    out.push({ path, added, removed });
  }
  return out;
}

/**
 * A branch's commit and tree, or a reason.
 *
 * TWO `rev-parse` CALLS, NOT ONE PARSED IN HALF. `git rev-parse <b> <b>^{tree}` does answer both on
 * two lines, and reading position 0 and 1 out of that output is exactly the kind of parse that
 * returns a plausible wrong answer when git prepends a warning — which it does, on a repository
 * with a detached HEAD or an ambiguous ref. Two calls, each with one thing to say.
 */
export function revisionOf(
  run: (args: readonly string[]) => { readonly status: number | null; readonly stdout?: string; readonly stderr?: string; readonly error?: Error },
  ref: string,
): { readonly ok: true; readonly revision: ChangeRevision } | { readonly ok: false; readonly reason: string } {
  const read = (what: string): string | undefined => {
    const out = run(["rev-parse", "--verify", what]);
    if (out.error !== undefined || out.status !== 0) return undefined;
    const value = String(out.stdout ?? "").trim();
    // A 40-hex object name or nothing. `rev-parse` prints the input back verbatim when it cannot
    // resolve it under some configurations, so a shape check is what stops `HEAD` becoming a sha.
    return /^[0-9a-f]{40}$/.test(value) ? value : undefined;
  };
  const commit = read(ref);
  if (commit === undefined) return { ok: false, reason: `could not resolve ${ref} to a commit` };
  const tree = read(`${ref}^{tree}`);
  if (tree === undefined) return { ok: false, reason: `could not resolve the tree of ${ref}` };
  return { ok: true, revision: { commit, tree } };
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
    spawnSync("git", [...args], { cwd: input.cwd, encoding: "utf-8", shell: false, maxBuffer: MAX_COMMAND_OUTPUT_BYTES });
  return {
    meta: {
      port: Port.ChangeControl,
      name: input.name ?? "git",
      fidelity: Fidelity.Real,
      describes: `branches from ${input.baseBranch} in ${input.cwd}`,
    },
    open: async (node, ctx) => {
      // The same per-change base as the worktree adapter, for the same reason. Both are real
      // change control over one repository; a topology that only one of them understood would
      // put the work in a different place depending on which flag the operator passed.
      const base = (ctx.base ?? "").trim() === "" ? input.baseBranch : (ctx.base as string);
      if (base !== input.baseBranch && !branchExists(git, base)) {
        const cut = git(["branch", "--no-track", base, input.baseBranch]);
        if (cut.error !== undefined) return { ok: false, reason: `git could not run: ${cut.error.message}` };
        if (cut.status !== 0) {
          return {
            ok: false,
            reason: `could not create the integration branch '${base}' from '${input.baseBranch}': ${(cut.stderr ?? "").trim()}`,
          };
        }
      }
      const made = git(["checkout", "-b", ctx.branch, base]);
      if (made.error !== undefined) return { ok: false, reason: `git could not run: ${made.error.message}` };
      if (made.status !== 0) return { ok: false, reason: `could not branch ${ctx.branch}: ${(made.stderr ?? "").trim()}` };
      return {
        ok: true,
        value: { changeId: `${ctx.branch}@${node.workId}`, branch: ctx.branch, base },
        evidence: [{ kind: "trace", ref: `branch:${ctx.branch}` }, { kind: "trace", ref: `cut-from:${base}` }],
      };
    },
    merge: async (handle) => {
      const into = (handle.base ?? "").trim() === "" ? input.baseBranch : (handle.base as string);
      const back = git(["checkout", into]);
      if (back.status !== 0) return { ok: false, reason: `could not return to ${into}: ${(back.stderr ?? "").trim()}` };
      // HEAD is now the base, so the default `into` is correct here — stated rather than assumed,
      // because it is only true BECAUSE of the checkout on the line above.
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
      // THE MERGE COMMIT, read back rather than assumed. `merge --no-ff` always makes one, and
      // "always" is a claim about git's behaviour under configuration this adapter does not own.
      const at = revisionOf(git, "HEAD");
      return {
        ok: true,
        value: at.ok ? { ...handle, commit: at.revision.commit, tree: at.revision.tree } : handle,
        evidence: [{ kind: "trace", ref: at.ok ? `merged:${at.revision.commit}` : `merged:${handle.branch}` }],
      };
    },
    revision: async (handle) => {
      const at = revisionOf(git, handle.branch);
      return at.ok
        ? { ok: true, value: at.revision, evidence: [{ kind: "trace", ref: `rev:${at.revision.commit}` }] }
        : { ok: false, reason: at.reason };
    },
    // WHAT THE BRANCH HOLDS relative to where it started. `<base>...<branch>` is the three-dot
    // form on purpose: it diffs against the MERGE BASE, so commits that landed on the base branch
    // while this work was in flight are not reported as this work's changes.
    changed: async (handle) => {
      const out = git(["diff", "--numstat", `${input.baseBranch}...${handle.branch}`]);
      if (out.error !== undefined) return { ok: false, reason: `git could not run: ${out.error.message}` };
      if (out.status !== 0) {
        return { ok: false, reason: `could not diff ${handle.branch}: ${(out.stderr ?? "").trim()}` };
      }
      return {
        ok: true,
        value: parseNumstat(String(out.stdout ?? "")),
        evidence: [{ kind: "trace", ref: `diff:${handle.branch}` }],
      };
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
 * `merge` merges into the BASE BRANCH, named — never into `HEAD`. That distinction is the whole
 * bug this paragraph used to describe incorrectly: `git merge <branch>` merges into whatever is
 * checked out, and the property above guarantees that is NOT the base. Measured against a clone
 * sitting on a feature branch: the change branched from `main`, and the merge landed on the
 * feature branch while `main` never moved. The run called it delivered.
 *
 * So the base is merged in a worktree of its own when the shared checkout is somewhere else, and
 * in place when it is already there. Either way the operator's own HEAD and working tree are
 * exactly where they were left.
 *
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
  /**
   * What makes a freshly cut worktree RUNNABLE — the project's dependencies, generated files.
   *
   * A worktree is a checkout, not an installation: MEASURED on the Agentic Team's three repositories,
   * each is an npm monorepo and a new worktree has no `node_modules`, so every verifier and every
   * QA run in it would fail for a reason that has nothing to do with the change. How to make a
   * checkout runnable is the project's knowledge, so it is a COMMAND the operator supplies, run in
   * the new worktree with `ORG_BASE_CHECKOUT` / `ORG_WORKTREE` / `ORG_BRANCH` set. Run once, when
   * the worktree is created — never on a rejoin. A setup that fails REFUSES the open: a change cut
   * into a checkout that cannot run would be judged by tests that never ran.
   */
  readonly setup?: { readonly command: string; readonly args: readonly string[]; readonly timeoutMs?: number };
  /**
   * HOW A CHANGE IS HANDED TO PEOPLE — the command that pushes it and opens its review.
   *
   * The review system is the project's knowledge, so it is a COMMAND the operator supplies, run in
   * the change's checkout with `ORG_BRANCH` / `ORG_BASE` / `ORG_TITLE` / `ORG_DESCRIPTION_FILE` /
   * `ORG_COMMIT` set; the last line it prints that is a URL is the review's address. Absent, this
   * adapter cannot hand off, and a run that must hand off refuses to use it.
   */
  readonly handoff?: { readonly command: string; readonly args: readonly string[]; readonly timeoutMs?: number };
  /**
   * The remote a handed-off change is reviewed on — where its target is read from when measuring how
   * far behind it is. Default `origin`, which is what the handoff pushes to.
   */
  readonly remote?: string;
}): ChangeControlPort {
  const git = (args: readonly string[], at = input.cwd) =>
    spawnSync("git", [...args], { cwd: at, encoding: "utf-8", shell: false, maxBuffer: MAX_COMMAND_OUTPUT_BYTES });
  const handoffCmd = input.handoff;
  const remote = (input.remote ?? "").trim() || "origin";
  /**
   * The target as the REVIEW SYSTEM sees it when this clone knows it, else the local branch. A change
   * that has had the remote target merged in, diffed against a stale local one, would be blamed for
   * every file the target itself added since.
   */
  const targetRef = (into: string, at = input.cwd): string =>
    git(["rev-parse", "--verify", "--quiet", `refs/remotes/${remote}/${into}`], at).status === 0 ? `${remote}/${into}` : into;
  const lines = (text: string | null | undefined): readonly string[] =>
    String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
  return {
    meta: {
      port: Port.ChangeControl,
      name: input.name ?? "git-worktree",
      fidelity: Fidelity.Real,
      describes:
        `one worktree per change under ${input.worktreeRoot}, branched from ${input.baseBranch}` +
        (handoffCmd === undefined ? "" : `; handed to people by '${handoffCmd.command}'`),
    },
    ...(handoffCmd === undefined
      ? {}
      : {
          handoff: async (handle: ChangeHandle, proposal: ChangeProposal): Promise<PortResult<ChangeHandoff>> => {
            const into = (proposal.base ?? handle.base ?? "").trim() || input.baseBranch;
            // NOTHING TO REVIEW IS A REFUSAL, not an empty merge request a person has to discover.
            const ahead = commitsAhead(git, handle.branch, into);
            if (ahead === undefined) return { ok: false, reason: `could not tell whether ${handle.branch} has anything to review` };
            if (ahead === 0) return { ok: false, reason: `${handle.branch} has no commits ahead of ${into}: there is nothing to hand to a reviewer` };
            // WHAT THE ORGANIZATION KEEPS OUT, refused before anything is pushed. MEASURED on the
            // first merge requests: a UAT screenshot committed into the repository. ADDED paths only
            // (added, or renamed into place): a change that edits a file the product already has is
            // the product's business.
            const keepOut = proposal.keepOut ?? [];
            if (keepOut.length > 0) {
              const added = git(["diff", "--name-only", "--diff-filter=AR", `${targetRef(into)}...${handle.branch}`]);
              if (added.status !== 0) {
                return { ok: false, reason: `could not list what ${handle.branch} adds, so could not check it against what the organization keeps out: ${(added.stderr ?? "").trim()}` };
              }
              const bad = keptOutPaths(lines(added.stdout), keepOut);
              if (bad.length > 0) {
                return {
                  ok: false,
                  reason:
                    `${handle.branch} adds what this organization keeps out of its merge requests: ${bad.join(", ")} - ` +
                    "evidence belongs in the organization's record, not the repository; remove it from the branch",
                };
              }
            }
            const head = git(["rev-parse", handle.branch]);
            const commit = head.status === 0 ? String(head.stdout ?? "").trim() : undefined;
            // The description travels as a FILE: it is long, it is markdown, and argv is world-readable.
            const dir = mkdtempSync(join(tmpdir(), "org-handoff-"));
            const descriptionFile = join(dir, "description.md");
            writeFileSync(descriptionFile, proposal.description, { encoding: "utf-8", mode: 0o600 });
            const ran = spawnSync(handoffCmd.command, [...handoffCmd.args], {
              cwd: handle.workdir ?? input.cwd,
              env: {
                ...process.env,
                ORG_BRANCH: handle.branch,
                ORG_BASE: into,
                ORG_TITLE: proposal.title,
                ORG_DESCRIPTION_FILE: descriptionFile,
                ...(commit === undefined ? {} : { ORG_COMMIT: commit }),
              },
              encoding: "utf-8",
              shell: false,
              timeout: handoffCmd.timeoutMs ?? 300_000,
              maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
            });
            rmSync(dir, { recursive: true, force: true });
            if (ran.error !== undefined) return { ok: false, reason: `'${handoffCmd.command}' could not run: ${ran.error.message}` };
            if (ran.status !== 0) {
              return {
                ok: false,
                reason: `handing off ${handle.branch} failed (exit ${String(ran.status)}): ${(ran.stderr ?? "").trim().slice(0, 600)}`,
              };
            }
            const url = String(ran.stdout ?? "")
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter((l) => /^https?:\/\//.test(l))
              .pop();
            return {
              ok: true,
              value: { branch: handle.branch, ...(url === undefined ? {} : { url }), ...(commit === undefined ? {} : { commit }) },
              evidence: [{ kind: "trace", ref: url === undefined ? `handed-off:${handle.branch}` : `review:${url}` }],
            };
          },
        }),
    open: async (node, ctx) => {
      const workdir = join(input.worktreeRoot, worktreeDirName(ctx.branch));
      const base = (ctx.base ?? "").trim() === "" ? input.baseBranch : (ctx.base as string);

      // ── AN INTEGRATION BRANCH IS BORN HERE, OR NOWHERE ─────────────────
      // A story cut from `feature/X` needs `feature/X` to exist, and nothing upstream creates
      // it: the runtime derives the topology but does not touch git, and the collection became
      // real at the moment its first story was opened — which is this call. So a base that is
      // not the trunk and does not yet exist is CUT FROM THE TRUNK, once.
      //
      // IDEMPOTENT BY CONSTRUCTION, which is what makes it safe on a resumed run: the second
      // story finds the branch and joins it, and `--no-track` keeps it a local integration
      // branch rather than one claiming an upstream nobody pushed.
      if (base !== input.baseBranch && !branchExists(git, base)) {
        const cut = git(["branch", "--no-track", base, input.baseBranch]);
        if (cut.error !== undefined) return { ok: false, reason: `git could not run: ${cut.error.message}` };
        if (cut.status !== 0) {
          // REFUSED, never silently demoted to the trunk. Landing the work somewhere plausible
          // and wrong is the defect this whole seam exists to close.
          return {
            ok: false,
            reason: `could not create the integration branch '${base}' from '${input.baseBranch}': ${(cut.stderr ?? "").trim()}`,
          };
        }
      }

      // ── A RESUME REJOINS ITS OWN WORK, IT DOES NOT REFUSE IT ───────────
      // MEASURED before this existed: a second cycle over the same item died on
      // `fatal: a branch named 'work/task-015' already exists`, and the run then reported the
      // item done with nothing merged. The branch was its OWN, from the cycle before.
      //
      // Two states to rejoin, and they are checked in the order that makes each check honest:
      // the worktree first (a directory whose HEAD is already this branch), then the branch
      // alone (a checkout to re-create over it).
      if (existsSync(workdir)) {
        const onIt = git(["rev-parse", "--abbrev-ref", "HEAD"], workdir);
        // TWO CONDITIONS, and the second is the one a first cut missed. The directory must be a
        // checkout of this branch — a leftover or an unrelated tree handed back as this change's
        // workdir would have the work performed where the merge will never look — AND it must
        // have been opened by THIS work item. Without the owner check a second item asking for
        // the same branch inherits the first's checkout, its work lands under the first's name,
        // and the run calls both delivered.
        const owner = ownerOf(workdir);
        if (onIt.status === 0 && String(onIt.stdout ?? "").trim() === ctx.branch && owner === node.workId) {
          return {
            ok: true,
            value: { changeId: `${ctx.branch}@${node.workId}`, branch: ctx.branch, base, workdir },
            evidence: [{ kind: "trace", ref: `worktree-rejoined:${workdir}` }],
          };
        }
        return {
          ok: false,
          reason:
            owner !== undefined && owner !== node.workId
              ? `'${ctx.branch}' is already open for '${owner}': refusing to reuse another item's change`
              : `'${workdir}' exists and is not a checkout of ${ctx.branch}: refusing to work in it`,
        };
      }
      // An existing branch is checked out WITHOUT `-b`, which would refuse it. `base` is not
      // passed here on purpose: the branch already has a history and re-pointing it at the base
      // would silently discard whatever the earlier cycle committed.
      //
      // …but only for the item that owns it. A branch whose checkout is gone but whose marker
      // names somebody else is the same reuse refused above, arriving one state later.
      const existing = branchExists(git, ctx.branch);
      if (existing) {
        const owner = ownerOf(workdir);
        if (owner !== undefined && owner !== node.workId) {
          return {
            ok: false,
            reason: `'${ctx.branch}' belongs to '${owner}': refusing to reuse another item's change`,
          };
        }
      }
      const made = existing
        ? git(["worktree", "add", workdir, ctx.branch])
        : git(["worktree", "add", "-b", ctx.branch, workdir, base]);
      if (made.error !== undefined) return { ok: false, reason: `git could not run: ${made.error.message}` };
      if (made.status !== 0) {
        return { ok: false, reason: `could not open a worktree for ${ctx.branch}: ${(made.stderr ?? "").trim()}` };
      }
      if (input.setup !== undefined) {
        const ready = spawnSync(input.setup.command, [...input.setup.args], {
          cwd: workdir,
          env: { ...process.env, ORG_BASE_CHECKOUT: input.cwd, ORG_WORKTREE: workdir, ORG_BRANCH: ctx.branch },
          encoding: "utf-8",
          shell: false,
          timeout: input.setup.timeoutMs ?? 900_000,
          maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
        });
        if (ready.error !== undefined || ready.status !== 0) {
          return {
            ok: false,
            reason:
              `the worktree for ${ctx.branch} could not be made runnable by '${input.setup.command}': ` +
              (ready.error?.message ?? `exit ${String(ready.status)} ${(ready.stderr ?? "").trim().slice(0, 400)}`),
          };
        }
      }
      // WHO OWNS THIS CHECKOUT. Written after the worktree exists, so a failed `add` leaves no
      // claim behind. A write that fails is not fatal: the marker only ever REFUSES a reuse, so
      // its absence costs the guard rather than the change, and losing the change would be worse.
      try {
        // `wx` + 0o600: EXCLUSIVE CREATE, OWNER-ONLY.
        //
        // `js/insecure-temporary-file` (CWE-377) flags this because callers root
        // `worktreeRoot` under the OS temp dir, which is world-writable — so a
        // predictable name written with default permissions can be pre-created
        // or symlinked by another user between the check and the write.
        //
        // Both halves are also what this marker MEANS, which is why this is a
        // fix rather than an appeasement. `wx` fails when the file already
        // exists, and an existing marker is precisely the reuse the guard
        // refuses; 0o600 matches a claim that is nobody else's business.
        writeFileSync(ownerMarkerPath(workdir), node.workId, { encoding: "utf-8", mode: 0o600, flag: "wx" });
      } catch {
        // deliberately ignored — see above
      }
      return {
        ok: true,
        // `base` TRAVELS. `merge(handle)` is all the runtime passes, so a base left behind here
        // would send every story back to the trunk and the feature branch would hold nothing.
        value: { changeId: `${ctx.branch}@${node.workId}`, branch: ctx.branch, base, workdir },
        evidence: [{ kind: "trace", ref: `worktree:${workdir}` }, { kind: "trace", ref: `cut-from:${base}` }],
      };
    },
    merge: async (handle) => {
      // BEFORE the merge, because afterwards the answer is always zero and the question is lost.
      // MEASURED AGAINST THE BASE, not against HEAD: this adapter deliberately leaves the shared
      // checkout alone, so HEAD is the operator's own branch and `HEAD..work/x` counts commits
      // that have nothing to do with whether this change carries anything.
      // THE HANDLE'S BASE, not the adapter's. A story merges into its feature branch; only the
      // handle knows which one, and counting against the trunk would report a story as empty
      // the moment its siblings had already landed on the feature.
      const into = (handle.base ?? "").trim() === "" ? input.baseBranch : (handle.base as string);
      const ahead = commitsAhead(git, handle.branch, into);
      if (ahead === undefined) return { ok: false, reason: `could not tell whether ${handle.branch} has anything to merge` };
      if (ahead === 0) {
        // The worktree may well hold files — the work ran. Uncommitted files are not a change, and
        // this adapter does not commit on the performer's behalf: doing so would put whatever else
        // is lying in that tree into a commit nobody wrote.
        return { ok: false, reason: `${handle.branch} has no commits: the work left nothing committed, and a merge that moves nothing is not a merge` };
      }

      // ── WHERE THE MERGE LANDS, DECIDED RATHER THAN INHERITED ──────────────
      // `git merge` merges into HEAD. Run in the shared repository that is the operator's branch,
      // which is the one place this change must never go. When the shared checkout already sits on
      // the base, merging in place is both correct and cheapest; when it does not, the base is
      // borrowed into a worktree of its own so the operator's HEAD and files are not touched.
      const head = git(["rev-parse", "--abbrev-ref", "HEAD"]);
      if (head.status !== 0) return { ok: false, reason: `could not read the checked-out branch: ${(head.stderr ?? "").trim()}` };
      const onBase = String(head.stdout ?? "").trim() === into;
      const borrowed = join(input.worktreeRoot, worktreeDirName(`into-${into}`));
      if (!onBase) {
        const lent = git(["worktree", "add", borrowed, into]);
        if (lent.error !== undefined) return { ok: false, reason: `git could not run: ${lent.error.message}` };
        if (lent.status !== 0) {
          // The commonest cause is the base being checked out in ANOTHER worktree, which git
          // refuses to duplicate. Refusing here is right: the alternative is merging somewhere
          // else and calling it delivered, which is the defect this whole block exists for.
          return {
            ok: false,
            reason:
              `could not merge into '${into}': it is not checked out here and a worktree for it ` +
              `could not be opened: ${(lent.stderr ?? "").trim()}`,
          };
        }
      }
      const mergeAt = onBase ? input.cwd : borrowed;
      const merged = git(["merge", "--no-ff", "-m", `merge ${handle.changeId}`, handle.branch], mergeAt);
      // The borrowed checkout is released whichever way the merge went — it holds a lock on the
      // base branch, and leaving it behind would make the NEXT change unmergeable.
      const release = (): void => {
        // Nothing was borrowed when the shared checkout was already on the base, so there is
        // nothing holding it. Removing unconditionally would try to delete the operator's own
        // checkout.
        if (onBase) return;
        // `--force` because the borrowed tree is not clean after a merge lands in it, and a
        // refused merge can leave conflict markers on disk. Nothing is lost either way: the
        // worktree had the BASE BRANCH checked out, so a successful merge is already a commit on
        // that branch in the shared object store, and a refused one wrote no commit at all. What
        // is removed here is the working directory, never the work.
        git(["worktree", "remove", "--force", borrowed]);
      };
      if (merged.error !== undefined) {
        release();
        return { ok: false, reason: `git could not run: ${merged.error.message}` };
      }
      if (merged.status !== 0) {
        release();
        return { ok: false, reason: `merge of ${handle.branch} refused: ${(merged.stderr ?? "").trim()}` };
      }
      release();
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
      // THE MERGE COMMIT, read off the BRANCH THAT RECEIVED IT. `HEAD` here is the shared
      // checkout, which this adapter has just gone to some trouble not to move — so reading it
      // would report the operator's own tip as the change's landing commit, and the tree hash
      // filed against every bound check would belong to somebody else's work.
      const at = revisionOf(git, into);
      return {
        ok: true,
        value: at.ok ? { ...handle, commit: at.revision.commit, tree: at.revision.tree } : handle,
        evidence: [{ kind: "trace", ref: at.ok ? `merged:${at.revision.commit}` : `merged:${handle.branch}` }],
      };
    },
    revision: async (handle) => {
      const at = revisionOf(git, handle.branch);
      return at.ok
        ? { ok: true, value: at.revision, evidence: [{ kind: "trace", ref: `rev:${at.revision.commit}` }] }
        : { ok: false, reason: at.reason };
    },
    syncWithTarget: async (handle, opts) => {
      const into = (handle.base ?? "").trim() || input.baseBranch;
      const at = handle.workdir ?? input.cwd;
      // THE TARGET AS REVIEWERS SEE IT: fetched, never the clone's local branch, which moves only
      // when somebody moves it and would report every handed-off change as current forever.
      const fetched = git(["fetch", "--quiet", remote, into], at);
      if (fetched.error !== undefined) return { ok: false, reason: `git could not run: ${fetched.error.message}` };
      if (fetched.status !== 0) return { ok: false, reason: `could not fetch ${remote}/${into}: ${(fetched.stderr ?? "").trim().slice(0, 400)}` };
      const target = `${remote}/${into}`;
      const behind = commitsAhead((a) => git(a, at), target, handle.branch);
      if (behind === undefined) return { ok: false, reason: `could not tell how far ${handle.branch} is behind ${target}` };
      const unchanged = { target, behindBy: behind, applied: false, conflicts: [] as readonly string[] };
      if (!opts.apply || behind === 0) return { ok: true, value: unchanged, evidence: [{ kind: "trace", ref: `behind:${String(behind)}:${target}` }] };
      // A DIRTY CHECKOUT IS NOT MERGED INTO: the merge would mix somebody's uncommitted work into a
      // commit nobody wrote, which is the same refusal `merge` makes for the same reason.
      const dirty = git(["status", "--porcelain", "--untracked-files=no"], at);
      if (dirty.status !== 0 || lines(dirty.stdout).length > 0) {
        return { ok: false, reason: `${handle.branch} has uncommitted changes in ${at}: commit or discard them before it is brought up to date` };
      }
      const merged = git(["merge", "--no-ff", "--no-edit", "-m", `Merge ${target} into ${handle.branch}`, target], at);
      if (merged.error !== undefined) return { ok: false, reason: `git could not run: ${merged.error.message}` };
      if (merged.status === 0) {
        return { ok: true, value: { ...unchanged, applied: true }, evidence: [{ kind: "trace", ref: `synced:${target}` }] };
      }
      const conflicts = lines(git(["diff", "--name-only", "--diff-filter=U"], at).stdout);
      if (conflicts.length === 0) {
        // Refused for a reason that is not a conflict: nothing is left half-done.
        git(["merge", "--abort"], at);
        return { ok: false, reason: `merging ${target} into ${handle.branch} refused: ${(merged.stderr ?? merged.stdout ?? "").trim().slice(0, 400)}` };
      }
      // LEFT IN PROGRESS, on purpose: resolving a conflict is judgement, and the checkout is where
      // the agent that resolves it works. `abortSync` is the way back out.
      return { ok: true, value: { ...unchanged, conflicts }, evidence: [{ kind: "trace", ref: `sync-conflicted:${target}` }] };
    },
    abortSync: async (handle) => {
      const at = handle.workdir ?? input.cwd;
      if (git(["rev-parse", "-q", "--verify", "MERGE_HEAD"], at).status !== 0) return { ok: true, value: true, evidence: [] };
      const aborted = git(["merge", "--abort"], at);
      return aborted.status === 0
        ? { ok: true, value: true, evidence: [{ kind: "trace", ref: `sync-aborted:${handle.branch}` }] }
        : { ok: false, reason: `could not back out the merge in ${at}: ${(aborted.stderr ?? "").trim()}` };
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
