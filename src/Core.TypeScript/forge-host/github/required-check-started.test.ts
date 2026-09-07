import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PR_LIST_LIMIT,
  HEARTBEAT_REF_PREFIX,
  REQUIRED_GATE_NAME,
  classifyMissingRequiredCheck,
  heartbeatPrsMissingRequiredCheck,
  isTransientHostFailure,
  listWithTransientRetry,
  listingWasTruncated,
  prsMissingRequiredCheck,
  readRequiredCheckOnHead,
  requiredCheckStarted,
} from "./required-check-started";

const T0 = Date.parse("2026-08-15T15:00:00.000Z");

describe("requiredCheckStarted (081M010H4KE)", () => {
  test("green present checks are not enough if gate never started", () => {
    expect(requiredCheckStarted([{ name: "agencysignature (PR body)" }, { name: "lint (TS)" }])).toBe(false);
  });

  test("gate present — even pending — counts as started", () => {
    expect(requiredCheckStarted([{ name: REQUIRED_GATE_NAME }])).toBe(true);
  });

  test("empty rollup is the filed defect", () => {
    expect(requiredCheckStarted([])).toBe(false);
  });
});

const PAGINATION_HEAD = "594aee771a9e20c4f72b6f03b54aa8e27072523a";
const context = (id: number, name = `advisory-${id}`) => ({ __typename: "CheckRun", id: `check-${id}`, name });
const firstHundred = () => Array.from({ length: 100 }, (_, i) => context(i));
const prPage = <T>(commit: T, headRefOid = PAGINATION_HEAD) => ({
  data: { repository: { pullRequest: { headRefOid, commits: { nodes: [{ commit }] } } } },
});
const contextPage = (nodes: unknown[], totalCount: number, hasNextPage = false, endCursor: string | null = null) =>
  prPage({
    oid: PAGINATION_HEAD,
    statusCheckRollup: {
      contexts: { nodes, totalCount, pageInfo: { hasNextPage, endCursor } },
    },
  });
const pageResult = (page: unknown) => ({ status: 0, stdout: JSON.stringify(page), stderr: "" });

describe("complete required-check pagination (081M1XK76XQ087G0R000Y23NGM)", () => {
  test("the successful check hidden at position 101 is present, not a terminal-run stall", async () => {
    const first = firstHundred();
    expect(requiredCheckStarted(first)).toBe(false);
    const cursors: (string | null)[] = [];
    const result = await readRequiredCheckOnHead(PAGINATION_HEAD, (cursor) => {
      cursors.push(cursor);
      return pageResult(
        cursor === null
          ? contextPage(first, 103, true, "MTAw")
          : contextPage([context(100, REQUIRED_GATE_NAME), context(101, "drift (loud)"), context(102, "CodeQL")], 103),
      );
    });
    expect(result).toEqual({ kind: "measured", started: true });
    expect(cursors).toEqual([null, "MTAw"]);
  });

  test("complete absence still permits the existing queued versus stalled distinction", async () => {
    const result = await readRequiredCheckOnHead(PAGINATION_HEAD, (cursor) =>
      pageResult(
        cursor === null
          ? contextPage(firstHundred(), 103, true, "next")
          : contextPage([context(100), context(101), context(102)], 103),
      ),
    );
    expect(result).toEqual({ kind: "measured", started: false });
    expect(classifyMissingRequiredCheck([{ number: 1, runCount: 1, liveRunCount: 0 }]).stalled).toEqual([1]);
    expect(classifyMissingRequiredCheck([{ number: 1, runCount: 1, liveRunCount: 1 }]).queued).toEqual([1]);
  });

  test("an existing commit with no rollup has no published check", async () => {
    expect(
      await readRequiredCheckOnHead(PAGINATION_HEAD, () =>
        pageResult(prPage({ oid: PAGINATION_HEAD, statusCheckRollup: null })),
      ),
    ).toEqual({ kind: "measured", started: false });
  });

  test("legacy status contexts contribute to page counts without impersonating a named CheckRun", async () => {
    const page = contextPage([{ __typename: "StatusContext", id: "legacy", context: REQUIRED_GATE_NAME }], 1);
    expect(await readRequiredCheckOnHead(PAGINATION_HEAD, () => pageResult(page))).toEqual({
      kind: "measured",
      started: false,
    });
  });

  test("a repeated cursor or context cannot masquerade as complete pagination", async () => {
    for (const second of [contextPage([context(1)], 3, true, "same"), contextPage([context(0)], 2)]) {
      const result = await readRequiredCheckOnHead(PAGINATION_HEAD, (cursor) =>
        pageResult(
          cursor === null
            ? contextPage(
                [context(0)],
                second.data.repository.pullRequest.commits.nodes[0]!.commit.statusCheckRollup.contexts.totalCount,
                true,
                "same",
              )
            : second,
        ),
      );
      expect(result.kind).toBe("unmeasured");
    }
  });

  test("a changing count or incomplete final page refuses the negative inference", async () => {
    for (const second of [contextPage([context(1)], 3), contextPage([], 2)]) {
      expect(
        (
          await readRequiredCheckOnHead(PAGINATION_HEAD, (cursor) =>
            pageResult(cursor === null ? contextPage([context(0)], 2, true, "next") : second),
          )
        ).kind,
      ).toBe("unmeasured");
    }
  });

  test("malformed pages, partial GraphQL errors, missing commits and wrong heads stay unmeasured", async () => {
    const wrongHead = contextPage([], 0);
    const changedPrHead = contextPage([], 0);
    changedPrHead.data.repository.pullRequest.headRefOid = "e".repeat(40);
    wrongHead.data.repository.pullRequest.commits.nodes[0]!.commit.oid = "f".repeat(40);
    const boolCount = contextPage([], 0) as unknown as { data: unknown };
    const malformedCount = JSON.parse(JSON.stringify(boolCount));
    malformedCount.data.repository.pullRequest.commits.nodes[0]!.commit.statusCheckRollup.contexts.totalCount = false;
    for (const page of [
      null,
      { data: { repository: null } },
      wrongHead,
      changedPrHead,
      malformedCount,
      { ...contextPage([], 0), errors: [{ message: "incomplete authorization" }] },
      contextPage([], 1, true, "next"),
      contextPage([{}], 1),
      contextPage([context(0)], 0),
    ]) {
      expect((await readRequiredCheckOnHead(PAGINATION_HEAD, () => pageResult(page))).kind).toBe("unmeasured");
    }
    expect(
      (await readRequiredCheckOnHead(PAGINATION_HEAD, () => ({ status: 0, stdout: "not JSON", stderr: "" }))).kind,
    ).toBe("unmeasured");
  });

  test("a failed page is not a measured absence", async () => {
    const result = await readRequiredCheckOnHead(PAGINATION_HEAD, () => ({
      status: 1,
      stdout: "",
      stderr: "HTTP 403",
    }));
    expect(result).toEqual({ kind: "unmeasured", reason: "HTTP 403" });
  });

  test("invalid head and excessive pagination refuse within a fixed host-work bound", async () => {
    let calls = 0;
    expect(
      (
        await readRequiredCheckOnHead("not-a-sha", () => {
          calls++;
          return pageResult(null);
        })
      ).kind,
    ).toBe("unmeasured");
    expect(calls).toBe(0);
    const result = await readRequiredCheckOnHead(PAGINATION_HEAD, () => {
      const id = calls++;
      return pageResult(contextPage([context(id)], 101, true, `cursor-${id}`));
    });
    expect(result.kind).toBe("unmeasured");
    expect(calls).toBe(100);
  });

  // The executable shim is POSIX-only; the pagination cases above have no host dependency.
  test.skipIf(process.platform === "win32")(
    "the real CLI consults page two before any terminal-workflow inference",
    () => {
      const dir = mkdtempSync(join(tmpdir(), "zeta-required-check-page-"));
      const bin = join(dir, "bin");
      mkdirSync(bin);
      const gh = join(bin, "gh");
      const trace = join(dir, "trace.jsonl");
      const first = contextPage(firstHundred(), 103, true, "MTAw");
      const second = contextPage([context(100, REQUIRED_GATE_NAME), context(101), context(102)], 103);
      const listed = [
        {
          number: 16911,
          createdAt: "2000-01-01T00:00:00Z",
          headRefName: "fixture",
          headRefOid: PAGINATION_HEAD,
          statusCheckRollup: firstHundred(),
        },
      ];
      const script = `#!/usr/bin/env bun
import { appendFileSync } from "node:fs";
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(trace)}, JSON.stringify(args) + "\\n");
if (args[0] === "pr" && args[1] === "list") {
  process.stdout.write(JSON.stringify(${JSON.stringify(listed)}));
} else if (args[0] === "api" && args[1] === "graphql" && args.includes("number=16911")) {
  process.stdout.write(JSON.stringify(args.includes("endCursor=MTAw") ? ${JSON.stringify(second)} : ${JSON.stringify(first)}));
} else {
  process.stderr.write("unexpected gh call; no external command is allowed");
  process.exit(2);
}
`;
      writeFileSync(gh, script);
      chmodSync(gh, 0o755);
      try {
        const subject = fileURLToPath(new URL("./required-check-started.ts", import.meta.url));
        const result = spawnSync(process.execPath, [subject, "--ref-prefix", "", "--min-age-min", "0"], {
          encoding: "utf8",
          timeout: 10_000,
          env: { ...process.env, PATH: [bin, dirname(process.execPath), process.env.PATH ?? ""].join(delimiter) },
        });
        expect(result.status).toBe(0);
        expect(result.stderr).toBe("");
        expect(result.stdout).toContain("gate (required) is published on #16911 (paginated head read)");
        const calls = readFileSync(trace, "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line) as string[]);
        expect(calls.length).toBe(3);
        expect(calls[1]).not.toContain("endCursor=MTAw");
        expect(calls[2]).toContain("endCursor=MTAw");
        expect(calls[1]![calls[1]!.indexOf("number=16911") - 1]).toBe("-F");
        expect(calls.flat().some((arg) => arg.includes("/actions/workflows/"))).toBe(false);
      } finally {
        for (const file of readdirSync(bin)) unlinkSync(join(bin, file));
        rmdirSync(bin);
        for (const file of readdirSync(dir)) unlinkSync(join(dir, file));
        rmdirSync(dir);
      }
    },
  );
});

describe("heartbeatPrsMissingRequiredCheck", () => {
  test("ignores young PRs — gate may not have been scheduled yet", () => {
    const missing = heartbeatPrsMissingRequiredCheck(
      [
        {
          number: 1,
          createdAt: "2026-08-15T14:55:00.000Z",
          headRef: "heartbeat/otto",
          headSha: "a".repeat(40),
          rollup: [],
        },
      ],
      T0,
      10 * 60_000,
    );
    expect(missing).toEqual([]);
  });

  test("names an old heartbeat PR whose gate never started", () => {
    const missing = heartbeatPrsMissingRequiredCheck(
      [
        {
          number: 10490,
          createdAt: "2026-08-15T12:00:00.000Z",
          headRef: "heartbeat/soraya",
          headSha: "b".repeat(40),
          rollup: [{ name: "lint (TS)" }],
        },
        {
          number: 2,
          createdAt: "2026-08-15T12:00:00.000Z",
          headRef: "heartbeat/otto",
          headSha: "c".repeat(40),
          rollup: [{ name: REQUIRED_GATE_NAME }],
        },
        {
          number: 3,
          createdAt: "2026-08-15T12:00:00.000Z",
          headRef: "fix/something",
          headSha: "d".repeat(40),
          rollup: [],
        },
      ],
      T0,
      10 * 60_000,
    );
    expect(missing).toEqual([10490]);
  });

  test("a current agent lane remains red while an unrelated heartbeat lane is excluded", () => {
    const prs = [
      {
        number: 15772,
        createdAt: "2026-08-15T12:00:00.000Z",
        headRef: "heartbeat/pr-archive",
        headSha: "e".repeat(40),
        rollup: [],
      },
      {
        number: 15784,
        createdAt: "2026-08-15T12:00:00.000Z",
        headRef: "heartbeat/alexa-flush",
        headSha: "f".repeat(40),
        rollup: [],
      },
    ];

    expect(prsMissingRequiredCheck(prs, T0, 10 * 60_000, "heartbeat/alexa-flush")).toEqual([15784]);
    expect(heartbeatPrsMissingRequiredCheck(prs, T0, 10 * 60_000)).toEqual([15772, 15784]);
  });
});

// The regression these tests exist for (2026-08-17): rollup-absence alone
// reported three healthy-but-queued PRs as "never started", because a gate run
// that has started does not publish `gate (required)` into the rollup for the
// first ~28 minutes. Existence of a run for the head SHA separates them; the
// numbers below are the real ones measured that morning.
describe("classifyMissingRequiredCheck — absent-from-rollup is not never-going-to-run", () => {
  test("a run that exists is queued, not stalled (#11387, #11401 shape)", () => {
    expect(classifyMissingRequiredCheck([{ number: 11387, runCount: 1 }])).toEqual({
      stalled: [],
      queued: [11387],
    });
  });

  test("zero runs is the genuine defect (#11369, #11426 shape)", () => {
    expect(classifyMissingRequiredCheck([{ number: 11369, runCount: 0 }])).toEqual({
      stalled: [11369],
      queued: [],
    });
  });

  // THE FALSIFIER FOR THE 2026-08-25 DEFECT (#15327). Every test below fails
  // against the previous implementation, which split on `runCount` alone.
  test("a TERMINAL run that never published the check is stalled, not queued (#15327 shape)", () => {
    // `action_required`: GitHub withholds execution for PRs opened with
    // GITHUB_TOKEN. The run exists and has 0 jobs, and it is finished — so the
    // check will never appear. `runCount: 1` called this "merely slow" for 14h.
    expect(classifyMissingRequiredCheck([{ number: 15327, runCount: 1, liveRunCount: 0 }])).toEqual({
      stalled: [15327],
      queued: [],
    });
  });

  test("a live run is still queued — the fix must not make in-flight PRs red", () => {
    expect(classifyMissingRequiredCheck([{ number: 15499, runCount: 1, liveRunCount: 1 }])).toEqual({
      stalled: [],
      queued: [15499],
    });
  });

  test("finished runs alongside one live run is queued — the live one can still publish", () => {
    expect(classifyMissingRequiredCheck([{ number: 15500, runCount: 3, liveRunCount: 1 }])).toEqual({
      stalled: [],
      queued: [15500],
    });
  });

  test("many runs, all finished, none published — stalled however high the count", () => {
    expect(classifyMissingRequiredCheck([{ number: 15501, runCount: 9, liveRunCount: 0 }])).toEqual({
      stalled: [15501],
      queued: [],
    });
  });

  test("liveRunCount absent falls back to the old, more forgiving reading", () => {
    // An unmeasured field must never manufacture a red. Absent is not zero.
    expect(classifyMissingRequiredCheck([{ number: 15502, runCount: 1 }])).toEqual({
      stalled: [],
      queued: [15502],
    });
  });

  test("zero runs is stalled whether or not the live count was measured", () => {
    expect(classifyMissingRequiredCheck([{ number: 15503, runCount: 0, liveRunCount: 0 }])).toEqual({
      stalled: [15503],
      queued: [],
    });
  });

  test("a mixed batch reports each PR under the right verdict", () => {
    expect(
      classifyMissingRequiredCheck([
        { number: 11387, runCount: 1 },
        { number: 11426, runCount: 0 },
        { number: 11401, runCount: 2 },
      ]),
    ).toEqual({ stalled: [11426], queued: [11387, 11401] });
  });

  test("no candidates is not a verdict about anything", () => {
    expect(classifyMissingRequiredCheck([])).toEqual({ stalled: [], queued: [] });
  });
});

describe("listWithTransientRetry", () => {
  test("retries bounded transient host failures and returns the recovered read", async () => {
    const results = [
      { status: 1, stdout: "", stderr: "HTTP 504: request timed out" },
      { status: 1, stdout: "", stderr: "connection reset by peer" },
      { status: 0, stdout: "[]", stderr: "" },
    ];
    const delays: number[] = [];
    const result = await listWithTransientRetry(
      () => results.shift()!,
      (milliseconds) => {
        delays.push(milliseconds);
        return Promise.resolve();
      },
    );
    expect(result).toEqual({ status: 0, stdout: "[]", stderr: "" });
    expect(delays).toEqual([1_000, 2_000]);
  });

  test("does not retry an authorization failure", async () => {
    let calls = 0;
    const result = await listWithTransientRetry(
      () => {
        calls += 1;
        return { status: 1, stdout: "", stderr: "HTTP 403: Resource not accessible" };
      },
      () => Promise.resolve(),
    );
    expect(result.status).toBe(1);
    expect(calls).toBe(1);
  });

  test("recognizes only transport-class failures", () => {
    expect(isTransientHostFailure("HTTP 502: bad gateway")).toBe(true);
    expect(isTransientHostFailure("ECONNRESET")).toBe(true);
    expect(isTransientHostFailure("HTTP 401: bad credentials")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// REPO-WIDE SCOPE (081M0TK8DE8087G0R0001HSKHF)
//
// These are the falsifiers for the widening, and each fails against the pre-change
// file: `prsMissingRequiredCheck` did not exist, and the only selector hard-coded
// `headRef.startsWith("heartbeat/")` so the ordinary-PR case below returned [].
// ---------------------------------------------------------------------------

/** An ordinary PR, old enough to judge, whose rollup carries everything BUT the gate. */
const ORDINARY_PR_WITHOUT_GATE = {
  number: 14858,
  createdAt: "2026-08-15T14:00:00.000Z",
  headRef: "ouroboros-bootstrap",
  headSha: "58a43245d650253576014ef999e12da74e6f445e",
  // Verbatim from `gh pr checks 14858 --json name` on 2026-08-24: six passing checks,
  // no gate. The bare `gh pr checks` reported rc=0 / fail=0 / pend=0 on this exact set.
  rollup: [
    { name: "submit-nuget" },
    { name: "Analyze (csharp)" },
    { name: "Analyze (go)" },
    { name: "Analyze (java-kotlin)" },
    { name: "Analyze (javascript-typescript)" },
    { name: "Analyze (python)" },
  ],
} as const;

describe("prsMissingRequiredCheck — the class is not heartbeat-shaped", () => {
  test("an ordinary PR with six green checks and no gate is FOUND at repo-wide scope", () => {
    expect(prsMissingRequiredCheck([ORDINARY_PR_WITHOUT_GATE], T0, 10 * 60_000, "")).toEqual([14858]);
  });

  test("...and is INVISIBLE at the heartbeat scope — which is the defect, stated as a test", () => {
    expect(prsMissingRequiredCheck([ORDINARY_PR_WITHOUT_GATE], T0, 10 * 60_000, HEARTBEAT_REF_PREFIX)).toEqual([]);
  });

  test("the heartbeat entry point is unchanged by the widening", () => {
    const heartbeat = { ...ORDINARY_PR_WITHOUT_GATE, number: 11369, headRef: "heartbeat/otto-flush-abc" };
    expect(heartbeatPrsMissingRequiredCheck([heartbeat, ORDINARY_PR_WITHOUT_GATE], T0, 10 * 60_000)).toEqual([11369]);
  });

  test("repo-wide scope still respects the age floor — a fresh PR is queued, not stalled", () => {
    const fresh = { ...ORDINARY_PR_WITHOUT_GATE, createdAt: "2026-08-15T14:59:00.000Z" };
    expect(prsMissingRequiredCheck([fresh], T0, 10 * 60_000, "")).toEqual([]);
  });

  test("repo-wide scope does not flag a PR whose gate is merely pending", () => {
    const gated = { ...ORDINARY_PR_WITHOUT_GATE, rollup: [{ name: REQUIRED_GATE_NAME }] };
    expect(prsMissingRequiredCheck([gated], T0, 10 * 60_000, "")).toEqual([]);
  });
});

describe("listingWasTruncated — a full page is unmeasured, not clean", () => {
  test("a page filled to the limit is truncated", () => {
    // The live shape this guards: 42 open PRs today against the old hard-coded
    // `--limit 50`. Eight more and the detector would have measured a subset.
    expect(listingWasTruncated(50, 50)).toBe(true);
    expect(listingWasTruncated(42, 50)).toBe(false);
  });

  test("the default limit leaves real headroom over the measured open-PR count", () => {
    expect(DEFAULT_PR_LIST_LIMIT).toBeGreaterThan(50);
  });
});
