import { describe, expect, test } from "bun:test";
import { authorizeMerge } from "../../observe/merge-receipt";
import { err, forgeError, ok } from "../result";
import type { GithubRest } from "./github-pr-rest";
import { mapMergeObserve, observeMerge } from "./github-merge-observe";

type Node = Record<string, unknown>;
const HEAD = "a".repeat(40);
const checks = (count: number, offset = 0): Node[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `check-${offset + i}`,
    __typename: "CheckRun",
    name: `job-${offset + i}`,
    status: "COMPLETED",
    conclusion: "SUCCESS",
  }));
const threads = (count: number, offset = 0): Node[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `thread-${offset + i}`,
    isResolved: true,
    isOutdated: false,
  }));
const connection = (
  nodes: Node[] | undefined,
  totalCount: number,
  hasNextPage = false,
  endCursor: string | null = null,
) => ({
  totalCount,
  pageInfo: { hasNextPage, endCursor },
  ...(nodes === undefined ? {} : { nodes }),
});
const empty = () => connection([], 0);
const skipped = (count = 0) => connection(undefined, count);
const page = (contexts = empty(), reviewThreads = empty()) => ({
  data: {
    repository: {
      pullRequest: {
        number: 1,
        state: "OPEN",
        headRefOid: HEAD,
        mergeStateStatus: "CLEAN",
        autoMergeRequest: null,
        mergeCommit: null,
        reviewThreads,
        commits: { nodes: [{ commit: { oid: HEAD, statusCheckRollup: { contexts } } }] },
      },
    },
  },
});
type Page = ReturnType<typeof page>;
function scripted(pages: Page[]) {
  const variables: Record<string, unknown>[] = [];
  const rest: GithubRest = {
    request: async (_method, _path, body) => {
      variables.push((body as { variables: Record<string, unknown> }).variables);
      const response = pages[variables.length - 1];
      return response === undefined
        ? err(forgeError("internal", "unexpected extra request"))
        : ok(JSON.stringify(response));
    },
  };
  return { rest, variables };
}
async function decision(rest: GithubRest) {
  return authorizeMerge(1, "fixture", async (number) => {
    const result = await observeMerge(rest, "o/r", number);
    return result.ok ? { ok: true, gate: result.value } : { ok: false, why: result.error.message };
  });
}

describe("complete merge receipt traversal", () => {
  test.each(["FAILURE", "IN_PROGRESS"])(
    "a %s check after 100 successes still refuses actual merge authorization",
    async (tail) => {
      const later = checks(1, 100);
      later[0] = {
        ...later[0],
        status: tail === "FAILURE" ? "COMPLETED" : tail,
        conclusion: tail === "FAILURE" ? tail : null,
      };
      const fixture = scripted([
        page(connection(checks(100), 101, true, "check-100")),
        page(connection(later, 101, false, "check-101"), skipped()),
      ]);
      expect((await decision(fixture.rest)).permitted).toBe(false);
      expect(fixture.variables).toHaveLength(2);
      expect(fixture.variables[1]).toMatchObject({
        contextCursor: "check-100",
        includeContexts: true,
        includeThreads: false,
      });
    },
  );

  test("thread 101 remains a blocker after 100 resolved threads", async () => {
    const fixture = scripted([
      page(empty(), connection(threads(100), 101, true, "thread-100")),
      page(skipped(), connection([{ id: "thread-100", isResolved: false }], 101, false, "thread-101")),
    ]);
    const result = await decision(fixture.rest);
    expect(result.permitted).toBe(false);
    expect(result.why).toContain("1 unresolved review thread");
    expect(fixture.variables[1]).toMatchObject({ includeContexts: false, threadCursor: "thread-100" });
  });

  test("different connection lengths preserve all identities and omit only completed nodes", async () => {
    const fixture = scripted([
      page(connection(checks(100), 201, true, "c1"), connection(threads(100), 101, true, "t1")),
      page(connection(checks(100, 100), 201, true, "c2"), connection(threads(1, 100), 101, false, "t2")),
      page(connection(checks(1, 200), 201, false, "c3"), skipped(101)),
    ]);
    const result = await observeMerge(fixture.rest, "o/r", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.checks.ok).toBe(201);
    expect(result.value.threads).toHaveLength(101);
    expect(result.value.requiredChecks).toEqual(result.value.checks);
    expect(fixture.variables[2]).toMatchObject({
      contextCursor: "c2",
      threadCursor: "t2",
      includeContexts: true,
      includeThreads: false,
    });
  });

  test("legacy status-context tail is included in the same conservative summary", async () => {
    const fixture = scripted([
      page(connection(checks(100), 101, true, "c1")),
      page(
        connection(
          [{ id: "status-tail", __typename: "StatusContext", context: "external", state: "PENDING" }],
          101,
          false,
          "c2",
        ),
        skipped(),
      ),
    ]);
    const result = await observeMerge(fixture.rest, "o/r", 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.checks.pending).toBe(1);
      expect(result.value.nextAction).toBe("wait-ci");
    }
  });

  test("an explicit null rollup stays empty while threads continue", async () => {
    const pages = [
      page(empty(), connection(threads(100), 101, true, "t1")),
      page(empty(), connection(threads(1, 100), 101, false, "t2")),
    ];
    for (const p of pages)
      (p.data.repository.pullRequest.commits.nodes[0]!.commit as Record<string, unknown>).statusCheckRollup = null;
    expect((await decision(scripted(pages).rest)).permitted).toBe(true);
  });

  test("the pure mapper refuses a first-page prefix even if CLEAN", () => {
    expect(mapMergeObserve(JSON.stringify(page(connection(checks(100), 101, true, "c1")))).ok).toBe(false);
  });

  test("foreign legacy fields cannot hide an admitted CheckRun failure", async () => {
    const mixed = { ...checks(1)[0], conclusion: "FAILURE", context: "spoof" };
    const fixture = scripted([page(connection([mixed], 1, false, "c1"))]);
    const result = await decision(fixture.rest);
    expect(result.permitted).toBe(false);
    expect(result.why).toContain("1 required check(s) failing");
  });

  test("the admitted 100-page boundary counts all 10000 checks", async () => {
    const pages = Array.from({ length: 100 }, (_, i) =>
      page(connection(checks(100, i * 100), 10000, i < 99, `c${i}`), i === 0 ? empty() : skipped()),
    );
    const fixture = scripted(pages);
    const result = await observeMerge(fixture.rest, "o/r", 1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.checks.ok).toBe(10000);
    expect(fixture.variables).toHaveLength(100);
  });
});

type Mutation = (value: Page) => void;
const pr = (p: Page) => p.data.repository.pullRequest;
const context = (p: Page) => pr(p).commits.nodes[0]!.commit.statusCheckRollup.contexts;
const mutations: [string, Mutation][] = [
  [
    "changed head",
    (p) => {
      pr(p).headRefOid = "b".repeat(40);
      pr(p).commits.nodes[0]!.commit.oid = "b".repeat(40);
    },
  ],
  [
    "wrong commit",
    (p) => {
      pr(p).commits.nodes[0]!.commit.oid = "b".repeat(40);
    },
  ],
  [
    "wrong PR",
    (p) => {
      pr(p).number = 2;
    },
  ],
  [
    "changed merge state",
    (p) => {
      pr(p).mergeStateStatus = "BLOCKED";
    },
  ],
  [
    "changed count",
    (p) => {
      context(p).totalCount = 102;
    },
  ],
  [
    "changed completed connection count",
    (p) => {
      pr(p).reviewThreads.totalCount = 1;
    },
  ],
  [
    "unexpected completed nodes",
    (p) => {
      pr(p).reviewThreads = empty();
    },
  ],
  [
    "repeated cursor",
    (p) => {
      context(p).pageInfo.endCursor = "c1";
    },
  ],
  [
    "missing cursor",
    (p) => {
      context(p).pageInfo.endCursor = null;
    },
  ],
  [
    "duplicate ID across pages",
    (p) => {
      context(p).nodes![0]!.id = "check-0";
    },
  ],
  [
    "missing ID",
    (p) => {
      delete context(p).nodes![0]!.id;
    },
  ],
  [
    "unknown check state",
    (p) => {
      context(p).nodes![0]!.status = "UNRECOGNIZED";
    },
  ],
  [
    "completed check without conclusion",
    (p) => {
      context(p).nodes![0]!.conclusion = null;
    },
  ],
  [
    "missing pageInfo",
    (p) => {
      delete (context(p) as Record<string, unknown>).pageInfo;
    },
  ],
  [
    "missing count",
    (p) => {
      delete (context(p) as Record<string, unknown>).totalCount;
    },
  ],
  [
    "null nodes",
    (p) => {
      (context(p) as Record<string, unknown>).nodes = null;
    },
  ],
  [
    "invalid continuation flag",
    (p) => {
      (context(p).pageInfo as Record<string, unknown>).hasNextPage = "false";
    },
  ],
  [
    "negative count",
    (p) => {
      context(p).totalCount = -1;
    },
  ],
  [
    "empty terminal page before declared count",
    (p) => {
      context(p).nodes = [];
    },
  ],
  [
    "GraphQL partial errors",
    (p) => {
      (p as Record<string, unknown>).errors = [{ message: "partial failure" }];
    },
  ],
];
describe("incomplete observations cannot authorize a merge", () => {
  test.each(mutations)("refuses %s", async (_name, mutate) => {
    const second = page(connection(checks(1, 100), 101, false, "c2"), skipped());
    mutate(second);
    const fixture = scripted([page(connection(checks(100), 101, true, "c1")), second]);
    const result = await decision(fixture.rest);
    expect(result.permitted).toBe(false);
    expect(result.why).toContain("could not read the gate state");
    expect(fixture.variables).toHaveLength(2);
  });

  test.each(["page over 100", "count over cap", "short nonterminal page", "duplicate in page"])(
    "refuses %s before requesting a continuation",
    async (name) => {
      const c = connection(checks(100), 101, true, "c1");
      if (name === "page over 100") c.nodes = checks(101);
      if (name === "count over cap") c.totalCount = 10001;
      if (name === "short nonterminal page") c.nodes = checks(99);
      if (name === "duplicate in page") c.nodes![99]!.id = "check-0";
      const fixture = scripted([page(c)]);
      expect((await decision(fixture.rest)).permitted).toBe(false);
      expect(fixture.variables).toHaveLength(1);
    },
  );

  test.each(["transport failure", "transport exception"])(
    "refuses %s after an admitted first page without retry",
    async (kind) => {
      let calls = 0;
      const rest: GithubRest = {
        request: async () => {
          calls++;
          if (calls === 1) return ok(JSON.stringify(page(connection(checks(100), 101, true, "c1"))));
          if (kind === "transport exception") throw new Error("synthetic network failure");
          return err(forgeError("internal", "synthetic network failure"));
        },
      };
      expect((await decision(rest)).permitted).toBe(false);
      expect(calls).toBe(2);
    },
  );
});
