import { describe, expect, it } from "bun:test";
import { OWN_MODEL } from "./own-model.ts";

describe("own-model — local online learner, not a vendor chat backend", () => {
  it("is local, not chat-completions, and points at the in-tree BNN surfaces", () => {
    expect(OWN_MODEL.id).toBe("zeta-bnn");
    expect(OWN_MODEL.kind).toBe("online-learner");
    expect(OWN_MODEL.execution).toBe("local");
    expect(OWN_MODEL.chatCompletions).toBe(false);
    expect(OWN_MODEL.surfaces.fsharpMinimal).toBe("src/Bayesian/MinimalBnn.fs");
    expect(OWN_MODEL.surfaces.tsStudentT).toBe("src/Core.TypeScript/planning/student-t-bnn.ts");
  });

  it("is not a paid-login roster id (those stay account OAuth)", () => {
    expect(OWN_MODEL.id).not.toBe("openai");
    expect(OWN_MODEL.id).not.toBe("grok");
    expect(OWN_MODEL.id).not.toBe("manus");
  });
});
