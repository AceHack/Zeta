import { test, expect } from "bun:test";
import { classifyOs, osId, type KnownOs } from "./host-os.ts";
import {
  dispositionOn,
  mechanismNounIn,
  silentOverrides,
  symmetryGaps,
  type CapabilityRow,
} from "./disposition.ts";

// The work-item this design was filed under; used as the owner-bearing debt reference.
const WORKITEM = "081M0T694EG087G0R002SJST5K";

/**
 * A WORKED registry of the capability the trigger actually touches, plus one whose
 * per-OS mechanisms are already shipped. Two rows is the point: this is a
 * proof-of-concept for the SHAPE, not the migrated corpus.
 *
 * Note what is NOT here: a row whose disposition is `unsupported`. Classifying all 35
 * WINDOWS_EXCEPTIONS entries plus the `pam-reattach` trigger produced ZERO genuine
 * platform absences -- every one is a built-in, an alias, a different channel, a nested
 * host, a role scope, or an undecided question. The `unsupported` arm exists so the
 * type is total and the author is never forced to invent a presence; it is exercised
 * below on a SYNTHETIC row, and that separation is deliberate.
 */
const REGISTRY: readonly CapabilityRow[] = [
  {
    capability: "elevation-consent",
    intent: "a present human approves one privileged operation before it runs, and the approval cannot be replayed",
    by: {
      // The only installable part on macOS; the Touch-ID module itself ships with the OS.
      darwin: { kind: "provided", by: "pam-reattach", channel: "system-package" },
      // biometric.ts returns "windows-hello" here and the repo calls it a SEAM -- a named
      // intention, not an implementation. Debt with an owner, not a sentence.
      win32: {
        kind: "undetermined",
        owner: "credential-substrate",
        workitem: WORKITEM,
        settledBy:
          "a Windows Hello adapter behind the same consent port, plus a probe for the headless/SSH session case",
      },
      linux: {
        kind: "undetermined",
        owner: "credential-substrate",
        workitem: WORKITEM,
        settledBy: "an fprintd or polkit adapter behind the same consent port",
      },
    },
  },
  {
    capability: "background-loop-supervision",
    intent: "a persona's loop is started at boot, restarted on failure, and its last outcome is readable",
    by: {
      darwin: { kind: "builtin", component: "launchd" },
      linux: { kind: "builtin", component: "systemd (user session)" },
      // loop-liveness.ts today falls through to systemd on Windows, so a live loop is
      // reported "not-installed". Naming the cell is what stops absence reading as failure.
      win32: {
        kind: "undetermined",
        owner: "service-substrate",
        workitem: WORKITEM,
        settledBy: "a Windows Service / Task Scheduler adapter reporting the same CellFacts",
      },
    },
  },
];

test("the worked registry answers every declared OS with no prose", () => {
  expect(symmetryGaps(REGISTRY)).toEqual([]);
});

test("SABOTAGE CONTROL: a missing cell fails, and the failure names the cell", () => {
  const sabotaged: CapabilityRow[] = REGISTRY.map((row) => {
    if (row.capability !== "elevation-consent") return row;
    const by: Record<string, unknown> = { ...row.by };
    delete by.win32; // the cell is ABSENT, not present-and-undefined
    return { ...row, by: by as CapabilityRow["by"] };
  });
  expect(symmetryGaps(sabotaged)).toEqual([{ capability: "elevation-consent", os: "win32", why: "undeclared" }]);
});

test("unknown include is better than unknown exclude: undeclared is a Gap, never silent unsupported", () => {
  // POSIX undefined = -1 (silence means absent = unknown exclude).
  // Zeta: missing cell stays IN the failure set until a fact is written.
  const row: CapabilityRow = {
    capability: "synthetic-include-default",
    intent: "names a capability the code needs; the missing OS must not vanish",
    by: {
      linux: { kind: "builtin", component: "c" },
      win32: { kind: "builtin", component: "c" },
    },
  };
  expect(dispositionOn(row, "darwin")).toBeNull();
  expect(symmetryGaps([row])).toEqual([{ capability: "synthetic-include-default", os: "darwin", why: "undeclared" }]);
});

test("PowerBuilder is the degenerate case: earlier/later collision is disclosed, never a silent Map overwrite", () => {
  const green = REGISTRY[0];
  if (green === undefined) throw new Error("REGISTRY[0] missing");
  const earlier: CapabilityRow = { ...green, intent: "first declaration" };
  const later: CapabilityRow = { ...green, intent: "second declaration" };
  const lastWins = new Map<string, CapabilityRow>();
  lastWins.set(earlier.capability, earlier);
  lastWins.set(later.capability, later);
  expect(lastWins.size).toBe(1);
  expect(lastWins.get(earlier.capability)?.intent).toBe("second declaration");
  expect(silentOverrides([earlier, later])).toEqual([
    { capability: earlier.capability, earlierIndex: 0, laterIndex: 1 },
  ]);
  expect(silentOverrides(REGISTRY)).toEqual([]);
});

test("SABOTAGE CONTROL: undetermined without a real work-item fails", () => {
  const sabotaged: readonly CapabilityRow[] = [
    {
      capability: "elevation-consent",
      intent: "as above",
      by: {
        darwin: { kind: "provided", by: "pam-reattach", channel: "system-package" },
        linux: { kind: "undetermined", owner: "x", workitem: "", settledBy: "y" },
        win32: { kind: "undetermined", owner: "x", workitem: "B-0402", settledBy: "y" },
      },
    },
  ];
  expect(symmetryGaps(sabotaged)).toEqual([
    { capability: "elevation-consent", os: "linux", why: "undetermined-without-workitem" },
    { capability: "elevation-consent", os: "win32", why: "undetermined-without-workitem" },
  ]);
});

test("unsupported is a GREEN answer -- an absence closes a row, it does not owe an excuse", () => {
  // SYNTHETIC row: no measured capability in this repo is genuinely absent on an OS.
  const synthetic: readonly CapabilityRow[] = [
    {
      capability: "synthetic-absent-capability",
      intent: "exercises the absence arm; not a claim about any real capability",
      by: {
        darwin: { kind: "builtin", component: "irrelevant" },
        linux: { kind: "builtin", component: "irrelevant" },
        win32: { kind: "unsupported", absence: { kind: "no-mechanism", mechanism: "a mechanism of this class" } },
      },
    },
  ];
  expect(symmetryGaps(synthetic)).toEqual([]);
});

test("undeclared and unsupported are DIFFERENT values, not one null", () => {
  const row: CapabilityRow = {
    capability: "synthetic-absent-capability",
    intent: "as above",
    by: { win32: { kind: "unsupported", absence: { kind: "no-mechanism", mechanism: "m" } } },
  };
  expect(dispositionOn(row, "win32")).toEqual({
    kind: "unsupported",
    absence: { kind: "no-mechanism", mechanism: "m" },
  });
  expect(dispositionOn(row, "darwin")).toBeNull();
});

test("a capability may not be named after one OS's mechanism", () => {
  // The trigger's own key is a mechanism name -- which is why it had no Windows twin.
  expect(mechanismNounIn("pam-reattach")).toBe("pam");
  expect(mechanismNounIn("launchd-plist-install")).toBe("launchd");
  expect(mechanismNounIn("keychain-secret-read")).toBe("keychain");
  // The capability the trigger actually serves is platform-neutral.
  expect(mechanismNounIn("elevation-consent")).toBeNull();
  expect(mechanismNounIn("background-loop-supervision")).toBeNull();
});

test("every capability in the worked registry passes the non-coercion lint", () => {
  for (const row of REGISTRY) expect(mechanismNounIn(row.capability)).toBeNull();
});

test("an unknown OS is `other`, never a narrowed lie", () => {
  expect(classifyOs("freebsd")).toEqual({ kind: "other", id: "freebsd" });
  expect(classifyOs("darwin")).toEqual({ kind: "known", os: "darwin" });
  expect(osId(classifyOs("freebsd"))).toBe("freebsd");
  // The zeta-native adapter is already nameable -- adding it is a column, not a rewrite.
  expect(classifyOs("zeta")).toEqual({ kind: "known", os: "zeta" as KnownOs });
});
