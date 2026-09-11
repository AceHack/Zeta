/**
 * corporate/repo-skills.ts — what the repository being worked in already knows how to do.
 *
 * ── WHY DISCOVERY AND NOT JUST AN INSTRUCTION ────────────────────────────────
 * `DEFAULT_DIRECTIVES` tells an agent to prefer the repository's own skills. On its own that is
 * prose, and prose about a directory nobody looked in is the vacuity class in its politest form: it
 * reads as configuration, it changes nothing anybody can check, and the first time an agent ignores
 * it there is no way to tell whether the skills were absent or merely unread.
 *
 * So the register can LOOK. A source repository's skills are enumerable, and once enumerated the
 * instruction has evidence behind it: a listing can say "this repository offers eleven skills" or
 * "this repository offers none, so the instruction is inert here", and those are different facts.
 *
 * ── THE PATHS ARE DATA, NOT A HARDCODED CONVENTION ───────────────────────────
 * Several harnesses keep skills in several places and the set will keep growing. `SKILL_ROOTS` is a
 * default list, overridable per call — so a repository that keeps them somewhere else is a
 * configuration question rather than a patch to this file.
 *
 * ── READ-ONLY, LIKE EVERY OTHER SOURCE ───────────────────────────────────────
 * Nothing here writes. A source repository is read and never written back to, and a discovery
 * mechanism is the easiest place to forget that.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Where skills conventionally live, in the order worth looking.
 *
 * DATA rather than a constant buried in a loop: a caller may pass its own list, and the reason this
 * is plural at all is that the convention genuinely differs between harnesses.
 */
export const SKILL_ROOTS: readonly string[] = [
  ".claude/skills",
  ".cursor/skills",
  ".agent/skills",
];

export interface RepoSkill {
  /** The skill's own declared name, or its directory when it declares none. */
  readonly name: string;
  /** The one-line description from its front matter, when it has one. */
  readonly description?: string;
  /** Where it was found, relative to the repository root — so a reader can go and look. */
  readonly at: string;
}

/**
 * Pull `name` and `description` out of a SKILL.md's front matter.
 *
 * A DELIBERATELY SMALL PARSER. It reads the two scalar keys this register uses and ignores
 * everything else, because the alternative — a general YAML dependency to read two strings — buys
 * nothing and adds a way for a malformed skill file to throw inside a listing.
 *
 * Values are taken verbatim after the colon, trimmed, with surrounding quotes removed. A folded or
 * multi-line value yields its first line, which is the right answer for a one-line description and a
 * harmless one for a name.
 */
export function skillFrontMatter(text: string): { readonly name?: string; readonly description?: string } {
  const normalised = text.replace(/\r\n/g, "\n");
  if (!normalised.startsWith("---\n")) return {};
  const end = normalised.indexOf("\n---", 4);
  if (end === -1) return {};
  const block = normalised.slice(4, end);
  const read = (key: string): string | undefined => {
    // Anchored to the start of a line so a `description:` inside another value is not mistaken for
    // the key. Ordinal, case-sensitive: front matter keys are lowercase by convention and matching
    // them case-insensitively would accept two spellings of one key.
    const m = new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(block);
    if (m === null) return undefined;
    const raw = (m[1] ?? "").trim().replace(/^["']|["']$/g, "").trim();
    return raw === "" ? undefined : raw;
  };
  const name = read("name");
  const description = read("description");
  return {
    ...(name === undefined ? {} : { name }),
    ...(description === undefined ? {} : { description }),
  };
}

/**
 * The skills a repository offers.
 *
 * Returns an EMPTY LIST for a repository with none and for a path that does not exist — and those are
 * genuinely the same answer to this question ("what does it offer?"), which is why they are not
 * distinguished here. What must not happen is a throw: this is called from listings and from a
 * running organization, and a missing directory is the ordinary case rather than an error.
 *
 * Sorted by name, ordinally. A listing that changed order between calls because a filesystem
 * returned entries differently would make two identical configurations look different.
 */
export function repoSkillsIn(repoDir: string, roots: readonly string[] = SKILL_ROOTS): readonly RepoSkill[] {
  const out: RepoSkill[] = [];
  const seen = new Set<string>();
  for (const root of roots) {
    let entries: readonly string[];
    try {
      entries = readdirSync(join(repoDir, root));
    } catch {
      // Absent, unreadable, or not a directory. All three mean "no skills here".
      continue;
    }
    for (const entry of entries) {
      const at = `${root}/${entry}`;
      let text: string;
      try {
        text = readFileSync(join(repoDir, root, entry, "SKILL.md"), "utf-8");
      } catch {
        // A directory with no SKILL.md is not a skill. Skipped rather than reported as a nameless
        // one, which would put a row in every listing for every stray folder.
        continue;
      }
      const front = skillFrontMatter(text);
      const name = front.name ?? entry;
      // FIRST ROOT WINS on a duplicate name, matching the order `roots` is documented to express.
      // Reporting both would offer an agent two skills with one name and no way to choose.
      if (seen.has(name)) continue;
      seen.add(name);
      out.push({
        name,
        ...(front.description === undefined ? {} : { description: front.description }),
        at,
      });
    }
  }
  return [...out].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * What an agent should be told about the repositories it is working in.
 *
 * Rendered because the consumer is a prompt. A repository with no skills is STATED rather than
 * omitted: "this one offers none" is the fact that makes the standing instruction inert here, and an
 * agent that saw nothing could not tell that from a directory nobody looked in.
 */
export function renderRepoSkills(
  sources: readonly { readonly sourceId: string; readonly location: string }[],
  read: (dir: string) => readonly RepoSkill[] = (d) => repoSkillsIn(d),
): string {
  const lines: string[] = [];
  for (const source of sources) {
    const found = read(source.location);
    if (found.length === 0) {
      lines.push(`  ${source.sourceId}: offers no skills of its own`);
      continue;
    }
    lines.push(`  ${source.sourceId}:`);
    for (const skill of found) {
      lines.push(`    ${skill.name}${skill.description === undefined ? "" : ` — ${skill.description}`}`);
    }
  }
  return lines.join("\n");
}
