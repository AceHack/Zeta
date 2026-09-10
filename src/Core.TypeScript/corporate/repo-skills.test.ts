/**
 * repo-skills.test.ts — what the repository being worked in already knows how to do.
 *
 * The standing directive tells an agent to prefer a repository's own skills. Discovery is what makes
 * that checkable rather than prose about a directory nobody opened — so the property worth defending
 * is that "this repository offers none" and "nobody looked" are different, visible answers.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderRepoSkills, repoSkillsIn, skillFrontMatter, SKILL_ROOTS } from "./repo-skills";

/** A repository with skills laid out however the caller says. */
function repoWith(skills: readonly { readonly root: string; readonly dir: string; readonly body: string }[]): string {
  const root = mkdtempSync(join(tmpdir(), "repo-skills-"));
  for (const skill of skills) {
    mkdirSync(join(root, skill.root, skill.dir), { recursive: true });
    writeFileSync(join(root, skill.root, skill.dir, "SKILL.md"), skill.body);
  }
  return root;
}

const front = (name: string, description: string) => `---\nname: ${name}\ndescription: ${description}\n---\n\nbody\n`;

describe("front matter, read with a deliberately small parser", () => {
  test("name and description are read", () => {
    expect(skillFrontMatter(front("build-image", "Build the golden image"))).toEqual({
      name: "build-image",
      description: "Build the golden image",
    });
  });

  test("quotes are stripped and CRLF survives", () => {
    // A repository cloned on Windows has CRLF line endings, and a parser anchored to `\n` would
    // read every value with a trailing carriage return — which then appears inside a branch name,
    // an env var, and an agent's brief.
    expect(skillFrontMatter('---\r\nname: "quoted"\r\ndescription: \'single\'\r\n---\r\n')).toEqual({
      name: "quoted",
      description: "single",
    });
  });

  test("a file with NO front matter yields nothing rather than guessing", () => {
    expect(skillFrontMatter("# just a heading\n")).toEqual({});
    expect(skillFrontMatter("---\nname: unterminated\n")).toEqual({});
  });

  test("a key inside a VALUE is not mistaken for the key", () => {
    // Anchored to the start of a line. Without that, `description:` appearing inside a longer value
    // would be read as the description and the real one silently lost.
    expect(skillFrontMatter("---\nname: a\ndescription: mentions description: here\n---\n").description)
      .toBe("mentions description: here");
    // THE CASE THAT ACTUALLY DISCRIMINATES, and the one my first version missed: the key has to
    // appear inside an EARLIER line's value. Unanchored, the regex finds `description:` inside the
    // name and returns the tail of the wrong line — so the assertion above passed with or without
    // the anchor, and the mutation that removed it survived.
    expect(skillFrontMatter("---\nname: talks about description: nonsense\ndescription: the real one\n---\n"))
      .toEqual({ name: "talks about description: nonsense", description: "the real one" });
  });

  test("an empty value is ABSENT, not an empty string", () => {
    // A skill whose description is blank should read as having none; an empty string would render as
    // `name — ` in every listing.
    expect(skillFrontMatter("---\nname: a\ndescription:\n---\n")).toEqual({ name: "a" });
  });
});

describe("discovery", () => {
  test("skills are found, named from their front matter, and sorted", () => {
    const repo = repoWith([
      { root: ".claude/skills", dir: "zebra", body: front("zebra", "last") },
      { root: ".claude/skills", dir: "alpha", body: front("alpha", "first") },
    ]);
    try {
      const found = repoSkillsIn(repo);
      // ORDINALLY SORTED. A filesystem that returned entries differently between calls would make
      // two identical configurations look different.
      expect(found.map((s) => s.name)).toEqual(["alpha", "zebra"]);
      expect(found[0]?.description).toBe("first");
      expect(found[0]?.at).toBe(".claude/skills/alpha");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("a directory NAME is the fallback when a skill declares no name", () => {
    const repo = repoWith([{ root: ".claude/skills", dir: "unnamed", body: "no front matter\n" }]);
    try {
      expect(repoSkillsIn(repo).map((s) => s.name)).toEqual(["unnamed"]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("a directory with NO SKILL.md is not a skill", () => {
    // Otherwise every stray folder puts a nameless row in every listing.
    const repo = repoWith([{ root: ".claude/skills", dir: "real", body: front("real", "d") }]);
    try {
      mkdirSync(join(repo, ".claude/skills/not-a-skill"), { recursive: true });
      expect(repoSkillsIn(repo).map((s) => s.name)).toEqual(["real"]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("SEVERAL ROOTS are searched, and the first wins a name clash", () => {
    // The convention differs between harnesses, which is why the list is plural and is DATA. First
    // root wins, because offering an agent two skills with one name gives it no way to choose.
    const repo = repoWith([
      { root: ".claude/skills", dir: "shared", body: front("shared", "from claude") },
      { root: ".cursor/skills", dir: "shared", body: front("shared", "from cursor") },
      { root: ".cursor/skills", dir: "only-here", body: front("only-here", "d") },
    ]);
    try {
      const found = repoSkillsIn(repo);
      expect(found.map((s) => s.name)).toEqual(["only-here", "shared"]);
      expect(found.find((s) => s.name === "shared")?.description).toBe("from claude");
      expect(SKILL_ROOTS.indexOf(".claude/skills")).toBeLessThan(SKILL_ROOTS.indexOf(".cursor/skills"));
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("A MISSING DIRECTORY IS AN EMPTY LIST, NEVER A THROW", () => {
    // Called from listings and from a running organization. A repository with no skills is the
    // ordinary case, and a throw here would take down a report about four repositories because one
    // of them had no `.claude`.
    expect(repoSkillsIn(join(tmpdir(), "definitely-not-here-9e1f"))).toEqual([]);
  });

  test("the roots are OVERRIDABLE, so a repository that differs is configuration not a patch", () => {
    const repo = repoWith([{ root: "docs/agent-skills", dir: "custom", body: front("custom", "d") }]);
    try {
      expect(repoSkillsIn(repo)).toEqual([]);
      expect(repoSkillsIn(repo, ["docs/agent-skills"]).map((s) => s.name)).toEqual(["custom"]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("what an agent is told", () => {
  test("A REPOSITORY WITH NO SKILLS IS STATED, not omitted", () => {
    // The whole point. An agent that saw nothing could not tell "this one offers none" from "nobody
    // looked", and the standing directive would be unfalsifiable either way.
    const rendered = renderRepoSkills(
      [
        { sourceId: "dev-portal", location: "/a" },
        { sourceId: "empty-repo", location: "/b" },
      ],
      (dir) => (dir === "/a" ? [{ name: "jira-tools", description: "Talk to Jira", at: ".claude/skills/jira-tools" }] : []),
    );
    expect(rendered).toContain("dev-portal:");
    expect(rendered).toContain("jira-tools — Talk to Jira");
    expect(rendered).toContain("empty-repo: offers no skills of its own");
  });

  test("a skill with no description is listed without a dangling dash", () => {
    const rendered = renderRepoSkills(
      [{ sourceId: "r", location: "/a" }],
      () => [{ name: "bare", at: ".claude/skills/bare" }],
    );
    expect(rendered).toContain("bare");
    expect(rendered).not.toContain("bare —");
  });
});
