/**
 * state-du.test.ts — the three greys must not collapse, and this is what fails when they do.
 *
 * `unavailable`, `frost` and `absent` look alike on a screen and mean entirely different things:
 *
 *   unavailable  structurally impossible   nobody can change it; it is a property of the model
 *   frosted      deliberately withheld     the owner, by spending privacy budget
 *   absent       not applicable            not a state; it must not render
 *
 * Collapsing unavailable into frosted tells a user their permissions are the problem when the
 * model is. Collapsing frosted into unavailable leaks that something is being withheld while
 * claiming it is impossible — worse, because it is a false statement about the world made by the
 * interface, and frost is earned, permanent and inviolable
 * (`.claude/rules/privacy-budget-is-hard-money-earned-by-others.md`).
 *
 * These tests are structural, over the stylesheet and the DU table. They exist because the
 * collapse is invisible by eye: a grey cell and a violet cell both just look "off".
 */

import { describe, expect, test } from "bun:test";
import { skeletonOf, skeletonKey } from "../hygiene/visual-skeleton.ts";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ABSENT_IS_NOT_A_MEMBER, STATE_DU, ariaAttributesFor, renderStateText, stateMember } from "./state-du";

const SELECTOR = '[data-state="unavailable"]';

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const DS_DIR = join(REPO_ROOT, "docs", "design", "root-site-iris", "_ds");

function stateCss(): string {
  const dir = readdirSync(DS_DIR, { withFileTypes: true }).filter(
    (e) => e.isDirectory() && e.name.startsWith("design-system-"),
  )[0]!;
  return readFileSync(join(DS_DIR, dir.name, "zeta-state.css"), "utf8");
}

describe("the model register exists and is not the withheld register", () => {
  test("unavailable has its own token, and it is not the withheld violet", () => {
    const css = stateCss();
    expect(css).toContain("--state-unavailable:");
    expect(css).toContain('[data-state="unavailable"]');

    const unavailableLine = css.split("\n").find((l) => l.includes("--state-unavailable:"))!;
    // The exact collapse the FATX finding names: a structurally impossible option rendered in
    // the withheld register says "this is not for you" about something nobody is withholding.
    expect(unavailableLine).not.toContain("#9A8CE6");
    expect(unavailableLine).not.toContain("var(--state-withheld)");
  });

  test("unavailable is not merely an alias of cold", () => {
    // Cold means "we are watching and nothing arrived", which implies something still could.
    // Aliasing unavailable onto it silently promises a future the constraint system forbids.
    const css = stateCss();
    const line = css.split("\n").find((l) => l.includes("--state-unavailable:"))!;
    expect(line).not.toContain("#46506B");
    expect(line).not.toContain("var(--state-cold)");
  });

  test("the model register's texture is not the withheld register's hatch", () => {
    // Hue is the weakest channel and colour-blind readers do not have it. If both registers
    // used a repeating 45-degree hatch they would be one visual family whatever the hex says.
    const css = stateCss();
    // There is more than one `[data-state="unavailable"]` rule (colour, then texture, then the
    // motion cancellation), so scan every block rather than trusting the first.
    const blocks: string[] = [];
    for (let i = css.indexOf(SELECTOR); i >= 0; i = css.indexOf(SELECTOR, i + 1)) {
      blocks.push(css.slice(i, css.indexOf("}", i)));
    }
    const textured = blocks.filter((b) => b.includes("background-image"));
    expect(textured.length).toBe(1);
    expect(textured[0]).toContain("linear-gradient");
    expect(textured[0]).not.toContain("repeating-linear-gradient");
  });

  test("withheld still outranks unavailable in the cascade", () => {
    // The direction is deliberate. If both are somehow set, render "withheld": asserting
    // IMPOSSIBLE over something merely private is a falsehood about the world AND overwrites
    // earned, inviolable frost. The reverse error is a misattribution, which is bad and not
    // a lie about what the world permits.
    const css = stateCss();
    expect(css.indexOf('[data-observed="false"] { --state:')).toBeGreaterThan(
      css.indexOf('[data-state="unavailable"] { --state:'),
    );
  });

  test("motion is cancelled for unavailable", () => {
    // A pulse is a claim of liveness. Something that cannot exist must never breathe.
    expect(stateCss()).toContain('[data-state="unavailable"] .zx-pulse');
  });
});

describe("frost is a rendering, not an enforcement", () => {
  test("the stylesheet says so at the definition site", () => {
    // `filter: blur()` is paint-time only: it does not touch the DOM, the accessibility tree,
    // find-in-page, view-source, or a client with CSS off. An implementer who reads the rule as
    // redaction ships a privacy primitive that is defeated by Ctrl+U.
    const css = stateCss();
    const frostBlock = css.slice(css.indexOf('[data-withheld="frost"]'));
    expect(frostBlock).toMatch(/aria-hidden/);
    expect(frostBlock).toMatch(/never be delivered|not be delivered/);
  });

  test("frost is content-hidden to assistive tech, and is NOT reported as disabled", () => {
    // Frost is not a disabled control: the thing exists, it is simply not for this viewer.
    // Marking it disabled would collapse it into the model register through the aria channel
    // even while the hues stay correct.
    const frost = stateMember("frost")!;
    expect(frost.aria).toBe("content-hidden");
    expect(ariaAttributesFor("frost")["aria-disabled"]).toBeUndefined();
  });
});

describe("the non-visual channel — strip the hue and the distinction must survive", () => {
  test("every member has a glyph, an ASCII fallback, a label and a reason", () => {
    for (const m of STATE_DU) {
      expect(m.glyph.length).toBeGreaterThan(0);
      expect(m.ascii.length).toBeGreaterThan(0);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.sentence.length).toBeGreaterThan(0);
    }
  });

  test("glyphs and ASCII marks are unique — a shared mark is a collapse in the text channel", () => {
    const glyphs = STATE_DU.map((m) => m.glyph);
    const asciis = STATE_DU.map((m) => m.ascii);
    expect(new Set(glyphs).size).toBe(glyphs.length);
    expect(new Set(asciis).size).toBe(asciis.length);
  });

  // The assertion above compares CODEPOINTS, which is the machine's comparison. It passed while
  // U+25CB/U+25CC and U+25D0/U+25CD were shipping as four glyphs and reading as two rings. Both
  // properties are wanted, so this JOINS it rather than replacing it: distinct strings AND
  // distinct silhouettes.
  test("glyphs are unique under the PERCEPTUAL quotient, not just by codepoint", () => {
    const keys = STATE_DU.map((m) => {
      const s = skeletonOf(m.glyph);
      // An unmodelled glyph is not a pass. If a future member uses a mark the table does not
      // cover, this fails loudly rather than skipping it — the vacuity guard.
      expect(s, `no skeleton row for ${m.id} "${m.glyph}" — add one before shipping it`).toBeDefined();
      return skeletonKey(s!);
    });
    expect(new Set(keys).size, `colliding silhouettes: ${keys.join(", ")}`).toBe(keys.length);
  });

  test("BASE FORM separates the claim classes — the rule, asserted rather than described", () => {
    // The capacity argument: base-form separation is scarce, so it is spent on the boundary that
    // must never be confused. Two members of DIFFERENT claim classes must not share a base form.
    for (const a of STATE_DU) {
      for (const b of STATE_DU) {
        if (a.id === b.id || a.claim === b.claim) continue;
        const sa = skeletonOf(a.glyph)!;
        const sb = skeletonOf(b.glyph)!;
        if (sa.baseForm !== sb.baseForm) continue;
        // Sharing a base form across classes is permitted ONLY when a strike separates them,
        // because a full-diameter stroke changes the silhouette and survives blur. That is the
        // one exemption, and `unavailable` ∅ against `cold` ○ is what it exists for.
        expect(
          sa.struck !== sb.struck,
          `${a.id} (${a.claim}) and ${b.id} (${b.claim}) share base form "${sa.baseForm}" with no strike between them`,
        ).toBe(true);
      }
    }
  });

  test("the unknown fallback does not borrow a DU member's silhouette", () => {
    // A failed lookup that draws itself as `cold` would mint the observation "watched, and
    // nothing is there" out of a missing map entry.
    const unknownGlyph = renderStateText("no-such-member").split(" ")[0]!;
    const unknownKey = skeletonKey(skeletonOf(unknownGlyph)!);
    for (const m of STATE_DU) {
      expect(skeletonKey(skeletonOf(m.glyph)!)).not.toBe(unknownKey);
    }
  });

  test("unavailable and frost read differently with no colour at all", () => {
    // The falsifier for the whole finding: in a terminal there is no hue, and these two must
    // still be two different things.
    const u = renderStateText("unavailable", { ascii: true });
    const f = renderStateText("frost", { ascii: true });
    expect(u).not.toBe(f);
    expect(u).toContain("unavailable");
    expect(f).toContain("withheld");
    // ...and each carries its reason, which is what stops the reader guessing at the cause.
    expect(u).toContain("no valid configuration");
    expect(f).toContain("owner");
  });

  test("the ASCII rendering is genuinely ASCII", () => {
    // BP-09 surfaces (notebooks, logs) are ASCII-only; a glyph that survives into them is not a
    // fallback, it is the same bug one layer down.
    for (const m of STATE_DU) {
      expect(renderStateText(m.id, { ascii: true })).toMatch(/^[\x20-\x7E]+$/);
    }
  });

  test("unavailable never says 'this is not for you'", () => {
    // The carved consequence, asserted directly. The sentence must describe the world, not the
    // reader: no second person, no permission vocabulary.
    const s = stateMember("unavailable")!.sentence.toLowerCase();
    for (const forbidden of ["you", "your", "permission", "access", "allowed", "denied"]) {
      expect(s.includes(forbidden)).toBe(false);
    }
  });
});

describe("aria treatments differ because the claims differ", () => {
  test("unavailable is aria-disabled and never merely hidden", () => {
    const a = ariaAttributesFor("unavailable");
    expect(a["aria-disabled"]).toBe("true");
    expect(a["aria-hidden"]).toBeUndefined();
    // The reason must be in the accessible name, or the user reaches the element and learns
    // nothing — an explanation nobody can reach is the accessibility form of the vacuity class.
    expect(a["aria-label"]).toContain("no valid configuration");
  });

  test("unobserved is labelled, not disabled — unmeasured is not impossible", () => {
    expect(ariaAttributesFor("unobserved")["aria-disabled"]).toBeUndefined();
  });

  test("the sr-only utility the pattern depends on exists", () => {
    // The label is delivered by a visually-hidden span. Without the class it either renders
    // visibly (noise) or is set `display:none` by someone tidying up, which removes it from the
    // accessibility tree too — a label nobody hears.
    const css = stateCss();
    expect(css).toContain(".zx-sr");
    const block = css.slice(css.indexOf(".zx-sr"), css.indexOf("}", css.indexOf(".zx-sr")));
    expect(block).not.toContain("display: none");
    expect(block).not.toContain("visibility: hidden");
  });
});

describe("absent is not a member", () => {
  test("no DU member claims to represent absence", () => {
    expect(STATE_DU.some((m) => m.id === "absent")).toBe(false);
    expect(ABSENT_IS_NOT_A_MEMBER).toContain("does not render");
  });

  test("an unknown id does not silently become an observation", () => {
    // Substituting `cold` here would mint an observation ("we watched, nothing there") that
    // nobody made. The CSS fail-safe is a paint decision; a text renderer must not copy it.
    expect(stateMember("absent")).toBeUndefined();
    expect(renderStateText("absent", { ascii: true })).toContain("unknown");
    expect(renderStateText("absent", { ascii: true })).not.toContain("cold");
  });
});

describe("the authoring copy and the shipped copy do not drift", () => {
  test("_ds/ and site/_ds/ carry byte-identical stylesheets", () => {
    // `site/` is the deployable bundle — it is what actually reaches a reader. A DU extended in
    // the authoring copy and not the shipped one is a design language that is correct only in
    // the repo, which is the one place nobody is confused by it.
    const shipped = join(
      REPO_ROOT,
      "docs",
      "design",
      "root-site-iris",
      "site",
      "_ds",
      readdirSync(DS_DIR, { withFileTypes: true }).filter(
        (e) => e.isDirectory() && e.name.startsWith("design-system-"),
      )[0]!.name,
      "zeta-state.css",
    );
    expect(readFileSync(shipped, "utf8")).toBe(stateCss());
  });
});
