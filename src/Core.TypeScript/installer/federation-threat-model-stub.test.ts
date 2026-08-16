import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import {
  EXAMPLE_APERTURE_LODGE_STUB,
  emptyFederationThreatModelStub,
  validateFederationThreatModelStub,
} from "./federation-threat-model-stub.ts";

const TEMPLATE_PATH = join(
  import.meta.dir,
  "../../../docs/security/federation-threat-model-stub.TEMPLATE.md",
);

describe("validateFederationThreatModelStub", () => {
  it("accepts the Aperture Lodge example fill", () => {
    const result = validateFederationThreatModelStub(EXAMPLE_APERTURE_LODGE_STUB);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects an empty template (not yet filled)", () => {
    const result = validateFederationThreatModelStub(
      emptyFederationThreatModelStub("example-lodge", "Example Lodge"),
    );
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("missing charterRef");
    expect(result.errors).toContain(
      "exitPaths must contain at least one path (Universal Exit Principle)",
    );
  });

  it("rejects a fake federation that forbids exit", () => {
    const trapped: typeof EXAMPLE_APERTURE_LODGE_STUB = {
      ...EXAMPLE_APERTURE_LODGE_STUB,
      scaleAnswers: {
        ...EXAMPLE_APERTURE_LODGE_STUB.scaleAnswers,
        whoCanLeave: "never",
      },
    };
    const result = validateFederationThreatModelStub(trapped);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("scaleAnswers.whoCanLeave cannot forbid exit");
  });

  it("rejects a non-slug federationId", () => {
    const result = validateFederationThreatModelStub({
      ...EXAMPLE_APERTURE_LODGE_STUB,
      federationId: "Aperture Lodge",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("federationId must be a lowercase kebab slug");
  });

  it("keeps the markdown template aligned with §3 questions", () => {
    const text = readFileSync(TEMPLATE_PATH, "utf8");
    expect(text).toContain("Who am I?");
    expect(text).toContain("Who can join?");
    expect(text).toContain("Who can leave?");
    expect(text).toContain("What is secret?");
    expect(text).toContain("What is enforceable?");
    expect(text).toContain("Universal Exit Principle");
  });
});
