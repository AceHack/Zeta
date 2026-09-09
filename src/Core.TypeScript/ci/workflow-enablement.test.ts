// workflow-enablement.test.ts -- falsifiers for the disabled-workflow detector.
//
// EVERY TEST HERE CARRIES ITS MUTATION CONTROL. A falsifier that only ever sees the
// failing input cannot tell you it discriminates; the paired green case is what proves
// the red one was earned. This is the repo standing discipline (mutation-runner.ts,
// "a test that survives mutation is not a falsifier") applied by hand at each site.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  type ObservedWorkflow,
  type RegistryEntry,
  enablementAnnotations,
  foldEnablement,
  isRunnable,
  renderEnablementMarkdown,
} from "./workflow-enablement.ts";

const wf = (path: string, state: string): ObservedWorkflow => ({ path, name: path, state });

const entry = (path: string, classification = "unreviewed"): RegistryEntry => ({
  path,
  state: "disabled_manually",
  classification,
  reason: "recorded by the audit that introduced this registry",
});

describe("isRunnable -- allow-list of one, never a deny-list", () => {
  test("active is runnable", () => {
    expect(isRunnable("active")).toBe(true);
  });

  // THE DIRECTION THAT MATTERS. A deny-list of the known disabled states would let a
  // state GitHub adds tomorrow read as runnable -- a workflow that never runs, counted
  // as one that does. The allow-list fails the other way, which is the safe way.
  test.each([["disabled_manually"], ["disabled_inactivity"], ["a_state_github_has_not_invented_yet"], [""]])(
    "{s is NOT runnable",
    (state) => {
      expect(isRunnable(state)).toBe(false);
    },
  );
});

describe("undeclared-disabled -- the next silent disablement", () => {
  const registry = [entry(".github/workflows/known.yml")];

  test("RED: a workflow disabled in the forge and absent from the registry", () => {
    const observed = [
      wf(".github/workflows/known.yml", "disabled_manually"),
      wf(".github/workflows/surprise.yml", "disabled_manually"),
      wf(".github/workflows/gate.yml", "active"),
    ];
    const r = foldEnablement(observed, registry, observed.length);
    expect(r.register).toBe("drift");
    const kinds = r.findings.filter((f) => f.blocking).map((f) => f.kind);
    expect(kinds).toContain("undeclared-disabled");
    const named = r.findings.find((f) => f.kind === "undeclared-disabled");
    expect(named?.path).toBe(".github/workflows/surprise.yml");
  });

  // MUTATION CONTROL. Same shape, one bit flipped: the surprise workflow is active. The
  // check MUST go green here, or the red above was not caused by the disablement.
  test("GREEN (control): the same listing with that workflow active", () => {
    const observed = [
      wf(".github/workflows/known.yml", "disabled_manually"),
      wf(".github/workflows/surprise.yml", "active"),
      wf(".github/workflows/gate.yml", "active"),
    ];
    const r = foldEnablement(observed, registry, observed.length);
    expect(r.register).toBe("ok");
    expect(r.findings.filter((f) => f.blocking)).toHaveLength(0);
  });

  // SECOND CONTROL, mutating the OTHER input. Declaring it must also clear the red --
  // which proves the finding is about the registry disagreeing, not about the count.
  test("GREEN (control): the same listing with that workflow DECLARED", () => {
    const observed = [
      wf(".github/workflows/known.yml", "disabled_manually"),
      wf(".github/workflows/surprise.yml", "disabled_manually"),
    ];
    const declared = [entry(".github/workflows/known.yml"), entry(".github/workflows/surprise.yml")];
    const r = foldEnablement(observed, declared, observed.length);
    expect(r.register).toBe("ok");
    expect(r.unreviewedCount).toBe(2);
  });
});

describe("stale-baseline-now-active -- a roster row that claims a closed gap", () => {
  test("RED: the registry names a workflow the forge reports active", () => {
    const observed = [wf(".github/workflows/back.yml", "active")];
    const r = foldEnablement(observed, [entry(".github/workflows/back.yml")], 1);
    expect(r.register).toBe("drift");
    expect(r.findings.map((f) => f.kind)).toContain("stale-baseline-now-active");
  });

  test("GREEN (control): the same entry while the workflow is still disabled", () => {
    const observed = [wf(".github/workflows/back.yml", "disabled_manually")];
    const r = foldEnablement(observed, [entry(".github/workflows/back.yml")], 1);
    expect(r.register).toBe("ok");
  });
});

describe("baseline-path-absent -- an entry that can never be true", () => {
  test("RED: the registry names a path the forge does not list", () => {
    const observed = [wf(".github/workflows/gate.yml", "active")];
    const r = foldEnablement(observed, [entry(".github/workflows/renamed-away.yml")], 1);
    expect(r.register).toBe("drift");
    expect(r.findings.map((f) => f.kind)).toContain("baseline-path-absent");
  });

  test("GREEN (control): the same entry when the forge does list it", () => {
    const observed = [
      wf(".github/workflows/gate.yml", "active"),
      wf(".github/workflows/renamed-away.yml", "disabled_manually"),
    ];
    const r = foldEnablement(observed, [entry(".github/workflows/renamed-away.yml")], 2);
    expect(r.register).toBe("ok");
  });
});

describe("malformed-entry -- a roster row that records nothing", () => {
  test("RED: an entry with an empty reason", () => {
    const bad: RegistryEntry = {
      path: ".github/workflows/x.yml",
      state: "disabled_manually",
      classification: "unreviewed",
      reason: "   ",
    };
    const r = foldEnablement([wf(".github/workflows/x.yml", "disabled_manually")], [bad], 1);
    expect(r.register).toBe("drift");
    expect(r.findings.map((f) => f.kind)).toContain("malformed-entry");
  });

  test("RED: an entry with an unknown classification", () => {
    const bad: RegistryEntry = {
      path: ".github/workflows/x.yml",
      state: "disabled_manually",
      classification: "probably-fine",
      reason: "a real reason",
    };
    const r = foldEnablement([wf(".github/workflows/x.yml", "disabled_manually")], [bad], 1);
    expect(r.findings.map((f) => f.kind)).toContain("malformed-entry");
  });

  test("GREEN (control): the same entry with a reason and a known classification", () => {
    const ok: RegistryEntry = {
      path: ".github/workflows/x.yml",
      state: "disabled_manually",
      classification: "intentional",
      reason: "retired 2026-09-01; superseded by gate.yml",
    };
    const r = foldEnablement([wf(".github/workflows/x.yml", "disabled_manually")], [ok], 1);
    expect(r.register).toBe("ok");
    expect(r.intentionalCount).toBe(1);
    expect(r.unreviewedCount).toBe(0);
  });
});

// THE DETECTOR'S OWN LIVENESS. These are the tests that stop this file from becoming the
// thing it detects: an empty or short listing must never fold to a clean bill of health.
describe("unmeasured -- a detector that did not look never reports ok", () => {
  test("RED: an empty listing is unmeasured, NOT ok", () => {
    const r = foldEnablement([], [], 0);
    expect(r.register).toBe("unmeasured");
    expect(r.register).not.toBe("ok");
  });

  // THE ONE THAT FIRED FOR REAL. First live run: 105 workflows, page size 100. A
  // single-page read lost five rows, and a registry seeded from it would have been wrong
  // in the direction that matters -- a disabled workflow on page 2 is invisible.
  test("RED: a truncated listing is unmeasured, NOT ok", () => {
    const observed = [wf(".github/workflows/a.yml", "active")];
    const r = foldEnablement(observed, [], 105);
    expect(r.register).toBe("unmeasured");
    expect(r.reasons.join(" ")).toContain("TRUNCATED");
  });

  // MUTATION CONTROL for the truncation guard: the same rows, an honest total.
  test("GREEN (control): a complete listing folds normally", () => {
    const observed = [wf(".github/workflows/a.yml", "active")];
    const r = foldEnablement(observed, [], 1);
    expect(r.register).toBe("ok");
  });

  // A truncated listing must not be allowed to MANUFACTURE findings either -- otherwise
  // a flaky page would print a fake baseline-path-absent for every registry row.
  test("a truncated listing yields NO findings at all", () => {
    const observed = [wf(".github/workflows/a.yml", "active")];
    const r = foldEnablement(observed, [entry(".github/workflows/b.yml")], 9);
    expect(r.findings).toHaveLength(0);
  });

  test("the unmeasured register annotates as an ERROR, never a warning", () => {
    const lines = enablementAnnotations(foldEnablement([], [], 0));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l.startsWith("::error")).toBe(true);
  });
});

describe("report shape", () => {
  test("known-disabled entries annotate as warnings, blocking ones as errors", () => {
    const observed = [
      wf(".github/workflows/known.yml", "disabled_manually"),
      wf(".github/workflows/surprise.yml", "disabled_manually"),
    ];
    const lines = enablementAnnotations(foldEnablement(observed, [entry(".github/workflows/known.yml")], 2));
    expect(lines.some((l) => l.startsWith("::warning") && l.includes("known.yml"))).toBe(true);
    expect(lines.some((l) => l.startsWith("::error") && l.includes("surprise.yml"))).toBe(true);
  });

  // Idempotency (12) + culture-invariance: same inputs in a different order must produce
  // a byte-identical report, or two runners disagree about a fact neither of them changed.
  test("the report is byte-identical under input reordering", () => {
    const a = [wf(".github/workflows/b.yml", "disabled_manually"), wf(".github/workflows/a.yml", "active")];
    const b = [a[1] as ObservedWorkflow, a[0] as ObservedWorkflow];
    const reg = [entry(".github/workflows/b.yml")];
    expect(renderEnablementMarkdown(foldEnablement(a, reg, 2))).toBe(
      renderEnablementMarkdown(foldEnablement(b, reg, 2)),
    );
  });
});

// THE COMMITTED REGISTRY ITSELF. Hermetic -- reads the file, never the forge. This is what
// keeps a hand-edited row from shipping a malformed entry that only the live job would see.
describe("registry/workflow-enablement.json is well formed", () => {
  const raw = JSON.parse(
    readFileSync(join(import.meta.dir, "..", "..", "..", "registry", "workflow-enablement.json"), "utf8"),
  ) as { readonly entries?: readonly RegistryEntry[] };
  const entries = raw.entries ?? [];

  test("it carries entries", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  test("every entry has a path under .github/workflows/, a reason, and a known classification", () => {
    for (const e of entries) {
      expect(e.path.startsWith(".github/workflows/")).toBe(true);
      expect(e.reason.trim().length).toBeGreaterThan(0);
      expect(["intentional", "unreviewed"]).toContain(e.classification);
    }
  });

  test("no duplicate paths -- a second row for one path is a row nobody reads", () => {
    const seen = new Set<string>();
    for (const e of entries) {
      expect(seen.has(e.path)).toBe(false);
      seen.add(e.path);
    }
  });

  // Folding the committed registry against a synthetic listing that agrees with it must be
  // ok. If this ever goes red, the committed file cannot pass its own audit.
  test("the committed registry folds clean against a listing that matches it", () => {
    const observed = entries.map((e) => wf(e.path, e.state));
    const r = foldEnablement(observed, entries, observed.length);
    expect(r.register).toBe("ok");
  });
});
