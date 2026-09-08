import { describe, expect, test } from "bun:test";
import { ok } from "../result";
import type { GithubRest } from "./github-pr-rest.ts";
import {
  MERGE_OBSERVE_QUERY,
  mapMergeObserve,
  mapOpenPullRequests,
  mergeObserveRequest,
  observeMerge,
  observeOpenPullRequests,
} from "./github-merge-observe.ts";

const HEAD = "a".repeat(40);
function envelope(over: Record<string, unknown>): string {
  const pr = {
    number: 42,
    state: "OPEN",
    headRefOid: HEAD,
    mergeStateStatus: "CLEAN",
    autoMergeRequest: null,
    mergeCommit: null,
    reviewThreads: { nodes: [] },
    commits: { nodes: [{ commit: { oid: HEAD, statusCheckRollup: { contexts: { nodes: [] } } } }] },
    ...over,
  };
  // Compact semantic fixtures still receive the metadata a complete API receipt
  // must carry. Malformation tests mutate the resulting JSON after this builder.
  const threads = pr.reviewThreads as { nodes: unknown[] };
  const commits = pr.commits as {
    nodes: { commit: { oid?: string; statusCheckRollup: { contexts: { nodes: Record<string, unknown>[] } } } }[];
  };
  const commit = commits.nodes[0]!.commit;
  const contexts = commit.statusCheckRollup.contexts;
  const complete = (nodes: unknown[], label: string) => ({
    totalCount: nodes.length,
    pageInfo: { hasNextPage: false, endCursor: nodes.length > 0 ? label : null },
    nodes,
  });
  return JSON.stringify({
    data: {
      repository: {
        pullRequest: {
          ...pr,
          reviewThreads: complete(threads.nodes, "threads-end"),
          commits: {
            nodes: [
              {
                commit: {
                  ...commit,
                  oid: commit.oid ?? HEAD,
                  statusCheckRollup: {
                    contexts: complete(
                      contexts.nodes.map((n, i) => ({
                        id: `check-${i}`,
                        __typename: typeof n.context === "string" ? "StatusContext" : "CheckRun",
                        conclusion: null,
                        ...n,
                      })),
                      "checks-end",
                    ),
                  },
                },
              },
            ],
          },
        },
      },
    },
  });
}

describe("mergeObserveRequest", () => {
  test("is one POST graphql with owner/name/number — never a second required-checks call", () => {
    const call = mergeObserveRequest("Lucent-Financial-Group/Zeta", 15694);
    expect(call.ok).toBe(true);
    if (!call.ok) return;
    expect(call.value).toEqual({
      method: "POST",
      path: "graphql",
      query: MERGE_OBSERVE_QUERY,
      variables: { owner: "Lucent-Financial-Group", name: "Zeta", number: 15694 },
    });
    expect(call.value.query.includes("statusCheckRollup")).toBe(true);
    expect(call.value.query.includes("reviewThreads")).toBe(true);
  });

  test("rejects a bad nwo without touching the network", () => {
    expect(mergeObserveRequest("nope", 1).ok).toBe(false);
  });
});

describe("mapMergeObserve", () => {
  test("CLEAN + no threads + no pending checks → gate clean, next none", () => {
    const got = mapMergeObserve(envelope({}));
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.gate).toBe("clean");
    expect(got.value.nextAction).toBe("none");
    expect(got.value.unresolvedThreads).toBe(0);
    expect(got.value.autoMerge).toBe("none");
  });

  test("failed CheckRun → fix-failed-checks, one observation not two polls", () => {
    const got = mapMergeObserve(
      envelope({
        mergeStateStatus: "BLOCKED",
        commits: {
          nodes: [
            {
              commit: {
                statusCheckRollup: {
                  // The REAL shape GitHub returns: `contexts` is a connection, so the union nodes
                  // live under `nodes`. The old double said `contexts: [...]` — the same wrong shape
                  // the query had — so this test agreed with the bug instead of catching it.
                  contexts: {
                    nodes: [{ __typename: "CheckRun", name: "lint (TS)", status: "COMPLETED", conclusion: "FAILURE" }],
                  },
                },
              },
            },
          ],
        },
      }),
    );
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.checks.failed).toBe(1);
    expect(got.value.nextAction).toBe("fix-failed-checks");
    expect(got.value.gate).toBe("blocked");
  });

  test("unresolved review thread → resolve-threads", () => {
    const got = mapMergeObserve(
      envelope({
        mergeStateStatus: "BLOCKED",
        reviewThreads: {
          nodes: [
            { id: "a", isResolved: false },
            { id: "b", isResolved: true },
          ],
        },
      }),
    );
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.unresolvedThreads).toBe(1);
    expect(got.value.nextAction).toBe("resolve-threads");
  });

  test("BEHIND → rebase", () => {
    const got = mapMergeObserve(envelope({ mergeStateStatus: "BEHIND" }));
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.gate).toBe("dirty");
    expect(got.value.nextAction).toBe("rebase");
  });
});

describe("mapOpenPullRequests", () => {
  test("one GraphQL list carries mergeStateStatus so World.forgeState.cleanPrCount can be non-zero", () => {
    const got = mapOpenPullRequests(
      JSON.stringify({
        data: {
          repository: {
            pullRequests: {
              nodes: [
                {
                  number: 1,
                  title: "clean",
                  mergeStateStatus: "CLEAN",
                  url: "u",
                  updatedAt: "t",
                  isDraft: false,
                  headRefName: "a",
                  baseRefName: "main",
                  author: { login: "ace" },
                  reviewDecision: "APPROVED",
                },
                {
                  number: 2,
                  title: "blocked",
                  mergeStateStatus: "BLOCKED",
                  url: "u2",
                  updatedAt: "t",
                  isDraft: false,
                  headRefName: "b",
                  baseRefName: "main",
                  author: { login: "ace" },
                  reviewDecision: null,
                },
              ],
            },
          },
        },
      }),
    );
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value).toHaveLength(2);
    expect(got.value[0]?.mergeStateStatus).toBe("clean");
    expect(got.value[0]?.reviewDecision).toBe("approved");
    expect(got.value[1]?.mergeStateStatus).toBe("blocked");
  });
});

describe("observeOpenPullRequests", () => {
  test("issues exactly one graphql POST", async () => {
    const calls: { method: string; path: string }[] = [];
    const rest: GithubRest = {
      request: (method, path) => {
        calls.push({ method, path });
        return Promise.resolve(ok(JSON.stringify({ data: { repository: { pullRequests: { nodes: [] } } } })));
      },
    };
    const got = await observeOpenPullRequests(rest, "o/r", 20);
    expect(got.ok).toBe(true);
    expect(calls).toEqual([{ method: "POST", path: "graphql" }]);
  });
});

describe("observeMerge", () => {
  test("issues one graphql POST when both connections are complete", async () => {
    const calls: { method: string; path: string }[] = [];
    const rest: GithubRest = {
      request: (method, path) => {
        calls.push({ method, path });
        return Promise.resolve(ok(envelope({})));
      },
    };
    const got = await observeMerge(rest, "o/r", 42);
    expect(got.ok).toBe(true);
    expect(calls).toEqual([{ method: "POST", path: "graphql" }]);
  });
});

describe("review threads — what BLOCKS vs what can be ANSWERED", () => {
  const t = (id: string | undefined, isResolved: boolean, extra: Record<string, unknown> = {}) => ({
    ...(id === undefined ? {} : { id }),
    isResolved,
    ...extra,
  });

  test("the thread id reaches the gate — it is the only thing resolveThread accepts", () => {
    const got = mapMergeObserve(
      envelope({ reviewThreads: { nodes: [t("PRRT_1", false, { path: "a.ts", line: 7 })] } }),
    );
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.threads.map((x) => x.id)).toEqual(["PRRT_1"]);
    expect(got.value.threads[0]?.path).toBe("a.ts");
    expect(got.value.threads[0]?.line).toBe(7);
  });

  test("the reviewer's first comment comes through", () => {
    const got = mapMergeObserve(
      envelope({
        reviewThreads: {
          nodes: [
            t("PRRT_1", false, { comments: { nodes: [{ author: { login: "lior" }, body: "unbounded retry" }] } }),
          ],
        },
      }),
    );
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.threads[0]?.firstComment).toEqual({ author: "lior", body: "unbounded retry" });
  });

  test("an ID-LESS thread refuses the entire receipt instead of shrinking its blockers", () => {
    // Deriving the blocker count from the answerable subset would let a malformed thread quietly
    // reduce it, which is a merge permitted because a field was missing.
    const got = mapMergeObserve(envelope({ reviewThreads: { nodes: [t(undefined, false), t("PRRT_2", false)] } }));
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.message).toContain("identity");
  });

  test("duplicate thread IDs refuse even when both copies say resolved", () => {
    const got = mapMergeObserve(envelope({ reviewThreads: { nodes: [t("same", true), t("same", true)] } }));
    expect(got.ok).toBe(false);
  });

  test("no warning when every unresolved thread is answerable", () => {
    const got = mapMergeObserve(envelope({ reviewThreads: { nodes: [t("PRRT_1", false)] } }));
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.warnings.some((w) => w.includes("cannot be answered from here"))).toBe(false);
  });

  test("resolved threads are carried but do not block", () => {
    const got = mapMergeObserve(envelope({ reviewThreads: { nodes: [t("PRRT_1", true)] } }));
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.unresolvedThreads).toBe(0);
    expect(got.value.threads).toHaveLength(1);
    expect(got.value.threads[0]?.isResolved).toBe(true);
  });

  test("a thread that omits isResolved is treated as UNRESOLVED, not as resolved", () => {
    // An absent field must never read as "already handled". `=== true` and `!== false` are
    // identical on every fixture that sets the flag, and opposite on the one that does not — a
    // mutant swapping them SURVIVED until this test existed.
    const got = mapMergeObserve(envelope({ reviewThreads: { nodes: [{ id: "PRRT_1" }] } }));
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.threads[0]?.isResolved).toBe(false);
    expect(got.value.unresolvedThreads).toBe(1);
  });

  test("an absent isOutdated is treated as NOT outdated", () => {
    const got = mapMergeObserve(envelope({ reviewThreads: { nodes: [{ id: "PRRT_1", isResolved: false }] } }));
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.threads[0]?.isOutdated).toBe(false);
  });

  test("the reviewThreads selection asks for the id, the outdated flag and the first comment", () => {
    // Scoped to the reviewThreads BLOCK. `toContain("id")` over the whole query is satisfied by
    // `mergeCommit { oid }` — a mutant deleting the thread id survived it. Found by the matrix.
    const at = MERGE_OBSERVE_QUERY.indexOf("reviewThreads(first: 100,");
    expect(at).toBeGreaterThan(-1);
    const block = MERGE_OBSERVE_QUERY.slice(at, MERGE_OBSERVE_QUERY.indexOf("commits(last: 1)", at));
    // A STANDALONE `id` field, not the substring: `oid` and `isOutdated` both contain "id".
    const standaloneId = block.split("\n").some((l) => l.trim() === "id");
    expect(standaloneId).toBe(true);
    for (const field of ["isResolved", "isOutdated", "path", "line", "comments(first: 1)", "author { login }"]) {
      expect(block).toContain(field);
    }
  });
});

describe("MERGE_OBSERVE_QUERY — the shape GitHub will actually accept", () => {
  test("a union type condition is applied to the NODE, never to the connection", () => {
    // The defect: `contexts { ... on CheckRun { ... } }`. `contexts` is a
    // StatusCheckRollupContextConnection, so GitHub refuses the WHOLE query with
    // "Fragment on CheckRun cannot be spread inside StatusCheckRollupContextConnection" — every
    // call, for every PR. No unit double could catch it: a double written from the implementation
    // reproduces the implementation own idea of the shape, which is exactly what happened here.
    // This asserts on the QUERY TEXT instead, which is the part the server judges.
    const at = MERGE_OBSERVE_QUERY.indexOf("contexts");
    expect(at).toBeGreaterThan(-1);
    const rest = MERGE_OBSERVE_QUERY.slice(at);
    const nodesAt = rest.indexOf("nodes @include");
    const spreadAt = rest.indexOf("... on CheckRun");
    expect(nodesAt).toBeGreaterThan(-1);
    expect(spreadAt).toBeGreaterThan(-1);
    // The type condition must come AFTER the node traversal, never directly inside the connection.
    expect(spreadAt).toBeGreaterThan(nodesAt);
  });

  test("the connection is paginated rather than unbounded", () => {
    expect(MERGE_OBSERVE_QUERY).toContain("contexts(first:");
  });

  test("__typename is requested, so a union node stays distinguishable after parsing", () => {
    expect(MERGE_OBSERVE_QUERY).toContain("__typename");
  });
});
