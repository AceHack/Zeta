/**
 * state-du-css.test.ts — the state DU lives in ONE place, and this proves it stays there.
 *
 * Contract change 3 removed `color` from the JSON so the design system owns visual mapping
 * outright. That is only true while it STAYS true: the moment a page hardcodes `#5EC8C2`, there
 * are two sources of truth for "what live looks like" and they drift silently — nobody notices
 * until a state changes colour in one surface and not another.
 *
 * These are structural tests over the stylesheet and the pages, not rendering tests. They catch
 * the drift a reviewer would have to notice by eye, which is exactly the kind of thing reviewers
 * stop noticing after the third page.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stateMember } from "./state-du.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const SITE = join(REPO_ROOT, "docs", "design", "root-site-iris");
const DS_DIR = join(SITE, "_ds");

/** The design-system directory is uuid-suffixed; find it rather than hardcoding the uuid. */
function designSystemDir(): string {
  const entries = readdirSync(DS_DIR, { withFileTypes: true }).filter(
    (e) => e.isDirectory() && e.name.startsWith("design-system-"),
  );
  expect(entries.length).toBeGreaterThan(0);
  return join(DS_DIR, entries[0]!.name);
}

const STATE_CSS = join(designSystemDir(), "zeta-state.css");
const STYLES_CSS = join(designSystemDir(), "styles.css");

/** The four status values, and the fifth token that is deliberately NOT a status. */
const STATUS_TOKENS = ["--state-live", "--state-stale", "--state-cold", "--state-heat"] as const;
const WITHHELD_TOKEN = "--state-withheld";

describe("the state DU is defined, once, in the design system", () => {
  test("zeta-state.css exists and is reachable from styles.css", () => {
    // A stylesheet nothing imports is a stylesheet that does nothing. `_ds_bundle.css` is
    // generated output we must not edit, so the import in styles.css is the whole wiring — and
    // it is the thing to restore if the design tool ever regenerates that file.
    expect(existsSync(STATE_CSS)).toBe(true);
    expect(readFileSync(STYLES_CSS, "utf8")).toContain("zeta-state.css");
  });

  test("all four status tokens plus the withheld register are defined", () => {
    const css = readFileSync(STATE_CSS, "utf8");
    for (const token of [...STATUS_TOKENS, WITHHELD_TOKEN]) {
      expect(css).toContain(`${token}:`);
    }
  });

  test("every status value has an attribute selector — the case IS the attribute", () => {
    const css = readFileSync(STATE_CSS, "utf8");
    for (const status of ["live", "stale", "cold", "heat"]) {
      expect(css).toContain(`[data-state="${status}"]`);
    }
  });
});

describe("the fail-safe default — unknown reads cold, never live", () => {
  test("the bare --state fallback is cold", () => {
    // The single most important line in the file. An element with no data-state must not render
    // as alive; that is the property the whole contract exists to protect, expressed in CSS.
    const css = readFileSync(STATE_CSS, "utf8");
    const root = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
    expect(root).toMatch(/--state:\s*var\(--state-cold\)/);
    expect(root).not.toMatch(/--state:\s*var\(--state-live\)/);
  });

  test("withheld is declared AFTER the status selectors so it outranks them", () => {
    // Cascade order is the mechanism, not a nicety: an unobserved thing must read violet whatever
    // its nominal state, because "we did not measure" is a different claim from "we measured idle".
    const css = readFileSync(STATE_CSS, "utf8");
    const lastStatus = Math.max(
      ...["live", "stale", "cold", "heat"]
        .map((s) => css.indexOf(`[data-state="${s}"]  { --state`))
        .map((i) => (i < 0 ? css.indexOf(`[data-state=`) : i)),
    );
    expect(css.indexOf('[data-observed="false"]')).toBeGreaterThan(lastStatus);
  });
});

describe("red is heat, and only heat", () => {
  test("the heat token is the only one bound to the red hex", () => {
    // BASE labels red as "attention / live", where that "live" is the broadcast on-air sense.
    // In THIS DU live is teal. Implementers get it wrong from the BASE table alone, so the
    // binding is pinned here rather than trusted to a comment.
    const css = readFileSync(STATE_CSS, "utf8");
    const heatLine = css.split("\n").find((l) => l.includes("--state-heat:"));
    expect(heatLine).toBeDefined();
    expect(heatLine).toContain("#E0746A");
    const liveLine = css.split("\n").find((l) => l.includes("--state-live:"));
    expect(liveLine).toContain("#5EC8C2");
    expect(liveLine).not.toContain("#E0746A");
  });
});

describe("motion is a claim of liveness — reserved for live", () => {
  test("the pulse animation is emitted under live and cancelled everywhere else", () => {
    // Without the cancellation, the 60s re-tick cannot stop a stale tab from breathing, and
    // "a stopped society can never render live" becomes false in the browser — the only place
    // anyone actually observes it.
    const css = readFileSync(STATE_CSS, "utf8");
    expect(css).toMatch(/\[data-state="live"\]\s+\.zx-pulse\s*\{\s*animation:/);
    for (const dead of ["stale", "cold", "heat"]) {
      expect(css).toContain(`[data-state="${dead}"] .zx-pulse`);
    }
    expect(css).toContain('[data-observed="false"] .zx-pulse');
    expect(css).toMatch(/animation:\s*none/);
  });
});

describe("blur is frost ONLY — an absence is hatched, never blurred", () => {
  test("frost blurs; unobserved and sealed hatch", () => {
    // Blurring an absence would tell the reader a dweller is exercising earned privacy when the
    // truth is that we have no measurement — over-claiming in the direction of attributing
    // intent. Hatch says "nothing was written here"; blur says "something is here, withheld".
    const css = readFileSync(STATE_CSS, "utf8");
    const frostBlock = css.slice(css.indexOf('[data-withheld="frost"]'));
    expect(frostBlock).toMatch(/filter:\s*blur/);

    const hatchBlock = css.slice(css.indexOf('[data-withheld="unobserved"]'), css.indexOf('[data-withheld="frost"]'));
    expect(hatchBlock).toContain("repeating-linear-gradient");
    expect(hatchBlock).not.toMatch(/filter:\s*blur/);
  });
});

/**
 * SETTLEMENT MIGRATION (Iris §1.3, step 2) — the DU is only load-bearing if pages actually use it.
 *
 * Step 1 defined the tokens; this pins that `Settlement.dc.html` consumes them rather than
 * computing colour in JS. The failure this prevents is quiet: someone adds a room, hardcodes
 * `#5EC8C2` because it looks right, and now "what live looks like" has two sources of truth that
 * drift the first time one is edited.
 *
 * Scope is deliberate. STATE colours must come from the token; BRAND/chrome colours (the ζ logo,
 * header text, panel backgrounds) stay hardcoded and are none of this DU's business. Conflating
 * the two would make the test either useless or unpassable.
 */
const SETTLEMENT = join(SITE, "Settlement.dc.html");

describe("Settlement consumes the DU rather than computing colour", () => {
  test("rooms carry data-state, data-observed and data-withheld", () => {
    const html = readFileSync(SETTLEMENT, "utf8");
    for (const attr of ["data-state=", "data-observed=", "data-withheld="]) {
      expect(html).toContain(attr);
    }
  });

  test("no JS-computed colour bindings survive", () => {
    // `{{ room.color }}` / `{{ dw.color }}` / `{{ room.pulse }}` were the old path: a hex chosen
    // in the component script and interpolated into inline style. All four corners of that are
    // gone — colour comes from the cascade now, and motion from the state selector.
    const html = readFileSync(SETTLEMENT, "utf8");
    for (const binding of ["room.color", "dw.color", "room.pulse", "room.lightBg"]) {
      expect(html).not.toContain(binding);
    }
  });

  test("the legacy vocabulary is mapped, not emitted", () => {
    // The mock still names rooms with its own words; what matters is that they are TRANSLATED to
    // the shipped DU at the boundary instead of leaking into markup. `?? "cold"` is the
    // fail-safe: an unmapped legacy name reads cold, never live.
    const html = readFileSync(SETTLEMENT, "utf8");
    expect(html).toContain("const STATE = {");
    expect(html).toMatch(/active:\s*"live"/);
    expect(html).toMatch(/attention:\s*"heat"/);
    expect(html).toMatch(/\?\?\s*"cold"/);
  });

  test("dwellers no longer carry a decorative colour", () => {
    // Dweller colour was index parity — `i%2 ? blue : orange` — decoration wearing the appearance
    // of meaning. A dweller now renders in its room's state; only bob `delay` stays cosmetic.
    const html = readFileSync(SETTLEMENT, "utf8");
    expect(html).not.toContain('"#3a6ea5"');
    expect(html).not.toContain('"#c9913f"');
    expect(html).toContain("delay:");
  });

  test("the sealed mark is the glyph vocabulary, not an emoji", () => {
    // Emoji render at platform-dependent size, weight and COLOUR — which defeats a DU whose whole
    // point is that colour is controlled in one place.
    // Reads the mark from the DU rather than restating it: a hardcoded glyph here is a second
    // vocabulary, and it is exactly what let the 2026-08-19 reassignment be a four-file change.
    const html = readFileSync(SETTLEMENT, "utf8");
    expect(html).not.toContain("🔒");
    expect(html).toContain(stateMember("sealed")!.glyph);
  });

  test("the pulse hook exists for the CSS motion rule to bite on", () => {
    // Without a `.zx-pulse` element the `[data-state="live"] .zx-pulse` rule matches nothing, and
    // motion silently never happens — a rule that cannot fire is the CSS form of a test that
    // cannot fail.
    expect(readFileSync(SETTLEMENT, "utf8")).toContain("zx-pulse");
  });
});

/**
 * THE GAP MY OWN TESTS HAD.
 *
 * The migration tests above check that the BINDINGS are gone (`{{ room.color }}` etc.) and that
 * the attributes are present. Sabotaging the file with a hardcoded `#5EC8C2` in a room passed all
 * fourteen of them — which is precisely the drift the DU exists to prevent, sailing straight
 * through the suite written to prevent it.
 *
 * The fix cannot be "ban these hexes": brand chrome legitimately uses them (the ζ logo is amber,
 * header accents are teal). So the assertion is SCOPED to the room-rendering block, where a state
 * hex is always wrong because that markup is exactly what `var(--state)` is for.
 */
describe("no hardcoded state colour inside room markup", () => {
  test("the room block resolves colour only through the token", () => {
    const html = readFileSync(SETTLEMENT, "utf8");
    const roomAttr = html.indexOf("data-room=");
    expect(roomAttr).toBeGreaterThan(0);
    const blockStart = html.lastIndexOf("<sc-for", roomAttr);
    const blockEnd = html.indexOf("</sc-for>", html.indexOf("room.dwellers"));
    const roomBlock = html.slice(blockStart, blockEnd);

    // Every state hex is banned HERE and only here. Brand chrome outside this block is untouched.
    const stateHexes = roomBlock.match(/#5EC8C2|#E8B566|#46506B|#E0746A|#9A8CE6/gi) ?? [];
    expect(stateHexes).toEqual([]);
    // ...and the token is actually used, so "no hexes" cannot be satisfied by rendering nothing.
    expect(roomBlock).toContain("var(--state)");
  });
});
