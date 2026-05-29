import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { DiscussionAnchorType, DiscussionExpectedOutput } from "../../domain/src/index.ts";
import {
  CockroachDiscussionAnchorStateStoreStatement,
  createCockroachDiscussionAnchorStateStore,
  type CockroachDiscussionAnchorSqlResult,
  type CockroachDiscussionAnchorSqlExecutor,
  type CockroachDiscussionAnchorSqlStatement,
} from "../src/index.ts";

describe("cockroach discussion anchor state store", () => {
  test("reads discussion anchors behind the generic application port", async () => {
    const executor = createRecordingExecutor();
    const store = createCockroachDiscussionAnchorStateStore({
      executor,
    });

    const discussionAnchor = await store.findDiscussionAnchor("discussion-anchor-001");

    deepEqual(executor.statements.map((statement) => statement.name), [
      CockroachDiscussionAnchorStateStoreStatement.FindDiscussionAnchor,
    ]);
    deepEqual(executor.statements[0]?.parameters, ["discussion-anchor-001"]);
    equal(discussionAnchor?.discussionAnchorId, "discussion-anchor-001");
    equal(discussionAnchor?.organizationId, "org-lfg");
    equal(discussionAnchor?.projectId, "project-agentic-org");
    equal(discussionAnchor?.teamId, "team-runtime");
    equal(discussionAnchor?.workItemId, "work-runtime-001");
    equal(discussionAnchor?.discussionAnchorType, DiscussionAnchorType.WorkItem);
    deepEqual(discussionAnchor?.expectedOutputs, [DiscussionExpectedOutput.Decision]);
    deepEqual(discussionAnchor?.createdBy, {
      agentId: "agent-em-001",
      hatAssignmentId: "hat-assignment-em-001",
    });
    equal(discussionAnchor?.metadata.version, 1);
  });

  test("rejects malformed durable expected output JSON instead of trusting scalar includes", async () => {
    const executor = createRecordingExecutor({
      expectedOutputs: DiscussionExpectedOutput.Decision,
    });
    const store = createCockroachDiscussionAnchorStateStore({
      executor,
    });

    const discussionAnchor = await store.findDiscussionAnchor("discussion-anchor-001");

    equal(discussionAnchor, undefined);
  });
});

function createRecordingExecutor(
  input: { expectedOutputs?: unknown } = {},
): CockroachDiscussionAnchorSqlExecutor & {
  statements: CockroachDiscussionAnchorSqlStatement[];
} {
  const statements: CockroachDiscussionAnchorSqlStatement[] = [];

  return {
    statements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachDiscussionAnchorSqlStatement) => {
      statements.push(statement);

      return {
        rows: [
          {
            discussion_anchor_id: "discussion-anchor-001",
            organization_id: "org-lfg",
            project_id: "project-agentic-org",
            team_id: "team-runtime",
            work_item_id: "work-runtime-001",
            discussion_anchor_type: DiscussionAnchorType.WorkItem,
            title: "Review evidence",
            purpose: "Decide whether review evidence is sufficient.",
            expected_outputs: input.expectedOutputs ?? [DiscussionExpectedOutput.Decision],
            created_by_agent_id: "agent-em-001",
            created_by_hat_assignment_id: "hat-assignment-em-001",
            created_at: "2026-05-29T00:30:00.000Z",
            updated_at: "2026-05-29T00:30:00.000Z",
            version: "1",
            correlation_id: "corr-001",
            causation_id: "cause-001",
            trace_id: "trace-001",
          },
        ] as readonly unknown[] as readonly Row[],
      } satisfies CockroachDiscussionAnchorSqlResult<Row>;
    },
  };
}
