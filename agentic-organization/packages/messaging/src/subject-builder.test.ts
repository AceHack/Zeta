import { equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { AgenticEventType } from "../../domain/src/index.ts";
import { buildAgenticEventSubject } from "./subject-builder.ts";

describe("agentic event NATS subjects", () => {
  test("uses a stable organization-scoped subject shape", () => {
    equal(
      buildAgenticEventSubject({
        environment: "dev",
        organizationId: "org-lfg",
        domain: "work",
        eventType: AgenticEventType.WorkItemChanged,
      }),
      "agentic-org.dev.org-lfg.work.work_item.changed",
    );
  });
});
