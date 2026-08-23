// src/Core.TypeScript/zflash/usb-hardware-manual-lane.test.ts
//
// THE LOUD SKIP.
//
// Every run of this suite prints, by id, the checks that a device would be
// needed to run -- and states that this run did not run them. The banner is
// emitted unconditionally, not from inside a `test.skipIf`, because a skip that
// only prints when someone opts in is exactly the silent-skip defect wearing a
// helpful name.
//
// The tests below then keep the register honest. A manifest of things-not-tested
// is itself an untested artifact unless something checks that its entries are
// complete, that the ids are stable, and that the procedure document has not
// drifted away from them. All three are asserted here.

import { describe, expect, test } from "bun:test";
import {
  MANUAL_CHECKS,
  PROCEDURE_DOC,
  renderNotTestedBanner,
  type ManualCheck,
} from "./usb-hardware-manual-lane.ts";

// Printed at module load, so it appears on EVERY run of this file -- including
// runs of the whole suite, where the reader is most likely to mistake green for
// complete.
process.stdout.write(renderNotTestedBanner());

const repoRoot = new URL("../../../", import.meta.url);

describe("the loud skip is actually loud", () => {
  test("MLANE-1: the banner names every check, its id, and its path", () => {
    const banner = renderNotTestedBanner();
    for (const c of MANUAL_CHECKS) {
      expect(banner).toContain(c.id);
      expect(banner).toContain(c.proves);
      expect(banner).toContain(c.needsHardwareBecause);
    }
    expect(banner).toContain(String(MANUAL_CHECKS.length));
  });

  test("MLANE-2: the banner says outright that these did not run", () => {
    // The wording is the point. "hardware lane skipped" reads as housekeeping;
    // "they did NOT run" and "says NOTHING about the lines above" do not.
    const banner = renderNotTestedBanner();
    expect(banner).toContain("NOT TESTED BY THIS SUITE");
    expect(banner).toContain("They did NOT run.");
    expect(banner).toContain("A green run of this suite says NOTHING about the lines above.");
  });

  test("MLANE-3: the banner points at a procedure document that EXISTS", () => {
    // A pointer to a missing runbook is a skip that is loud and useless.
    const f = Bun.file(new URL(PROCEDURE_DOC, repoRoot));
    return f.exists().then((ok: boolean) => {
      expect(ok).toBe(true);
    });
  });

  test("MLANE-4: destructive steps are flagged in the banner", () => {
    const banner = renderNotTestedBanner();
    for (const c of MANUAL_CHECKS.filter((x: ManualCheck) => x.destructive)) {
      const line = banner.split("\n").find((l: string) => l.includes(c.id)) ?? "";
      expect(line).toContain("*DESTRUCTIVE*");
    }
    // And the non-destructive ones are not, or the marker means nothing.
    for (const c of MANUAL_CHECKS.filter((x: ManualCheck) => !x.destructive)) {
      const line = banner.split("\n").find((l: string) => l.includes(c.id)) ?? "";
      expect(line).not.toContain("*DESTRUCTIVE*");
    }
  });
});

describe("the register is well-formed", () => {
  test("MLANE-5: ids are unique and stably shaped", () => {
    // Ids are quoted in the procedure doc and would be quoted in an incident
    // writeup. A duplicate id makes a finding unaddressable.
    const ids = MANUAL_CHECKS.map((c: ManualCheck) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^MAN-(USB|TOK)-\d{2}$/u);
  });

  test("MLANE-6: every field is populated -- no placeholder entries", () => {
    // An entry with an empty `needsHardwareBecause` is an entry that should
    // have been automated and was filed here instead.
    for (const c of MANUAL_CHECKS) {
      expect(c.proves.length).toBeGreaterThan(20);
      expect(c.needsHardwareBecause.length).toBeGreaterThan(40);
      expect(c.command.length).toBeGreaterThan(10);
      expect(c.expected.length).toBeGreaterThan(20);
      expect(c.onMismatch.length).toBeGreaterThan(20);
    }
  });

  test("MLANE-7: onMismatch is an ACTION, never 'investigate'", () => {
    // "Investigate" is what a runbook says when nobody knew what to do. The
    // operator is holding a device at 2am; the line has to tell them.
    for (const c of MANUAL_CHECKS) {
      expect(c.onMismatch.toLowerCase()).not.toMatch(/^\s*investigate\b/u);
      expect(c.onMismatch.toLowerCase()).not.toBe("tbd");
    }
  });

  test("MLANE-8: both USB paths are represented", () => {
    // The register exists because "USB hardware" means two different devices
    // here. Covering one and calling it done is the drift this catches.
    const paths = new Set(MANUAL_CHECKS.map((c: ManualCheck) => c.path));
    expect([...paths].sort()).toEqual(["installer-stick", "security-token"]);
  });

  test("MLANE-9: the module is DATA -- it shells out to nothing", () => {
    // If this file ever grows an execFileSync, the register stops being inert
    // and starts being a thing that touches devices at import time.
    return Bun.file(new URL("./usb-hardware-manual-lane.ts", import.meta.url))
      .text()
      .then((src: string) => {
        expect(src).not.toContain("child_process");
        expect(src).not.toContain("execFileSync");
        expect(src).not.toContain("Bun.spawn");
      });
  });
});

describe("the procedure document does not drift from the register", () => {
  test("MLANE-10: every id in the register is documented, and vice versa", () => {
    // The failure this catches: a check is added here and never written up, or
    // removed here and left in the doc as a procedure for something that is now
    // covered automatically. Both directions asserted.
    return Bun.file(new URL(PROCEDURE_DOC, repoRoot))
      .text()
      .then((doc: string) => {
        for (const c of MANUAL_CHECKS) {
          expect(doc).toContain(c.id);
        }
        const inDoc = [...doc.matchAll(/MAN-(?:USB|TOK)-\d{2}/gu)].map((m) => m[0]);
        const known = new Set(MANUAL_CHECKS.map((c: ManualCheck) => c.id));
        for (const id of new Set(inDoc)) {
          expect([...known]).toContain(id);
        }
      });
  });

  test("MLANE-11: each id has its OWN section carrying an expected output", () => {
    // A procedure without an expected output is a procedure whose result is
    // whatever the operator hoped for.
    //
    // Anchored on the `### <id>` heading, not on the first mention of the id.
    // The first draft of this test sliced from doc.indexOf(id) and went red on a
    // prose mention in the preamble -- which was the test being right: an id
    // named in passing is not an id with a procedure.
    return Bun.file(new URL(PROCEDURE_DOC, repoRoot))
      .text()
      .then((doc: string) => {
        const headingOf = (id: string): number => doc.indexOf(`### ${id}`);
        for (const c of MANUAL_CHECKS) {
          const idx = headingOf(c.id);
          expect(idx).toBeGreaterThan(-1);
          const nextIdx = MANUAL_CHECKS.map((o: ManualCheck) => headingOf(o.id))
            .filter((i: number) => i > idx)
            .sort((a: number, b: number) => a - b)[0];
          const section = doc.slice(idx, nextIdx ?? doc.length);
          expect(section).toContain("**Expected.**");
          // And a stated failure action, not just a happy path.
          expect(section.toLowerCase()).toContain("mismatch");
        }
      });
  });
});

// ============================================================================
// THE HARDWARE LANE MUST BE REACHABLE
// ============================================================================
//
// The register above says "MAN-TOK-02: run the frost hardware lane". MEASURED
// 2026-08-23, that instruction did not work: the lane is in bunfig.toml's
// pathIgnorePatterns (correctly -- no CI runner has the silicon), and bun applies
// pathIgnorePatterns even to an EXPLICIT path filter, so the documented command
// matched no test files and exited 1.
//
// Exit 1 is ALSO what the lane returns when it runs correctly and finds no token.
// So the operator's only signal could not distinguish "no token attached" from
// "the lane never ran" -- and it is the second that means nothing was checked.
// This is the repo's named worst defect class, sitting inside the mechanism built
// to prevent it.
//
// These tests are the falsifier that was missing.

const HARDWARE_LANE_FILE = "tools/setup/persona-keys/frost-share-adapter.hardware.test.ts";
const HARDWARE_LANE_CONFIG = "bunfig.hardware-lane.toml";

describe("the hardware lane is reachable by its documented command", () => {
  test("MLANE-12: the gate bunfig DOES exclude the lane, and says so", () => {
    // If this ever stops being true the lane has joined the whole-suite gate,
    // where it will fail on every runner. The exclusion is correct; it is the
    // absence of an escape hatch that was the defect.
    return Bun.file(new URL("bunfig.toml", repoRoot))
      .text()
      .then((toml: string) => {
        expect(toml).toContain(HARDWARE_LANE_FILE);
      });
  });

  test("MLANE-13: an escape-hatch bunfig exists and does NOT exclude the lane", () => {
    return Bun.file(new URL(HARDWARE_LANE_CONFIG, repoRoot))
      .text()
      .then((toml: string) => {
        // The omission is the whole content of that file, so assert the omission
        // rather than trusting its comment.
        //
        // Anchored on the ASSIGNMENT, not on the first mention of the key: the
        // file's header comment quotes the excluded path while explaining why it
        // is not excluded here, and the first draft of this test read that
        // comment as configuration. The test was right to go red -- it was
        // reading prose and calling it a setting.
        const assignAt = toml.indexOf("pathIgnorePatterns = [");
        expect(assignAt).toBeGreaterThan(-1);
        const patterns = toml.slice(assignAt, toml.indexOf("]", assignAt) + 1);
        expect(patterns).not.toContain(HARDWARE_LANE_FILE);
        expect(patterns).not.toContain("hardware.test.ts");
        // And it must still exclude the heavy trees, or it is unusable.
        expect(patterns).toContain("**/node_modules/**");
        expect(patterns).toContain("**/references/prior-art/**");
      });
  });

  test("MLANE-14: the lane's own header documents the flag, in the position bun honours", () => {
    // `bun test --config=X` parses without complaint and IGNORES X. Only
    // `bun --config=X test` applies it. A header that documents the first form
    // is a runbook that silently does nothing, which is how this started.
    return Bun.file(new URL(HARDWARE_LANE_FILE, repoRoot))
      .text()
      .then((src: string) => {
        const header = src.slice(0, src.indexOf("import {"));
        expect(header).toContain(`--config=${HARDWARE_LANE_CONFIG}`);
        // Every documented `bun ... test <lane file>` invocation carries the flag
        // BEFORE the subcommand. This is the assertion that discriminates.
        const invocations = header
          .split("\n")
          .filter((l: string) => /^\/\/\s+bun .*\btest\b/u.test(l));
        expect(invocations.length).toBeGreaterThan(0);
        for (const line of invocations) {
          expect(line).toContain(`--config=${HARDWARE_LANE_CONFIG}`);
          const cfgAt = line.indexOf("--config=");
          const testAt = line.indexOf(" test");
          expect(cfgAt).toBeGreaterThan(-1);
          expect(cfgAt).toBeLessThan(testAt);
        }
      });
  });

  test("MLANE-15: the register's own command for MAN-TOK-02 is the reachable one", () => {
    // The register is a runbook. A runbook whose command does not run is worse
    // than an absent one, because it consumes the operator's attention and
    // returns a plausible exit status.
    const tok02 = MANUAL_CHECKS.find((c: ManualCheck) => c.id === "MAN-TOK-02");
    expect(tok02).toBeDefined();
    if (tok02 === undefined) return;
    expect(tok02.command).toContain(`--config=${HARDWARE_LANE_CONFIG}`);
    const cfgAt = tok02.command.indexOf("--config=");
    const testAt = tok02.command.indexOf(" test ");
    expect(cfgAt).toBeLessThan(testAt);
  });
});
