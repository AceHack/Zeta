// Falsifiers for the exception lint and for the tla2tools premise check.
//
// The lint is the ONLY thing that makes "temporary" mean anything, so the tests
// that matter are the ones that prove it goes RED. Every check has a paired
// happy/refusal case built from the same base row, so a mutant that neuters one
// check cannot hide behind the others.
//
// ── MUTATION LOG (2026-09-09) — 10 mutants, 10 killed ────────────────────────
//
//  M1  lint: `daysBetween(today, expires) < 0` -> `< -3650` (never expire)
//      KILLED — "an EXPIRED row fails the gate"
//  M2  lint: drop the `pin.rolling === null` refusal
//      KILLED — "an exception on a NON-rolling row is refused"
//  M3  lint: `row.accept !== "auto"` -> `row.accept === "auto"`
//      KILLED — "accept=auto is the only permitted mode" + happy-path case
//  M4  lint: `span > MAX_EXCEPTION_DAYS` -> `span > 100000`
//      KILLED — "a window past the ceiling is refused"
//  M5  lint: drop the duplicate-dest check
//      KILLED — "two rows for one dest are a finding"
//  M6  lint: drop the `attacker` requirement in checkTradeoffDoc
//      KILLED — "a tradeoff doc that never names an attacker is refused"
//  M7  lint: drop the `text.includes(row.dest)` requirement
//      KILLED — "a tradeoff doc that does not name the dest is refused"
//  M8  lint: treat a missing exitcheck= as fine
//      KILLED — "a row with no exitcheck= is refused"
//  M9  premise: `model.tier !== "gate"` -> accept every tier
//      KILLED — "an extended-tier expectDetail does NOT keep the premise alive"
// M10  premise: NAMED_TEMPORAL -> /Temporal propert/ (matches the plural form)
//      KILLED — "the v1.7.4 plural diagnostic does not satisfy the premise"
//
// ── DECLARED CONTROLS — these MUST SURVIVE every mutant above ────────────────
//
//  C1  "CONTROL: a well-formed row produces no findings"
//  C2  "CONTROL: the repo's own manifest and premise are green"
//
// C2 is the one that would catch a mutant reaching past its log entry into the
// shipped data. If either control dies, a log entry above is wrong.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkRollingExceptions,
  argvScript,
  readTextOrNull,
  type ExceptionInputs,
} from "./lint-rolling-exceptions.ts";
import {
  NAMED_TEMPORAL,
  checkPremise,
  gateModelsNeedingNamedTemporal,
} from "./lint-tla2tools-rolling-premise.ts";
import { EXCEPTIONS_MANIFEST } from "../ace/setup-realizers/rolling-exception.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const DEST = "src/Core.TLA/tla2tools.jar";

const FROM_URL_ROLLING =
  `${DEST}  https://example.invalid/x.jar  sha256=${"a".repeat(64)}  rolling=tag` +
  "  remeasure=src/run.ts:--all\n" +
  `src/Core.Alloy/alloy.jar  https://example.invalid/a.jar  sha256=${"b".repeat(64)}\n`;

const BASE_ROW =
  `${DEST}  accept=auto  verify=deferred  declared=2026-09-09  expires=2026-12-08` +
  "  exitcheck=src/premise.ts  tradeoff=docs/tradeoff.md";

const TRADEOFF_DOC =
  `While this is live an attacker who controls that URL chooses the verifier for ${DEST}.`;

function inputs(overrides: Partial<ExceptionInputs> = {}): ExceptionInputs {
  return {
    exceptionsText: BASE_ROW,
    fromUrlText: FROM_URL_ROLLING,
    today: "2026-09-09",
    present: (rel) => ["src/premise.ts", "docs/tradeoff.md", "src/verify.ts"].includes(rel),
    readDoc: (rel) => (rel === "docs/tradeoff.md" ? TRADEOFF_DOC : null),
    ...overrides,
  };
}

/** Findings mentioning `needle`, so a test names the check it is about. */
function about(findings: readonly string[], needle: string): readonly string[] {
  return findings.filter((f) => f.includes(needle));
}

describe("checkRollingExceptions", () => {
  test("CONTROL: a well-formed row produces no findings", () => {
    expect(checkRollingExceptions(inputs())).toEqual([]);
  });

  test("an EXPIRED row fails the gate", () => {
    const findings = checkRollingExceptions(inputs({ today: "2026-12-09" }));
    expect(about(findings, "EXPIRED")).toHaveLength(1);
  });

  test("a row expiring TODAY is still fine", () => {
    expect(checkRollingExceptions(inputs({ today: "2026-12-08" }))).toEqual([]);
  });

  test("an exception on a NON-rolling row is refused", () => {
    const row = BASE_ROW.replace(DEST, "src/Core.Alloy/alloy.jar");
    const findings = checkRollingExceptions(inputs({ exceptionsText: row }));
    expect(about(findings, "NOT a rolling= row")).toHaveLength(1);
  });

  test("an exception for a dest with no from-url row at all is refused", () => {
    const row = BASE_ROW.replace(DEST, "src/Nowhere/x.jar");
    const findings = checkRollingExceptions(inputs({ exceptionsText: row }));
    expect(about(findings, "has no row in")).toHaveLength(1);
  });

  test("accept=auto is the only permitted mode", () => {
    for (const mode of ["always", "yes", "true", "auto-remeasure"]) {
      const row = BASE_ROW.replace("accept=auto", "accept=" + mode);
      const findings = checkRollingExceptions(inputs({ exceptionsText: row }));
      expect(about(findings, "the only permitted mode")).toHaveLength(1);
    }
  });

  test("a malformed expires= is refused", () => {
    const row = BASE_ROW.replace("expires=2026-12-08", "expires=soon");
    const findings = checkRollingExceptions(inputs({ exceptionsText: row }));
    expect(about(findings, "not a calendar date")).toHaveLength(1);
  });

  test("a window past the ceiling is refused", () => {
    const row = BASE_ROW.replace("expires=2026-12-08", "expires=2099-01-01");
    const findings = checkRollingExceptions(inputs({ exceptionsText: row }));
    expect(about(findings, "ceiling")).toHaveLength(1);
  });

  test("expires before declared is refused", () => {
    const row = BASE_ROW.replace("expires=2026-12-08", "expires=2026-09-01");
    const findings = checkRollingExceptions(inputs({ exceptionsText: row }));
    expect(about(findings, "precedes declared")).toHaveLength(1);
  });

  test("a declared= in the future is refused", () => {
    const row = BASE_ROW.replace("declared=2026-09-09", "declared=2026-10-01");
    const findings = checkRollingExceptions(inputs({ exceptionsText: row }));
    expect(about(findings, "in the future")).toHaveLength(1);
  });

  test("two rows for one dest are a finding", () => {
    const findings = checkRollingExceptions(inputs({ exceptionsText: BASE_ROW + "\n" + BASE_ROW }));
    expect(about(findings, "SECOND exception row")).toHaveLength(1);
  });

  test("a missing tradeoff= is refused", () => {
    const row = BASE_ROW.replace("  tradeoff=docs/tradeoff.md", "");
    const findings = checkRollingExceptions(inputs({ exceptionsText: row }));
    expect(about(findings, "no tradeoff= doc")).toHaveLength(1);
  });

  test("a tradeoff doc not in the tree is refused", () => {
    const row = BASE_ROW.replace("tradeoff=docs/tradeoff.md", "tradeoff=docs/absent.md");
    const findings = checkRollingExceptions(inputs({ exceptionsText: row }));
    expect(about(findings, "not in the tree")).toHaveLength(1);
  });

  test("an UNREADABLE tradeoff doc is not the same finding as an absent one", () => {
    // A permissions error is a question that could not be answered; reporting it
    // as "not in the tree" would be a confident wrong reading.
    const findings = checkRollingExceptions(
      inputs({
        readDoc: () => {
          throw new Error("EACCES");
        },
      }),
    );
    expect(about(findings, "is unreadable")).toHaveLength(1);
    expect(about(findings, "not in the tree")).toHaveLength(0);
  });

  test("a tradeoff doc that does not name the dest is refused", () => {
    const findings = checkRollingExceptions(
      inputs({ readDoc: () => "an attacker could do things to some jar somewhere" }),
    );
    expect(about(findings, "never names")).toHaveLength(1);
  });

  test("a tradeoff doc that never names an attacker is refused", () => {
    const findings = checkRollingExceptions(
      inputs({ readDoc: () => `this row covers ${DEST} and is fine, trust us` }),
    );
    expect(about(findings, "ATTACKER")).toHaveLength(1);
  });

  test("a row with no exitcheck= is refused", () => {
    const row = BASE_ROW.replace("  exitcheck=src/premise.ts", "");
    const findings = checkRollingExceptions(inputs({ exceptionsText: row }));
    expect(about(findings, "no exitcheck=")).toHaveLength(1);
  });

  test("an exitcheck= whose script is absent is refused", () => {
    const row = BASE_ROW.replace("exitcheck=src/premise.ts", "exitcheck=src/gone.ts");
    const findings = checkRollingExceptions(inputs({ exceptionsText: row }));
    expect(about(findings, "is not in the tree")).toHaveLength(1);
  });

  test("verify=deferred is accepted; a verify= naming an absent script is not", () => {
    expect(checkRollingExceptions(inputs())).toEqual([]);
    const row = BASE_ROW.replace("verify=deferred", "verify=src/gone.ts:--all");
    const findings = checkRollingExceptions(inputs({ exceptionsText: row }));
    expect(about(findings, "is not in the tree")).toHaveLength(1);
  });

  test("a verify= naming a present script is accepted", () => {
    const row = BASE_ROW.replace("verify=deferred", "verify=src/verify.ts:--all");
    expect(checkRollingExceptions(inputs({ exceptionsText: row }))).toEqual([]);
  });

  test("a row with no verify= at all is refused (say deferred out loud)", () => {
    const row = BASE_ROW.replace("  verify=deferred", "");
    const findings = checkRollingExceptions(inputs({ exceptionsText: row }));
    expect(about(findings, "declares no verify=")).toHaveLength(1);
  });

  test("an EMPTY manifest is a clean, strict tree", () => {
    expect(checkRollingExceptions(inputs({ exceptionsText: "" }))).toEqual([]);
  });

  test("argvScript takes the first token", () => {
    expect(argvScript(["a.ts", "--all"])).toBe("a.ts");
    expect(argvScript([])).toBe("");
  });
});

describe("readTextOrNull", () => {
  test("an absent file is null, not a throw", () => {
    expect(readTextOrNull(join(REPO_ROOT, "docs/definitely-not-here-081M24396B2.md"))).toBeNull();
  });

  test("a present file comes back as text", () => {
    expect(readTextOrNull(join(REPO_ROOT, "tools/setup/manifests/from-url"))).toContain("Mechanism: from-url");
  });

  test("a NON-ENOENT error PROPAGATES rather than reading as absent", () => {
    // Reading a directory fails EISDIR. That is a question that could not be
    // answered, and returning null for it would make the caller report
    // "not in the tree" -- a confident, wrong reading produced by a probe that
    // did not run. MEASURED: without the ENOENT discrimination this test is the
    // only thing that fails, i.e. it is the falsifier for that one line.
    expect(() => readTextOrNull(join(REPO_ROOT, "tools/setup/manifests"))).toThrow();
  });
});

describe("the tla2tools premise", () => {
  test("a gate-tier named temporal expectation keeps the premise alive", () => {
    const verdict = checkPremise(
      JSON.stringify({
        models: [{ id: "X", tier: "gate", expectDetail: "Temporal property Deterrence was violated" }],
      }),
    );
    expect(verdict.ok).toBe(true);
    expect(verdict.message).toContain("X");
  });

  test("the v1.7.4 plural diagnostic does not satisfy the premise", () => {
    // `Temporal properties were violated.` is exactly what v1.7.4 prints, and it
    // names nothing. If that were the only expectation, the rolling build would
    // be buying us nothing.
    expect(NAMED_TEMPORAL.test("Temporal properties were violated")).toBe(false);
    const verdict = checkPremise(
      JSON.stringify({
        models: [{ id: "X", tier: "gate", expectDetail: "Temporal properties were violated" }],
      }),
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.message).toContain("PREMISE GONE");
  });

  test("an extended-tier expectDetail does NOT keep the premise alive", () => {
    const verdict = checkPremise(
      JSON.stringify({
        models: [{ id: "X", tier: "extended", expectDetail: "Temporal property Deterrence was violated" }],
      }),
    );
    expect(verdict.ok).toBe(false);
  });

  test("an invariant expectation is not a temporal one", () => {
    expect(
      gateModelsNeedingNamedTemporal([
        { id: "X", tier: "gate", expectDetail: "Invariant NoSeizure is violated" },
      ]),
    ).toEqual([]);
  });

  test("a registry with no models array is UNREADABLE, not a pass", () => {
    expect(() => checkPremise("{}")).toThrow("no models array");
    expect(() => checkPremise("not json")).toThrow("not valid JSON");
  });
});

describe("the shipped tree", () => {
  test("CONTROL: the repo's own manifest and premise are green", () => {
    // READ, do not stat-then-read. An `existsSync` gating the `readFileSync`
    // below is the check-then-use race the repo's own lint refuses -- and it was
    // here, in a file whose subject is refusing sloppy declarations. `null` is
    // the absence answer and it fails this assertion just as loudly.
    const exceptionsText = readTextOrNull(join(REPO_ROOT, EXCEPTIONS_MANIFEST));
    expect(exceptionsText).not.toBeNull();
    const findings = checkRollingExceptions({
      exceptionsText: exceptionsText ?? "",
      fromUrlText: readFileSync(join(REPO_ROOT, "tools/setup/manifests/from-url"), "utf8"),
      // Pinned, not `new Date()`: a test whose verdict changes at midnight is a
      // test that will fail for a reason unrelated to the change under review.
      // The EXPIRY itself is enforced by the gate step, which does read the clock.
      today: "2026-09-09",
      present: (rel) => existsSync(join(REPO_ROOT, rel)),
      readDoc: (rel) => readTextOrNull(join(REPO_ROOT, rel)),
    });
    expect(findings).toEqual([]);
    const premise = checkPremise(readFileSync(join(REPO_ROOT, "registry/tlc-models.json"), "utf8"));
    expect(premise.ok).toBe(true);
  });
});
