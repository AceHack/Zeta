// src/Core.TypeScript/cluster/reason-truth.test.ts
//
// THE BAR THIS FILE HAS TO CLEAR, and it is not "the checker runs".
//
// A guard that cannot catch the instances that motivated it has not been shown
// to work. Two reasons in this repo were measured FALSE within a day of being
// written, and both audits over them stayed green:
//
//   temporal  #13472's reason cited a `helm-template-failed` acknowledgement
//             that #13469 had already deleted, forty minutes earlier.
//   oz        `ACKNOWLEDGED_UNPUBLISHED`'s entry reasoned about chart versions
//             against a pin that #13471 then corrected, and the "not drop-in"
//             claim inside it turned out to be false when someone rendered all
//             four versions.
//
// Both are reconstructed below AS THEY STOOD, and the checker is run against
// TODAY'S tree. It goes red on both.
//
// -- THE HONEST PART OF THE RECONSTRUCTION --------------------------------
// The historical reasons were free prose; they carried no `[cite: ...]`. So
// each reconstruction below appends the citations that TRANSCRIBE the claims
// the sentence already makes -- "carried as an acknowledged helm-template-failed
// row in its baseline" becomes `[cite: unrenderable full-ai-cluster/temporal
// helm-template-failed]`, and nothing else. The transcription is mine; the
// TRUTH VALUE is the tree's, and the tree is what refutes them. What this
// demonstrates is therefore precise, and it is worth saying rather than
// implying: a reason whose claims are written as citations is refutable by a
// program, and these two would have been refuted the moment they merged. It
// does not demonstrate that a program can read the prose they were written in.
// Nothing here can do that, which is why `uncited` is counted and printed.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APPLIED_BUT_UNASSERTED_REASONS, DEV_EXCLUDED_REASONS } from "./argocd-health-test.ts";
import {
  auditReasonTruth,
  checkCitation,
  extractCitations,
  formatReasonTruthReport,
  loadEvidence,
  normalizeJobName,
  reasonTruthExitCode,
  splitCitationArgs,
  subjectsFromAppRegistry,
  type Citation,
  type Evidence,
  type ReasonSubject,
} from "./reason-truth.ts";
import { loadSnapshot, snapshotDrift, type RenderSnapshot } from "./rendered-storage-claims.ts";

const EVIDENCE = loadEvidence();

function subject(key: string, text: string, appId = `full-ai-cluster/${key}`): ReasonSubject {
  return { key, appId, text, registry: "RECONSTRUCTED" };
}

function only(citation: string): Citation {
  const parsed = extractCitations(citation);
  expect(parsed.malformed).toEqual([]);
  expect(parsed.citations.length).toBe(1);
  return parsed.citations[0] as Citation;
}

function rulesFor(subjects: readonly ReasonSubject[]): readonly string[] {
  const report = auditReasonTruth(subjects, EVIDENCE);
  return [...report.refuted, ...report.unbound].map((finding) => finding.rule);
}

// ---------------------------------------------------------------------------
// THE TWO HISTORICAL CASES
// ---------------------------------------------------------------------------

/**
 * `temporal`'s reason exactly as #13472 merged it, with its own claims written
 * as citations. #13469 had already landed the datastore wiring, re-measured the
 * render as OK, and removed the baseline row this sentence rests on.
 */
const TEMPORAL_REASON_AS_MERGED_BY_13472 =
  "ITS CHART HAS NO PERSISTENCE STORE CONFIGURED, so it does not render. Application.yaml sets " +
  "`cassandra.enabled: false` and leaves the CockroachDB SQL block COMMENTED OUT beneath it, which " +
  "leaves temporal 0.59.0 with a default store it cannot describe: `helm template` fails with " +
  "`execution error at (temporal/templates/server-job.yaml:73:18): Please specify cassandra port for " +
  "default store` -- measured by `rendered-storage-claims.ts` and carried as an acknowledged " +
  "`helm-template-failed` row in its baseline. " +
  "LIFTS WHEN: the `persistence` block is UNCOMMENTED against a reachable store, so the chart renders. " +
  "[cite: unrenderable full-ai-cluster/temporal helm-template-failed] " +
  "[cite: renders-not full-ai-cluster/temporal] " +
  "[cite: chart-pin full-ai-cluster/temporal temporal 0.59.0]";

/**
 * `oz`'s acknowledgement exactly as it stood in `ACKNOWLEDGED_UNPUBLISHED`
 * before #13471, with its claims written as citations. Its key named the pin
 * `1.4.5`; the manifest now pins 3.1.1.
 */
const OZ_ACKNOWLEDGEMENT_BEFORE_13471 =
  "The defect this audit was written for. OpenZiti's ziti-controller 1.x line ends at " +
  "1.3.4 and 1.4.5 was never published (1.4.2 exists in that repository only as an " +
  "appVersion). The replacement is not mechanical -- 1.3.4 is the newest 1.x, while " +
  "separate 2.x and 3.x lines exist and are not drop-in for the pinned values in this " +
  "manifest -- so the version is the maintainer's call and is left to PR #13313. " +
  "[cite: chart-pin full-ai-cluster/oz ziti-controller 1.4.5] " +
  "[cite: unpublished ziti-controller 1.4.5]";

/** `gitlab`'s reason as it stood on `main` at c9ba64e4, hours before this change. */
const GITLAB_REASON_BEFORE_THIS_CHANGE =
  "TWO independent blockers, either alone sufficient. (1) IT DOES NOT EVEN RENDER: `helm template` of " +
  "charts.gitlab.io/gitlab 8.7.0 against this Application's own valuesObject fails with `execution error " +
  "at (gitlab/charts/certmanager-issuer/templates/cert-manager.yml:14:3): You must provide an email to " +
  "associate with your TLS certificates` -- measured by `rendered-storage-claims.ts` and carried as an " +
  "acknowledged `helm-template-failed` row in its baseline. " +
  "[cite: unrenderable full-ai-cluster/gitlab helm-template-failed] " +
  "[cite: renders-not full-ai-cluster/gitlab]";

describe("the historical cases this checker exists for", () => {
  test("temporal as #13472 merged it: the cited acknowledgement was already gone", () => {
    const report = auditReasonTruth([subject("temporal", TEMPORAL_REASON_AS_MERGED_BY_13472)], EVIDENCE);
    expect(reasonTruthExitCode(report)).toBe(1);
    const rules = report.refuted.map((finding) => finding.rule);
    // TWO independent refutations of the same sentence, from two artifacts.
    expect(rules).toContain("cited-acknowledgement-retired");
    expect(rules).toContain("render-claim-refuted");
    // And the detail has to say WHICH artifact, or a red gate teaches nothing.
    const retired = report.refuted.find((finding) => finding.rule === "cited-acknowledgement-retired");
    expect(retired?.detail).toContain("no unrenderable acknowledgement for full-ai-cluster/temporal");
  });

  test("temporal's chart-pin clause is still TRUE, and stays green -- the check discriminates", () => {
    // The whole risk in a checker like this is that it reddens everything old.
    // The same reconstructed reason carries a claim that has NOT expired (the
    // chart is still pinned at 0.59.0) and that citation holds.
    const verdict = checkCitation(
      only("[cite: chart-pin full-ai-cluster/temporal temporal 0.59.0]"),
      EVIDENCE,
      subject("temporal", ""),
    );
    expect(verdict).toBeNull();
  });

  test("oz's acknowledgement before #13471: the reason outlived the pin it was written about", () => {
    const report = auditReasonTruth([subject("oz", OZ_ACKNOWLEDGEMENT_BEFORE_13471)], EVIDENCE);
    expect(reasonTruthExitCode(report)).toBe(1);
    const moved = report.refuted.find((finding) => finding.rule === "cited-pin-moved");
    expect(moved).toBeDefined();
    expect(moved?.detail).toContain("pins ziti-controller at 3.1.1");
  });

  test("oz's OTHER clause was true then and is true now, so it is not refuted", () => {
    // `1.4.5 was never published` is still correct -- the roster lists 96
    // ziti-controller versions and that is not one of them. A checker that
    // reddened this clause too would be measuring age, not truth.
    const report = auditReasonTruth([subject("oz", OZ_ACKNOWLEDGEMENT_BEFORE_13471)], EVIDENCE);
    expect(report.refuted.map((finding) => finding.rule)).not.toContain("cited-version-published");
    expect(checkCitation(only("[cite: unpublished ziti-controller 1.4.5]"), EVIDENCE, subject("oz", ""))).toBeNull();
  });

  test("what this does NOT catch on oz, stated as a test so it cannot be forgotten", () => {
    // The clause that was actually FALSE -- "not drop-in for the pinned values"
    // -- is a claim about chart behaviour under four versions, and no artifact
    // in this tree records it. `helm template` of all four was run by a person,
    // once, in #13471. So the honest scope is: this file catches the ANCHOR
    // drift (the pin moved), never the prose. A reason built only of that
    // clause carries no citation at all and lands in `uncited`.
    const claimOnly = subject("oz", "separate 2.x and 3.x lines exist and are not drop-in for the pinned values.");
    const report = auditReasonTruth([claimOnly], EVIDENCE);
    expect(report.refuted).toEqual([]);
    expect(report.uncited).toEqual(["oz"]);
  });

  test("gitlab's reason from this morning: the baseline row was deleted by #13471", () => {
    const report = auditReasonTruth([subject("gitlab", GITLAB_REASON_BEFORE_THIS_CHANGE)], EVIDENCE);
    expect(reasonTruthExitCode(report)).toBe(1);
    const rules = report.refuted.map((finding) => finding.rule);
    expect(rules).toContain("cited-acknowledgement-retired");
    expect(rules).toContain("render-claim-refuted");
  });
});

// ---------------------------------------------------------------------------
// THE LIVE TREE
// ---------------------------------------------------------------------------

describe("the live registries", () => {
  const subjects = [
    ...subjectsFromAppRegistry(DEV_EXCLUDED_REASONS, "DEV_EXCLUDED_REASONS"),
    ...subjectsFromAppRegistry(APPLIED_BUT_UNASSERTED_REASONS, "APPLIED_BUT_UNASSERTED_REASONS"),
  ];

  test("every cited anchor in every reason still holds", () => {
    const report = auditReasonTruth(subjects, EVIDENCE);
    expect(formatReasonTruthReport(report)).toContain("every cited anchor still holds");
    expect(report.refuted).toEqual([]);
    expect(report.unbound).toEqual([]);
  });

  test("the audit is checking a non-trivial number of anchors", () => {
    // A green report over zero citations is the vacuity this file is about.
    const report = auditReasonTruth(subjects, EVIDENCE);
    expect(report.citationsChecked).toBeGreaterThan(30);
    expect(report.subjectsChecked).toBe(DEV_EXCLUDED_REASONS.size + APPLIED_BUT_UNASSERTED_REASONS.size);
  });

  test("no reason in either registry is uncited -- a ratchet, not a claim about prose", () => {
    // Every reason here cites at least one artifact. This is a RATCHET on the
    // two registries as they stand, not an assertion that citing something
    // makes a reason true: the rest of each sentence is still prose, and
    // `uncited` exists precisely because that is not checkable.
    expect(auditReasonTruth(subjects, EVIDENCE).uncited).toEqual([]);
  });

  test("no citation is glued to the sentence before it", () => {
    // A REAL DEFECT, and it was found by review rather than by me: appending
    // the citation block to eleven reasons produced `...is neither.ANCHORS,
    // CHECKED BY...` in the rendered string, because the segment before it
    // ended without a trailing space. Concatenated TypeScript string literals
    // hide it perfectly -- the source reads correctly line by line and only the
    // joined value is wrong, which is why the falsifier asserts on the VALUE.
    for (const [key, reason] of [...DEV_EXCLUDED_REASONS, ...APPLIED_BUT_UNASSERTED_REASONS]) {
      expect(`${key}: ${reason}`).not.toMatch(/\S(ANCHORS|\[cite:)/);
    }
  });

  test("the gitlab reason no longer claims the chart cannot render", () => {
    const reason = DEV_EXCLUDED_REASONS.get("gitlab") ?? "";
    expect(reason).not.toContain("IT DOES NOT EVEN RENDER: `helm template`");
    // The refutation is KEPT rather than the error erased -- the same discipline
    // the temporal correction records, applied to the entry a check found.
    expect(reason).toContain("HALF OF THIS REASON WAS SPENT");
    expect(reason).toContain("nothing in this tree creates that Secret");
    // And the half nobody measured is LABELLED, not quietly promoted.
    expect(reason).toContain("CAPACITY IS CARRIED OVER, NOT MEASURED");
  });
});

// ---------------------------------------------------------------------------
// EACH CITATION KIND, BOTH WAYS
// ---------------------------------------------------------------------------

describe("citation kinds", () => {
  const anywhere = subject("temporal", "");

  test("path: resolves repo-relative and app-relative, and refuses what is gone", () => {
    expect(checkCitation(only("[cite: path infra/README.md]"), EVIDENCE, anywhere)).toBeNull();
    // App-relative: `statefulset.yaml` under the subject's own directory.
    expect(checkCitation(only("[cite: path statefulset.yaml]"), EVIDENCE, subject("agent-memory", ""))).toBeNull();
    expect(checkCitation(only("[cite: path docs/this-file-was-deleted.md]"), EVIDENCE, anywhere)?.rule).toBe(
      "cited-path-missing",
    );
  });

  test("path: a line number past the end of the file is a stale citation", () => {
    expect(checkCitation(only("[cite: path infra/README.md:165]"), EVIDENCE, anywhere)).toBeNull();
    expect(checkCitation(only("[cite: path infra/README.md:99999]"), EVIDENCE, anywhere)?.rule).toBe(
      "cited-line-out-of-range",
    );
  });

  test("unrenderable / no-unrenderable are opposite claims about one artifact", () => {
    expect(checkCitation(only("[cite: no-unrenderable full-ai-cluster/temporal]"), EVIDENCE, anywhere)).toBeNull();
    expect(
      checkCitation(only("[cite: unrenderable full-ai-cluster/temporal helm-template-failed]"), EVIDENCE, anywhere)
        ?.rule,
    ).toBe("cited-acknowledgement-retired");
  });

  test("pvc-class and pvc-total read the measured render", () => {
    expect(checkCitation(only("[cite: pvc-class full-ai-cluster/ollama longhorn]"), EVIDENCE, anywhere)).toBeNull();
    expect(checkCitation(only("[cite: pvc-total full-ai-cluster/ollama 200]"), EVIDENCE, anywhere)).toBeNull();
    expect(checkCitation(only("[cite: pvc-class full-ai-cluster/ollama gp3]"), EVIDENCE, anywhere)?.rule).toBe(
      "cited-storage-class-absent",
    );
    // The number in the prose is the thing that drifts, so it is the thing checked.
    expect(checkCitation(only("[cite: pvc-total full-ai-cluster/ollama 100]"), EVIDENCE, anywhere)?.rule).toBe(
      "cited-total-disagrees",
    );
  });

  test("no-pvc: temporal renders none, gitlab renders four", () => {
    expect(checkCitation(only("[cite: no-pvc full-ai-cluster/temporal]"), EVIDENCE, anywhere)).toBeNull();
    expect(checkCitation(only("[cite: no-pvc full-ai-cluster/gitlab]"), EVIDENCE, anywhere)?.rule).toBe(
      "cited-pvc-absence-contradicted",
    );
  });

  test("chart-pin refuses an app that is not there and a chart it does not source", () => {
    expect(checkCitation(only("[cite: chart-pin full-ai-cluster/nope chart 1.0.0]"), EVIDENCE, anywhere)?.rule).toBe(
      "cited-app-unknown",
    );
    expect(
      checkCitation(only("[cite: chart-pin full-ai-cluster/gitlab not-a-chart 8.7.0]"), EVIDENCE, anywhere)?.rule,
    ).toBe("cited-pin-moved");
  });

  test("published / unpublished, and a chart the roster cannot decide", () => {
    expect(checkCitation(only("[cite: published gitlab 8.7.0]"), EVIDENCE, anywhere)).toBeNull();
    expect(checkCitation(only("[cite: unpublished gitlab 8.7.0]"), EVIDENCE, anywhere)?.rule).toBe(
      "cited-version-published",
    );
    expect(checkCitation(only("[cite: published gitlab 99.0.0]"), EVIDENCE, anywhere)?.rule).toBe(
      "cited-version-unpublished",
    );
    // An undecidable claim is a FINDING, never a pass.
    expect(checkCitation(only("[cite: published no-such-chart 1.0.0]"), EVIDENCE, anywhere)?.rule).toBe(
      "roster-does-not-cover-chart",
    );
  });

  test("glob-defers / glob-applies read the one list that decides what CI applies", () => {
    expect(checkCitation(only("[cite: glob-defers temporal]"), EVIDENCE, anywhere)).toBeNull();
    expect(checkCitation(only("[cite: glob-applies redis]"), EVIDENCE, anywhere)).toBeNull();
    expect(checkCitation(only("[cite: glob-defers redis]"), EVIDENCE, anywhere)?.rule).toBe(
      "cited-glob-deferral-lifted",
    );
    expect(checkCitation(only("[cite: glob-applies temporal]"), EVIDENCE, anywhere)?.rule).toBe(
      "cited-glob-application-refuted",
    );
  });

  test("workflow-job: a renamed lane stops supporting the reason that cited it", () => {
    expect(
      checkCitation(only('[cite: workflow-job k8s-argocd-health-test.yml "live kind Cilium CNI"]'), EVIDENCE, anywhere),
    ).toBeNull();
    expect(
      checkCitation(only('[cite: workflow-job k8s-argocd-health-test.yml "no such job"]'), EVIDENCE, anywhere)?.rule,
    ).toBe("cited-workflow-job-missing");
    expect(checkCitation(only('[cite: workflow-job never-existed.yml "whatever"]'), EVIDENCE, anywhere)?.rule).toBe(
      "cited-workflow-missing",
    );
  });

  test("a matrix expression in a job name is normalised away, not matched loosely", () => {
    expect(normalizeJobName("live kind Cilium CNI (${{ matrix.runner }})")).toBe("live kind Cilium CNI");
    expect(normalizeJobName("gate")).toBe("gate");
  });
});

// ---------------------------------------------------------------------------
// THE GRAMMAR, AND THE HOLE IT WOULD LEAVE WITHOUT `unbound-identifier`
// ---------------------------------------------------------------------------

describe("the citation grammar", () => {
  test("quoted arguments survive, so a job name with spaces is nameable", () => {
    expect(splitCitationArgs('workflow-job file.yml "two words"')).toEqual(["workflow-job", "file.yml", "two words"]);
  });

  test("an unknown kind is MALFORMED, not skipped", () => {
    const parsed = extractCitations("[cite: rendersnot full-ai-cluster/temporal]");
    expect(parsed.citations).toEqual([]);
    expect(parsed.malformed.length).toBe(1);
    expect(parsed.malformed[0]?.detail).toContain("unknown citation kind");
  });

  test("the wrong argument count is MALFORMED -- a typo must not pass as a check", () => {
    const parsed = extractCitations("[cite: unrenderable full-ai-cluster/temporal]");
    expect(parsed.malformed[0]?.detail).toContain("takes 2 argument(s), got 1");
  });

  test("a malformed citation fails the audit", () => {
    expect(rulesFor([subject("temporal", "prose [cite: bogus x]")])).toContain("malformed-citation");
  });

  test("naming a render failure class in prose with no citation is refused", () => {
    // The dodge this closes: write the claim in English, cite nothing, stay
    // green. It is deliberately narrow -- only the CLOSED set of failure classes
    // `rendered-storage-claims.ts` emits.
    const rules = rulesFor([
      subject("temporal", "it carries a helm-template-failed row. LIFTS WHEN: someone fixes it."),
    ]);
    expect(rules).toContain("unbound-identifier");
  });

  test("...and binding a citation for that app satisfies it", () => {
    const bound = subject(
      "temporal",
      "the helm-template-failed row was retired. [cite: no-unrenderable full-ai-cluster/temporal]",
    );
    expect(rulesFor([bound])).toEqual([]);
  });

  test("a citation for a DIFFERENT app does not satisfy the binding", () => {
    // Otherwise any citation anywhere in the paragraph would launder the claim.
    const misbound = subject(
      "temporal",
      "the helm-template-failed row is live. [cite: no-unrenderable full-ai-cluster/gitlab]",
    );
    expect(rulesFor([misbound])).toContain("unbound-identifier");
  });
});

// ---------------------------------------------------------------------------
// SNAPSHOT COVERAGE -- the guard that keeps `renders` from being a guess
// ---------------------------------------------------------------------------

describe("snapshot coverage", () => {
  const withSnapshot = (snapshot: RenderSnapshot | null, liveAppCount: number): Evidence => ({
    ...EVIDENCE,
    snapshot,
    snapshotAppCount: snapshot?.appsDiscovered ?? 0,
    liveAppCount,
    snapshotCoversTree: snapshot !== null && snapshot.appsDiscovered === liveAppCount,
  });

  test("an app with NO rows cannot be decided by a snapshot that under-covers the tree", () => {
    const snapshot = loadSnapshot() as RenderSnapshot;
    const evidence = withSnapshot(
      { ...snapshot, appsDiscovered: snapshot.appsDiscovered - 1 },
      snapshot.appsDiscovered,
    );
    // temporal renders zero PVCs, so its absence from the rows is ambiguous:
    // either it rendered nothing, or it was never measured.
    expect(
      checkCitation(only("[cite: no-pvc full-ai-cluster/temporal]"), evidence, subject("temporal", ""))?.rule,
    ).toBe("snapshot-coverage-stale");
  });

  test("an app WITH rows was demonstrably measured, so the same snapshot still decides it", () => {
    const snapshot = loadSnapshot() as RenderSnapshot;
    const evidence = withSnapshot(
      { ...snapshot, appsDiscovered: snapshot.appsDiscovered - 1 },
      snapshot.appsDiscovered,
    );
    expect(
      checkCitation(only("[cite: pvc-total full-ai-cluster/ollama 200]"), evidence, subject("ollama", "")),
    ).toBeNull();
  });

  test("no snapshot at all is a finding, never a pass", () => {
    const evidence = withSnapshot(null, 54);
    expect(checkCitation(only("[cite: renders full-ai-cluster/gitlab]"), evidence, subject("gitlab", ""))?.rule).toBe(
      "snapshot-coverage-stale",
    );
  });

  // -------------------------------------------------------------------------
  // The gap this found in `--check-snapshot`, fixed in rendered-storage-claims.ts
  // and tested HERE so a concurrent change to that file's own tests does not
  // land on the same lines.
  //
  // MEASURED 2026-08-22 on main: the tree had 54 Applications, the snapshot
  // said 53 (`spire-crds`, added by #13488, renders no PVC), and
  // `--check-snapshot` printed "snapshot matches the live render". Every drift
  // loop compares ROWS, and an app with no rows is invisible to all of them.
  // -------------------------------------------------------------------------
  test("snapshotDrift reports coverage, not only rows", () => {
    const snapshot = loadSnapshot() as RenderSnapshot;
    expect(snapshotDrift(snapshot, snapshot)).toEqual([]);
    const live = { ...snapshot, appsDiscovered: snapshot.appsDiscovered + 1 };
    const drift = snapshotDrift(live, snapshot);
    expect(drift.length).toBe(1);
    expect(drift[0]).toContain("COVERAGE");
  });

  test("the checked-in snapshot covers the tree it is checked against", () => {
    expect(EVIDENCE.snapshotAppCount).toBe(EVIDENCE.liveAppCount);
  });
});

// ---------------------------------------------------------------------------
// THE EXIT CODE ITSELF
//
// Every test above calls the checker as a function. A gate is a PROCESS, and
// `process.exit(0)` written where the report should decide is a mutation none
// of those tests can see -- the "main always exits 0" shape that has produced
// fake green runs in this repo before. So the CLI is spawned, twice, and its
// exit code is read directly.
// ---------------------------------------------------------------------------

describe("the CLI exit code", () => {
  const cli = new URL("./reason-truth.ts", import.meta.url).pathname;

  test("exits 0 on the tree it ships with", () => {
    const run = Bun.spawnSync(["bun", cli]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout.toString()).toContain("every cited anchor still holds");
  });

  test("exits 1 against a tree that holds none of the cited artifacts", () => {
    const scratch = mkdtempSync(join(tmpdir(), "zeta-reason-truth-"));
    try {
      const run = Bun.spawnSync(["bun", cli, "--repo-root", scratch]);
      expect(run.exitCode).toBe(1);
      expect(run.stdout.toString()).toContain("REFUTED");
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
