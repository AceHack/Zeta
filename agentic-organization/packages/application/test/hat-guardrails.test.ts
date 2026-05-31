import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { ActionClass, preflightHatAction, preflightApproval, buildHatDefinitions } from "../src/index.ts";

const hats = buildHatDefinitions();
const hat = (id: string) => hats.find((h) => h.id === id)!;

test("a TPM (program_director, no Delivery bundle) literally CANNOT write code", () => {
  const r = preflightHatAction(hat("program_director"), ActionClass.WriteCode);
  equal(r.allowed, false);
  if (!r.allowed) {
    equal(r.requiredBundle, "delivery");
    ok(r.reason.includes("program_director"));
  }
});

test("a code author (release_operator, Delivery) CAN write code but CANNOT approve a review", () => {
  equal(preflightHatAction(hat("release_operator"), ActionClass.WriteCode).allowed, true);
  const approve = preflightHatAction(hat("release_operator"), ActionClass.ApproveReview);
  equal(approve.allowed, false, "no ReviewAndGates bundle → cannot approve");
});

test("a backend implementer CAN write code for implementation prompt flows", () => {
  equal(preflightHatAction(hat("backend_implementer"), ActionClass.WriteCode).allowed, true);
});

test("a reviewer (cto, ReviewAndGates) CAN review but CANNOT write code", () => {
  equal(preflightHatAction(hat("cto"), ActionClass.ReviewCode).allowed, true);
  equal(preflightHatAction(hat("cto"), ActionClass.WriteCode).allowed, false);
});

test("separation of duties: a hat cannot approve the change it proposed", () => {
  equal(preflightApproval("code_author", "code_author").allowed, false);
  equal(preflightApproval("code_author", "code_reviewer").allowed, true);
});
