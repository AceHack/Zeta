import { describe, expect, test } from "bun:test";

import {
  canonicalJson,
  classifyChange,
  coverageDelta,
  coveredRefs,
  emptyBaseline,
  normalizeRuleset,
  refNameMatches,
  type CanonicalRuleset,
} from "./ruleset-model";

// The real ref shapes this repo carries: ~21 live heartbeat lanes plus the
// transient per-push snapshot refs that PR #15309 stopped minting.
const LANE_REFS = [
  "refs/heads/heartbeat/otto",
  "refs/heads/heartbeat/society",
  "refs/heads/heartbeat/society-buffer",
  "refs/heads/heartbeat/alexa-flush",
  "refs/heads/heartbeat/soraya-flush",
];
const SNAPSHOT_REFS = [
  "refs/heads/heartbeat/alexa-flush-0036f0cfdb1aa4e7e405aaf68cd91e36bcf8130a",
  "refs/heads/heartbeat/otto-flush-1756000000",
  "refs/heads/heartbeat/society-flush-deadbeef",
];
const ALL_REFS = [...LANE_REFS, ...SNAPSHOT_REFS, "refs/heads/main"];

describe("refNameMatches — File::FNM_PATHNAME semantics", () => {
  test("`*` does NOT cross a `/` — the trap that makes a pattern a silent no-op", () => {
    // This is the load-bearing negative. `refs/heads/*-flush-*` reads as if it
    // would catch the snapshot refs; it has three path segments and they have
    // four, so it matches NOTHING.
    for (const ref of SNAPSHOT_REFS) {
      expect(refNameMatches("refs/heads/*-flush-*", ref, "main")).toBe(false);
    }
  });

  test("the segment-anchored pattern DOES match the snapshot refs", () => {
    for (const ref of SNAPSHOT_REFS) {
      expect(refNameMatches("refs/heads/heartbeat/*-flush-*", ref, "main")).toBe(
        true,
      );
    }
  });

  test("`-flush-` requires a trailing segment: the fixed `-flush` lanes survive", () => {
    // PR #15309 mints one fixed `heartbeat/<agent>-flush` ref per agent and
    // force-updates it in place. Those must STAY protected.
    expect(
      refNameMatches("refs/heads/heartbeat/*-flush-*", "refs/heads/heartbeat/alexa-flush", "main"),
    ).toBe(false);
    expect(
      refNameMatches("refs/heads/heartbeat/*-flush-*", "refs/heads/heartbeat/soraya-flush", "main"),
    ).toBe(false);
  });

  test("`**` does cross `/` (GitHub's documented multi-level form)", () => {
    expect(refNameMatches("refs/heads/**/*-flush-*", SNAPSHOT_REFS[0] as string, "main")).toBe(
      true,
    );
    // A bare pattern is qualified under `refs/heads/`, so these two agree.
    expect(refNameMatches("qa/**/*", "refs/heads/qa/foo/bar/baz", "main")).toBe(true);
    expect(refNameMatches("refs/heads/qa/**/*", "refs/heads/qa/foo/bar/baz", "main")).toBe(true);
    // …and `*` still refuses to cross `/`, even standing beside a `**`.
    expect(refNameMatches("refs/heads/qa/*", "refs/heads/qa/foo/bar", "main")).toBe(false);
  });

  test("a trailing `**` consumes ALL remaining segments, including the last", () => {
    // Mutation-found gap: the `**` loop bound must be `i <= len`, not `i < len`.
    // With `<`, a trailing `**` can never swallow the final segment and this
    // returns false — a whole class of pattern silently stops matching.
    expect(refNameMatches("refs/heads/qa/**", "refs/heads/qa/a/b", "main")).toBe(true);
    expect(refNameMatches("refs/heads/qa/**", "refs/heads/qa/a", "main")).toBe(true);
    expect(refNameMatches("refs/heads/**", "refs/heads/heartbeat/otto", "main")).toBe(true);
  });

  test("a malformed character class matches NOTHING rather than crashing", () => {
    // Mutation-found gap: the catch-arm in segmentGlob had no test. Fail-closed
    // means an unparseable pattern covers nothing — which `coverageDelta` then
    // reports as released refs, so it cannot hide.
    expect(refNameMatches("refs/heads/[z-a]bad", "refs/heads/xbad", "main")).toBe(false);
    // An unterminated `[` is treated as a literal bracket, not an error.
    expect(refNameMatches("refs/heads/[abc", "refs/heads/[abc", "main")).toBe(true);
  });

  test("documented example: `qa/*` matches one level and not two", () => {
    expect(refNameMatches("qa/*", "refs/heads/qa/foo", "main")).toBe(true);
    expect(refNameMatches("qa/*", "refs/heads/qa/foo/bar", "main")).toBe(false);
  });

  test("sentinels", () => {
    expect(refNameMatches("~ALL", "refs/heads/anything", "main")).toBe(true);
    expect(refNameMatches("~DEFAULT_BRANCH", "refs/heads/main", "main")).toBe(true);
    expect(refNameMatches("~DEFAULT_BRANCH", "refs/heads/other", "main")).toBe(false);
  });

  test("matching is case-sensitive and never culture-folded", () => {
    expect(refNameMatches("refs/heads/Heartbeat/*", "refs/heads/heartbeat/otto", "main")).toBe(
      false,
    );
  });
});

describe("coveredRefs / coverageDelta", () => {
  const include = { ref_name: { include: ["refs/heads/heartbeat/*"], exclude: [] } };

  test("include-only covers every heartbeat ref and not main", () => {
    const covered = coveredRefs(include, ALL_REFS, "main");
    expect(covered.length).toBe(LANE_REFS.length + SNAPSHOT_REFS.length);
    expect(covered).not.toContain("refs/heads/main");
  });

  test("the CORRECT exclude releases exactly the snapshot refs and keeps the lanes", () => {
    const desired = {
      ref_name: {
        include: ["refs/heads/heartbeat/*"],
        exclude: ["refs/heads/heartbeat/*-flush-*"],
      },
    };
    const d = coverageDelta(include, desired, ALL_REFS, "main");
    expect(d.released.length).toBe(SNAPSHOT_REFS.length);
    expect([...d.released].sort()).toEqual([...SNAPSHOT_REFS].sort());
    expect(d.afterCount).toBe(LANE_REFS.length);
    expect(d.newlyCovered.length).toBe(0);
  });

  test("FALSIFIER: the naive exclude releases ZERO refs — a no-op wearing a fix", () => {
    const naive = {
      ref_name: {
        include: ["refs/heads/heartbeat/*"],
        exclude: ["refs/heads/*-flush-*"],
      },
    };
    const d = coverageDelta(include, naive, ALL_REFS, "main");
    expect(d.released.length).toBe(0);
    expect(d.afterCount).toBe(d.beforeCount);
  });
});

describe("normalizeRuleset — idempotency depends on this", () => {
  const live = {
    id: 16934633,
    name: "Heartbeat Branch Protection",
    target: "branch",
    enforcement: "active" as const,
    // server bookkeeping the reconciler must ignore
    node_id: "RRS_xxx",
    created_at: "2026-05-27T10:15:45.261-04:00",
    updated_at: "2026-08-25T09:21:57.997-04:00",
    conditions: {
      ref_name: {
        exclude: ["refs/heads/heartbeat/*-flush-*"],
        include: ["refs/heads/heartbeat/*"],
      },
    },
    rules: [{ type: "deletion", parameters: null }],
    bypass_actors: [],
  };

  test("dropping server fields makes a live read equal to a desired file", () => {
    const a = normalizeRuleset(live);
    const b = normalizeRuleset({
      id: 16934633,
      name: "Heartbeat Branch Protection",
      target: "branch",
      enforcement: "active",
      conditions: {
        ref_name: {
          include: ["refs/heads/heartbeat/*"],
          exclude: ["refs/heads/heartbeat/*-flush-*"],
        },
      },
      rules: [{ type: "deletion" }],
      bypass_actors: [],
    });
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(classifyChange(a, b).verdict).toBe("no-op");
  });

  test("normalization is stable under reordering (so re-runs stay no-ops)", () => {
    const shuffled = normalizeRuleset({
      ...live,
      rules: [{ type: "non_fast_forward" }, { type: "deletion" }],
      bypass_actors: [
        { actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" },
        { actor_id: 1, actor_type: "OrganizationAdmin", bypass_mode: "pull_request" },
      ],
    });
    const other = normalizeRuleset({
      ...live,
      rules: [{ type: "deletion" }, { type: "non_fast_forward" }],
      bypass_actors: [
        { actor_id: 1, actor_type: "OrganizationAdmin", bypass_mode: "pull_request" },
        { actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" },
      ],
    });
    expect(canonicalJson(shuffled)).toBe(canonicalJson(other));
  });

  test("normalizing twice changes nothing (f(f(x)) === f(x))", () => {
    const once = normalizeRuleset(live);
    const twice = normalizeRuleset(once);
    expect(canonicalJson(twice)).toBe(canonicalJson(once));
  });
});

// ---------------------------------------------------------------------------
// The safety crux. Every one of these must classify as `widening`, because a
// reconciler holding `administration: write` that mis-classifies any of them
// silently removes a guard.
// ---------------------------------------------------------------------------

function base(over: Partial<CanonicalRuleset> = {}): CanonicalRuleset {
  return normalizeRuleset({
    id: 1,
    name: "R",
    target: "branch",
    enforcement: "active",
    conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
    rules: [{ type: "deletion" }, { type: "non_fast_forward" }],
    bypass_actors: [],
    ...over,
  } as Parameters<typeof normalizeRuleset>[0]);
}

describe("classifyChange — WIDENING is refused, and these prove it fires", () => {
  test("removing a rule widens", () => {
    const c = classifyChange(base(), base({ rules: [{ type: "deletion" }] }));
    expect(c.verdict).toBe("widening");
    expect(c.changes.some((x) => x.kind === "widening" && x.path === "rules")).toBe(true);
  });

  test("adding a bypass actor widens", () => {
    const c = classifyChange(
      base(),
      base({
        bypass_actors: [
          { actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" },
        ],
      }),
    );
    expect(c.verdict).toBe("widening");
    expect(c.changes.some((x) => x.path === "bypass_actors")).toBe(true);
  });

  test("loosening an existing actor's bypass_mode to `always` widens", () => {
    const withActor = base({
      bypass_actors: [
        { actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "pull_request" },
      ],
    });
    const loosened = base({
      bypass_actors: [{ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" }],
    });
    expect(classifyChange(withActor, loosened).verdict).toBe("widening");
    // …and the reverse tightens.
    expect(classifyChange(loosened, withActor).verdict).toBe("tightening");
  });

  test("narrowing ref coverage widens — both by dropping include and by adding exclude", () => {
    expect(
      classifyChange(
        base(),
        base({ conditions: { ref_name: { include: [], exclude: [] } } }),
      ).verdict,
    ).toBe("widening");
    expect(
      classifyChange(
        base(),
        base({
          conditions: {
            ref_name: { include: ["refs/heads/main"], exclude: ["refs/heads/main"] },
          },
        }),
      ).verdict,
    ).toBe("widening");
  });

  test("lowering enforcement widens; raising it tightens", () => {
    expect(classifyChange(base(), base({ enforcement: "disabled" })).verdict).toBe(
      "widening",
    );
    expect(classifyChange(base(), base({ enforcement: "evaluate" })).verdict).toBe(
      "widening",
    );
    expect(classifyChange(base({ enforcement: "evaluate" }), base()).verdict).toBe(
      "tightening",
    );
  });

  test("dropping a required status check widens", () => {
    const two = base({
      rules: [
        {
          type: "required_status_checks",
          parameters: {
            strict_required_status_checks_policy: true,
            required_status_checks: [
              { context: "gate (required)" },
              { context: "lint (TS)" },
            ],
          },
        },
      ],
    });
    const one = base({
      rules: [
        {
          type: "required_status_checks",
          parameters: {
            strict_required_status_checks_policy: true,
            required_status_checks: [{ context: "gate (required)" }],
          },
        },
      ],
    });
    expect(classifyChange(two, one).verdict).toBe("widening");
    expect(classifyChange(one, two).verdict).toBe("tightening");
  });

  test("lowering required approvals widens; disabling thread resolution widens", () => {
    const strict = base({
      rules: [
        {
          type: "pull_request",
          parameters: {
            required_approving_review_count: 2,
            required_review_thread_resolution: true,
            allowed_merge_methods: ["squash"],
          },
        },
      ],
    });
    const loose = base({
      rules: [
        {
          type: "pull_request",
          parameters: {
            required_approving_review_count: 1,
            required_review_thread_resolution: true,
            allowed_merge_methods: ["squash"],
          },
        },
      ],
    });
    expect(classifyChange(strict, loose).verdict).toBe("widening");

    const noThreads = base({
      rules: [
        {
          type: "pull_request",
          parameters: {
            required_approving_review_count: 2,
            required_review_thread_resolution: false,
            allowed_merge_methods: ["squash"],
          },
        },
      ],
    });
    expect(classifyChange(strict, noThreads).verdict).toBe("widening");
  });

  test("adding a merge method widens (more ways through the gate)", () => {
    const squashOnly = base({
      rules: [
        { type: "pull_request", parameters: { allowed_merge_methods: ["squash"] } },
      ],
    });
    const alsoMerge = base({
      rules: [
        {
          type: "pull_request",
          parameters: { allowed_merge_methods: ["squash", "merge"] },
        },
      ],
    });
    expect(classifyChange(squashOnly, alsoMerge).verdict).toBe("widening");
    expect(classifyChange(alsoMerge, squashOnly).verdict).toBe("tightening");
  });

  test("do_not_enforce_on_create true is the LOOSER value", () => {
    const enforced = base({
      rules: [
        {
          type: "required_status_checks",
          parameters: { do_not_enforce_on_create: false, required_status_checks: [] },
        },
      ],
    });
    const escaped = base({
      rules: [
        {
          type: "required_status_checks",
          parameters: { do_not_enforce_on_create: true, required_status_checks: [] },
        },
      ],
    });
    expect(classifyChange(enforced, escaped).verdict).toBe("widening");
  });

  test("FAIL-CLOSED: an unrecognised parameter change is treated as widening", () => {
    const a = base({
      rules: [{ type: "some_future_rule", parameters: { unknown_knob: 7 } }],
    });
    const b = base({
      rules: [{ type: "some_future_rule", parameters: { unknown_knob: 9 } }],
    });
    expect(classifyChange(a, b).verdict).toBe("widening");
  });

  test("a widening component POISONS an otherwise-tightening change set", () => {
    // The whole point: netting a bypass actor against an added rule is how a
    // hole rides in on a fix. The verdict must be the loosest member.
    const c = classifyChange(
      base(),
      base({
        rules: [
          { type: "deletion" },
          { type: "non_fast_forward" },
          { type: "required_linear_history" },
        ],
        bypass_actors: [
          { actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" },
        ],
      }),
    );
    expect(c.verdict).toBe("widening");
    expect(c.changes.some((x) => x.kind === "tightening")).toBe(true);
  });
});

describe("classifyChange — the safe directions stay usable", () => {
  test("identical inputs are a no-op", () => {
    expect(classifyChange(base(), base()).verdict).toBe("no-op");
  });

  test("adding a rule tightens", () => {
    expect(
      classifyChange(
        base(),
        base({
          rules: [
            { type: "deletion" },
            { type: "non_fast_forward" },
            { type: "required_linear_history" },
          ],
        }),
      ).verdict,
    ).toBe("tightening");
  });

  test("removing an exclude tightens (protection returns)", () => {
    const excluded = base({
      conditions: {
        ref_name: {
          include: ["refs/heads/heartbeat/*"],
          exclude: ["refs/heads/heartbeat/*-flush-*"],
        },
      },
    });
    const full = base({
      conditions: { ref_name: { include: ["refs/heads/heartbeat/*"], exclude: [] } },
    });
    expect(classifyChange(excluded, full).verdict).toBe("tightening");
  });

  test("a rename alone is neutral", () => {
    expect(classifyChange(base(), base({ name: "Renamed" })).verdict).toBe("neutral");
  });

  test("creation is diffed against the empty baseline, so a bypass actor still widens", () => {
    const fresh = base({
      bypass_actors: [
        { actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" },
      ],
    });
    expect(classifyChange(emptyBaseline("R", "branch"), fresh).verdict).toBe("widening");
    expect(classifyChange(emptyBaseline("R", "branch"), base()).verdict).toBe("tightening");
  });
});

describe("canonicalJson", () => {
  test("sorts keys at every depth, ordinally", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(
      '{\n  "a": {\n    "c": 3,\n    "d": 2\n  },\n  "b": 1\n}',
    );
  });

  test("is stable under key insertion order (the basis of the no-op check)", () => {
    expect(canonicalJson({ x: 1, y: [{ q: 1, p: 2 }] })).toBe(
      canonicalJson({ y: [{ p: 2, q: 1 }], x: 1 }),
    );
  });
});
