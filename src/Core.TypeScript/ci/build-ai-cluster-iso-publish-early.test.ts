// build-ai-cluster-iso-publish-early.test.ts -- falsifiers for the `publish_iso_early`
// workflow_dispatch input of .github/workflows/build-ai-cluster-iso.yml.
//
// THE PROBLEM IT PINS (measured, run 36907804039): `Build installer ISO` finished at
// 19:03 and the ISO was published at 21:54, because Locate / cosign / upload ran at the
// END of the job, after ~2h50m of dispatch-only QEMU scenarios. `publish_iso_early`
// moves that block to right after the post-build audit, opt-in.
//
// HOW THESE TESTS WORK. A workflow `if:` is an expression, and "exactly one copy runs"
// is a property of the EXPRESSIONS taken together, not of any one line. So instead of
// grepping, this file parses the workflow and SIMULATES the build job's step list under
// each event/input/failure combination, evaluating each step's real `if:` text. The
// evaluator is deliberately tiny (GitHub expression syntax used by this job is a JS
// subset) and REFUSES a reference to a step id that does not exist: GitHub evaluates
// `steps.typo.outcome` to null without complaint, which would silently turn a guard
// into `false` -- exactly the failure this refusal makes loud.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { parse } from "yaml";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const WORKFLOW_PATH = ".github/workflows/build-ai-cluster-iso.yml";
const RAW = readFileSync(join(REPO_ROOT, WORKFLOW_PATH), "utf-8");

interface Step {
  name?: string;
  id?: string;
  if?: string | boolean;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
  "continue-on-error"?: boolean;
  "working-directory"?: string;
}

interface Workflow {
  on: { workflow_dispatch: { inputs: Record<string, { type: string; default: unknown }> } };
  jobs: { build: { steps: Step[] } };
}

const doc = parse(RAW) as Workflow;
const steps = doc.jobs.build.steps;

const idx = (pred: (s: Step) => boolean, what: string): number => {
  const i = steps.findIndex(pred);
  if (i < 0) throw new Error(`step not found: ${what}`);
  return i;
};
const byId = (id: string): number => idx((s) => s.id === id, `id ${id}`);
// By name, EXCLUDING the early copies (their names carry "(early publish)") -- otherwise
// "Locate ISO + capture metadata" would match the early step first and every
// end-of-job assertion below would silently be about the wrong copy.
const byName = (needle: string): number =>
  idx((s) => (s.name ?? "").includes(needle) && !(s.name ?? "").includes("(early publish)"), `name ~ ${needle}`);

const EARLY_IDS = [
  "iso_early",
  "cosign_early",
  "sign_early",
  "upload_iso_early",
  "upload_sha_early",
  "upload_bundle_early",
];
const LATE_PUBLISH_NAMES = [
  "Locate ISO + capture metadata",
  "Install cosign",
  "Sign ISO with cosign (keyless OIDC + Fulcio + Rekor)",
  "Upload ISO as workflow artifact",
  "Upload the ISO digest manifest as a workflow artifact",
  "Upload cosign bundle as workflow artifact",
];
const NOTICE = "Early publish notice";
const GATE = "Early ISO publish must have succeeded";

// ---- the simulator -------------------------------------------------------------

type Outcome = "success" | "failure" | "skipped";

interface Mode {
  event: "push" | "pull_request" | "schedule" | "workflow_dispatch";
  /** undefined = input not present (any non-dispatch event). */
  publishEarly?: boolean;
  onlyWp11?: boolean;
  /** step ids / names (substring) that fail when they run. */
  failing?: string[];
}

interface Result {
  ran: Set<string>; // step display key (id or name) that executed
  outcomes: Record<string, Outcome>;
  jobFailed: boolean;
}

const key = (s: Step): string => s.id ?? s.name ?? "?";

function simulate(mode: Mode): Result {
  const outcomes: Record<string, Outcome> = {};
  for (const s of steps) if (s.id) outcomes[s.id] = "skipped";
  const ran = new Set<string>();
  let jobFailed = false;
  const inputs: Record<string, unknown> = {};
  if (mode.event === "workflow_dispatch") {
    inputs.publish_iso_early = mode.publishEarly ?? false;
    inputs.only_wp11 = mode.onlyWp11 ?? false;
    inputs.only_cluster_ha = false;
  }
  const stepsCtx = new Proxy(outcomes, {
    get(t, id: string) {
      if (!(id in t)) throw new Error(`workflow if: references unknown step id '${id}'`);
      return { outcome: t[id] };
    },
  });
  const ctx = {
    success: () => !jobFailed,
    failure: () => jobFailed,
    always: () => true,
    cancelled: () => false,
    github: { event_name: mode.event },
    inputs,
    steps: stepsCtx,
  };
  const evalIf = (raw: string | boolean | undefined): boolean => {
    if (raw === undefined) return ctx.success();
    if (typeof raw === "boolean") return raw;
    let expr = raw.trim();
    const m = /^\$\{\{([\s\S]*)\}\}$/.exec(expr);
    if (m) expr = m[1]!.trim();
    // A status function anywhere in the expression disables the implicit success().
    const hasStatusFn = /\b(success|failure|always|cancelled)\s*\(/.test(expr);
    // eslint-disable-next-line no-new-func
    const fn = new Function("ctx", `with (ctx) { return (${expr}); }`) as (c: typeof ctx) => unknown;
    const v = Boolean(fn(ctx));
    return hasStatusFn ? v : ctx.success() && v;
  };
  for (const s of steps) {
    // The ISO build is the step whose outcome the publish block keys on; treat every
    // step before the audit as having passed unless the mode says otherwise.
    if (!evalIf(s.if)) continue;
    const k = key(s);
    ran.add(k);
    const fails = (mode.failing ?? []).some((f) => k === f || (s.name ?? "").includes(f));
    const outcome: Outcome = fails ? "failure" : "success";
    if (s.id) outcomes[s.id] = outcome;
    if (fails && !s["continue-on-error"]) jobFailed = true;
    if (fails && s["continue-on-error"]) {
      // outcome stays "failure"; the job status does not -- that is continue-on-error.
    }
  }
  return { ran, outcomes, jobFailed };
}

const lateKeys = (): string[] => LATE_PUBLISH_NAMES.map((n) => key(steps[byName(n)]!));

const ranEarly = (r: Result): string[] => EARLY_IDS.filter((id) => r.ran.has(id));
const ranLate = (r: Result): string[] => lateKeys().filter((k) => r.ran.has(k));

// ---- tests ---------------------------------------------------------------------

describe("the input", () => {
  test("publish_iso_early is a boolean that defaults to false", () => {
    const input = doc.on.workflow_dispatch.inputs.publish_iso_early;
    expect(input).toBeDefined();
    expect(input!.type).toBe("boolean");
    expect(input!.default).toBe(false);
  });
});

describe("placement -- the early copy sits between the floor and the first slow scenario", () => {
  test("early publish steps come AFTER the post-build audit", () => {
    const audit = byName("Audit installer ISO content");
    for (const id of EARLY_IDS) expect(byId(id)).toBeGreaterThan(audit);
    expect(byName(NOTICE)).toBeGreaterThan(audit);
  });

  test("early publish steps come BEFORE every QEMU scenario (the whole point)", () => {
    const lastEarly = Math.max(...EARLY_IDS.map(byId), byName(NOTICE));
    const slow = [
      "Install QEMU + zflash toolchain",
      "scenario 1",
      "scenario 2",
      "UEFI keyfile restore decrypt",
      "wifi ESP acceptance",
      "UEFI keyfile install-time write",
      "UEFI keyfile picker bind",
      "scenario 3",
      "scenario 4",
      "WP11 — installed-disk first-boot k3s verify",
    ];
    for (const n of slow) expect(byName(n)).toBeGreaterThan(lastEarly);
  });

  test("the end-of-job copies are still at the END, after WP11", () => {
    const wp11 = byName("WP11 — installed-disk first-boot k3s verify");
    for (const n of LATE_PUBLISH_NAMES) expect(byName(n)).toBeGreaterThan(wp11);
  });

  test("the early copy is not placed before the build or the audit could have failed the job", () => {
    expect(byId("iso_early")).toBeGreaterThan(byId("iso_build"));
  });
});

describe("one copy per mode -- simulated over the real `if:` expressions", () => {
  test.each([
    ["push", { event: "push" }],
    ["pull_request", { event: "pull_request" }],
    ["schedule", { event: "schedule" }],
    ["dispatch, input false", { event: "workflow_dispatch", publishEarly: false }],
    ["dispatch, input false + only_wp11", { event: "workflow_dispatch", publishEarly: false, onlyWp11: true }],
  ] as [string, Mode][])("DEFAULT (%s): the six end-of-job steps run, no early step does", (_label, mode) => {
    const r = simulate(mode);
    expect(ranEarly(r)).toEqual([]);
    expect(r.ran.has(NOTICE)).toBe(false);
    expect(ranLate(r)).toHaveLength(LATE_PUBLISH_NAMES.length);
    expect(r.ran.has(GATE)).toBe(false);
  });

  test.each([
    ["dispatch", {}],
    ["dispatch + only_wp11", { onlyWp11: true }],
  ] as [string, Partial<Mode>][])("EARLY (%s): the six early steps run, no end-of-job copy does", (_label, extra) => {
    const r = simulate({ event: "workflow_dispatch", publishEarly: true, ...extra });
    expect(ranEarly(r).sort()).toEqual([...EARLY_IDS].sort());
    expect(ranLate(r)).toEqual([]);
    expect(r.ran.has(key(steps[byName(NOTICE)]!))).toBe(true);
    expect(r.ran.has(GATE)).toBe(false);
    expect(r.jobFailed).toBe(false);
  });

  test("EARLY, and the dispatch-only scenarios still run afterwards (they still decide the verdict)", () => {
    const r = simulate({ event: "workflow_dispatch", publishEarly: true });
    for (const n of ["scenario 3", "scenario 4", "WP11 — installed-disk first-boot k3s verify"]) {
      expect(r.ran.has(key(steps[byName(n)]!))).toBe(true);
    }
  });

  test("EARLY, a scenario fails: the ISO is already published and the job is red", () => {
    const r = simulate({ event: "workflow_dispatch", publishEarly: true, failing: ["scenario 4"] });
    expect(ranEarly(r)).toHaveLength(EARLY_IDS.length);
    expect(ranLate(r)).toEqual([]);
    expect(r.jobFailed).toBe(true);
  });

  test("EARLY, the early sign step fails: no second copy, scenarios still run, job ends red", () => {
    const r = simulate({ event: "workflow_dispatch", publishEarly: true, failing: ["sign_early"] });
    expect(ranLate(r)).toEqual([]); // no double publish after a half-published run
    expect(r.ran.has(key(steps[byName("scenario 3")]!))).toBe(true); // continue-on-error kept them alive
    expect(r.ran.has(key(steps[byName(GATE)]!))).toBe(true); // ...and the gate re-fails the job
    expect(r.ran.has("upload_bundle_early")).toBe(false); // nothing to upload without a bundle
    expect(r.ran.has("upload_iso_early")).toBe(true);
  });

  test("EARLY, the early locate fails: no second copy either, and the gate fires", () => {
    const r = simulate({ event: "workflow_dispatch", publishEarly: true, failing: ["iso_early"] });
    expect(ranLate(r)).toEqual([]);
    expect(r.ran.has(key(steps[byName(GATE)]!))).toBe(true);
  });

  test("EARLY but the floor (audit) FAILED: early never starts and the end-of-job copy runs as it always did", () => {
    const r = simulate({
      event: "workflow_dispatch",
      publishEarly: true,
      failing: ["Audit installer ISO content"],
    });
    expect(ranEarly(r)).toEqual([]);
    expect(ranLate(r)).toHaveLength(LATE_PUBLISH_NAMES.length);
  });

  test("DEFAULT with the floor failed behaves as before: the end-of-job copy still publishes", () => {
    const r = simulate({
      event: "workflow_dispatch",
      publishEarly: false,
      failing: ["Audit installer ISO content"],
    });
    expect(ranEarly(r)).toEqual([]);
    expect(ranLate(r)).toHaveLength(LATE_PUBLISH_NAMES.length);
  });

  test("EARLY is dispatch-only: every early step names the event, not just the input", () => {
    // Even if `inputs` somehow carried the flag on another event, the event guard holds.
    for (const s of steps.filter((x) => EARLY_IDS.includes(x.id ?? ""))) {
      expect(String(s.if)).toContain("github.event_name == 'workflow_dispatch'");
    }
  });
});

describe("the two copies do not drift", () => {
  const code = (run: string): string =>
    run
      .split("\n")
      .map((l) => l.trimEnd())
      .filter((l) => l.trim() !== "" && !l.trim().startsWith("#"))
      .join("\n");

  test("early locate runs the same code as the end-of-job locate", () => {
    const late = steps[byName("Locate ISO + capture metadata")]!;
    const early = steps[byId("iso_early")]!;
    expect(code(early.run!)).toBe(code(late.run!));
    expect(early["working-directory"]).toBe(late["working-directory"]);
  });

  test("early sign runs the same code as the end-of-job sign (same signing identity)", () => {
    const late = steps[byId("sign")]!;
    const early = steps[byId("sign_early")]!;
    expect(code(early.run!)).toBe(code(late.run!));
    const norm = (v: unknown): string => JSON.stringify(v).replaceAll("steps.iso_early", "steps.iso");
    expect(norm(early.env)).toBe(norm(late.env));
  });

  test("early cosign install pins the same action", () => {
    expect(steps[byId("cosign_early")]!.uses).toBe(steps[byName("Install cosign")]!.uses);
  });

  test.each([
    ["upload_iso_early", "Upload ISO as workflow artifact"],
    ["upload_sha_early", "Upload the ISO digest manifest as a workflow artifact"],
    ["upload_bundle_early", "Upload cosign bundle as workflow artifact"],
  ])("%s publishes the same artifact name/path/retention as the end-of-job upload", (earlyId, lateName) => {
    const early = steps[byId(earlyId)]!;
    const late = steps[byName(lateName)]!;
    expect(early.uses).toBe(late.uses);
    const norm = (v: unknown): string =>
      JSON.stringify(v).replaceAll("steps.iso_early", "steps.iso").replaceAll("steps.sign_early", "steps.sign");
    expect(norm(early.with)).toBe(norm(late.with));
  });
});

describe("the notice and the loud failure", () => {
  test("the early step summary carries the verdict warning verbatim", () => {
    const notice = steps[byName(NOTICE)]!;
    expect(notice.run).toContain(
      "ISO published BEFORE the dispatch-only scenarios ran: treat the run conclusion as the verdict on this ISO",
    );
  });

  test("the notice is emitted only after ALL three uploads succeeded", () => {
    const cond = String(steps[byName(NOTICE)]!.if);
    for (const id of ["upload_iso_early", "upload_sha_early", "upload_bundle_early"]) {
      expect(cond).toContain(`steps.${id}.outcome == 'success'`);
    }
  });

  test("every continue-on-error early step is covered by the closing gate", () => {
    const gate = String(steps[byName(GATE)]!.if);
    for (const s of steps) {
      if (s["continue-on-error"] && EARLY_IDS.includes(s.id ?? "")) {
        expect(gate).toContain(`steps.${s.id}.outcome == 'failure'`);
      }
    }
  });
});

describe("no existing gate is weakened", () => {
  test("the end-of-job copies keep their original conditions as a prefix", () => {
    const originals: [string, string][] = [
      ["Locate ISO + capture metadata", "!cancelled() && steps.iso_build.outcome == 'success'"],
      ["Install cosign", "!cancelled() && steps.iso.outcome == 'success'"],
      ["Sign ISO with cosign (keyless OIDC + Fulcio + Rekor)", "!cancelled() && steps.iso.outcome == 'success'"],
      ["Upload ISO as workflow artifact", "!cancelled() && steps.iso.outcome == 'success'"],
      ["Upload the ISO digest manifest as a workflow artifact", "!cancelled() && steps.iso.outcome == 'success'"],
      ["Upload cosign bundle as workflow artifact", "!cancelled() && steps.sign.outcome == 'success'"],
    ];
    for (const [name, prefix] of originals) {
      const cond = String(steps[byName(name)]!.if);
      expect(cond).toContain(prefix);
      expect(cond).toContain("steps.iso_early.outcome == 'skipped'");
    }
  });

  test("the cosign OIDC permission is still job-scoped", () => {
    expect(RAW).toContain("id-token: write");
  });
});
