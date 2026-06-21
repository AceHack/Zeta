import type {
  CommandStateStoreFactory,
  HatAssignmentAuthorityReaderPort,
  HatAssignmentAuthorityWriterPort,
  QualityGateEvaluationStateReaderPort,
  WorkScheduleBlockAuthorityReaderPort,
} from "../../application/src/ports.ts";
import type { DiscussionAnchorStateReaderPort } from "../../application/src/ports.ts";
import type { OutboxEventSource } from "../../state/src/index.ts";
import type { EventIngestionStore } from "../../state/src/index.ts";
import type { WorkAnchorStateStore } from "../../state/src/index.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";
import { createCockroachCommandStateStoreFactory, type CockroachSqlExecutor } from "./cockroach-command-state-store.ts";
import {
  createCockroachDiscussionAnchorStateStore,
  type CockroachDiscussionAnchorSqlExecutor,
} from "./cockroach-discussion-anchor-state-store.ts";
import {
  createCockroachEventIngestionStore,
  type CockroachEventIngestionSqlExecutor,
} from "./cockroach-event-ingestion-store.ts";
import {
  createCockroachHatAssignmentAuthorityReader,
  type CockroachHatAssignmentAuthoritySqlExecutor,
} from "./cockroach-hat-assignment-authority-reader.ts";
import { createCockroachHatAssignmentAuthorityWriter } from "./cockroach-hat-assignment-authority-writer.ts";
import { createCockroachOutboxEventSource, type CockroachOutboxSqlExecutor } from "./cockroach-outbox-event-source.ts";
import {
  createCockroachPolicyDecisionObservationStore,
  type CockroachPolicyDecisionObservationSqlExecutor,
  type CockroachPolicyDecisionObservationStore,
} from "./cockroach-policy-decision-observation-store.ts";
import {
  createCockroachQualityGateEvaluationStateReader,
  type CockroachQualityGateEvaluationSqlExecutor,
} from "./cockroach-quality-gate-evaluation-state-reader.ts";
import {
  createCockroachReactionPlanWorkQueue,
  type CockroachReactionPlanWorkQueueSqlExecutor,
} from "./cockroach-reaction-plan-work-queue.ts";
import {
  createCockroachWorkAnchorStateStore,
  type CockroachWorkAnchorSqlExecutor,
} from "./cockroach-work-anchor-state-store.ts";
import {
  createCockroachWorkScheduleBlockAuthorityReader,
  type CockroachWorkScheduleBlockAuthoritySqlExecutor,
} from "./cockroach-work-schedule-block-authority-reader.ts";
import type { ReactionPlanWorkQueue } from "../../state/src/index.ts";

export type CockroachOrganizationSqlExecutor = CockroachGenericSqlExecutor &
  CockroachSqlExecutor &
  CockroachDiscussionAnchorSqlExecutor &
  CockroachOutboxSqlExecutor &
  CockroachEventIngestionSqlExecutor &
  CockroachHatAssignmentAuthoritySqlExecutor &
  CockroachPolicyDecisionObservationSqlExecutor &
  CockroachQualityGateEvaluationSqlExecutor &
  CockroachReactionPlanWorkQueueSqlExecutor &
  CockroachWorkScheduleBlockAuthoritySqlExecutor &
  CockroachWorkAnchorSqlExecutor;

export type CockroachDurableStateAdapters<Result> = {
  commandStateStoreFactory: CommandStateStoreFactory<Result>;
  outboxEventSource: OutboxEventSource;
  eventIngestionStore: EventIngestionStore;
  policyDecisionObservationStore: CockroachPolicyDecisionObservationStore;
  qualityGateEvaluationStateReader: QualityGateEvaluationStateReaderPort;
  discussionAnchorStateReader: DiscussionAnchorStateReaderPort;
  hatAssignmentAuthorityReader: HatAssignmentAuthorityReaderPort;
  hatAssignmentAuthorityWriter: HatAssignmentAuthorityWriterPort;
  reactionPlanWorkQueue: ReactionPlanWorkQueue;
  workScheduleBlockAuthorityReader: WorkScheduleBlockAuthorityReaderPort;
  workAnchorStateStore: WorkAnchorStateStore;
};

export type CreateCockroachDurableStateAdaptersInput = {
  executor: CockroachOrganizationSqlExecutor;
};

export function createCockroachDurableStateAdapters<Result>(
  input: CreateCockroachDurableStateAdaptersInput,
): CockroachDurableStateAdapters<Result> {
  return {
    commandStateStoreFactory: createCockroachCommandStateStoreFactory<Result>({
      executor: input.executor,
    }),
    outboxEventSource: createCockroachOutboxEventSource({
      executor: input.executor,
    }),
    eventIngestionStore: createCockroachEventIngestionStore({
      executor: input.executor,
    }),
    policyDecisionObservationStore: createCockroachPolicyDecisionObservationStore({
      executor: input.executor,
    }),
    qualityGateEvaluationStateReader: createCockroachQualityGateEvaluationStateReader({
      executor: input.executor,
    }),
    discussionAnchorStateReader: createCockroachDiscussionAnchorStateStore({
      executor: input.executor,
    }),
    hatAssignmentAuthorityReader: createCockroachHatAssignmentAuthorityReader({
      executor: input.executor,
    }),
    hatAssignmentAuthorityWriter: createCockroachHatAssignmentAuthorityWriter({
      executor: input.executor,
    }),
    reactionPlanWorkQueue: createCockroachReactionPlanWorkQueue({
      executor: input.executor,
    }),
    workScheduleBlockAuthorityReader: createCockroachWorkScheduleBlockAuthorityReader({
      executor: input.executor,
    }),
    workAnchorStateStore: createCockroachWorkAnchorStateStore({
      executor: input.executor,
    }),
  };
}
