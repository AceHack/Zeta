import { expect, test } from "bun:test";
import { assertCascadeAllowed, planCascadeTeardown, type CascadeTeardownInventory } from "./cascade-teardown.ts";

const TARGET = { id: "ca:alice", ownerUserId: "alice" } as const;

test("cascade enumerates dependent machines, certs, and registrations", () => {
  const inventory: CascadeTeardownInventory = {
    machines: [{ id: "machine:alpha", kind: "machine", dependsOn: [TARGET.id], label: "alpha" }],
    certs: [{ id: "cert:alpha", kind: "cert", dependsOn: [TARGET.id] }],
    registrations: [{ id: "registration:alpha", kind: "registration", dependsOn: [TARGET.id] }],
    extraCare: [
      {
        id: "memory:unrelated",
        kind: "persona-memory",
        ownerUserId: "alice",
        dependsOn: ["ca:other"],
      },
    ],
  };

  const plan = planCascadeTeardown({ target: TARGET, requestedByUserId: "alice", inventory });

  expect(plan.nodes.map((n) => n.id)).toEqual(["machine:alpha", "cert:alpha", "registration:alpha"]);
  expect(plan.nodes.every((n) => n.class === "cascade")).toBe(true);
  expect(plan.blastRadius.total).toBe(3);
  expect(plan.blastRadius.machines).toBe(1);
  expect(plan.blastRadius.certs).toBe(1);
  expect(plan.blastRadius.registrations).toBe(1);
});

test("extra-care nodes require explicit acknowledgment", () => {
  const inventory: CascadeTeardownInventory = {
    extraCare: [
      {
        id: "hardware:yubikey-slot",
        kind: "hardware-state",
        ownerUserId: "alice",
        dependsOn: [TARGET.id],
      },
      {
        id: "memory:alice",
        kind: "persona-memory",
        ownerUserId: "alice",
        dependsOn: [TARGET.id],
      },
    ],
  };

  const plan = planCascadeTeardown({ target: TARGET, requestedByUserId: "alice", inventory });
  expect(plan.blastRadius.extraCareWarn).toBe(1);
  expect(plan.blastRadius.ownerConsentRequired).toBe(1);

  const noConsent = assertCascadeAllowed(plan, {});
  expect(noConsent.ok).toBe(false);
  if (!noConsent.ok) {
    expect(noConsent.reasons).toContain("hardware:yubikey-slot: requires explicit extra-care acknowledgment");
    expect(noConsent.reasons).toContain("memory:alice: requires explicit extra-care acknowledgment");
    expect(noConsent.reasons).toContain("memory:alice: requires consent from owner alice");
  }

  const allowed = assertCascadeAllowed(plan, {
    acknowledgedNodeIds: ["hardware:yubikey-slot", "memory:alice"],
    ownerConsentNodeIds: ["memory:alice"],
  });
  expect(allowed).toEqual({ ok: true });
});

test("cross-user memory is refused", () => {
  const inventory: CascadeTeardownInventory = {
    extraCare: [
      {
        id: "memory:bob",
        kind: "persona-memory",
        ownerUserId: "bob",
        dependsOn: [TARGET.id],
      },
    ],
  };

  const plan = planCascadeTeardown({ target: TARGET, requestedByUserId: "alice", inventory });

  expect(plan.nodes).toHaveLength(1);
  expect(plan.nodes[0]!.class).toBe("refuse-cross-user");
  expect(plan.blastRadius.refuseCrossUser).toBe(1);

  const allowed = assertCascadeAllowed(plan, {
    acknowledgedNodeIds: ["memory:bob"],
    ownerConsentNodeIds: ["memory:bob"],
  });
  expect(allowed.ok).toBe(false);
  if (!allowed.ok) {
    expect(allowed.reasons).toContain("memory:bob: refuses cross-user memory or encrypted-vault teardown");
  }
});

test("empty inventory yields an empty plan", () => {
  const plan = planCascadeTeardown({ target: TARGET, requestedByUserId: "alice", inventory: {} });

  expect(plan.nodes).toEqual([]);
  expect(plan.blastRadius.total).toBe(0);
  expect(assertCascadeAllowed(plan, {})).toEqual({ ok: true });
});
