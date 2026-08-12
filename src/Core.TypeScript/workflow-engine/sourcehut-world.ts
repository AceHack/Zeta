// src/Core.TypeScript/workflow-engine/sourcehut-world.ts
//
// 081KSNY2Z0008QG0R002A785QR — SourcehutWorld per-host adapter.
//
// SubstantIVELY DIFFERENT shape from GitHub/GitLab/Gitea/Bitbucket/
// Codeberg. Sourcehut (sr.ht) uses EMAIL-PATCHES + MAILING LISTS for
// code review (lists.sr.ht), git.sr.ht for hosting, builds.sr.ht for
// CI, todo.sr.ht for tickets. NO web-PR equivalent.
//
// This adapter substrate-engineering substrate-naming substrate
// demonstrates the per-host-adapter pattern can extend to QUALITATIVELY
// DIFFERENT forge models, not just PR/MR variations.
//
// Composes with PR #5775 (GitWorld base) + PR #5801 (GitLabWorld) +
// 081KSNY2Z0008QG0R002A785QR (per-host adapters target).

import { registerLifetimePair, type ComposedKey, type LifetimeState, type StandardVerdict } from "./world.js";
import { type GitWorld } from "./git-world.js";

/**
 * Email-patch lifetime (Sourcehut-native; analog of PR/MR but qualitatively
 * different — patches are emails, reviews are mailing-list replies).
 *
 * Per Sourcehut's `git send-email` workflow:
 * https://man.sr.ht/git.sr.ht/#sending-patches-upstream
 */
export interface EmailPatchLifetime extends LifetimeState {
  readonly kind:
    | "sent" // patch sent to list
    | "under-review" // replies in thread
    | "needs-revision" // reviewer requested changes
    | "applied" // maintainer applied locally
    | "merged" // pushed to upstream
    | "rejected" // explicitly declined
    | "abandoned"; // no activity; faded
}

/**
 * Mailing-list thread lifetime (lists.sr.ht).
 *
 * Threads are first-class substrate; not attached to specific patches
 * (a thread can be discussion-only, RFC, or carry patches).
 */
export interface MailingListThreadLifetime extends LifetimeState {
  readonly kind:
    | "discussion" // no patches; pure conversation
    | "rfc" // request-for-comments; no patches yet
    | "patch-series" // contains one or more patch emails
    | "announcement" // unilateral notice
    | "closed"; // moderator-closed
}

/**
 * builds.sr.ht job lifetime (Sourcehut-native CI/CD).
 */
export interface SrhtBuildLifetime extends LifetimeState {
  readonly kind: "pending" | "queued" | "running" | "success" | "failed" | "timeout" | "cancelled";
}

/**
 * todo.sr.ht ticket lifetime.
 */
export interface SrhtTicketLifetime extends LifetimeState {
  readonly kind: "open" | "resolved-fixed" | "resolved-wontfix" | "resolved-duplicate" | "resolved-not-our-bug";
}

/**
 * Sourcehut resource budget. Sourcehut is paid-only (subscription model);
 * doesn't enforce per-request rate limits the way GitHub/GitLab do, but
 * has soft limits on builds.sr.ht (concurrent jobs per subscription tier).
 */
export interface SrhtResourceBudget {
  readonly buildJobsRemaining: number; // concurrent builds.sr.ht slots
  readonly buildJobsLimit: number; // subscription tier
  readonly listSendsPerHour: number; // soft limit on mailing-list sends
}

export type SrhtRateLimitTier = "normal" | "constrained";

export function srhtRateLimitTier(buildJobsRemaining: number): SrhtRateLimitTier {
  return buildJobsRemaining > 0 ? "normal" : "constrained";
}

/**
 * SourcehutWorld — Sourcehut forge specialization.
 *
 * Per Aaron's "rank-4 substrate primitive" framing: this adapter
 * demonstrates that the per-host-adapter pattern extends to QUALITATIVELY
 * DIFFERENT forge models. Sourcehut's email-patches + mailing-lists
 * workflow has different substrate-engineering shape than GitHub/GitLab/
 * Bitbucket's PR-driven workflow.
 *
 * Inherits all GitWorld substrate + adds Sourcehut-native:
 * - EmailPatchLifetime (analog of PR/MR; qualitatively different shape)
 * - MailingListThreadLifetime (lists.sr.ht first-class substrate)
 * - SrhtBuildLifetime (builds.sr.ht CI)
 * - SrhtTicketLifetime (todo.sr.ht)
 * - SrhtResourceBudget (subscription-tier-bound rather than per-request)
 */
export interface SourcehutWorld extends GitWorld {
  readonly forgeName: "git";
  readonly forgeSpecialization: "sourcehut";
  readonly patchUniverse: ReadonlyArray<EmailPatchLifetime>;
  readonly listThreadUniverse: ReadonlyArray<MailingListThreadLifetime>;
  readonly buildUniverse: ReadonlyArray<SrhtBuildLifetime>;
  readonly ticketUniverse: ReadonlyArray<SrhtTicketLifetime>;
  readonly resourceBudget?: SrhtResourceBudget;
}

export function buildSourcehutWorld(gitWorld: GitWorld, resourceBudget?: SrhtResourceBudget): SourcehutWorld {
  return {
    ...gitWorld,
    forgeSpecialization: "sourcehut",
    patchUniverse: [
      { kind: "sent" },
      { kind: "under-review" },
      { kind: "needs-revision" },
      { kind: "applied" },
      { kind: "merged" },
      { kind: "rejected" },
      { kind: "abandoned" },
    ],
    listThreadUniverse: [
      { kind: "discussion" },
      { kind: "rfc" },
      { kind: "patch-series" },
      { kind: "announcement" },
      { kind: "closed" },
    ],
    buildUniverse: [
      { kind: "pending" },
      { kind: "queued" },
      { kind: "running" },
      { kind: "success" },
      { kind: "failed" },
      { kind: "timeout" },
      { kind: "cancelled" },
    ],
    ticketUniverse: [
      { kind: "open" },
      { kind: "resolved-fixed" },
      { kind: "resolved-wontfix" },
      { kind: "resolved-duplicate" },
      { kind: "resolved-not-our-bug" },
    ],
    ...(resourceBudget !== undefined && { resourceBudget }),
  };
}

export type SourcehutFeedback =
  | { kind: "UnsupportedSourcehutFeature"; feature: string }
  | { kind: "BuildSlotsExhausted"; required: number; available: number }
  | { kind: "MailingListThrottled"; sendsPerHour: number }
  | { kind: "PatchApplyFailed"; reason: string };

export type SourcehutResult<T> = { ok: true; world: T } | { ok: false; feedback: SourcehutFeedback };

export function canAffordSrhtBuild(world: SourcehutWorld, jobsNeeded: number): SourcehutResult<SourcehutWorld> {
  const budget = world.resourceBudget;
  if (!budget) return { ok: true, world };
  if (jobsNeeded > budget.buildJobsRemaining) {
    return {
      ok: false,
      feedback: {
        kind: "BuildSlotsExhausted",
        required: jobsNeeded,
        available: budget.buildJobsRemaining,
      },
    };
  }
  return { ok: true, world };
}

export function registerInSourcehut<A extends LifetimeState, B extends LifetimeState, T>(
  world: SourcehutWorld,
  pairName: string,
  matrix: ReadonlyMap<ComposedKey<A, B>, T>,
): SourcehutWorld {
  return registerLifetimePair(world, pairName, matrix);
}

export const SRHT_PATCH_UNIVERSE: ReadonlyArray<EmailPatchLifetime> = [
  { kind: "sent" },
  { kind: "under-review" },
  { kind: "needs-revision" },
  { kind: "applied" },
  { kind: "merged" },
  { kind: "rejected" },
  { kind: "abandoned" },
];

export const SRHT_BUILD_UNIVERSE: ReadonlyArray<SrhtBuildLifetime> = [
  { kind: "pending" },
  { kind: "queued" },
  { kind: "running" },
  { kind: "success" },
  { kind: "failed" },
  { kind: "timeout" },
  { kind: "cancelled" },
];

/**
 * Email-patches verdict: Sourcehut workflow expects patches to land via
 * maintainer-applied (not auto-merge). This verdict captures the manual-
 * apply discipline.
 */
export const SRHT_MANUAL_APPLY_VERDICT: StandardVerdict = {
  kind: "block",
  reason: "Sourcehut: email-patches require manual maintainer apply, not auto-merge",
};
