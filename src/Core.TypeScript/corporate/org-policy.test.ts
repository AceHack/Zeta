/**
 * org-policy.test.ts — falsifiers for per-organization, per-gate rules.
 *
 * The class of bug this module is most likely to have is a rule that CANNOT FAIL: an empty needle
 * matches every string, a `MinApprovers` of zero is satisfied by nobody approving, and a duplicated
 * gate policy silently applies whichever was found first. Those are all checked here, at
 * configuration time, because every one of them is invisible at run time.
 */

import { describe, expect, test } from "bun:test";
import {
  basePolicy,
  isVerificationApproach,
  policyFor,
  RuleKind,
  satisfiesPolicy,
  skillsAt,
  unmetRules,
  validateOrgPolicy,
  verificationAt,
  VerificationApproach,
  type GateFacts,
  type OrgPolicy,
} from "./org-policy";
import { GateKind } from "./quality-gate";

const NO_FACTS: GateFacts = { evidenceRefs: [], approverHatIds: [], artifactPaths: [] };

const GREENFIELD: OrgPolicy = {
  orgId: "new-venture",
  verification: VerificationApproach.AuthoredScripts,
  gates: [
    {
      gate: GateKind.QaUat,
      verification: VerificationApproach.AuthoredScripts,
      skills: ["playwright-authoring"],
      rules: [
        {
          id: "spec-attached",
          kind: RuleKind.EvidenceMatching,
          needle: "playwright-report",
          because: "a repeatable script is what makes this check survive the session that wrote it",
        },
        {
          id: "two-eyes",
          kind: RuleKind.MinApprovers,
          atLeast: 2,
          because: "greenfield QA has no regression history to lean on",
        },
      ],
    },
  ],
};

describe("verification is a prerequisite, not a default", () => {
  test("an org that has not said how it verifies is refused", () => {
    const bad = { orgId: "x", verification: undefined } as unknown as OrgPolicy;
    const r = validateOrgPolicy(bad);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("must state how it verifies");
  });

  test("an unknown approach is refused rather than coerced", () => {
    const bad = { orgId: "x", verification: "vibes" } as unknown as OrgPolicy;
    expect(validateOrgPolicy(bad).ok).toBe(false);
  });

  test("a base policy with a stated approach is valid and carries no opinions", () => {
    const p = basePolicy("elera", VerificationApproach.ExistingHarness);
    expect(validateOrgPolicy(p).ok).toBe(true);
    expect(p.gates).toBeUndefined();
    expect(unmetRules(p, GateKind.QaUat, NO_FACTS)).toEqual([]);
  });

  test("different orgs verify differently — that is the whole point", () => {
    const corporate = basePolicy("elera", VerificationApproach.ExistingHarness);
    expect(verificationAt(corporate, GateKind.QaUat)).toBe(VerificationApproach.ExistingHarness);
    expect(verificationAt(GREENFIELD, GateKind.QaUat)).toBe(VerificationApproach.AuthoredScripts);
  });

  test("a gate override beats the org default, and only for that gate", () => {
    const p: OrgPolicy = {
      orgId: "mixed",
      verification: VerificationApproach.ManualWalkthrough,
      gates: [{ gate: GateKind.QaUat, verification: VerificationApproach.BehaviourSpecs }],
    };
    expect(verificationAt(p, GateKind.QaUat)).toBe(VerificationApproach.BehaviourSpecs);
    expect(verificationAt(p, GateKind.RuntimeValidation)).toBe(VerificationApproach.ManualWalkthrough);
  });

  test("isVerificationApproach admits exactly the four", () => {
    for (const v of Object.values(VerificationApproach)) expect(isVerificationApproach(v)).toBe(true);
    expect(isVerificationApproach("playwright")).toBe(false);
    expect(isVerificationApproach(undefined)).toBe(false);
  });
});

describe("A RULE THAT CANNOT FAIL IS REFUSED AT CONFIGURATION TIME", () => {
  test("an empty needle is refused — it matches every string", () => {
    const p: OrgPolicy = {
      orgId: "x",
      verification: VerificationApproach.AuthoredScripts,
      gates: [
        {
          gate: GateKind.QaUat,
          rules: [{ id: "r", kind: RuleKind.EvidenceMatching, needle: "  ", because: "why" }],
        },
      ],
    };
    const r = validateOrgPolicy(p);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("cannot fail");
  });

  test("a missing needle is refused too", () => {
    const p: OrgPolicy = {
      orgId: "x",
      verification: VerificationApproach.AuthoredScripts,
      gates: [{ gate: GateKind.QaUat, rules: [{ id: "r", kind: RuleKind.ArtifactPresent, because: "why" }] }],
    };
    expect(validateOrgPolicy(p).ok).toBe(false);
  });

  test("MinApprovers of zero is refused — nobody approving would satisfy it", () => {
    const p: OrgPolicy = {
      orgId: "x",
      verification: VerificationApproach.AuthoredScripts,
      gates: [
        { gate: GateKind.QaUat, rules: [{ id: "r", kind: RuleKind.MinApprovers, atLeast: 0, because: "why" }] },
      ],
    };
    const r = validateOrgPolicy(p);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("atLeast >= 1");
  });

  test("a rule with no stated reason is refused", () => {
    const p: OrgPolicy = {
      orgId: "x",
      verification: VerificationApproach.AuthoredScripts,
      gates: [
        { gate: GateKind.QaUat, rules: [{ id: "r", kind: RuleKind.MinApprovers, atLeast: 2, because: " " }] },
      ],
    };
    expect(validateOrgPolicy(p).ok).toBe(false);
  });

  test("two policies for one gate are refused — which applies would be undefined", () => {
    const p: OrgPolicy = {
      orgId: "x",
      verification: VerificationApproach.AuthoredScripts,
      gates: [{ gate: GateKind.QaUat }, { gate: GateKind.QaUat, skills: ["other"] }],
    };
    const r = validateOrgPolicy(p);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("two policies");
  });

  test("two rules with the same id on one gate are refused", () => {
    const p: OrgPolicy = {
      orgId: "x",
      verification: VerificationApproach.AuthoredScripts,
      gates: [
        {
          gate: GateKind.QaUat,
          rules: [
            { id: "dup", kind: RuleKind.MinApprovers, atLeast: 1, because: "a" },
            { id: "dup", kind: RuleKind.MinApprovers, atLeast: 2, because: "b" },
          ],
        },
      ],
    };
    expect(validateOrgPolicy(p).ok).toBe(false);
  });

  test("the well-formed greenfield policy passes", () => {
    expect(validateOrgPolicy(GREENFIELD).ok).toBe(true);
  });
});

describe("rules are checked against facts the gate already carries", () => {
  test("a QA gate with no playwright report is unmet, and says so", () => {
    const unmet = unmetRules(GREENFIELD, GateKind.QaUat, {
      evidenceRefs: ["notes.md"],
      approverHatIds: ["qa_engineer", "qa_manager"],
      artifactPaths: [],
    });
    expect(unmet).toHaveLength(1);
    expect(unmet[0]?.rule.id).toBe("spec-attached");
    expect(unmet[0]?.because).toContain("playwright-report");
  });

  test("attaching the report satisfies it", () => {
    expect(
      satisfiesPolicy(GREENFIELD, GateKind.QaUat, {
        evidenceRefs: ["ci/playwright-report/index.html"],
        approverHatIds: ["qa_engineer", "qa_manager"],
        artifactPaths: [],
      }),
    ).toBe(true);
  });

  test("ONE APPROVER TWICE IS NOT TWO APPROVERS", () => {
    const unmet = unmetRules(GREENFIELD, GateKind.QaUat, {
      evidenceRefs: ["ci/playwright-report/x"],
      approverHatIds: ["qa_engineer", "qa_engineer"],
      artifactPaths: [],
    });
    expect(unmet.map((u) => u.rule.id)).toEqual(["two-eyes"]);
    expect(unmet[0]?.because).toContain("1 distinct approver");
  });

  test("every unmet rule is reported, not just the first", () => {
    const unmet = unmetRules(GREENFIELD, GateKind.QaUat, NO_FACTS);
    expect(unmet.map((u) => u.rule.id).sort()).toEqual(["spec-attached", "two-eyes"]);
  });

  test("an artifact rule reads the artifacts, not the evidence", () => {
    const p: OrgPolicy = {
      orgId: "x",
      verification: VerificationApproach.BehaviourSpecs,
      gates: [
        {
          gate: GateKind.QaUat,
          rules: [{ id: "bdd", kind: RuleKind.ArtifactPresent, needle: ".feature", because: "BDD org" }],
        },
      ],
    };
    expect(satisfiesPolicy(p, GateKind.QaUat, { ...NO_FACTS, evidenceRefs: ["x.feature"] })).toBe(false);
    expect(satisfiesPolicy(p, GateKind.QaUat, { ...NO_FACTS, artifactPaths: ["specs/login.feature"] })).toBe(true);
  });

  test("a gate this org says nothing about demands nothing extra", () => {
    expect(unmetRules(GREENFIELD, GateKind.ReleaseReadiness, NO_FACTS)).toEqual([]);
    expect(satisfiesPolicy(GREENFIELD, GateKind.ReleaseReadiness, NO_FACTS)).toBe(true);
  });

  test("an unknown rule kind is reported unmet, never quietly passed", () => {
    const p = {
      orgId: "x",
      verification: VerificationApproach.AuthoredScripts,
      gates: [{ gate: GateKind.QaUat, rules: [{ id: "r", kind: "vibes", because: "why" }] }],
    } as unknown as OrgPolicy;
    const unmet = unmetRules(p, GateKind.QaUat, NO_FACTS);
    expect(unmet).toHaveLength(1);
    expect(unmet[0]?.because).toContain("cannot be checked");
  });
});

describe("skills are offered, and repo skills are not listed", () => {
  test("a configured step offers its skills", () => {
    expect(skillsAt(GREENFIELD, GateKind.QaUat)).toEqual(["playwright-authoring"]);
  });

  test("an unconfigured step offers none — meaning repo-only, not no tooling", () => {
    expect(skillsAt(GREENFIELD, GateKind.ArchitectureDesign)).toEqual([]);
    expect(policyFor(GREENFIELD, GateKind.ArchitectureDesign)).toBeUndefined();
  });

  test("a base policy offers no extra skills anywhere", () => {
    const p = basePolicy("elera", VerificationApproach.ExistingHarness);
    for (const gate of Object.values(GateKind)) expect(skillsAt(p, gate)).toEqual([]);
  });
});
