/**
 * The ChangeControlPort (CC4) — the projection seam. The internal ChangeSet is
 * canonical; a port materializes ONE stage of it onto an external system (GitHub
 * PR / GitLab MR / Jira card) and reconciles the external decision back IN. Same
 * compose-don't-fork shape as the Memory port + Hindsight adapter.
 *
 *   project(cs, stage) — create the external PR/MR/card → ProjectionRef
 *   pull(ref)          — poll the external review state (approved? merged?)
 *   push(ref, outcome) — mirror an internal stage decision onto the external view
 *   merge(ref)         — merge/close the external PR when the ChangeSet is applied
 *
 * NullChangeControlPort runs internal-only orgs (every method a no-op; an external
 * stage degrades to auto-approve so it never blocks). createFakeExternalPort is a
 * controllable in-memory external system for the kind proof — the runtime can flip
 * a projection to "approved" to simulate a human approving the PR.
 */

import {
  ExternalSystem,
  type ChangeSet,
  type ProjectionRef,
  type ReviewStage,
  type StageOutcome,
} from "../../domain/src/index.ts";
import { ExternalDecision } from "./change-control-kernel.ts";

export type ExternalReviewState = {
  decision: ExternalDecision;
  merged: boolean;
  detail: string;
};

export interface ChangeControlPort {
  system: ExternalSystem;
  project: (cs: ChangeSet, stage: ReviewStage) => Promise<ProjectionRef>;
  pull: (ref: ProjectionRef) => Promise<ExternalReviewState>;
  push: (ref: ProjectionRef, stage: ReviewStage, outcome: StageOutcome) => Promise<void>;
  merge: (ref: ProjectionRef) => Promise<void>;
}

// ── internal-only: the org ships with zero external systems ──────────────────

export function createNullChangeControlPort(): ChangeControlPort {
  return {
    system: ExternalSystem.None,
    async project(cs: ChangeSet): Promise<ProjectionRef> {
      return { system: ExternalSystem.None, externalId: `internal:${cs.changeSetId}`, url: "", lastSyncedState: "internal", syncedAt: new Date(0).toISOString() };
    },
    async pull(): Promise<ExternalReviewState> {
      // no external system → an external stage can't block; degrade to approved
      return { decision: ExternalDecision.Approved, merged: false, detail: "internal-only (no external system)" };
    },
    async push(): Promise<void> {},
    async merge(): Promise<void> {},
  };
}

// ── controllable fake external system (for the kind proof) ───────────────────

export type FakeExternalPort = ChangeControlPort & {
  /** simulate a human approving the external PR/MR/card */
  approve: (externalId: string) => void;
  /** simulate the external reviewer requesting changes */
  requestChanges: (externalId: string) => void;
  isMerged: (externalId: string) => boolean;
};

export function createFakeExternalPort(system: ExternalSystem, nowMs: () => number): FakeExternalPort {
  const states = new Map<string, ExternalReviewState>();
  let counter = 0;

  return {
    system,
    async project(cs: ChangeSet): Promise<ProjectionRef> {
      const externalId = `${system}-${cs.workItemId}-${++counter}`;
      states.set(externalId, { decision: ExternalDecision.Pending, merged: false, detail: "projected; awaiting external review" });
      return { system, externalId, url: `https://example.test/${system}/${externalId}`, lastSyncedState: "pending", syncedAt: new Date(nowMs()).toISOString() };
    },
    async pull(ref: ProjectionRef): Promise<ExternalReviewState> {
      return states.get(ref.externalId) ?? { decision: ExternalDecision.Pending, merged: false, detail: "unknown projection" };
    },
    async push(ref: ProjectionRef): Promise<void> {
      const s = states.get(ref.externalId);
      if (s !== undefined) states.set(ref.externalId, { ...s, detail: `mirrored internal decision` });
    },
    async merge(ref: ProjectionRef): Promise<void> {
      const s = states.get(ref.externalId);
      if (s !== undefined) states.set(ref.externalId, { ...s, merged: true, detail: "merged" });
    },
    approve(externalId: string): void {
      states.set(externalId, { decision: ExternalDecision.Approved, merged: false, detail: "approved by external human" });
    },
    requestChanges(externalId: string): void {
      states.set(externalId, { decision: ExternalDecision.ChangesRequested, merged: false, detail: "changes requested externally" });
    },
    isMerged(externalId: string): boolean {
      return states.get(externalId)?.merged ?? false;
    },
  };
}
