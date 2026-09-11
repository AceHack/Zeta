/**
 * practice-reaches-agent.test.ts — THE JOIN, asserted against a real spawned process.
 *
 * ── WHY THIS FILE EXISTS SEPARATELY ──────────────────────────────────────────
 * `practice.test.ts` proves the process RESOLVES correctly. That is the easy half, and on its own it
 * is exactly the shape of every configuration surface this register has caught being fiction: a
 * resolver with full coverage, and nothing that hands the answer to anybody.
 *
 * `Method` shipped that way — `org-drive.ts` never passed it and nothing read `methodFor`, so the
 * whole seam was dead while its unit tests were green. `changed` on the provider wrapper shipped that
 * way for the wrapper's entire life. So the guidance is asserted where it has to arrive: in the
 * ENVIRONMENT OF AN ACTUAL CHILD PROCESS, spawned by the adapter agents really run under.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commandArtifactProducer } from "./adapters";
import { GateKind } from "./quality-gate";
import { WorkState, WorkType, type Cascade, type CascadeNode } from "./goal-cascade";
import { guidanceFrom, PracticeSubjectKind, type Directive, type Practice } from "./practice";
import { DEFAULT_DIRECTIVES, DEFAULT_PRACTICES, REPO_SKILLS_FIRST } from "./practice-defaults";
import { SkillSource } from "./skill-binding";

const NODE = process.execPath;

function nodeAt(over: Partial<CascadeNode> = {}): CascadeNode {
  return {
    workId: "leaf-1",
    workType: WorkType.Defect,
    title: "checkout double-charges",
    state: WorkState.Open,
    ownerHatId: "tech_lead",
    parentWorkId: "proj-1",
    ...over,
  } as CascadeNode;
}

const cascade: Cascade = {
  nodes: [
    { workId: "goal-1", workType: WorkType.Goal, title: "g", state: WorkState.Open, ownerHatId: "cto" },
    { workId: "proj-1", workType: WorkType.Project, title: "p", state: WorkState.Open, ownerHatId: "tech_lead", parentWorkId: "goal-1" },
    nodeAt(),
  ],
};

/**
 * Spawn the producer and read back the environment the child actually received.
 *
 * The child prints its own `ORG_*` variables as JSON. Nothing else in this file trusts a claim about
 * what was passed — the assertion is on what arrived.
 */
async function envSeenBy(
  guidanceFor: ReturnType<typeof guidanceFrom> | undefined,
  gate: GateKind = GateKind.ImplementationReview,
): Promise<Record<string, string>> {
  // A SCRIPT FILE, not `-e`, and the child writes to a FILE rather than to stderr. Both of those are
  // corrections to earlier attempts, and both mattered:
  //
  //   - the adapter does not forward the child's stderr, so reading it there compared `undefined`
  //     against every expected string — and the two tests expecting UNDEFINED then passed for
  //     entirely the wrong reason, which is the more dangerous half of that mistake.
  //   - `process.execPath` under `bun test` is BUN, and `bun -e` does not pass a trailing argument to
  //     the snippet the way `node -e` does. A file behaves identically under both runtimes.
  const dir = mkdtempSync(join(tmpdir(), "practice-env-"));
  const probe = join(dir, "probe.cjs");
  const out = join(dir, "env.json");
  writeFileSync(
    probe,
    'const fs = require("fs");\n' +
      'fs.writeFileSync(process.argv[2], JSON.stringify(Object.fromEntries(\n' +
      '  Object.entries(process.env).filter(([k]) => k.startsWith("ORG_")),\n' +
      ')));\n' +
      // DOUBLED ON PURPOSE. A single-quoted TS string turns \\n into a REAL newline, so the
      // probe file was written with an unterminated string literal and the child exited 1 —
      // reported by the adapter as "produced nothing", which points at the wrong thing entirely.
      'process.stdout.write("/tmp/a.md\\n");\n',
  );

  try {
    const producer = commandArtifactProducer({
      command: NODE,
      gate,
      cwd: process.cwd(),
      argsFor: () => [probe, out],
      ...(guidanceFor === undefined ? {} : { guidanceFor: (g, n) => guidanceFor(String(g), n) }),
    });

    const r = await producer.produce(nodeAt(), { branch: "b", priorArtifacts: new Map() });
    if (!r.ok) throw new Error(r.reason);
    return JSON.parse(readFileSync(out, "utf-8")) as Record<string, string>;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("THE PROCESS REACHES THE PROCESS", () => {
  test("a stated practice arrives in the agent's environment", async () => {
    const practices: readonly Practice[] = [
      {
        subject: { kind: PracticeSubjectKind.Gate, id: String(GateKind.ImplementationReview) },
        skills: [
          { skill: "house-review", source: SkillSource.Repo },
          { skill: "deep-review", source: SkillSource.Local },
        ],
        directive: "review the diff against the ticket, not against your own idea of the feature",
        why: "our reviewers kept redesigning work that was already agreed",
      },
    ];
    const env = await envSeenBy(guidanceFrom({ practices, cascade }));

    expect(env["ORG_PRACTICE"]).toContain("review the diff against the ticket");
    // ORDER SURVIVES THE TRIP. Precedence configured and then flattened on the way out would be the
    // whole feature quietly not working.
    expect(env["ORG_PRACTICE"]).toContain("1. house-review");
    expect(env["ORG_PRACTICE"]).toContain("2. deep-review");
    expect(env["ORG_PRACTICE"]?.indexOf("1. house-review"))
      .toBeLessThan(env["ORG_PRACTICE"]?.indexOf("2. deep-review") ?? 0);
    // AND THE REASON. An agent handed a process it cannot evaluate follows it because it arrived.
    expect(env["ORG_PRACTICE"]).toContain("because our reviewers kept redesigning");
  }, 60_000);

  test("THE REGISTER'S DEFAULTS ARRIVE with nothing configured at all", async () => {
    // The case an operator who has configured nothing is actually in — and the one where a dead seam
    // is hardest to notice, because there is nothing of theirs missing to miss.
    const env = await envSeenBy(
      guidanceFrom({
        defaultPractices: DEFAULT_PRACTICES,
        defaultDirectives: DEFAULT_DIRECTIVES,
        cascade,
      }),
    );
    // The defect practice, because this node is a defect.
    expect(env["ORG_PRACTICE"]).toContain("not solved until something fails without the fix");
    // …and the standing instruction about the repository's own skills.
    expect(env["ORG_DIRECTIVES"]).toContain("repository you are working in already provides");
    expect(env["ORG_DIRECTIVES"]).toContain("because");
  }, 60_000);

  test("what each REPOSITORY offers arrives too", async () => {
    const env = await envSeenBy(
      guidanceFrom({
        defaultDirectives: DEFAULT_DIRECTIVES,
        cascade,
        repoSkills: "  dev-portal:\n    jira-tools — Talk to Jira",
      }),
    );
    // Without this the standing directive is prose about a directory nobody opened.
    expect(env["ORG_REPO_SKILLS"]).toContain("jira-tools");
    expect(env["ORG_REPO_SKILLS"]).toContain("dev-portal");
  }, 60_000);

  test("SILENCE IS SILENCE — an unconfigured organization emits no variables", async () => {
    // An agent must be able to tell "this organization states no process" from "the process is
    // empty". A variable present and blank is the second, and it is a lie.
    const env = await envSeenBy(guidanceFrom({ cascade }));
    expect(env["ORG_PRACTICE"]).toBeUndefined();
    expect(env["ORG_DIRECTIVES"]).toBeUndefined();
    expect(env["ORG_REPO_SKILLS"]).toBeUndefined();
    // …and the brief still arrives, so this is not a broken producer.
    expect(env["ORG_WORK_ID"]).toBe("leaf-1");
    expect(env["ORG_WORK_TYPE"]).toBe("defect");
  }, 60_000);

  test("NO GUIDANCE WIRED AT ALL behaves exactly as before the layer existed", async () => {
    // Every existing caller passes nothing. If that path changed, this feature broke the runs that
    // do not use it.
    const env = await envSeenBy(undefined);
    expect(env["ORG_PRACTICE"]).toBeUndefined();
    expect(env["ORG_DIRECTIVES"]).toBeUndefined();
  }, 60_000);

  test("A SCOPED PRACTICE reaches a task through its project", async () => {
    // The whole reason the layer is scoped: a stage of a programme runs its own process, and the
    // ancestry is walked from the cascade rather than asked of the caller.
    const scoped: readonly Practice[] = [
      {
        subject: { kind: PracticeSubjectKind.Gate, id: String(GateKind.ImplementationReview) },
        skills: [],
        directive: "org-wide: two reviewers",
        why: "regulated",
      },
      {
        subject: { kind: PracticeSubjectKind.Gate, id: String(GateKind.ImplementationReview) },
        scopeWorkId: "proj-1",
        skills: [],
        directive: "in this pilot: one reviewer is enough",
        why: "a pilot that waits two days for a second reviewer is not a pilot",
      },
    ];
    const env = await envSeenBy(guidanceFrom({ practices: scoped, cascade }));
    expect(env["ORG_PRACTICE"]).toContain("one reviewer is enough");
    expect(env["ORG_PRACTICE"]).not.toContain("two reviewers");
  }, 60_000);

  test("A DECLINED DIRECTIVE stops arriving", async () => {
    // The third state, end to end. An operator who declined the register's instruction must not find
    // it in the agent's environment anyway.
    const declined: readonly Directive[] = [
      { id: REPO_SKILLS_FIRST, text: "", why: "our repositories' skills are stale and we are deleting them" },
    ];
    const env = await envSeenBy(
      guidanceFrom({ directives: declined, defaultDirectives: DEFAULT_DIRECTIVES, cascade }),
    );
    expect(env["ORG_DIRECTIVES"]).toBeUndefined();
  }, 60_000);
});
