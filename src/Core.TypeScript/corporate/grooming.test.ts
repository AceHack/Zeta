/**
 * grooming.test.ts — the first gate has to read something.
 *
 * `business_context_grooming` was judgement-only: no producer, so its reviewer was shown whatever
 * had accumulated by phase one, which is nothing. The tests that matter here are that grooming now
 * CITES what it read, that a source it could not read REFUSES rather than producing an empty
 * approval, and — the integration one — that a runtime handed a repository actually reaches it.
 */

import { describe, expect, test } from "bun:test";
import { groom, groomingProducer, groomingTerms, MAX_CITATIONS } from "./grooming";
import { gitDataSource, simulatedDataSource } from "./git-data-source";
import { WorkState, WorkType, type CascadeNode } from "./goal-cascade";
import { Fidelity, Port, type SourceDocument } from "./providers";
import { agentsFromChart, runOrgRuntime, type OrgRuntimeDeps } from "./org-runtime";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { GateKind } from "./quality-gate";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

function node(title: string): CascadeNode {
  return {
    workId: "task-1",
    workType: WorkType.Task,
    title,
    state: WorkState.Open,
    ownerHatId: "tech_lead",
    assigneeHatId: "backend_implementer",
  };
}

const doc = (path: string, content: string): SourceDocument => ({
  path,
  revision: "r1",
  content,
  ref: `fixture:r1:${path}`,
});

describe("the terms a search is made of", () => {
  test("SHORT WORDS ARE DROPPED — a search that matches everything discriminates nothing", () => {
    // "the", "a" and "of" appear in every document in any repository. Searching for them is the
    // vacuity class wearing a search box: a query that cannot fail to match.
    expect(groomingTerms(node("the cost of a checkout coupon"))).toEqual(["cost", "checkout", "coupon"]);
  });

  test("terms are de-duplicated, so one word is not searched twice", () => {
    expect(groomingTerms(node("coupon coupon COUPON"))).toEqual(["coupon"]);
  });

  test("a title with nothing searchable in it yields no terms", () => {
    expect(groomingTerms(node("a b of the"))).toEqual([]);
  });
});

describe("grooming CITES, and finding nothing is a result", () => {
  test("documents matching the terms are cited by ref", async () => {
    const source = simulatedDataSource([
      doc("checkout.md", "how checkout works"),
      doc("unrelated.md", "something else"),
    ]);
    const r = await groom(node("checkout flow"), source);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.documents.map((d) => d.ref)).toEqual(["fixture:r1:checkout.md"]);
  });

  test("A TERM THAT MATCHED NOTHING IS REPORTED — the map of what was never written down", async () => {
    const r = await groom(node("checkout kubernetes"), simulatedDataSource([doc("checkout.md", "checkout")]));
    if (!r.ok) throw new Error(r.reason);
    expect(r.value.termsWithNoMatch).toEqual(["kubernetes"]);
    expect(r.value.summary).toContain("nothing found for: kubernetes");
  });

  test("finding nothing at all still SUCCEEDS — the domain has no prior art, which is an answer", async () => {
    // Distinct from the refusal below, and the distinction is the whole point: "the repository has
    // nothing on this" and "the repository is unreachable" must never be the same result.
    const r = await groom(node("something nobody wrote"), simulatedDataSource([]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.documents).toEqual([]);
  });

  test("a document matching several terms is cited ONCE", async () => {
    // Keyed by ref — the same G-Set idempotence the union uses.
    const r = await groom(node("checkout coupon"), simulatedDataSource([doc("both.md", "checkout and coupon")]));
    if (!r.ok) throw new Error(r.reason);
    expect(r.value.documents.length).toBe(1);
  });

  test("citations are capped, and ordered ORDINALLY", async () => {
    const many = Array.from({ length: MAX_CITATIONS + 8 }, (_, i) =>
      doc(`f${String(i).padStart(3, "0")}.md`, "checkout"),
    );
    const r = await groom(node("checkout flow"), simulatedDataSource(many));
    if (!r.ok) throw new Error(r.reason);
    expect(r.value.documents.length).toBe(MAX_CITATIONS);
    const refs = r.value.documents.map((d) => d.ref);
    expect([...refs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(refs);
  });
});

describe("AN UNREADABLE SOURCE REFUSES THE PHASE", () => {
  test("a source that cannot be read does not produce an empty approval", async () => {
    // Continuing with the terms that did answer would produce an artifact that looks like a search
    // and silently omits a repository.
    const broken = gitDataSource({ repoDir: process.cwd(), ref: "no-such-ref-xyz" });
    const r = await groom(node("checkout flow"), broken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("could not resolve");
  });

  test("...and the producer turns that into a refused phase, not an artifact", async () => {
    const broken = gitDataSource({ repoDir: process.cwd(), ref: "no-such-ref-xyz" });
    const out = await groomingProducer(broken).produce(node("checkout flow"), {
      branch: "b",
      priorArtifacts: new Map(),
    });
    expect(out.ok).toBe(false);
  });
});

describe("the producer inherits the SOURCE'S fidelity", () => {
  test("grooming against a fixture is labelled simulated", () => {
    // Copying the fidelity would let a fixture-backed grooming report itself as real work, and a
    // reviewer approving that phase could not see that nothing real was read.
    expect(groomingProducer(simulatedDataSource([])).meta.fidelity).toBe(Fidelity.Simulated);
  });

  test("grooming against a repository is labelled real", () => {
    const real = groomingProducer(gitDataSource({ repoDir: process.cwd(), ref: "HEAD", subdir: "docs/DECISIONS" }));
    expect(real.meta.fidelity).toBe(Fidelity.Real);
    expect(real.meta.port).toBe(Port.DataSource);
  });
});

describe("THE INTEGRATION: a runtime handed a repository reaches it", () => {
  function deps(over: Partial<OrgRuntimeDeps> = {}): OrgRuntimeDeps {
    let n = 0;
    return {
      chart,
      externalEvents: [
        { source: "t", externalId: "T-1", title: "checkout coupon promotion gate", body: "b" },
      ],
      agents: agentsFromChart(chart),
      observations: [],
      acceptingHatId: "cto",
      resourceAuthorityHatId: "rmo_office",
      priorityDeciderHatId: "cto",
      createId: (p) => `${p}-${String(++n).padStart(3, "0")}`,
      nowMs: 0,
      workBlockMs: 3_600_000,
      leaseMs: 300_000,
      priorityInputsFor: () => ({
        executivePriority: 0.5,
        customerImpact: 1,
        severity: 1,
        releaseRisk: 0.2,
        blockedDownstreamCount: 2,
        dependencyFanOut: 1,
        queueAgeMs: 0,
        hatScarcity: 0,
        budgetBurn: 0,
        estimatedEffort: 0.2,
      }),
      ...over,
    } as OrgRuntimeDeps;
  }

  test("WITHOUT a source the gate cites ITS OWN APPROVAL and no document", async () => {
    // The state this replaces, and it is worse than "cites nothing": the only evidence is
    // `auto-approved:business_context_grooming:<id>` — the approver's own token, which is the gate
    // citing the fact that it approved. My first draft of this test asserted an EMPTY list and
    // failed, which is how the rubber-stamp became visible.
    const report = await runOrgRuntime(deps());
    const groomed = report.gateEvaluations.filter((g) => g.gate === GateKind.BusinessContextGrooming);
    expect(groomed.length).toBeGreaterThan(0);
    const refs = groomed.flatMap((g) => g.evidenceRefs);
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) expect(r.startsWith("auto-approved:")).toBe(true);
  });

  test("WITH a source the same gate cites documents at a revision", async () => {
    const report = await runOrgRuntime(
      deps({
        dataSource: simulatedDataSource([
          doc("checkout.md", "checkout and coupon behaviour"),
          doc("gate.md", "the promotion gate"),
        ]),
      }),
    );
    const groomed = report.gateEvaluations.filter((g) => g.gate === GateKind.BusinessContextGrooming);
    expect(groomed.length).toBeGreaterThan(0);
    // The citations are the artifact — `runPipeline` turns them into the gate's evidence, so the
    // reviewer of this phase is shown exactly what was read.
    const refs = groomed.flatMap((g) => g.evidenceRefs);
    expect(refs).toContain("fixture:r1:checkout.md");
    // A DOCUMENT, not just the approver's own token — the difference from the test above.
    expect(refs.some((r) => !r.startsWith("auto-approved:"))).toBe(true);
  });

  test("THE SOURCE APPEARS IN THE RUN'S FIDELITY REPORT, and is marked reached", async () => {
    // The defect this pins lasted one commit: the data source was not in `ProviderSet`, so a run
    // reading a real repository at a real commit printed "every port was simulated; this run
    // performed nothing and reached nothing".
    const report = await runOrgRuntime(
      deps({
        dataSource: gitDataSource({ repoDir: process.cwd(), ref: "HEAD", subdir: "docs/DECISIONS" }),
      }),
    );
    expect(report.fidelity.ports.some((p) => p.port === Port.DataSource)).toBe(true);
    expect(report.fidelity.realPorts).toContain(Port.DataSource);
    // REACHED, not merely configured — the recorder wraps the source, so a read is counted.
    expect(report.fidelity.reached).toContain(Port.DataSource);
  });

  test("a run with NO source names no data-source port at all", async () => {
    const report = await runOrgRuntime(deps());
    expect(report.fidelity.ports.some((p) => p.port === Port.DataSource)).toBe(false);
  });
});
