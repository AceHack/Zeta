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
        personaId: "riven",
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

test("extra-care hardware requires acknowledgment; persona-memory requires persona consent", () => {
  const inventory: CascadeTeardownInventory = {
    extraCare: [
      {
        id: "hardware:yubikey-slot",
        kind: "hardware-state",
        ownerUserId: "alice",
        dependsOn: [TARGET.id],
      },
      {
        id: "memory:riven",
        kind: "persona-memory",
        ownerUserId: "alice",
        personaId: "riven",
        dependsOn: [TARGET.id],
      },
    ],
  };

  const plan = planCascadeTeardown({ target: TARGET, requestedByUserId: "alice", inventory });
  expect(plan.blastRadius.extraCareWarn).toBe(1);
  expect(plan.blastRadius.personaConsentRequired).toBe(1);
  expect(plan.nodes.find((n) => n.id === "memory:riven")!.class).toBe("persona-consent-required");

  const noConsent = assertCascadeAllowed(plan, {});
  expect(noConsent.ok).toBe(false);
  if (!noConsent.ok) {
    expect(noConsent.reasons).toContain("hardware:yubikey-slot: requires explicit extra-care acknowledgment");
    expect(noConsent.reasons).toContain("memory:riven: requires explicit extra-care acknowledgment");
    expect(noConsent.reasons).toContain(
      "memory:riven: requires consent from persona riven (human confirm alone is insufficient)",
    );
  }

  // Human owner consent alone must NOT authorize persona-memory wipe (HC-9).
  const humanOnly = assertCascadeAllowed(plan, {
    acknowledgedNodeIds: ["hardware:yubikey-slot", "memory:riven"],
    ownerConsentNodeIds: ["memory:riven"],
  });
  expect(humanOnly.ok).toBe(false);
  if (!humanOnly.ok) {
    expect(humanOnly.reasons.some((r) => r.includes("requires consent from persona riven"))).toBe(true);
  }

  const allowed = assertCascadeAllowed(plan, {
    acknowledgedNodeIds: ["hardware:yubikey-slot", "memory:riven"],
    personaConsentNodeIds: ["memory:riven"],
  });
  expect(allowed).toEqual({ ok: true });
});

test("persona-memory without personaId refuses human-unilateral wipe", () => {
  const inventory: CascadeTeardownInventory = {
    extraCare: [
      {
        id: "memory:orphan",
        kind: "persona-memory",
        ownerUserId: "alice",
        dependsOn: [TARGET.id],
      },
    ],
  };

  const plan = planCascadeTeardown({ target: TARGET, requestedByUserId: "alice", inventory });
  expect(plan.nodes[0]!.class).toBe("refuse-human-unilateral");
  expect(plan.blastRadius.refuseHumanUnilateral).toBe(1);

  const allowed = assertCascadeAllowed(plan, {
    acknowledgedNodeIds: ["memory:orphan"],
    ownerConsentNodeIds: ["memory:orphan"],
    personaConsentNodeIds: ["memory:orphan"],
  });
  expect(allowed.ok).toBe(false);
  if (!allowed.ok) {
    expect(allowed.reasons[0]!).toContain("refuses human-unilateral persona-memory wipe");
  }
});

test("cross-user encrypted vault is refused", () => {
  const inventory: CascadeTeardownInventory = {
    extraCare: [
      {
        id: "vault:bob",
        kind: "unrecoverable-encrypted",
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
    acknowledgedNodeIds: ["vault:bob"],
    ownerConsentNodeIds: ["vault:bob"],
  });
  expect(allowed.ok).toBe(false);
  if (!allowed.ok) {
    expect(allowed.reasons).toContain("vault:bob: refuses cross-user memory or encrypted-vault teardown");
  }
});

test("empty inventory yields an empty plan", () => {
  const plan = planCascadeTeardown({ target: TARGET, requestedByUserId: "alice", inventory: {} });

  expect(plan.nodes).toEqual([]);
  expect(plan.blastRadius.total).toBe(0);
  expect(assertCascadeAllowed(plan, {})).toEqual({ ok: true });
});
