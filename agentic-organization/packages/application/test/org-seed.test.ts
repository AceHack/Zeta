import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { HatLevel } from "../../domain/src/hat-definition.ts";
import { DepartmentId } from "../../domain/src/department.ts";
import {
  DEPARTMENTS,
  OrgGraphValidation,
  buildHatDefinitions,
  buildOrgSeed,
  validateOrgGraph,
} from "../src/org-seed.ts";

test("seeds all 16 departments", () => {
  equal(DEPARTMENTS.length, 16);
  // every DepartmentId enum value is represented exactly once
  const seeded = new Set(DEPARTMENTS.map((d) => d.id));
  for (const id of Object.values(DepartmentId)) {
    ok(seeded.has(id), `missing department ${id}`);
  }
});

test("the hat catalog covers every level of the hierarchy", () => {
  const hats = buildHatDefinitions();
  ok(hats.length >= 100, `expected the full catalog, got ${hats.length}`);
  const levels = new Set(hats.map((h) => h.level));
  for (const level of Object.values(HatLevel)) {
    ok(levels.has(level), `no hat at level ${level}`);
  }
  // exactly one Executive Board root (reportsTo empty)
  const roots = hats.filter((h) => h.reportsToHatIds.length === 0);
  equal(roots.length, 1);
  equal(roots[0]?.id, "executive_board_member");
});

test("the supervisor graph is a DAG with all parents resolvable", () => {
  const result = validateOrgGraph(buildHatDefinitions());
  equal(result.outcome, OrgGraphValidation.Acyclic);
});

test("supervises is the exact reverse of reportsTo (no inconsistency possible)", () => {
  const hats = buildHatDefinitions();
  const byId = new Map(hats.map((h) => [h.id, h]));
  for (const hat of hats) {
    for (const child of hat.supervisesHatIds) {
      ok(byId.get(child)?.reportsToHatIds.includes(hat.id), `${hat.id} supervises ${child} but ${child} does not report to it`);
    }
    for (const parent of hat.reportsToHatIds) {
      ok(byId.get(parent)?.supervisesHatIds.includes(hat.id), `${hat.id} reports to ${parent} but is not supervised by it`);
    }
  }
});

test("every gate-owner hat the pipeline needs exists with the right approval scope", () => {
  const hats = buildHatDefinitions();
  const byId = new Map(hats.map((h) => [h.id, h]));
  const expectations: ReadonlyArray<[string, string]> = [
    ["product_owner", "customer_rfp_review"],
    ["brd_reviewer", "brd_approval"],
    ["architect", "architecture_approval"],
    ["code_reviewer", "implementation_review"],
    ["qa_reviewer", "runtime_validation"],
    ["product_owner", "final_business_validation"],
    ["release_manager", "release_readiness"],
  ];
  for (const [hatId, scope] of expectations) {
    const hat = byId.get(hatId);
    ok(hat !== undefined, `missing gate-owner hat ${hatId}`);
    ok(hat?.approvalScopes.includes(scope), `${hatId} lacks approval scope ${scope}`);
  }
});

test("hat-supply voters exist (RMO) with the hat_supply voting scope", () => {
  const hats = buildHatDefinitions();
  const voters = hats.filter((h) => h.votingScopes.includes("hat_supply"));
  // Directors + Cost Controller + CFO + Hat Approval Steward can vote on supply
  ok(voters.length >= 5, `expected several supply voters, got ${voters.length}`);
  ok(voters.some((h) => h.id === "cfo"));
  ok(voters.some((h) => h.id === "cost_controller"));
});

test("buildOrgSeed bundles departments + hats", () => {
  const seed = buildOrgSeed();
  equal(seed.departments.length, 16);
  ok(seed.hats.length >= 100);
});

test("a hat reporting to an unknown parent is rejected", () => {
  const broken = [
    { ...buildHatDefinitions()[0]!, reportsToHatIds: [] },
    { ...buildHatDefinitions()[1]!, reportsToHatIds: ["does_not_exist"] },
  ];
  const result = validateOrgGraph(broken);
  equal(result.outcome, OrgGraphValidation.UnknownParent);
});
