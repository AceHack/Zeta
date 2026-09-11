/**
 * practice.test.ts — the process as configuration.
 *
 * The properties worth defending hardest are the ones this register has already paid for twice
 * elsewhere: a configuration row that is STORED AND INERT reads exactly like one that governs
 * something, and a listing that reports what was typed rather than what is in force tells an
 * operator their organization has no process while it is following one.
 */

import { describe, expect, test } from "bun:test";
import { WorkState, WorkType, type Cascade, type CascadeNode } from "./goal-cascade";
import { GateKind } from "./quality-gate";
import { SkillSource } from "./skill-binding";
import {
  declinePractice,
  directivesInForce,
  guidanceFrom,
  isDeclined,
  practicesInForce,
  PracticeSubjectKind,
  renderPractice,
  resolvePractice,
  subjectRosterFor,
  validateDirective,
  validatePractice,
  validatePractices,
  ProcessSetting,
  resolveSetting,
  SETTING_VALUES,
  validateSetting,
  validateSettings,
  type Directive,
  type Practice,
  type SettingBinding,
} from "./practice";

const gateSubject = { kind: PracticeSubjectKind.Gate, id: String(GateKind.BrdApproval) } as const;
const defectSubject = { kind: PracticeSubjectKind.WorkType, id: String(WorkType.Defect) } as const;

function practice(over: Partial<Practice> = {}): Practice {
  return {
    subject: gateSubject,
    skills: [{ skill: "house-brd", source: SkillSource.Repo }],
    directive: "a BRD names the audience, the decision, and what done looks like",
    why: "our BRDs are read by finance, so the decision has to be on the first page",
    ...over,
  };
}

describe("A SUBJECT MUST BE SOMETHING THAT EXISTS", () => {
  test("the rosters come from the vocabularies that already define them", () => {
    // Not restated here. A second copy of the gate list would drift from the first, and a subject
    // validated against a stale copy is a practice that matches nothing.
    expect(subjectRosterFor(PracticeSubjectKind.Gate)).toContain(String(GateKind.BrdApproval));
    expect(subjectRosterFor(PracticeSubjectKind.Verb)).toContain("request_information");
    expect(subjectRosterFor(PracticeSubjectKind.WorkType)).toContain("defect");
  });

  test("a misspelled subject is REFUSED, not stored", () => {
    // The vacuity class, entered through a typo: a practice attached to `brd_aproval` governs
    // nothing, is matched by nothing, and appears in every listing as process.
    const bad = validatePractice(practice({ subject: { kind: PracticeSubjectKind.Gate, id: "brd_aproval" } }));
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("expected a refusal");
    expect(bad.reason).toContain("brd_aproval");
  });

  test("an UNKNOWN SUBJECT KIND refuses every id rather than admitting all of them", () => {
    // A kind added without a roster must fail loudly at the first bind. An empty roster that read as
    // "no constraint" would make the new kind accept anything, which is the opposite of the guard.
    expect(subjectRosterFor("epic" as PracticeSubjectKind)).toEqual([]);
    const bad = validatePractice(practice({ subject: { kind: "epic" as PracticeSubjectKind, id: "anything" } }));
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("expected a refusal");
    // THE MESSAGE, not just the refusal — and that distinction is what a mutation exposed. An empty
    // roster refuses every id either way, so deleting the kind check changed nothing observable
    // except which of two sentences an operator reads. The sentence IS the value: "'epic' is not a
    // subject kind" sends them to the right place, and "'anything' is not a epic — known: " sends
    // them looking for a roster that does not exist.
    expect(bad.reason).toContain("not a subject kind");
  });
});

describe("A PRACTICE MUST GOVERN SOMETHING, AND SAY WHY", () => {
  test("no reason is refused", () => {
    const bad = validatePractice(practice({ why: "  " }));
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("expected a refusal");
    expect(bad.reason).toContain("instruction");
  });

  test("NEITHER SKILLS NOR A DIRECTIVE is refused — that row changes nothing", () => {
    const bad = validatePractice(practice({ skills: [], directive: "" }));
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("expected a refusal");
    expect(bad.reason).toContain("governs nothing");
  });

  test("...but EITHER ONE ALONE is a real configuration", () => {
    // Both halves matter independently. "This is how we do it" often has no skill, and a routing
    // chain often needs no prose — refusing either would force operators to invent the other.
    expect(validatePractice(practice({ skills: [] })).ok).toBe(true);
    const noDirective: Practice = {
      subject: gateSubject,
      skills: [{ skill: "house-brd", source: SkillSource.Repo }],
      why: "the chain is the whole statement here",
    };
    expect(validatePractice(noDirective).ok).toBe(true);
  });

  test("a REPEATED SKILL is refused: order is precedence, so a repeat says two things", () => {
    const bad = validatePractice(
      practice({
        skills: [
          { skill: "a", source: SkillSource.Repo },
          { skill: "b", source: SkillSource.Repo },
          { skill: "a", source: SkillSource.Repo },
        ],
      }),
    );
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("expected a refusal");
    expect(bad.reason).toContain("twice");
  });

  test("a marketplace skill naming no marketplace is refused", () => {
    const bad = validatePractice(
      practice({ skills: [{ skill: "pro-brd", source: SkillSource.Marketplace }] }),
    );
    expect(bad.ok).toBe(false);
  });

  test("TWO PRACTICES FOR ONE SUBJECT AT ONE SCOPE are refused", () => {
    // Otherwise resolution goes by array order — a rule nobody stated and nobody can see.
    const bad = validatePractices([practice(), practice({ why: "a different reason" })]);
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("expected a refusal");
    expect(bad.reason).toContain("already has a practice");
  });

  test("...but the same subject at DIFFERENT scopes is the point of the layer", () => {
    expect(validatePractices([practice(), practice({ scopeWorkId: "pilot-1" })]).ok).toBe(true);
  });
});

describe("SCOPE: a programme, or a stage of one, can run its own process", () => {
  const orgWide = practice({ directive: "the full review", why: "regulated release" });
  const pilot = practice({
    scopeWorkId: "pilot-1",
    skills: [{ skill: "light-brd", source: SkillSource.Repo }],
    directive: "one page, no sign-off",
    why: "a pilot that takes three weeks to approve is not a pilot",
  });

  test("the NEAREST scope wins", () => {
    const r = resolvePractice([orgWide, pilot], gateSubject, ["task-1", "pilot-1", "goal-1"]);
    expect(r.governed).toBe(true);
    expect(r.directive).toBe("one page, no sign-off");
    expect(r.scopeWorkId).toBe("pilot-1");
    expect(r.because).toContain("pilot-1");
  });

  test("...and out of that scope the organization-wide one applies", () => {
    const r = resolvePractice([orgWide, pilot], gateSubject, ["task-9", "other-goal"]);
    expect(r.directive).toBe("the full review");
    expect(r.scopeWorkId).toBeUndefined();
  });

  test("A SCOPE INHERITS WHOLE OR STATES ITS OWN — never a merge", () => {
    // Merging two ordered lists needs an interleaving rule nobody stated and no reader could
    // predict, and a programme that deliberately runs a LIGHTER process would find the parent's
    // steps reappearing inside its own. So the pilot's chain is exactly its own.
    const r = resolvePractice([orgWide, pilot], gateSubject, ["pilot-1"]);
    expect(r.skills.map((s) => s.skill)).toEqual(["light-brd"]);
    expect(r.skills.map((s) => s.skill)).not.toContain("house-brd");
  });

  test("nothing stated anywhere is GOVERNED: false, and says so", () => {
    const r = resolvePractice([], gateSubject, ["task-1"]);
    expect(r.governed).toBe(false);
    expect(r.skills).toEqual([]);
    expect(r.because).toContain("however the repository and the agent see fit");
  });
});

describe("THE REGISTER'S DEFAULTS, AND THE THIRD STATE THAT KEEPS THEM FROM BEING MANDATES", () => {
  const registerDefault = practice({
    subject: defectSubject,
    skills: [],
    directive: "reproduce first, keep the reproduction as a test",
    why: "a fix with no falsifier is a belief about the defect",
  });

  test("an organization that stated nothing still has a process, marked as a default", () => {
    const r = resolvePractice([], defectSubject, ["task-1"], [registerDefault]);
    expect(r.governed).toBe(true);
    expect(r.byDefault).toBe(true);
    expect(r.because).toContain("register's own practice");
  });

  test("its own statement REPLACES the default and is not marked as one", () => {
    const own = practice({ subject: defectSubject, directive: "just fix it", why: "we ship hourly" });
    const r = resolvePractice([own], defectSubject, ["task-1"], [registerDefault]);
    expect(r.byDefault).toBeUndefined();
    expect(r.directive).toBe("just fix it");
  });

  test("A DEFAULT CAN BE DECLINED, and the decline carries its reason", () => {
    // Without this a default is a mandate: an operator who disagrees could only replace it with
    // another process, never say "neither". `declinePractice` is the only way to build the empty
    // shape, because `validatePractice` refuses it typed by hand.
    const declined = declinePractice(defectSubject, "our defects are triaged by a separate team");
    expect(isDeclined(declined)).toBe(true);
    expect(declined.why).toContain("separate team");
    // It wins over the default, and what it says is that nothing governs this.
    const r = resolvePractice([declined], defectSubject, ["task-1"], [registerDefault]);
    expect(r.skills).toEqual([]);
    // NO DIRECTIVE AT ALL, not an empty one. A decline is now declared by its own field, so it no
    // longer has to fake emptiness to be recognised.
    expect(r.directive).toBeUndefined();
    // AND IT REACHES AN AGENT AS SILENCE. My first version of this assertion expected the reason
    // to be rendered, and the fix that followed is the better answer: a heading with a `because`
    // and no process between them reads as an EMPTY rule rather than an absent one. The reason is
    // configuration — `org practice list` shows it — not part of the brief.
    expect(renderPractice(r)).toBe("");
    // …but the resolution still carries it, so a listing can explain the silence.
    expect(r.why).toContain("separate team");
  });

  test("A DECLINE SURVIVES VALIDATION — the boundary the CLI crosses on every write", () => {
    // CAUGHT BY WALKING THE CLI, not by a test. `org practice unbind` builds this shape and the
    // registry's `validatePractices` refused it:
    //
    //     a practice must carry at least one skill or a directive, or it governs nothing
    //
    // Both rules were right on their own — a row that governs nothing reads like process, and a
    // default that cannot be turned off is a mandate — and inferring the difference from SHAPE could
    // never satisfy both, because an accidental empty and a deliberate decline look identical.
    //
    // The earlier tests all called `declinePractice` and `resolvePractice` directly and never sent
    // the result through validation, so the one operation an operator actually performs was untested.
    const declined = declinePractice(defectSubject, "triaged by a separate team");
    expect(validatePractice(declined).ok).toBe(true);
    expect(validatePractices([declined]).ok).toBe(true);
  });

  test("...and it is DECLARED, not inferred from being empty", () => {
    // The field is what a reader of the registry file sees, and what `isDeclined` reads. An empty row
    // that merely looks declined is still refused, so a decline cannot be typed by accident.
    const declined = declinePractice(defectSubject, "w");
    expect(declined.declined).toBe(true);
    expect(isDeclined(declined)).toBe(true);

    const accidentallyEmpty: Practice = { subject: defectSubject, skills: [], directive: "", why: "w" };
    expect(isDeclined(accidentallyEmpty)).toBe(false);
    const bad = validatePractice(accidentallyEmpty);
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("expected a refusal");
    // …and the refusal points at the command that does mean it.
    expect(bad.reason).toContain("org practice unbind");
  });

  test("DECLINING AND STATING AT ONCE is a contradiction, and is refused", () => {
    // An exception with no boundary is a licence. Permitting the empty row for a declared decline
    // must not permit a decline that also carries a process — which of the two would apply?
    const both: Practice = {
      subject: defectSubject,
      skills: [{ skill: "some-skill", source: SkillSource.Repo }],
      declined: true,
      why: "w",
    };
    const bad = validatePractice(both);
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("expected a refusal");
    expect(bad.reason).toContain("decline it or state it, not both");
  });

  test("the listing reports what is IN FORCE, defaults included and labelled", () => {
    // The lesson `org method list` and `org skill list` both had to learn: a listing that shows only
    // what was typed tells an operator they have no process while they are following one.
    const rows = practicesInForce([practice()], [registerDefault]);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.byDefault)).toHaveLength(1);
    expect(rows.find((r) => r.byDefault)?.practice.subject.id).toBe("defect");
    // …and a default the organization replaced is NOT also listed as a default.
    const replaced = practicesInForce([practice({ subject: defectSubject })], [registerDefault]);
    expect(replaced).toHaveLength(1);
    expect(replaced[0]?.byDefault).toBe(false);
  });
});

describe("A PROCESS SETTING IS A CLOSED ROSTER, BOTH HALVES", () => {
  // Written with four refusals and NOT ONE of them asserted — the matrix found every one. A validator
  // nothing calls is the vacuity class with a type signature.

  const ok: SettingBinding = {
    setting: ProcessSetting.IntegrationBranch,
    value: "direct",
    scope: "AIAGENT-796",
    why: "a stabilization epic gathers unrelated work",
  };

  test("a good binding passes", () => {
    expect(validateSetting(ok).ok).toBe(true);
    expect(validateSettings([ok]).ok).toBe(true);
  });

  test("AN UNKNOWN SETTING NAME is refused, and the message names what exists", () => {
    // A free-form key would store, list as configuration, and govern nothing.
    const bad = validateSetting({ ...ok, setting: "integraton_branch" as ProcessSetting });
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("expected a refusal");
    expect(bad.reason).toContain("not a process setting");
    expect(bad.reason).toContain("integration_branch");
  });

  test("AN ILLEGAL VALUE is refused, and the message names what is legal", () => {
    const bad = validateSetting({ ...ok, value: "directly" });
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("expected a refusal");
    expect(bad.reason).toContain("directly");
    expect(bad.reason).toContain("collect");
    // …and the roster is what the refusal is checked against, not a second copy of it.
    expect(SETTING_VALUES[ProcessSetting.IntegrationBranch]).toEqual(["collect", "direct"]);
  });

  test("NO REASON is refused — a knob with none is indistinguishable from a typo", () => {
    const bad = validateSetting({ ...ok, why: "   " });
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("expected a refusal");
    expect(bad.reason).toContain("no reason");
  });

  test("TWO VALUES FOR ONE SETTING AT ONE SCOPE are refused", () => {
    // Two would resolve by array order — a rule nobody stated and nobody can see.
    const bad = validateSettings([ok, { ...ok, value: "collect" }]);
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("expected a refusal");
    expect(bad.reason).toContain("already set");
    // …but the same setting at DIFFERENT scopes is the point of scoping.
    expect(validateSettings([ok, { ...ok, scope: "AIAGENT-1519", value: "collect" }]).ok).toBe(true);
    // …and org-wide is a different scope from any item.
    expect(validateSettings([ok, { setting: ok.setting, value: "collect", why: "w" }]).ok).toBe(true);
  });

  test("UNSET ANSWERS NOTHING, and that is a real answer", () => {
    // The mechanical default applies. A resolver that invented a value here would silently replace
    // that default with a guess, which is worse than either.
    const r = resolveSetting([], ProcessSetting.IntegrationBranch, ["AIAGENT-796"]);
    expect(r.value).toBeUndefined();
    expect(r.because).toContain("mechanical default");
  });

  test("the NEAREST scope wins, then organization-wide", () => {
    const orgWide: SettingBinding = { setting: ok.setting, value: "collect", why: "we branch everything" };
    expect(resolveSetting([orgWide, ok], ok.setting, ["AIAGENT-796"]).value).toBe("direct");
    expect(resolveSetting([orgWide, ok], ok.setting, ["AIAGENT-1519"]).value).toBe("collect");
    expect(resolveSetting([orgWide, ok], ok.setting, ["AIAGENT-1519"]).because).toContain("organization-wide");
  });
});

describe("STANDING DIRECTIVES hold regardless of what is being done", () => {
  const repoFirst: Directive = {
    id: "repo-skills-first",
    text: "prefer the skills the repository already provides",
    why: "they are specific to the codebase in a way nothing configured here can be",
  };

  test("the register's default holds when the organization says nothing", () => {
    const rows = directivesInForce(undefined, [repoFirst]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.byDefault).toBe(true);
  });

  test("a statement with the SAME ID replaces rather than accumulating", () => {
    const rows = directivesInForce(
      [{ id: "repo-skills-first", text: "ours instead", why: "we vendored them" }],
      [repoFirst],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.directive.text).toBe("ours instead");
    expect(rows[0]?.byDefault).toBe(false);
  });

  test("EMPTY TEXT DECLINES IT — the third state again", () => {
    const rows = directivesInForce(
      [{ id: "repo-skills-first", text: "", why: "our repositories' skills are stale" }],
      [repoFirst],
    );
    expect(rows).toEqual([]);
  });

  test("an id the register has no opinion about is kept", () => {
    const rows = directivesInForce(
      [{ id: "no-force-push", text: "never force-push a shared branch", why: "it loses other people's work" }],
      [repoFirst],
    );
    expect(rows.map((r) => r.directive.id)).toEqual(["repo-skills-first", "no-force-push"]);
  });

  test("an id or a reason that cannot mean anything is refused", () => {
    expect(validateDirective({ id: "", text: "x", why: "y" }).ok).toBe(false);
    expect(validateDirective({ id: "Repo Skills", text: "x", why: "y" }).ok).toBe(false);
    expect(validateDirective({ id: "ok-id", text: "x", why: "  " }).ok).toBe(false);
    expect(validateDirective({ id: "ok-id", text: "x", why: "because" }).ok).toBe(true);
  });
});

describe("WHAT REACHES THE AGENT", () => {
  const node = (workId: string, workType: WorkType, parentWorkId?: string): CascadeNode => ({
    workId,
    workType,
    title: `do ${workId}`,
    state: WorkState.Open,
    ownerHatId: "tech_lead",
    ...(parentWorkId === undefined ? {} : { parentWorkId }),
  });

  const cascade: Cascade = {
    nodes: [node("goal-1", WorkType.Goal), node("proj-1", WorkType.Project, "goal-1"), node("leaf-1", WorkType.Defect, "proj-1")],
  };

  test("the ORDER of the skills survives, numbered, because precedence was the point", () => {
    // A list an agent reads as unordered is a list whose precedence was configured and then thrown
    // away on the way out.
    const r = resolvePractice(
      [practice({ skills: [
        { skill: "first", source: SkillSource.Repo },
        { skill: "second", source: SkillSource.Local },
        { skill: "third", source: SkillSource.Marketplace, marketplace: "acme" },
      ] })],
      gateSubject,
    );
    const rendered = renderPractice(r);
    expect(rendered).toContain("1. first");
    expect(rendered).toContain("2. second");
    expect(rendered).toContain("3. third  (marketplace:acme)");
    expect(rendered.indexOf("1. first")).toBeLessThan(rendered.indexOf("2. second"));
  });

  test("BOTH the gate's practice and the work type's reach the agent, each labelled", () => {
    // Neither subsumes the other: "how we review" and "what solving a defect means here" are
    // different statements, and an agent needs both to know which it may disagree with.
    const guide = guidanceFrom({
      practices: [
        practice({ subject: gateSubject, directive: "the BRD names the decision", why: "finance reads it" }),
        practice({ subject: defectSubject, skills: [], directive: "keep the reproduction", why: "a fix needs a falsifier" }),
      ],
      cascade,
    });
    const out = guide(String(GateKind.BrdApproval), node("leaf-1", WorkType.Defect, "proj-1"));
    expect(out.practice).toContain("the BRD names the decision");
    expect(out.practice).toContain("keep the reproduction");
    expect(out.practice).toContain(`the '${String(GateKind.BrdApproval)}' gate`);
    expect(out.practice).toContain("work of kind 'defect'");
  });

  test("SCOPE IS TAKEN FROM THE CASCADE, so a practice stated for a project reaches its tasks", () => {
    // Computed here rather than asked of the caller: a caller that forgot would silently get
    // organization-wide answers, and the whole scoping feature would be inert.
    const guide = guidanceFrom({
      practices: [
        practice({ subject: gateSubject, directive: "the full review", why: "default" }),
        practice({ subject: gateSubject, scopeWorkId: "proj-1", directive: "one page", why: "a pilot" }),
      ],
      cascade,
    });
    const out = guide(String(GateKind.BrdApproval), node("leaf-1", WorkType.Defect, "proj-1"));
    expect(out.practice).toContain("one page");
    expect(out.practice).not.toContain("the full review");
  });

  test("AN UNGOVERNED SUBJECT EMITS NOTHING rather than an empty statement", () => {
    // An agent must be able to tell "this organization states no process" from "the process is
    // empty". A variable present and blank is the second, and it is a lie.
    const guide = guidanceFrom({ cascade });
    const out = guide(String(GateKind.QaUat), node("leaf-1", WorkType.Task, "proj-1"));
    expect(out.practice).toBeUndefined();
    expect(out.directives).toBeUndefined();
    expect(out.repoSkills).toBeUndefined();
  });

  test("the standing directives reach the agent WITH their reasons", () => {
    const guide = guidanceFrom({
      defaultDirectives: [{ id: "repo-skills-first", text: "prefer the repo's own", why: "they are specific to it" }],
      cascade,
    });
    const out = guide(String(GateKind.QaUat), node("leaf-1", WorkType.Task, "proj-1"));
    expect(out.directives).toContain("prefer the repo's own");
    // The REASON travels. A directive an agent cannot evaluate is one it follows because it arrived.
    expect(out.directives).toContain("because they are specific to it");
  });

  test("a declined practice reaches the agent as NOTHING, not as an empty process", () => {
    const guide = guidanceFrom({
      practices: [declinePractice(defectSubject, "triaged elsewhere")],
      defaultPractices: [practice({ subject: defectSubject, skills: [], directive: "keep the reproduction", why: "falsifier" })],
      cascade,
    });
    const out = guide(String(GateKind.QaUat), node("leaf-1", WorkType.Defect, "proj-1"));
    // The default is suppressed rather than reappearing, and nothing empty is emitted in its place.
    expect(out.practice).toBeUndefined();
  });
});
