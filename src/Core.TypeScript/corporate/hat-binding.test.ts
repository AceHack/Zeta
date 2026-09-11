import { describe, expect, test } from "bun:test";
import {
  activeAuthorityFor,
  advanceAll,
  advanceBinding,
  approveBinding,
  beginBinding,
  BindingPhase,
  bindingForHat,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_TTL_MS,
  DEFAULT_WARMUP_MS,
  isAuthorizing,
  isTerminal,
  mayTakeHat,
  planSuccession,
  releaseBinding,
  revokeBinding,
  SuccessionPolicy,
  timingFor,
  isInCooldown,
  type HatBinding,
} from "./hat-binding";
import { buildOrgChart, type OrgHat } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { authorityForLevel } from "../observe/room/hat-gate";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const DEV = chart.byId.get("backend_implementer")!;
const CTO = chart.byId.get("cto")!;

const must = (r: { ok: true; binding: HatBinding } | { ok: false; reason: string }): HatBinding => {
  if (!r.ok) throw new Error(r.reason);
  return r.binding;
};

/** A fresh binding for `DEV`, bound at t=0. */
const fresh = (): HatBinding =>
  must(beginBinding(DEV, { bindingId: "b1", wearerAgentId: "alexa", nowMs: 0 }));

describe("timing", () => {
  test("a hat with no timing takes the defaults", () => {
    expect(timingFor(DEV)).toEqual({
      warmupMs: DEFAULT_WARMUP_MS,
      ttlMs: DEFAULT_TTL_MS,
      cooldownMs: DEFAULT_COOLDOWN_MS,
      succession: SuccessionPolicy.Appoint,
    });
  });

  test("a hat's own timing wins", () => {
    const custom: OrgHat = { ...DEV, warmupMs: 10, ttlMs: 100, cooldownMs: 5, successionPolicy: "rotate" };
    expect(timingFor(custom)).toEqual({
      warmupMs: 10,
      ttlMs: 100,
      cooldownMs: 5,
      succession: SuccessionPolicy.Rotate,
    });
  });
});

describe("creating a binding", () => {
  test("it starts in warmup with both deadlines set", () => {
    const b = fresh();
    expect(b.phase).toBe(BindingPhase.Warmup);
    expect(b.warmupEndsMs).toBe(DEFAULT_WARMUP_MS);
    expect(b.expiresMs).toBe(DEFAULT_TTL_MS);
    expect(b.activatedAtMs).toBeUndefined();
  });

  test("a TTL that does not outlast the warmup is REFUSED", () => {
    // Such a binding expires before it can activate: it occupies the hat, starts a cooldown, and
    // never authorizes anything — it reads as "this agent is wearing the hat" and never is.
    const bad: OrgHat = { ...DEV, warmupMs: 100, ttlMs: 100 };
    const r = beginBinding(bad, { bindingId: "b", wearerAgentId: "a", nowMs: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("expire before it could activate");
  });

  test("non-positive timing is refused", () => {
    expect(beginBinding({ ...DEV, ttlMs: 0 }, { bindingId: "b", wearerAgentId: "a", nowMs: 0 }).ok).toBe(false);
    expect(beginBinding({ ...DEV, warmupMs: -1 }, { bindingId: "b", wearerAgentId: "a", nowMs: 0 }).ok).toBe(false);
  });

  test("a non-finite clock is refused rather than producing NaN deadlines", () => {
    // A NaN deadline never compares true, so the binding would never expire — permanent authority,
    // which is the exact opposite of what the deadline exists to guarantee.
    const r = beginBinding(DEV, { bindingId: "b", wearerAgentId: "a", nowMs: Number.NaN });
    expect(r.ok).toBe(false);
  });
});

describe("advancing by the clock", () => {
  test("warmup holds until its deadline, then activates", () => {
    const b = fresh();
    expect(advanceBinding(b, DEV, DEFAULT_WARMUP_MS - 1).phase).toBe(BindingPhase.Warmup);
    const active = advanceBinding(b, DEV, DEFAULT_WARMUP_MS);
    expect(active.phase).toBe(BindingPhase.Active);
    expect(active.activatedAtMs).toBe(DEFAULT_WARMUP_MS);
  });

  test("an active binding expires at its TTL, and starts a cooldown", () => {
    const active = advanceBinding(fresh(), DEV, DEFAULT_WARMUP_MS);
    const expired = advanceBinding(active, DEV, DEFAULT_TTL_MS);
    expect(expired.phase).toBe(BindingPhase.Expired);
    expect(expired.endedAtMs).toBe(DEFAULT_TTL_MS);
    expect(expired.cooldownUntilMs).toBe(DEFAULT_TTL_MS + DEFAULT_COOLDOWN_MS);
  });

  test("A LONG GAP LANDS ON EXPIRED, never on active", () => {
    // Both deadlines are due at once — a tick that skipped the whole lifetime. Checking warmup
    // first would grant authority that had already lapsed, and the longer the outage the more
    // authority it would hand out.
    const skipped = advanceBinding(fresh(), DEV, DEFAULT_TTL_MS * 10);
    expect(skipped.phase).toBe(BindingPhase.Expired);
    expect(skipped.activatedAtMs).toBeUndefined();
  });

  test("terminal bindings do not advance again", () => {
    const revoked = must(revokeBinding(fresh(), 5, "policy"));
    expect(advanceBinding(revoked, DEV, DEFAULT_TTL_MS * 10)).toEqual(revoked);
  });

  test("advancing is pure — same inputs, same result", () => {
    const b = fresh();
    expect(advanceBinding(b, DEV, 12_345)).toEqual(advanceBinding(b, DEV, 12_345));
    // …and the input is untouched.
    expect(b.phase).toBe(BindingPhase.Warmup);
  });

  test("advanceAll ticks every binding, and skips ones whose hat is unknown", () => {
    const a = fresh();
    const orphan: HatBinding = { ...a, bindingId: "b2", hatId: "ghost" };
    const [ticked, untouched] = advanceAll([a, orphan], chart, DEFAULT_WARMUP_MS);
    expect(ticked?.phase).toBe(BindingPhase.Active);
    expect(untouched).toEqual(orphan);
  });
});

describe("ONLY AN ACTIVE BINDING AUTHORIZES", () => {
  test("warming up authorizes nothing yet", () => {
    const b = fresh();
    expect(activeAuthorityFor(chart, b, 0)).toBeUndefined();
    expect(isAuthorizing(b, 0)).toBe(false);
  });

  test("active confers the hat's level authority", () => {
    const active = advanceBinding(fresh(), DEV, DEFAULT_WARMUP_MS);
    expect(activeAuthorityFor(chart, active, DEFAULT_WARMUP_MS)).toEqual(
      authorityForLevel("individual_contributor"),
    );
    expect(isAuthorizing(active, DEFAULT_WARMUP_MS)).toBe(true);
  });

  test("AN UNTICKED EXPIRY STILL DENIES — the deadline beats the field", () => {
    // A caller that has not advanced since the deadline holds a binding still marked Active.
    // Trusting the phase would make authority depend on how recently someone remembered to tick.
    const stale = advanceBinding(fresh(), DEV, DEFAULT_WARMUP_MS);
    expect(stale.phase).toBe(BindingPhase.Active);
    expect(activeAuthorityFor(chart, stale, DEFAULT_TTL_MS + 1)).toBeUndefined();
    expect(isAuthorizing(stale, DEFAULT_TTL_MS + 1)).toBe(false);
  });

  test("released and revoked bindings authorize nothing", () => {
    const active = advanceBinding(fresh(), DEV, DEFAULT_WARMUP_MS);
    const released = must(releaseBinding(active, DEV, 100, "done"));
    const revoked = must(revokeBinding(active, 100, "incident"));
    expect(activeAuthorityFor(chart, released, 101)).toBeUndefined();
    expect(activeAuthorityFor(chart, revoked, 101)).toBeUndefined();
  });

  test("a binding on a hat that is not in the chart authorizes nothing", () => {
    const active = advanceBinding(fresh(), DEV, DEFAULT_WARMUP_MS);
    expect(activeAuthorityFor(chart, { ...active, hatId: "ghost" }, DEFAULT_WARMUP_MS)).toBeUndefined();
  });

  test("different hats confer different authority", () => {
    const dev = advanceBinding(fresh(), DEV, DEFAULT_WARMUP_MS);
    const boss = advanceBinding(
      must(beginBinding(CTO, { bindingId: "b2", wearerAgentId: "otto", nowMs: 0 })),
      CTO,
      DEFAULT_WARMUP_MS,
    );
    expect(activeAuthorityFor(chart, dev, DEFAULT_WARMUP_MS)?.canMerge).toBe(false);
    expect(activeAuthorityFor(chart, boss, DEFAULT_WARMUP_MS)?.canMerge).toBe(true);
  });
});

describe("ending a binding", () => {
  test("release serves a cooldown", () => {
    const r = releaseBinding(fresh(), DEV, 500, "handing off");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.binding.phase).toBe(BindingPhase.Released);
    expect(r.binding.cooldownUntilMs).toBe(500 + DEFAULT_COOLDOWN_MS);
    expect(r.binding.reason).toBe("handing off");
  });

  test("REVOCATION SETS NO COOLDOWN — a timer would say the wrong thing", () => {
    // Cooldown stops an agent cycling a hat to refresh its own authority. A revocation is a
    // decision that this agent should not hold it; expressing that as a timer would say it may
    // take it back once the timer runs out.
    const r = revokeBinding(fresh(), 500, "policy violation");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.binding.phase).toBe(BindingPhase.Revoked);
    expect(r.binding.cooldownUntilMs).toBeUndefined();
  });

  test("a terminal binding cannot be ended twice", () => {
    const released = must(releaseBinding(fresh(), DEV, 1, "x"));
    expect(releaseBinding(released, DEV, 2, "again").ok).toBe(false);
    expect(revokeBinding(released, 2, "again").ok).toBe(false);
  });

  test("approve moves pending to warmup and starts the clock there", () => {
    const pending: HatBinding = { ...fresh(), phase: BindingPhase.Pending };
    const r = approveBinding(pending, DEV, 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.binding.phase).toBe(BindingPhase.Warmup);
    expect(r.binding.boundAtMs).toBe(1000);
    expect(r.binding.warmupEndsMs).toBe(1000 + DEFAULT_WARMUP_MS);
  });

  test("approving something not pending is refused", () => {
    expect(approveBinding(fresh(), DEV, 1000).ok).toBe(false);
  });

  test("terminal phases are exactly the four that end it", () => {
    expect(isTerminal(BindingPhase.Expired)).toBe(true);
    expect(isTerminal(BindingPhase.Released)).toBe(true);
    expect(isTerminal(BindingPhase.Revoked)).toBe(true);
    expect(isTerminal(BindingPhase.Succeeded)).toBe(true);
    expect(isTerminal(BindingPhase.Warmup)).toBe(false);
    expect(isTerminal(BindingPhase.Active)).toBe(false);
    expect(isTerminal(BindingPhase.Pending)).toBe(false);
  });
});

describe("one wearer at a time, and a cooldown between", () => {
  test("a hat held by a live binding cannot be taken", () => {
    const b = fresh();
    const r = mayTakeHat([b], "otto", DEV.id, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("held by 'alexa'");
  });

  test("once it ends, someone else may take it immediately", () => {
    const ended = must(releaseBinding(fresh(), DEV, 100, "done"));
    expect(mayTakeHat([ended], "otto", DEV.id, 101).ok).toBe(true);
  });

  test("…but the PREVIOUS WEARER must wait out the cooldown", () => {
    const ended = must(releaseBinding(fresh(), DEV, 100, "done"));
    const during = mayTakeHat([ended], "alexa", DEV.id, 101);
    expect(during.ok).toBe(false);
    if (!during.ok) expect(during.reason).toContain("cooling down");
    expect(mayTakeHat([ended], "alexa", DEV.id, 100 + DEFAULT_COOLDOWN_MS).ok).toBe(true);
  });

  test("cooldown is per (agent, hat) — not a ban from the whole organization", () => {
    // Otherwise finishing a stint as tech lead would bar an agent from every other hat, making
    // cooldown a punishment rather than a rotation.
    const ended = must(releaseBinding(fresh(), DEV, 100, "done"));
    expect(mayTakeHat([ended], "alexa", "frontend_implementer", 101).ok).toBe(true);
  });

  test("a REVOKED binding leaves no cooldown to wait out", () => {
    const revoked = must(revokeBinding(fresh(), 100, "policy"));
    expect(mayTakeHat([revoked], "alexa", DEV.id, 101).ok).toBe(true);
  });

  test("bindingForHat finds the live one and ignores the dead", () => {
    const dead = must(releaseBinding(fresh(), DEV, 10, "x"));
    const live: HatBinding = { ...fresh(), bindingId: "b2", wearerAgentId: "otto" };
    expect(bindingForHat([dead, live], DEV.id)?.bindingId).toBe("b2");
    expect(bindingForHat([dead], DEV.id)).toBeUndefined();
  });
});

describe("succession", () => {
  const roster = ["a", "b", "c"];
  const withPolicy = (p: NonNullable<OrgHat["successionPolicy"]>): OrgHat => ({ ...DEV, successionPolicy: p });

  test("rotate takes the next candidate, wrapping", () => {
    expect(
      planSuccession({ hat: withPolicy("rotate"), candidateAgentIds: roster, lastWearerAgentId: "a" })
        .nextWearerAgentId,
    ).toBe("b");
    expect(
      planSuccession({ hat: withPolicy("rotate"), candidateAgentIds: roster, lastWearerAgentId: "c" })
        .nextWearerAgentId,
    ).toBe("a");
  });

  test("rotate starts from the top when the last wearer has left the pool", () => {
    // A hat that cannot be handed on because its previous holder is gone is the succession problem,
    // not a solution to it.
    expect(
      planSuccession({ hat: withPolicy("rotate"), candidateAgentIds: roster, lastWearerAgentId: "gone" })
        .nextWearerAgentId,
    ).toBe("a");
  });

  test("rotate with an empty roster names nobody", () => {
    expect(
      planSuccession({ hat: withPolicy("rotate"), candidateAgentIds: [], lastWearerAgentId: "a" })
        .nextWearerAgentId,
    ).toBeUndefined();
  });

  test("renew keeps the same wearer", () => {
    expect(
      planSuccession({ hat: withPolicy("renew"), candidateAgentIds: roster, lastWearerAgentId: "b" })
        .nextWearerAgentId,
    ).toBe("b");
  });

  test("APPOINT and NONE leave the successor undecided — an authority decides", () => {
    // Inventing a successor here would be this module making a staffing decision it has no standing
    // to make.
    for (const p of ["appoint", "none"] as const) {
      const plan = planSuccession({ hat: withPolicy(p), candidateAgentIds: roster, lastWearerAgentId: "a" });
      expect(plan.nextWearerAgentId).toBeUndefined();
      expect(plan.candidateAgentIds).toEqual(roster);
    }
  });
});

describe("isInCooldown — the staffing rule, out where it can be falsified", () => {
  const binding = (over: Partial<HatBinding> = {}): HatBinding =>
    ({ hatId: "tech_lead", wearerAgentId: "a1", cooldownUntilMs: 1_000, ...over }) as HatBinding;

  test("inside the window, cooling", () => {
    expect(isInCooldown([binding()], "tech_lead", "a1", 500)).toBe(true);
  });

  test("past the window, not cooling — the boundary is exclusive at the end", () => {
    expect(isInCooldown([binding()], "tech_lead", "a1", 1_000)).toBe(false);
    expect(isInCooldown([binding()], "tech_lead", "a1", 1_001)).toBe(false);
  });

  test("A MISSING cooldown is NOT cooling", () => {
    // The conservative direction is the wrong one here. A binding that never recorded a cooldown
    // is one whose cooldown never started; reading that silence as "still cooling" would strand an
    // agent forever on the strength of an absent field.
    // Built by omission rather than by an explicit `undefined`: under `exactOptionalPropertyTypes`
    // those are different things, and the case that actually occurs is the field being ABSENT.
    const noCooldown = { hatId: "tech_lead", wearerAgentId: "a1" } as HatBinding;
    expect(isInCooldown([noCooldown], "tech_lead", "a1", 0)).toBe(false);
  });

  test("it is scoped to the HAT and the AGENT, not to either alone", () => {
    const bs = [binding()];
    expect(isInCooldown(bs, "engineering_manager", "a1", 500)).toBe(false);
    expect(isInCooldown(bs, "tech_lead", "a2", 500)).toBe(false);
  });

  test("ANY matching binding cools — the newest does not have to be the one", () => {
    const bs = [binding({ cooldownUntilMs: 10 }), binding({ cooldownUntilMs: 9_000 })];
    expect(isInCooldown(bs, "tech_lead", "a1", 500)).toBe(true);
  });

  test("no bindings at all is not cooling", () => {
    expect(isInCooldown([], "tech_lead", "a1", 500)).toBe(false);
  });
});

describe("A HAT IS A ROLE: it takes as many wearers as the RMO authorized, and never one agent twice", () => {
  const { mayTakeHat, BindingPhase } = require("./hat-binding") as typeof import("./hat-binding");
  const live = (agent: string) => ({ bindingId: `b-${agent}`, hatId: "backend_implementer", wearerAgentId: agent, phase: BindingPhase.Warmup, boundAtMs: 0, warmupEndsMs: 10, expiresMs: 1000 });
  test("default supply 1: a second agent is refused — one wearer at a time, as before", () => {
    expect(mayTakeHat([live("a")] as never, "b", "backend_implementer", 5).ok).toBe(false);
  });
  test("supply 2: a second agent may wear it; a third may not", () => {
    expect(mayTakeHat([live("a")] as never, "b", "backend_implementer", 5, 2).ok).toBe(true);
    expect(mayTakeHat([live("a"), live("b")] as never, "c", "backend_implementer", 5, 2).ok).toBe(false);
  });
  test("the SAME agent is refused a hat it already holds, whatever the supply", () => {
    const r = mayTakeHat([live("a")] as never, "a", "backend_implementer", 5, 5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("already held by 'a'");
  });
});
