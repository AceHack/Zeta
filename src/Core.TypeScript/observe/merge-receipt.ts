/**
 * observe/merge-receipt.ts — a merge needs a receipt, and a missing tool is not one.
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 * `codegen-executor.ts` merged a PR with `gh pr merge --squash --auto --delete-branch`, which is the
 * safe path: `gh` goes through the forge, so branch protection, required checks and required reviews
 * all apply. But when `gh` was **absent from PATH** (`errCode === "ENOENT"`) it fell back to
 * `mergeViaGit` — `git merge --no-ff` locally followed by `git push origin main`.
 *
 * That fallback bypasses the pull request entirely. No required checks, no required reviews, no
 * unresolved-thread check, no merge queue. And its trigger is *the tool being missing* — so the loop
 * merged precisely when it had **lost the ability to ask whether merging was allowed**.
 *
 * That is the exact inverse of the discipline the control-plane halt and the promotion gate are
 * built on: **"could not tell" is not permission.** Server-side branch protection would very likely
 * have rejected the push, but that is an unenforced-elsewhere constraint the code does not check —
 * the same shape this repo names as the main obstacle to human–AI trust.
 *
 * ── WHAT A RECEIPT IS ────────────────────────────────────────────────────────
 * `ForgeHost.getPrGateState(n)` — which had **zero callers outside `forge-host/`** — is the forge's
 * own answer about a PR: its gate, its checks, its required checks, its unresolved review threads.
 * That is the unforgeable half. The loop's previous merge condition came from
 * `listOpenPullRequests`' `mergeStateStatus === "clean"`, which speaks to MERGEABILITY and says
 * nothing about whether reviewers' threads were ever answered.
 *
 * ── THE LIFECYCLE IS DRIVEN, NOT REIMPLEMENTED ───────────────────────────────
 * `workflow-engine/agent-loop/work-lifecycle-state-machine.ts` is a state machine verified against
 * `src/Core/WorkflowEngine.fs` by a 264-vector treaty — and until now its `applyTransition` had
 * exactly three callers: its own unit test, the transcript generator, and the treaty test. **The
 * running loop never consulted it.**
 *
 * So this module does not encode "you may merge when X". It walks the real machine — `PrOpen`
 * →`RequestReview`→ `InReview`, then either `ReceiveRevisionRequest` (threads outstanding) or
 * `ResolveAllThreads` (→ `Approved`) — and then asks `applyTransition` whether `Merge` is legal from
 * where it landed. The rule stays in the one place the F# oracle checks.
 */

import type { PrGateState } from "../forge-host/types";
import {
  applyTransition,
  type BacklogRow,
  type WorkLifecycleState,
} from "../workflow-engine/agent-loop/work-lifecycle-state-machine";
import type { AgentPersona } from "../protocol/agent-loop-contract";

/** A stand-in row for a synthetic `merge-pr-N` item, which has no backlog file behind it. */
export function rowForPr(prNumber: number, title: string): BacklogRow {
  return {
    id: `merge-pr-${String(prNumber)}`,
    title,
    priority: "P2",
    filePath: `(synthetic: pull request #${String(prNumber)})`,
    trajectory: "forge",
  };
}

/**
 * Where the forge says this PR actually is.
 *
 * Every step is a real transition through the verified machine, so the legality of the path is
 * checked by the same code the F# treaty pins — not restated here.
 */
export function lifecycleFromGateState(
  row: BacklogRow,
  gate: PrGateState,
  openedBy: AgentPersona = "otto",
): WorkLifecycleState {
  // `openedBy` is not part of the merge decision — the gate state is — so it takes a default rather
  // than being invented per call. Passing it explicitly is available where the caller knows it.
  const opened: WorkLifecycleState = {
    tag: "PrOpen",
    row,
    prNumber: gate.number,
    openedBy,
    openedAt: "",
  };

  const reviewed = applyTransition(opened, { tag: "RequestReview", reviewers: [] });
  if (!reviewed.ok) return opened;
  const inReview = reviewed.state;

  if (gate.unresolvedThreads > 0) {
    // Threads outstanding — the review is NOT finished, whatever the mergeability flag says.
    const bounced = applyTransition(inReview, {
      tag: "ReceiveRevisionRequest",
      threadIds: Array.from({ length: gate.unresolvedThreads }, (_, i) => `unresolved-${String(i)}`),
    });
    return bounced.ok ? bounced.state : inReview;
  }

  // No outstanding threads AND the forge reports the gate clean with required checks green.
  const checksGreen =
    gate.requiredChecks.failed === 0 && gate.requiredChecks.pending === 0 && gate.requiredChecks.inProgress === 0;
  if (gate.gate !== "clean" || !checksGreen) return inReview;

  const approved = applyTransition(inReview, { tag: "ResolveAllThreads" });
  return approved.ok ? approved.state : inReview;
}

export type MergeVerdict = { readonly permitted: true } | { readonly permitted: false; readonly why: string };

/**
 * May this state be merged?
 *
 * Answered by ASKING the machine, not by testing `state.tag === "Approved"` here. If the legal
 * graph ever changes, it changes in one place and the F# treaty catches the divergence.
 */
export function mergePermitted(state: WorkLifecycleState): MergeVerdict {
  const result = applyTransition(state, { tag: "Merge", mergeCommit: "(pending)", mergedAt: "" });
  if (result.ok) return { permitted: true };
  return { permitted: false, why: result.reason };
}

/**
 * How many threads to quote before summarising.
 *
 * Bounded because a refusal is read, and a fifty-line refusal is not. The COUNT above it is never
 * truncated — only the quoting is, so the number of blockers stays exact.
 */
const MAX_NAMED_THREADS = 5;

/** A reviewer's first line, bounded. The whole comment belongs in the thread, not in a log line. */
function firstLine(body: string): string {
  const line = body.split("\n")[0] ?? "";
  return line.length > 120 ? `${line.slice(0, 117)}...` : line;
}

/** Why a PR is not mergeable, in the operator's words rather than a state tag. */
export function describeGateRefusal(gate: PrGateState): string {
  const reasons: string[] = [];
  if (gate.unresolvedThreads > 0) {
    reasons.push(`${String(gate.unresolvedThreads)} unresolved review thread(s) — the review is not finished`);
    // NAME them. "3 unresolved threads" is a wall; "lior asked about the retry bound in do-item.ts"
    // is a task. The gate now carries the reviewer's actual words, so the refusal carries them too.
    const open = gate.threads.filter((x) => !x.isResolved);
    for (const t of open.slice(0, MAX_NAMED_THREADS)) {
      const where = t.path === undefined ? "" : ` (${t.path}${t.line === undefined ? "" : `:${String(t.line)}`})`;
      const said =
        t.firstComment === undefined
          ? "no comment text available"
          : `${t.firstComment.author}: "${firstLine(t.firstComment.body)}"`;
      reasons.push(`  - ${said}${where}${t.isOutdated ? " [outdated — the diff moved under it]" : ""}`);
    }
    if (open.length > MAX_NAMED_THREADS) {
      reasons.push(`  - ... and ${String(open.length - MAX_NAMED_THREADS)} more`);
    }
  }
  if (gate.requiredChecks.failed > 0) reasons.push(`${String(gate.requiredChecks.failed)} required check(s) failing`);
  const notDone = gate.requiredChecks.pending + gate.requiredChecks.inProgress;
  if (notDone > 0) reasons.push(`${String(notDone)} required check(s) still running`);
  if (gate.gate !== "clean") reasons.push(`forge reports the merge gate "${gate.gate}"`);
  return reasons.length > 0 ? reasons.join("; ") : "the forge did not report this PR as ready";
}

/** How the executor obtains a receipt. Injected so the merge path is testable without a network. */
export type PrGateReader = (prNumber: number) => Promise<{ ok: true; gate: PrGateState } | { ok: false; why: string }>;

export interface MergeAuthorization {
  readonly permitted: boolean;
  readonly why: string;
  readonly state?: WorkLifecycleState;
}

/**
 * The whole decision: get a receipt, derive the state, ask the machine.
 *
 * **No reader at all is a REFUSAL, not a pass.** That is the entire point — the old code merged by
 * a different route exactly when it could not consult the forge.
 */
export async function authorizeMerge(
  prNumber: number,
  title: string,
  reader: PrGateReader | undefined,
): Promise<MergeAuthorization> {
  if (reader === undefined) {
    return {
      permitted: false,
      why: `no forge receipt available for PR #${String(prNumber)} — a merge needs the forge's own answer about checks and unresolved review threads, and being unable to ask is not permission to proceed`,
    };
  }

  const receipt = await reader(prNumber);
  if (!receipt.ok) {
    return {
      permitted: false,
      why: `could not read the gate state for PR #${String(prNumber)}: ${receipt.why} — refusing rather than merging on an unverified PR`,
    };
  }

  const state = lifecycleFromGateState(rowForPr(prNumber, title), receipt.gate);
  const verdict = mergePermitted(state);
  if (verdict.permitted) return { permitted: true, why: `PR #${String(prNumber)} is Approved`, state };
  return {
    permitted: false,
    why: `PR #${String(prNumber)} is ${state.tag}, not Approved — ${describeGateRefusal(receipt.gate)}`,
    state,
  };
}
