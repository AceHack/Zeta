import { equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { AgenticEventType } from "../../domain/src/index.ts";
import { buildAgenticDeadLetterSubject, buildAgenticEventSubject } from "../src/subject-builder.ts";

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

  test("uses a domain-relative event suffix when the event type already carries the domain", () => {
    equal(
      buildAgenticEventSubject({
        environment: "dev",
        organizationId: "org-lfg",
        domain: "work_item",
        eventType: AgenticEventType.WorkItemChanged,
      }),
      "agentic-org.dev.org-lfg.work_item.changed",
    );
  });

  test("uses organization-scoped dead-letter subjects", () => {
    equal(
      buildAgenticDeadLetterSubject({
        environment: "dev",
        organizationId: "org-lfg",
        reason: "invalid_envelope",
      }),
      "agentic-org.dev.org-lfg.dead_letter.invalid_envelope",
    );
  });
});
