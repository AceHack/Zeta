/**
 * corporate/providers.ts — the ports where the organization touches reality.
 *
 * ── WHAT WAS SIMULATED, AND WHY IT LOOKED REAL ───────────────────────────────
 * The register orchestrates faithfully and performs nothing. "Implementation" moved a state to
 * `done`; QA outcomes came from a configured fallback; gate verdicts were computed rather than
 * earned; the inbound event was a hardcoded fixture. None of that is wrong — a simulation is a
 * legitimate thing to have — but it was INDISTINGUISHABLE from the real thing at every call site,
 * which is the failure `.claude/rules/toy-is-free-metered-must-be-earned.md` names: unlabelled work
 * reads as real by default.
 *
 * So this is not "add the real implementations". It is: make the boundary a declared, typed,
 * labelled seam, so a real adapter can be dropped in AND so a run can say which of its capabilities
 * actually touched anything.
 *
 * ── FIDELITY IS THE POINT ────────────────────────────────────────────────────
 * Every provider declares whether it is `simulated` or `real`, and a `ProviderSet` derives one
 * consequence from that: **a run that used a real provider is not DST-replayable.** `qa.ts` already
 * had a `TestExecutor` port and no way to say whether it had run anything, so a suite of planned
 * outcomes and a suite of executed ones produced identical-looking reports. `replayable` is the
 * difference, computed rather than asserted.
 *
 * ── AN UNREGISTERED PORT REFUSES; IT NEVER FALLS BACK ────────────────────────
 * The single most dangerous thing this layer could do is silently substitute a simulated provider
 * when a real one was asked for and not found. A run would then report work it never did. So
 * `resolve` REFUSES, and choosing the simulated adapter is something a caller does on purpose and
 * can be seen doing.
 *
 * ── NONINTERFERENCE ──────────────────────────────────────────────────────────
 * §13: entropy and influence cross only through declared, metered channels. A provider IS that
 * channel — the only place the register reaches a filesystem, a network, or a shell. Everything
 * else stays pure, so the parts that are not providers remain replayable whatever the providers do.
 *
 * ── NO CLASSES ───────────────────────────────────────────────────────────────
 * `.claude/rules/interfaces-free-classes-earned-under-rules.md`: interfaces are free, a class must
 * be earned. A registry is a value and its operations are functions over that value — nothing here
 * needs instance state, so nothing here has any.
 */

import type { ExternalEvent } from "./intake";
import type { CascadeNode } from "./goal-cascade";
import type { RunOutcome, TestCase } from "./qa";
import type { GateKind, GateOutcome } from "./quality-gate";
import type { EvidenceRef } from "./discussion-anchor";
import type { PortUsage } from "./meter";

/** Whether a provider actually touches anything outside this process. */
export const Fidelity = {
  /** Deterministic, replayable, touches nothing. The register's own default. */
  Simulated: "simulated",
  /** Reaches a filesystem, a network, a shell, or a service. Replay is off the table. */
  Real: "real",
} as const;

export type Fidelity = (typeof Fidelity)[keyof typeof Fidelity];

/** The seams. One per thing the organization cannot do by thinking about it. */
export const Port = {
  /** Where inbound work comes from. */
  Intake: "intake",
  /**
   * Where an agent READS from — a repository, a wiki, a directory of specs.
   *
   * Distinct from `Intake` on purpose, and the distinction is the reason this port exists. Intake
   * answers "what work has arrived"; a data source answers "what is true about the domain I am
   * about to work in". `business_context_grooming` is the first gate in the pipeline and had no way
   * to read anything, so grooming was a phase that produced a title.
   */
  DataSource: "data_source",
  /** What actually performs a work item. */
  WorkExecution: "work_execution",
  /** What runs the tests. */
  TestExecution: "test_execution",
  /**
   * Who decides a quality gate.
   *
   * The last port added, and the one whose absence was loudest. Six of the seven gates returned
   * `Approved` with the reason "reviewed" — a constant — while `fidelityOf` reported four ports and
   * said nothing about it. So a run printed `DST-replayable: yes`, named four honest adapters, and
   * rubber-stamped its own architecture review in silence. That is exactly the failure this whole
   * layer exists to prevent, sitting one layer above where it was fixed.
   */
  Review: "review",
  /** What opens, reviews and merges a change. */
  ChangeControl: "change_control",
} as const;

export type Port = (typeof Port)[keyof typeof Port];

export interface ProviderMeta {
  readonly port: Port;
  /** Unique within its port. The name a caller resolves by. */
  readonly name: string;
  readonly fidelity: Fidelity;
  /** One line: what this adapter actually does. Shown in the run's own report. */
  readonly describes: string;
}

/** A result shape shared by every port, so a provider can REFUSE rather than throw or lie. */
export type PortResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly evidence: readonly EvidenceRef[];
      /**
       * What the call CONSUMED, when the adapter can say — tokens and the model that spent them.
       *
       * Optional because most ports call no model: a git clone and a directory poll cross a
       * declared channel and spend no tokens. Absent means "not reported", which `meter.ts` keeps
       * distinct from "reported as zero" all the way to the screen. A dashboard may not turn one
       * into the other.
       */
      readonly usage?: PortUsage;
    }
  | {
      readonly ok: false;
      readonly reason: string;
      /**
       * What the agent needs a PERSON to answer before it can do this step.
       *
       * ── WHY THIS IS A FIELD AND NOT A MODULE ─────────────────────────────
       * An organization has to be able to ask. The first attempt at that was a module which decided
       * — in TypeScript, by regular expression — what makes a requirement ambiguous, wrote out ten
       * questions to ask about it, and named the hat that would do the asking. That is not an
       * organization; it is one person's interview compiled in, and every requirement it ever saw
       * would get the questions its author happened to think of.
       *
       * The agent doing the step is the only thing that knows what it is missing. So the mechanism
       * is a CHANNEL, not a questionnaire: any port, at any gate, may come back with questions
       * instead of an artifact, and the organization's job is to route them to a person, hold the
       * gate while they are open, and hand the answers back. What gets asked is not this layer's
       * business, and nothing here can name a question or a hat.
       *
       * Empty or absent means the refusal is the organization's own to resolve — the ordinary case,
       * and the one that must not be turned into a question, or every internal failure leaves
       * through the escape hatch and the person becomes the error handler.
       */
      readonly questions?: readonly string[];
    };

// ─── The ports ──────────────────────────────────────────────────────────────

export interface IntakeSource {
  readonly meta: ProviderMeta;
  /** Everything waiting to come in. Empty is a normal answer, not an error. */
  poll(): Promise<PortResult<readonly ExternalEvent[]>>;
}

/**
 * One thing an agent can read: a file at a revision, a page, a record.
 *
 * `revision` is what makes a reading CITABLE. A document quoted without the revision it was read at
 * is a claim about a moving target — the reviewer who checks it later sees a different file and
 * cannot tell whether the agent misread it or the file changed underneath. Every grooming artifact
 * in this register carries `ref` values built from these, so the evidence trail points at bytes
 * that still exist.
 */
export interface SourceDocument {
  /** Where it came from, within the source — a repo-relative path, a URL path, a key. */
  readonly path: string;
  /** The exact revision this content was read at. A commit sha, an etag, a version. */
  readonly revision: string;
  readonly content: string;
  /** A citable reference: `<source>:<revision>:<path>`. Built by the adapter, never by a caller. */
  readonly ref: string;
}

/**
 * Something an agent can read from — the seam a git repository plugs into.
 *
 * `query` is a substring match rather than a query language, deliberately. A richer interface would
 * be one every adapter had to implement badly; a substring is something a git tree, a directory and
 * an HTTP index can each answer honestly, and an adapter that can do better is free to.
 */
export interface DataSourcePort {
  readonly meta: ProviderMeta;
  /** Everything this source holds, at the revision it currently reads. */
  read(): Promise<PortResult<readonly SourceDocument[]>>;
  /** The subset whose path or content contains `term`, matched ORDINALLY. */
  query(term: string): Promise<PortResult<readonly SourceDocument[]>>;
}

/** What an attempt at a work item produced. */
export interface WorkOutcome {
  readonly workId: string;
  readonly succeeded: boolean;
  /** What changed, if anything — paths, refs, an identifier the next port can use. */
  readonly artifacts: readonly string[];
  /** Why, in a sentence. Carried into the trace. */
  readonly summary: string;
}

/** Where and on what a work item is to be performed. */
export interface WorkContext {
  readonly branch: string;
  /** The change's own checkout, when change control opened one. See `ChangeHandle.workdir`. */
  readonly workdir?: string;
  /**
   * What the phases before this one produced — the reproduction, the design — keyed by gate.
   *
   * The pipeline held these in `PhaseContext.priorArtifacts` and dropped them at the work
   * executor, so the agent that fixes a defect was never told where its reproduction was.
   */
  readonly priorPhases?: readonly { readonly gate: string; readonly refs: readonly string[]; readonly summary?: string }[];
}

export interface WorkExecutor {
  readonly meta: ProviderMeta;
  execute(node: CascadeNode, ctx: WorkContext): Promise<PortResult<WorkOutcome>>;
}

export interface TestRunner {
  readonly meta: ProviderMeta;
  run(
    testCase: TestCase,
    // `workdir` for the SAME reason `WorkContext` carries one: a change that opened its own
    // checkout must be TESTED in that checkout. Without it a runner falls back to the base
    // directory, where the change does not exist — so `runtime_validation`, the only gate that
    // reads real test evidence rather than a reviewer's opinion, judges the wrong tree.
    ctx: { readonly branch: string; readonly workdir?: string },
  ): Promise<PortResult<{ readonly outcome: RunOutcome }>>;
}

/** What a reviewer is asked to judge. */
export interface ReviewRequest {
  readonly gate: GateKind;
  readonly workId: string;
  /**
   * What the organization already knows about this work — QA runs, traces, documents.
   *
   * Supplied so a reviewer can judge from evidence rather than from a title. A reviewer that
   * ignores it is making a weaker judgement, and that is its business; a runtime that withheld it
   * would be forcing one.
   */
  readonly evidence: readonly EvidenceRef[];
  /**
   * The work's own checkout, when it has one. A reviewer runs there, not in the shared clone.
   *
   * MEASURED on AIAGENT-1662: a QA reviewer ran the change's Playwright spec from the shared base
   * checkout, the spec wrote its screenshot there, and that untracked file sat at the very path the
   * branch commits - so change control's merge into that checkout would have been refused. What a
   * reviewer's checks leave behind belongs with the work under review, never on the trunk.
   */
  readonly workdir?: string;
}

export interface ReviewVerdict {
  readonly outcome: GateOutcome;
  /** Why. Carried into the `GateEvaluation`, so a verdict is never a bare word. */
  readonly reason: string;
}

/**
 * Who decides a gate.
 *
 * A refusal is NOT an approval, and the runtime must treat it as blocking. "Nobody was available to
 * review this" and "this was reviewed and approved" are the two sentences an organization must
 * never confuse, and the failing-closed direction is the only safe default.
 */
export interface ReviewPort {
  readonly meta: ProviderMeta;
  review(request: ReviewRequest): Promise<PortResult<ReviewVerdict>>;
}

/** The change a piece of work becomes. Mirrors the lifecycle `change-control.ts` already models. */
export interface ChangeHandle {
  readonly changeId: string;
  readonly branch: string;
  /**
   * WHAT THIS CHANGE WAS CUT FROM, and what its merge must therefore target.
   *
   * Carried on the HANDLE rather than only in the open-context, because `merge(handle)` is all
   * the runtime passes and a base known only at `open` would be gone by the time it decides
   * anything. A story cut from its feature branch has to go back into that feature branch, and
   * an adapter holding one configured trunk cannot work that out.
   *
   * Absent means the adapter's own configured base — which is what every caller meant before
   * this field existed, so an adapter that ignores it behaves exactly as it did.
   */
  readonly base?: string;
  readonly url?: string;
  /**
   * Where this change's work should happen, when it has a place of its own.
   *
   * Absent means "wherever the executor was configured to run" — the single shared checkout, which
   * is correct while the runtime is sequential. A worktree-per-change adapter fills it in, and that
   * is what makes the isolation LOAD-BEARING rather than decorative: a worktree nothing works
   * inside is a directory the run pays for and never uses.
   */
  readonly workdir?: string;
  /**
   * The commit this change is AT, when the adapter can name one.
   *
   * Filled in by `merge` with the merge commit, and by `revision` with the branch tip. Absent means
   * the adapter cannot say — a simulated port, or a branch with nothing on it — and absent must
   * never be read as "no commit exists": those are different facts and only one of them is a defect.
   */
  readonly commit?: string;
  /**
   * The TREE this change holds — `git rev-parse <branch>^{tree}`.
   *
   * The better cache key of the two, and the reason both are carried. Two commits with different
   * messages, authors or parents over identical content have the same tree, so a check already run
   * against that tree does not need running again; keyed by COMMIT it would rerun on every rebase,
   * amend and cherry-pick, which is most of what a working branch does.
   */
  readonly tree?: string;
}

export interface ChangeControlPort {
  readonly meta: ProviderMeta;
  /**
   * Open a change on `ctx.branch`, cut from `ctx.base`.
   *
   * `base` is OPTIONAL so every existing caller keeps working: absent, the adapter uses the one
   * it was configured with. Present, it may name a branch that DOES NOT EXIST YET — an
   * integration branch is created by the first change that needs it, because nothing else knows
   * when the collection became real. An adapter that cannot create it must refuse rather than
   * silently fall back to its trunk: that fallback is the whole class of defect this field
   * exists to close, since the work would land somewhere plausible and wrong.
   */
  open(
    node: CascadeNode,
    ctx: { readonly branch: string; readonly base?: string },
  ): Promise<PortResult<ChangeHandle>>;
  merge(handle: ChangeHandle): Promise<PortResult<ChangeHandle>>;
  /**
   * WHAT THE CHANGE TOUCHED — path, lines added, lines removed.
   *
   * OPTIONAL, because an adapter that cannot diff should say so by not implementing this rather
   * than by returning an empty list. Those two are different facts and a view must be able to tell
   * them apart: "no files changed" is a finding, and "this adapter cannot tell you" is not.
   *
   * The counts come from the adapter's own diff of the branch, never from an agent's account of
   * what it did. The claim lives in `phase_output` as testimony; this is the measurement.
   */
  changed?(handle: ChangeHandle): Promise<PortResult<readonly ChangedFileCount[]>>;
  /**
   * WHERE THE CHANGE IS NOW — its commit and its tree, read at the moment of asking.
   *
   * Optional for the same reason `changed` is: an adapter that cannot answer must decline to
   * implement it rather than return zeroes, because "this port has no revisions" and "this branch
   * is empty" are different answers and a caller has to be able to tell them apart.
   *
   * Asked rather than remembered. A handle is created at `open`, when the branch is empty and there
   * is no revision to record; everything interesting happens after. So the revision is a question
   * about the repository right now, not a field frozen at the wrong moment.
   */
  revision?(handle: ChangeHandle): Promise<PortResult<ChangeRevision>>;
  /**
   * HAND THE CHANGE TO PEOPLE: make it visible where they review changes (push the branch, open a
   * merge request against `proposal.base`) and leave it OPEN. It never integrates anything.
   *
   * Optional, because not every adapter can reach a review system. A run whose delivery is
   * `human_review` refuses to start on an adapter without it, rather than falling back to a merge:
   * falling back is exactly the act the setting exists to rule out.
   *
   * Idempotent by contract: handing off a change that is already open for review answers with the
   * review that exists, never a second one.
   */
  handoff?(handle: ChangeHandle, proposal: ChangeProposal): Promise<PortResult<ChangeHandoff>>;
}

/** What a change is proposed AS: the words a reviewer reads first, and where it should go. */
export interface ChangeProposal {
  readonly title: string;
  readonly description: string;
  /** The branch it is proposed against. Absent: the adapter's own trunk. */
  readonly base?: string;
}

/** Where a handed-off change can be reviewed. */
export interface ChangeHandoff {
  readonly branch: string;
  /** The review's address (a merge request URL), when the review system gave one. */
  readonly url?: string;
  /** The commit that was handed off, when the adapter can read it. */
  readonly commit?: string;
}

/** A change's position in the repository. Both are full hex object names, never abbreviated. */
export interface ChangeRevision {
  readonly commit: string;
  readonly tree: string;
}

/** One file in a diff. Mirrors `git diff --numstat`, which is where the first adapter reads it. */
export interface ChangedFileCount {
  readonly path: string;
  readonly added: number;
  readonly removed: number;
}

export type AnyProvider = IntakeSource | WorkExecutor | TestRunner | ReviewPort | ChangeControlPort | DataSourcePort;

// ─── The registry ───────────────────────────────────────────────────────────

export interface ProviderRegistry {
  readonly providers: readonly AnyProvider[];
}

export const EMPTY_REGISTRY: ProviderRegistry = { providers: [] };

export type RegistryResult =
  | { readonly ok: true; readonly registry: ProviderRegistry }
  | { readonly ok: false; readonly reason: string };

/**
 * Add a provider.
 *
 * Refuses a duplicate `(port, name)`. Two adapters answering to one name means the one a caller
 * gets depends on registration order, and a run could use a simulated adapter while its report
 * names a real one.
 */
export function register(registry: ProviderRegistry, provider: AnyProvider): RegistryResult {
  const { port, name } = provider.meta;
  if (name.trim() === "") return { ok: false, reason: `a ${port} provider needs a name` };
  if (registry.providers.some((p) => p.meta.port === port && p.meta.name === name)) {
    return { ok: false, reason: `a ${port} provider named '${name}' is already registered` };
  }
  return { ok: true, registry: { providers: [...registry.providers, provider] } };
}

export function registerAll(registry: ProviderRegistry, providers: readonly AnyProvider[]): RegistryResult {
  let current = registry;
  for (const provider of providers) {
    const r = register(current, provider);
    if (!r.ok) return r;
    current = r.registry;
  }
  return { ok: true, registry: current };
}

export type ResolveResult<T> =
  | { readonly ok: true; readonly provider: T }
  | { readonly ok: false; readonly reason: string };

/**
 * Find a provider by port and name.
 *
 * REFUSES when it is not there. It does not fall back to a simulated adapter, and that is the most
 * important line in this file: a silent fallback would let a run configured for real work report
 * work it never performed, with nothing in the output to show for it.
 */
export function resolve<T extends AnyProvider>(
  registry: ProviderRegistry,
  port: Port,
  name: string,
): ResolveResult<T> {
  const found = registry.providers.find((p) => p.meta.port === port && p.meta.name === name);
  if (found === undefined) {
    const available = registry.providers.filter((p) => p.meta.port === port).map((p) => p.meta.name);
    return {
      ok: false,
      reason: `no ${port} provider named '${name}'` + (available.length === 0 ? " (none registered)" : ` (have: ${available.join(", ")})`),
    };
  }
  return { ok: true, provider: found as T };
}

/** Everything registered for a port, for a caller that wants to show the choice. */
export function providersFor(registry: ProviderRegistry, port: Port): readonly AnyProvider[] {
  return registry.providers.filter((p) => p.meta.port === port);
}

// ─── The resolved set a run uses ────────────────────────────────────────────

export interface ProviderSet {
  /**
   * What agents READ from. Optional, because an organization may legitimately have declared none.
   *
   * Optional and still COUNTED: when present it is part of what the run touched, so it appears in
   * the fidelity report like every other port. It was omitted from that report for exactly one
   * commit, and the result was a run reading a real repository at a real commit while printing
   * *"every port was simulated; this run performed nothing and reached nothing"* — a disclosure
   * contradicted by the thing it was disclosing.
   */
  readonly dataSource?: DataSourcePort;
  readonly intake: IntakeSource;
  readonly work: WorkExecutor;
  readonly tests: TestRunner;
  readonly review: ReviewPort;
  readonly change: ChangeControlPort;
}

export type ProviderSetResult =
  | { readonly ok: true; readonly set: ProviderSet }
  | { readonly ok: false; readonly reason: string };

/** Resolve a whole set by name. The first refusal wins — a partly-resolved set is not a set. */
export function resolveSet(
  registry: ProviderRegistry,
  names: {
    readonly intake: string;
    readonly work: string;
    readonly tests: string;
    readonly review: string;
    readonly change: string;
  },
): ProviderSetResult {
  const intake = resolve<IntakeSource>(registry, Port.Intake, names.intake);
  if (!intake.ok) return intake;
  const work = resolve<WorkExecutor>(registry, Port.WorkExecution, names.work);
  if (!work.ok) return work;
  const tests = resolve<TestRunner>(registry, Port.TestExecution, names.tests);
  if (!tests.ok) return tests;
  const review = resolve<ReviewPort>(registry, Port.Review, names.review);
  if (!review.ok) return review;
  const change = resolve<ChangeControlPort>(registry, Port.ChangeControl, names.change);
  if (!change.ok) return change;
  return {
    ok: true,
    set: {
      intake: intake.provider,
      work: work.provider,
      tests: tests.provider,
      review: review.provider,
      change: change.provider,
    },
  };
}

export interface FidelityReport {
  /** Every port, with the adapter chosen and what it is. */
  readonly ports: readonly ProviderMeta[];
  /** True only when EVERY provider is simulated. */
  readonly replayable: boolean;
  /** The ports that touched something real. Empty on a replayable run. */
  readonly realPorts: readonly Port[];
}

/**
 * What this run's providers were.
 *
 * `replayable` is DERIVED from the set rather than declared by the caller. A run that reached a
 * network and called itself deterministic would be the exact claim this whole layer exists to make
 * impossible to state by accident.
 */
export function fidelityOf(set: ProviderSet): FidelityReport {
  const ports = [
    ...(set.dataSource === undefined ? [] : [set.dataSource.meta]),
    set.intake.meta,
    set.work.meta,
    set.tests.meta,
    set.review.meta,
    set.change.meta,
  ];
  const realPorts = ports.filter((m) => m.fidelity === Fidelity.Real).map((m) => m.port);
  return { ports, replayable: realPorts.length === 0, realPorts };
}

/**
 * What a run COULD do, and what it actually DID — kept apart, because they are different claims.
 *
 * `fidelityOf` reads the ProviderSet's LABELS. That is the right basis for `replayable`: a set
 * holding a real adapter cannot be promised to replay, whether or not this particular run happened
 * to reach it, and answering otherwise would be a promise the next run breaks.
 *
 * It is the wrong basis for the sentence a human reads. The register wrote *"these port(s) touched
 * something real: review"* over a run with **zero gate evaluations** — measured — because the
 * reviewer was configured, not called. "Touched" is a claim about the world; configuration is a
 * claim about intent, and a disclosure that conflates them overstates in the one direction this
 * whole layer exists to prevent.
 *
 * So a run reports THREE things rather than two:
 *
 *   - `reached`             real AND called. The only set "touched something" can honestly name.
 *   - `configuredNotCalled` real and never called. Not nothing, and not a reach — its own answer.
 *   - `replayable`          configuration-derived, unchanged, deliberately conservative.
 *
 * Both new fields are DERIVED from `realPorts` and the invocation set. Neither can be declared.
 */
export interface RunFidelity extends FidelityReport {
  /** Every port whose adapter was called, real or simulated. */
  readonly invoked: readonly Port[];
  /** Real ports that were called. What the run reached. */
  readonly reached: readonly Port[];
  /** Real ports that were never called. Configured to reach, and did not. */
  readonly configuredNotCalled: readonly Port[];
}

export function runFidelityOf(set: ProviderSet, invoked: Iterable<Port>): RunFidelity {
  const base = fidelityOf(set);
  // Ordinal, and ordered by the port enum rather than by call order: a report whose field order
  // depended on which adapter happened to answer first would differ between two runs that did the
  // same thing, and this value is written to a content-addressed store.
  const called = new Set(invoked);
  const order = (ports: readonly Port[]) => [...ports].sort();
  return {
    ...base,
    invoked: order([...called]),
    reached: order(base.realPorts.filter((p) => called.has(p))),
    configuredNotCalled: order(base.realPorts.filter((p) => !called.has(p))),
  };
}

/**
 * The one sentence, in one place.
 *
 * The runtime writes it into the log and both CLIs print it. Three copies of this wording is three
 * chances to say something the report does not support — which is how it got out of step in the
 * first place: the emitted fact and the two CLI prints all independently said "touched something"
 * about a field that measures CONFIGURATION.
 */
export function fidelityLine(f: RunFidelity): string {
  if (f.reached.length > 0) {
    const unreached =
      f.configuredNotCalled.length === 0
        ? ""
        : `; configured real but never called: ${f.configuredNotCalled.join(", ")}`;
    return `these port(s) reached something real: ${f.reached.join(", ")}${unreached}`;
  }
  if (f.configuredNotCalled.length > 0) {
    // NOT "performed nothing". The run is still un-replayable: the same set run again would reach.
    return `no real port was called; configured real and never reached: ${f.configuredNotCalled.join(", ")}`;
  }
  return "every port was simulated; this run performed nothing and reached nothing";
}

/**
 * The same set, plus a record of which ports were actually called.
 *
 * A wrapper rather than a flag inside each adapter: an adapter that counted its own calls would be
 * a fact each of the fourteen adapters could get wrong independently, and three of them would
 * quietly not have it. Here there is one place to be right about, and `invoked()` is the only way
 * to learn the answer — so it cannot drift from what actually ran.
 */
export function recordingProviders(set: ProviderSet): {
  readonly providers: ProviderSet;
  invoked(): readonly Port[];
} {
  const called = new Set<Port>();
  const mark = (port: Port) => {
    called.add(port);
  };
  return {
    invoked: () => [...called].sort(),
    providers: {
      // Wrapped like every other port. A data source reached through the RAW set would be a real
      // adapter that read a repository and never appeared in `invoked`, so the run would report it
      // as "configured real and never reached" while its documents sat in a gate's evidence. That
      // is the exact contradiction this recorder exists to make impossible.
      ...(set.dataSource === undefined
        ? {}
        : {
            dataSource: {
              meta: set.dataSource.meta,
              read: async () => {
                mark(Port.DataSource);
                return set.dataSource!.read();
              },
              query: async (term: string) => {
                mark(Port.DataSource);
                return set.dataSource!.query(term);
              },
            },
          }),
      intake: {
        meta: set.intake.meta,
        poll: async () => {
          mark(Port.Intake);
          return set.intake.poll();
        },
      },
      work: {
        meta: set.work.meta,
        execute: async (node, ctx) => {
          mark(Port.WorkExecution);
          return set.work.execute(node, ctx);
        },
      },
      tests: {
        meta: set.tests.meta,
        run: async (testCase, ctx) => {
          mark(Port.TestExecution);
          return set.tests.run(testCase, ctx);
        },
      },
      review: {
        meta: set.review.meta,
        review: async (request) => {
          mark(Port.Review);
          return set.review.review(request);
        },
      },
      change: {
        meta: set.change.meta,
        // BOTH halves mark. A change that was opened and never merged still reached the repository,
        // and a report that only counted merges would call that run untouched.
        open: async (node, ctx) => {
          mark(Port.ChangeControl);
          return set.change.open(node, ctx);
        },
        merge: async (handle) => {
          mark(Port.ChangeControl);
          return set.change.merge(handle);
        },
        // ── THE OPTIONAL HALVES MUST SURVIVE THE WRAPPER ────────────────────
        // This object is rebuilt field by field, so an optional method the wrapped port implements
        // simply CEASES TO EXIST once it is wrapped — and every caller guards with
        // `port.changed !== undefined`, so the feature does not fail, it silently never happens.
        //
        // MEASURED: `changed` has been dropped here since the wrapper was written, which is why no
        // run through `runOrgRuntime` has ever emitted the `change_files` fact its call site
        // carefully explains. Found while wiring `revision` and watching it arrive as undefined.
        //
        // Spread conditionally rather than assigned unconditionally: under
        // `exactOptionalPropertyTypes` an explicit `revision: undefined` is not the same as an
        // absent one, and a present-but-undefined method is exactly the shape those guards read as
        // "this adapter cannot do it".
        ...(set.change.changed === undefined
          ? {}
          : {
              changed: async (handle: ChangeHandle) => {
                mark(Port.ChangeControl);
                return set.change.changed!(handle);
              },
            }),
        ...(set.change.revision === undefined
          ? {}
          : {
              revision: async (handle: ChangeHandle) => {
                mark(Port.ChangeControl);
                return set.change.revision!(handle);
              },
            }),
        // THE SAME TRAP, a third time: without this a run configured to hand changes to people
        // found no `handoff` on the wrapped port and refused - correctly, since it never merges
        // instead - for every change it finished.
        ...(set.change.handoff === undefined
          ? {}
          : {
              handoff: async (handle: ChangeHandle, proposal: ChangeProposal) => {
                mark(Port.ChangeControl);
                return set.change.handoff!(handle, proposal);
              },
            }),
      },
    },
  };
}

/**
 * Refuse a set that cannot support the determinism a caller requires.
 *
 * For a DST run, or any run whose output is being compared against a golden expectation: a real
 * provider makes the comparison meaningless, and finding that out from a diff is worse than being
 * told up front.
 */
export function requireReplayable(set: ProviderSet): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  const report = fidelityOf(set);
  if (report.replayable) return { ok: true };
  return {
    ok: false,
    reason: `this run needs to be replayable, and these port(s) are real: ${report.realPorts.join(", ")}`,
  };
}
