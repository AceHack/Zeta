/**
 * skill-binding.test.ts — falsifiers for optional skill configuration.
 *
 * The settled decision under test: an unbound gate FALLS BACK to the repo default and never
 * refuses, so the zero-config organization keeps working. The risk that creates is a silent
 * fallback — configuration people stop trusting because they cannot tell what actually ran — so
 * the pinned property is that every resolution says which source answered and why.
 */

import { describe, expect, test } from "bun:test";
import { GateKind } from "./quality-gate";
import {
  bindingsOf,
  resolve,
  SkillSource,
  validateBinding,
  validateBindings,
  type SkillBinding,
} from "./skill-binding";
import { DEFAULT_GATE_SKILLS } from "./method-defaults";

const REPO: SkillBinding = {
  gate: GateKind.ImplementationReview,
  skill: "bug-fix",
  source: SkillSource.Repo,
};
const MARKET: SkillBinding = {
  gate: GateKind.ArchitectureDesign,
  skill: "arch-review-pro",
  source: SkillSource.Marketplace,
  marketplace: "anthropic-skills",
};

describe("ZERO CONFIGURATION IS THE DEFAULT, not a degraded mode", () => {
  test("an org with no bindings resolves EVERY gate — some to a default, the rest to the repo", () => {
    // The property this has always defended: a new organization is never in a degraded state. What
    // changed is that three gates now resolve to the register's own method rather than to nothing.
    // Zero configuration got BETTER, not narrower — an operator who never heard of `org skill bind`
    // now gets a requirement interviewed rather than transcribed.
    for (const gate of Object.values(GateKind)) {
      const r = resolve([], gate);
      const hasDefault = DEFAULT_GATE_SKILLS[gate] !== undefined;
      expect(r.bound).toBe(hasDefault);
      if (hasDefault) expect(r.skill).toBe(DEFAULT_GATE_SKILLS[gate]);
    }
  });

  test("the defaults are NARROW — most gates still fall back to the repo", () => {
    // A default on everything would be the register having an opinion it has not earned. It has one
    // about shaping a requirement and not about reviewing architecture, and the table has to show
    // that restraint or it is just a second hardcoded pipeline.
    const defaulted = Object.values(GateKind).filter((g) => resolve([], g).bound);
    expect(defaulted.length).toBeGreaterThan(0);
    expect(defaulted.length).toBeLessThan(Object.values(GateKind).length / 2);
  });

  test("a default is REPLACEABLE, or it is a mandate", () => {
    const gate = Object.keys(DEFAULT_GATE_SKILLS)[0] as GateKind;
    const mine = resolve([{ gate, skill: "our-own-way", source: SkillSource.Repo }], gate);
    expect(mine.bound).toBe(true);
    expect(mine.skill).toBe("our-own-way");
  });

  test("a fallback NEVER refuses — it resolves, and says it fell back", () => {
    // The settled fork. Refusing would make the zero-config path impossible and would turn every
    // newly-added gate into an outage for every org that has not heard of it.
    const r = resolve([], GateKind.QaUat);
    expect(r.bound).toBe(false);
    expect(r.skill).toBeUndefined();
    expect(r.because).toContain("repo");
  });

  test("A FALLBACK IS NEVER SILENT — every resolution explains itself", () => {
    // Configuration people cannot audit is configuration people stop trusting.
    for (const bindings of [[], [REPO], [MARKET]]) {
      for (const gate of [GateKind.QaUat, GateKind.ImplementationReview, GateKind.ArchitectureDesign]) {
        expect(resolve(bindings, gate).because.length).toBeGreaterThan(15);
      }
    }
  });

  test("binding one gate does not disturb any other", () => {
    expect(resolve([REPO], GateKind.QaUat).bound).toBe(false);
    expect(resolve([REPO], GateKind.ImplementationReview).bound).toBe(true);
  });
});

describe("a binding is used when there is one", () => {
  test("an org-wide binding answers, with its source", () => {
    const r = resolve([MARKET], GateKind.ArchitectureDesign);
    expect(r.bound).toBe(true);
    expect(r.skill).toBe("arch-review-pro");
    expect(r.source).toBe(SkillSource.Marketplace);
    expect(r.marketplace).toBe("anthropic-skills");
  });

  test("a repo binding carries no marketplace", () => {
    expect(resolve([REPO], GateKind.ImplementationReview).marketplace).toBeUndefined();
  });
});

describe("PROJECT BEATS ORGANIZATION, and says which won", () => {
  const orgWide: SkillBinding = { gate: GateKind.QaUat, skill: "house-qa", source: SkillSource.Repo };
  const scoped: SkillBinding = {
    gate: GateKind.QaUat, skill: "payments-qa", source: SkillSource.Repo, scopeWorkId: "EPIC-1",
  };

  test("a binding scoped to the item wins over the organization's", () => {
    const r = resolve([orgWide, scoped], GateKind.QaUat, ["TASK-9", "EPIC-1"]);
    expect(r.skill).toBe("payments-qa");
    expect(r.scopeWorkId).toBe("EPIC-1");
  });

  test("THE NEAREST ANCESTOR WINS, not merely any match", () => {
    // A task overriding its epic is the case that makes per-project pipelines expressible; if the
    // epic won, the nearer statement would be silently ignored.
    const onTask: SkillBinding = {
      gate: GateKind.QaUat, skill: "task-qa", source: SkillSource.Repo, scopeWorkId: "TASK-9",
    };
    const r = resolve([orgWide, scoped, onTask], GateKind.QaUat, ["TASK-9", "EPIC-1"]);
    expect(r.skill).toBe("task-qa");
  });

  test("an item outside the scope gets the organization's binding", () => {
    const r = resolve([orgWide, scoped], GateKind.QaUat, ["TASK-2", "EPIC-OTHER"]);
    expect(r.skill).toBe("house-qa");
    expect(r.scopeWorkId).toBeUndefined();
  });

  test("a scoped binding with no org-wide fallback still falls back to the repo", () => {
    const r = resolve([scoped], GateKind.QaUat, ["TASK-2", "EPIC-OTHER"]);
    expect(r.bound).toBe(false);
  });

  test("the resolution says WHICH scope answered, so a surprise is explainable", () => {
    expect(resolve([orgWide, scoped], GateKind.QaUat, ["EPIC-1"]).because).toContain("EPIC-1");
    expect(resolve([orgWide], GateKind.QaUat, ["EPIC-1"]).because).toContain("organization-wide");
  });
});

describe("a binding that cannot mean what it says is refused", () => {
  test("A MARKETPLACE SKILL THAT NAMES NO MARKETPLACE IS REFUSED", () => {
    // The id alone does not say where to get it, so an org moved to another machine would fail
    // with "skill not found" and no way to know what to install.
    // Built without the key rather than with `marketplace: undefined` — under
    // `exactOptionalPropertyTypes` those are different types, and the second does not compile.
    const bad: SkillBinding = {
      gate: MARKET.gate, skill: MARKET.skill, source: MARKET.source,
    };
    const v = validateBinding(bad);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.reason).toContain("marketplace");
  });

  test("a repo skill may not also claim a marketplace", () => {
    expect(validateBinding({ ...REPO, marketplace: "x" }).ok).toBe(false);
  });

  test("an unusable skill name is refused", () => {
    expect(validateBinding({ ...REPO, skill: "" }).ok).toBe(false);
    expect(validateBinding({ ...REPO, skill: "a; rm -rf /" }).ok).toBe(false);
  });

  test("an unknown source is refused rather than defaulted", () => {
    expect(validateBinding({ ...REPO, source: "vibes" as SkillSource }).ok).toBe(false);
  });

  test("a scoped binding with an empty work id is refused", () => {
    expect(validateBinding({ ...REPO, scopeWorkId: "  " }).ok).toBe(false);
  });

  test("valid bindings pass", () => {
    expect(validateBinding(REPO).ok).toBe(true);
    expect(validateBinding(MARKET).ok).toBe(true);
  });
});

describe("a self-contradicting configuration is refused", () => {
  test("THE SAME GATE BOUND TWICE AT THE SAME SCOPE IS REFUSED", () => {
    // Otherwise which one wins depends on array order, and the same file behaves differently
    // after an unrelated edit.
    const v = validateBindings([REPO, { ...REPO, skill: "other" }]);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.reason).toContain("twice");
  });

  test("the same gate at DIFFERENT scopes is fine — that is the override", () => {
    expect(validateBindings([REPO, { ...REPO, scopeWorkId: "EPIC-1" }]).ok).toBe(true);
  });

  test("an empty configuration is valid — it is the default", () => {
    expect(validateBindings([]).ok).toBe(true);
  });

  test("one bad binding fails the whole set", () => {
    const bad: SkillBinding = { gate: MARKET.gate, skill: MARKET.skill, source: MARKET.source };
    expect(validateBindings([REPO, bad]).ok).toBe(false);
  });

  test("listing is stable and puts organization-wide before scoped", () => {
    const listed = bindingsOf([{ ...REPO, scopeWorkId: "Z" }, REPO]);
    expect(listed[0]?.scopeWorkId).toBeUndefined();
  });
});
