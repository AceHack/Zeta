import { equal } from "node:assert/strict";
import { test } from "node:test";

import {
  ConstitutionDecision,
  ConstitutionRatificationState,
  DEFAULT_CONSTITUTION_QUORUM,
  evaluateConstitutionRatification,
  type ConstitutionAgreement,
} from "../src/constitution-gate.ts";

function agree(agentId: string, hatAssignmentId: string): ConstitutionAgreement {
  return {
    agentId,
    hatAssignmentId,
    decision: ConstitutionDecision.Agree,
    rationale: `agree-${agentId}`,
  };
}

function object_(agentId: string, hatAssignmentId: string): ConstitutionAgreement {
  return {
    agentId,
    hatAssignmentId,
    decision: ConstitutionDecision.Object,
    rationale: `object-${agentId}`,
  };
}

test("three distinct agreers -> Ratified", () => {
  const result = evaluateConstitutionRatification({
    agreements: [agree("a", "h1"), agree("b", "h2"), agree("c", "h3")],
  });
  equal(result.state, ConstitutionRatificationState.Ratified);
  equal(result.distinctAgreeAgents, 3);
  equal(result.quorum, DEFAULT_CONSTITUTION_QUORUM);
  equal(result.objections, 0);
});

test("two distinct agreers with one agent twice -> Gathering, distinct counts once", () => {
  const result = evaluateConstitutionRatification({
    agreements: [agree("a", "h1"), agree("a", "h2"), agree("b", "h3")],
  });
  equal(result.state, ConstitutionRatificationState.Gathering);
  equal(result.distinctAgreeAgents, 2);
  equal(result.objections, 0);
});

test("three agreers plus one Object -> Rejected, objection veto precedence", () => {
  const result = evaluateConstitutionRatification({
    agreements: [
      agree("a", "h1"),
      agree("b", "h2"),
      agree("c", "h3"),
      object_("d", "h4"),
    ],
  });
  equal(result.state, ConstitutionRatificationState.Rejected);
  equal(result.objections, 1);
  equal(result.distinctAgreeAgents, 3);
});

test("zero agreements -> Proposed", () => {
  const result = evaluateConstitutionRatification({ agreements: [] });
  equal(result.state, ConstitutionRatificationState.Proposed);
  equal(result.distinctAgreeAgents, 0);
  equal(result.objections, 0);
});

test("custom quorum 2 with two distinct agreers -> Ratified", () => {
  const result = evaluateConstitutionRatification({
    agreements: [agree("a", "h1"), agree("b", "h2")],
    quorum: 2,
  });
  equal(result.state, ConstitutionRatificationState.Ratified);
  equal(result.distinctAgreeAgents, 2);
  equal(result.quorum, 2);
});
