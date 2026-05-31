import { equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  allEvidenceRefsContentAddressed,
  createContentAddressedEvidenceArtifact,
  createContentAddressedEvidenceRef,
  isContentAddressedEvidenceRef,
  verifiedContentAddressedEvidenceRefs,
} from "../src/index.ts";

describe("content-addressed evidence", () => {
  test("creates a stable sha256 evidence ref from canonical payload content", () => {
    const left = createContentAddressedEvidenceRef("test-run", {
      command: "npm test",
      passed: true,
      files: ["packages/application/test/content-addressed-evidence.test.ts"],
    });
    const right = createContentAddressedEvidenceRef("test-run", {
      files: ["packages/application/test/content-addressed-evidence.test.ts"],
      passed: true,
      command: "npm test",
    });

    equal(left, right);
    equal(/^evidence:test-run:sha256:[0-9a-f]{64}$/.test(left), true);
  });

  test("distinguishes payload content and rejects plain artifact labels", () => {
    const left = createContentAddressedEvidenceRef("test-run", { passed: true });
    const right = createContentAddressedEvidenceRef("test-run", { passed: false });

    equal(left === right, false);
    equal(isContentAddressedEvidenceRef(left), true);
    equal(isContentAddressedEvidenceRef("qa-report-001"), false);
    equal(allEvidenceRefsContentAddressed([left, right]), true);
    equal(allEvidenceRefsContentAddressed([left, "qa-report-001"]), false);
  });

  test("verifies refs by recomputing the payload digest", () => {
    const artifact = createContentAddressedEvidenceArtifact("test-run", { passed: true });
    const forged = { ...artifact, ref: `evidence:test-run:sha256:${"a".repeat(64)}` };
    const verified = verifiedContentAddressedEvidenceRefs([artifact, forged]);

    equal(verified.has(artifact.ref), true);
    equal(verified.has(forged.ref), false);
  });
});
