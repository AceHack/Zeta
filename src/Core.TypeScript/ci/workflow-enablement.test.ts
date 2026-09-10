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
  REJECTED_PATH,
  REJECTED_STATE,
  foldEnablement,
  isRunnable,
  sanitizeObservation,
  renderEnablementMarkdown,
  countsFromReport,
  renderEnablementSummary,
} from "./workflow-enablement.ts";

const wf = (path: string, state: string): ObservedWorkflow => ({ path, state });

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

// CodeQL alert 930 (`js/http-to-file-access`): main() writes the rendered report to
// $GITHUB_STEP_SUMMARY and every string in it descends from a network fetch. These pin the
// boundary. Each rejection case is paired with an ACCEPT control, because a sanitiser that
// rejects everything closes the query and destroys the tool.
describe("sanitizeObservation -- nothing unvalidated reaches a file", () => {
  test("ACCEPT (control): a real workflow row passes through byte-identical", () => {
    const out = sanitizeObservation({ path: ".github/workflows/gate.yml", state: "active" });
    expect(out.path).toBe(".github/workflows/gate.yml");
    expect(out.state).toBe("active");
  });

  test("ACCEPT (control): every state GitHub actually uses is admitted", () => {
    for (const state of ["active", "disabled_manually", "disabled_inactivity"]) {
      expect(sanitizeObservation({ path: ".github/workflows/a.yml", state }).state).toBe(state);
    }
  });

  test("ACCEPT (control): .yaml and dashes/dots/underscores in the filename", () => {
    for (const p of [
      ".github/workflows/a.yaml",
      ".github/workflows/build-ai-cluster-iso.yml",
      ".github/workflows/a_b.c-d.yml",
    ]) {
      expect(sanitizeObservation({ path: p, state: "active" }).path).toBe(p);
    }
  });

  test.each([
    ["../../etc/passwd"],
    [".github/workflows/../../../etc/passwd"],
    ["/etc/passwd"],
    ["src/Core.TypeScript/ci/workflow-enablement.ts"],
    [".github/workflows/a.yml\ninjected: line"],
    [".github/workflows/a.yml | rm -rf /"],
    [".github/workflows/`whoami`.yml"],
    [""],
  ])("REJECT: a path that is not a workflow path -- {s", (path) => {
    expect(sanitizeObservation({ path, state: "active" }).path).toBe(REJECTED_PATH);
  });

  test.each([["ACTIVE"], ["active\ndisabled"], ["active; rm -rf /"], ["<b>active</b>"], [""]])(
    "REJECT: a state outside the allowlist -- {s",
    (state) => {
      expect(sanitizeObservation({ path: ".github/workflows/a.yml", state }).state).toBe(REJECTED_STATE);
    },
  );

  // THE DIRECTION THAT MATTERS. Both substitutions must FAIL CLOSED: the rejection must
  // never be the thing that makes a check pass.
  test("a rejected state is NOT runnable", () => {
    expect(isRunnable(REJECTED_STATE)).toBe(false);
    expect(REJECTED_STATE).not.toBe("active");
  });

  test("a rejected path matches no registry entry, so it reports LOUD", () => {
    const rejected = sanitizeObservation({ path: "../../etc/passwd", state: "disabled_manually" });
    const r = foldEnablement([rejected], [entry(".github/workflows/known.yml")], 1);
    expect(r.register).toBe("drift");
    expect(r.findings.map((f) => f.kind)).toContain("undeclared-disabled");
  });

  test("the patterns are ANCHORED -- a prefix match is not a match", () => {
    const out = sanitizeObservation({
      path: "evil/.github/workflows/a.yml",
      state: "active-ish",
    });
    expect(out.path).toBe(REJECTED_PATH);
    expect(out.state).toBe(REJECTED_STATE);
  });

  test("length is bounded -- an enormous path is rejected, not written", () => {
    const huge = ".github/workflows/" + "a".repeat(500) + ".yml";
    expect(sanitizeObservation({ path: huge, state: "active" }).path).toBe(REJECTED_PATH);
  });
});

// The step summary is a FILE WRITE, so nothing network-derived may appear in it
// (CodeQL js/http-to-file-access, alert 930).
describe("renderEnablementSummary -- nothing network-derived reaches the file", () => {
  const observed = [
    wf(".github/workflows/known.yml", "disabled_manually"),
    wf(".github/workflows/surprise.yml", "disabled_manually"),
    wf(".github/workflows/gate.yml", "active"),
  ];
  const report = foldEnablement(observed, [entry(".github/workflows/known.yml")], 3);

  test("carries the counts and the register", () => {
    const out = renderEnablementSummary(countsFromReport(report));
    expect(out).toContain("drift");
    expect(out).toContain("| active (runnable) | 1 |");
    expect(out).toContain("| blocking findings | 1 |");
  });

  test("contains NO workflow path from the observation set", () => {
    const out = renderEnablementSummary(countsFromReport(report));
    for (const w of observed) expect(out).not.toContain(w.path);
  });

  test("contains no observed STATE string either", () => {
    const out = renderEnablementSummary(countsFromReport(report));
    expect(out).not.toContain("disabled_manually");
  });

  // MUTATION CONTROL. The full markdown DOES carry those strings -- which is why it goes
  // to stdout and never to the file. Without this, the test above would pass just as well
  // against an empty string.
  test("GREEN (control): the stdout markdown DOES carry them", () => {
    const full = renderEnablementMarkdown(report);
    expect(full).toContain(".github/workflows/surprise.yml");
    expect(full).toContain("disabled_manually");
  });

  test("the detail still reaches the annotations, which are not a file", () => {
    const lines = enablementAnnotations(report).join("\n");
    expect(lines).toContain(".github/workflows/surprise.yml");
  });
});
