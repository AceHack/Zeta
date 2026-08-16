// agencysignature-block.test.ts — the falsifiers for the canonical rule, and
// the PARITY test that is the whole point of extracting it.
//
// The parity test is the one that matters. Everything else here checks that
// `validateBlock` says the right thing; parity checks that the PRE-merge gate
// and the POST-merge auditor say the SAME thing — which is the property that was
// broken (measured: 420 commits on `main` carry field combinations the pre-merge
// gate rejects and the auditor accepted) and the property a shared module is
// supposed to make unbreakable.
//
// A test asserting "they agree now" over a fixed pair of implementations would
// be an assertion with no way to fail. This one drives ONE table of cases
// through BOTH entry points and asserts the verdicts match, so re-introducing a
// local rule in either file turns it red.

import { describe, expect, test } from "bun:test";

import {
  CANONICAL_SHAPE,
  ENUMS,
  REQUIRED_KEYS,
  blockValue,
  findSignatureBlock,
  missingRequiredKeys,
  validateBlock,
} from "./agencysignature-block.ts";
import { classifyCommitRecord, loadIdentityRoster } from "./audit-agencysignature-main-tip.ts";
import { main as validatePrBody } from "./validate-agencysignature-pr-body.ts";

function block(over: Readonly<Record<string, string>> = {}): string {
  const base: Record<string, string> = {
    "Agency-Signature-Version": "1",
    Agent: "shadow",
    "Agent-Runtime": "Claude Code",
    "Agent-Model": "claude-opus-5",
    "Credential-Identity": "AceHack via gh",
    "Credential-Mode": "dedicated-agent",
    "Human-Review": "not-implied-by-credential",
    "Human-Review-Evidence": "none",
    "Action-Mode": "supervised",
    Task: "none",
  };
  const merged = { ...base, ...over };
  return REQUIRED_KEYS.filter((k) => merged[k] !== undefined)
    .map((k) => `${k}: ${merged[k] ?? ""}`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// THE PARITY TABLE — one set of cases, two entry points, identical verdicts.
// ---------------------------------------------------------------------------

interface ParityCase {
  readonly name: string;
  readonly block: string;
  /** Whether the canonical rule considers this block valid. */
  readonly valid: boolean;
}

const PARITY_CASES: readonly ParityCase[] = [
  { name: "canonical block", block: block(), valid: true },
  {
    name: "explicit review WITH evidence",
    block: block({ "Human-Review": "explicit", "Human-Review-Evidence": "pr-review" }),
    valid: true,
  },
  // THE MEASURED DIVERGENCE. This exact pair was rejected by the PR-body gate
  // and accepted by the auditor; another agent shipped it, got a red PR check
  // and a green main-tip audit on the merged commit.
  {
    name: "not-implied-by-credential + chat (the measured divergence)",
    block: block({
      "Human-Review": "not-implied-by-credential",
      "Human-Review-Evidence": "chat",
    }),
    valid: false,
  },
  {
    name: "explicit review WITHOUT evidence",
    block: block({ "Human-Review": "explicit", "Human-Review-Evidence": "none" }),
    valid: false,
  },
  // 29 commits on main carry `Action-Mode: autonomous`, 29 more `agent-chosen`,
  // 27 `Human-Review: pending` — none of which are in the enum set.
  {
    name: "Action-Mode: autonomous (29 live instances on main)",
    block: block({ "Action-Mode": "autonomous" }),
    valid: false,
  },
  {
    name: "Action-Mode: agent-chosen (29 live instances on main)",
    block: block({ "Action-Mode": "agent-chosen" }),
    valid: false,
  },
  {
    name: "Human-Review: pending (27 live instances on main)",
    block: block({ "Human-Review": "pending", "Human-Review-Evidence": "chat" }),
    valid: false,
  },
  {
    name: "Credential-Mode: human-delegated (3 live instances on main)",
    block: block({ "Credential-Mode": "human-delegated" }),
    valid: false,
  },
  {
    name: "unfilled template placeholder",
    block: block({ Agent: "<persona>" }),
    valid: false,
  },
  { name: "Task: TODO", block: block({ Task: "TODO" }), valid: false },
  {
    name: "Task: a ZetaId",
    block: block({ Task: "081M0085XQT087G0R003W4KFS4" }),
    valid: true,
  },
  { name: "Task: a slug", block: block({ Task: "fix-merge-duty-ordering" }), valid: true },
];

/** The PRE-merge verdict: exit 0 means the body was accepted. */
function preMergeAccepts(blockText: string): boolean {
  const chunks: string[] = [];
  const capture = (chunk: unknown): boolean => {
    chunks.push(String(chunk));
    return true;
  };
  const realOut = process.stdout.write;
  const realErr = process.stderr.write;
  process.stdout.write = capture as typeof process.stdout.write;
  process.stderr.write = capture as typeof process.stderr.write;
  try {
    return validatePrBody([], `## Summary\n\nWork.\n\n${blockText}\n`) === 0;
  } finally {
    process.stdout.write = realOut;
    process.stderr.write = realErr;
  }
}

/** The POST-merge verdict: `CORRECT` means the commit was accepted as clean. */
function postMergeAccepts(blockText: string): boolean {
  const message = `feat: x\n\n${blockText}\n`;
  const status = classifyCommitRecord(
    {
      // What `git log --pretty=%(trailers)` returns for a well-formed terminal
      // block: the block itself. Both instruments therefore see the same bytes,
      // which is what makes the comparison meaningful.
      trailers: `${blockText}\n`,
      message,
      timestamp: Date.parse("2026-08-20T00:00:00Z") / 1000,
      isoDate: "2026-08-20T00:00:00Z",
      authorEmail: "aaron_bond@yahoo.com",
      committerEmail: "noreply@github.com",
    },
    Date.parse("2026-05-28T20:22:11Z") / 1000,
    "2026-05-28T20:22:11Z",
    Date.parse("2026-08-15T00:00:00Z") / 1000,
    loadIdentityRoster(),
  ).status;
  return status === "CORRECT";
}

describe("PARITY: the pre-merge gate and the post-merge auditor cannot disagree", () => {
  test.each(PARITY_CASES.map((c) => [c.name, c] as const))(
    "%s — both entry points return the same verdict",
    (_name, testCase) => {
      const pre = preMergeAccepts(testCase.block);
      const post = postMergeAccepts(testCase.block);
      expect(pre).toBe(testCase.valid);
      expect(post).toBe(testCase.valid);
      // The load-bearing assertion: not "each is right" but "they are equal".
      // This is what goes red if either file grows a local rule again.
      expect(pre).toBe(post);
    },
  );

  test("MUTATION GUARD: the table contains cases of BOTH verdicts", () => {
    // A parity table of all-valid (or all-invalid) cases would pass against two
    // implementations that agree only by accident — the vacuity shape. Assert
    // the table itself discriminates.
    expect(PARITY_CASES.some((c) => c.valid)).toBe(true);
    expect(PARITY_CASES.some((c) => !c.valid)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RECOVERY — the falsifiers the brief asked for by name.
// ---------------------------------------------------------------------------

describe("findSignatureBlock (the lenient recovery scan)", () => {
  const good = block();

  test("recovers a block orphaned by a blank line before Co-authored-by", () => {
    // THE defect: 551 commits on main have exactly this shape.
    const message = `feat: x\n\nWhy:\n- because\n\n${good}\n\nCo-authored-by: shadow <s@z.agents>\n`;
    const found = findSignatureBlock(message);
    expect(found).not.toBeNull();
    expect(missingRequiredKeys((found ?? []).join("\n"))).toEqual([]);
    expect(blockValue((found ?? []).join("\n"), "Agent")).toBe("shadow");
  });

  test("recovers a block a squash-merge buried mid-message", () => {
    const message = `chore: squash\n\n* first\n\n${good}\n\n* second commit summary\n\nmore prose\n`;
    expect(findSignatureBlock(message)).not.toBeNull();
  });

  test("FALSIFIER: recovery stops recovering → this goes red", () => {
    // The brief's first required falsifier. If findSignatureBlock ever returns
    // null for a genuinely complete orphaned block, this fails.
    const message = `feat: x\n\n${good}\n\nCo-authored-by: shadow <s@z.agents>\n`;
    const found = findSignatureBlock(message);
    expect(found).not.toBeNull();
    expect(found?.length).toBe(REQUIRED_KEYS.length);
  });

  test("FALSIFIER: does NOT assemble a block from scattered keys", () => {
    // The way a fallback becomes a gate that cannot fail. Ten keys, ten
    // paragraphs, no contiguous block — recovery must refuse.
    const scattered = REQUIRED_KEYS.map((k) => `${k}: x`).join("\n\n");
    expect(findSignatureBlock(`feat: x\n\n${scattered}\n`)).toBeNull();
  });

  test("does not recover an INCOMPLETE block", () => {
    const partial = "Agency-Signature-Version: 1\nAgent: shadow";
    expect(findSignatureBlock(`feat: x\n\n${partial}\n\nCo-authored-by: a <a@b.c>\n`)).toBeNull();
  });
});

describe("FALSIFIER: a recovered block never reports as a clean PASS", () => {
  test("pre-merge: the orphaned-block body is not accepted silently", () => {
    const orphaned = `## Summary\n\nWork.\n\n${block()}\n\nCo-authored-by: shadow <s@z.agents>\n`;
    const chunks: string[] = [];
    const capture = (chunk: unknown): boolean => {
      chunks.push(String(chunk));
      return true;
    };
    const realOut = process.stdout.write;
    const realErr = process.stderr.write;
    process.stdout.write = capture as typeof process.stdout.write;
    process.stderr.write = capture as typeof process.stderr.write;
    let status: number;
    try {
      status = validatePrBody([], orphaned);
    } finally {
      process.stdout.write = realOut;
      process.stderr.write = realErr;
    }
    const out = chunks.join("");
    // The brief's second required falsifier: RECOVERED must never read as PASS.
    expect(out).not.toContain("PASS:");
    expect(out).toContain("RECOVERED-MALFORMED");
    expect(status).toBe(1);
  });

  test("post-merge: the same shape classifies RECOVERED-MALFORMED, not CORRECT", () => {
    const message = `feat: x\n\n${block()}\n\nCo-authored-by: shadow <s@z.agents>\n`;
    const result = classifyCommitRecord(
      {
        // Empty, because that is precisely what git returns for this shape.
        trailers: "",
        message,
        timestamp: Date.parse("2026-08-20T00:00:00Z") / 1000,
        isoDate: "2026-08-20T00:00:00Z",
        authorEmail: "aaron_bond@yahoo.com",
        committerEmail: "noreply@github.com",
      },
      Date.parse("2026-05-28T20:22:11Z") / 1000,
      "2026-05-28T20:22:11Z",
      Date.parse("2026-08-15T00:00:00Z") / 1000,
      loadIdentityRoster(),
    );
    expect(result.status).toBe("RECOVERED-MALFORMED");
    expect(result.status).not.toBe("CORRECT");
    expect(result.reason).toContain("RECOVERED");
  });

  test("post-merge: a version key with NO complete block is RECOVERED-PARTIAL", () => {
    // 976 commits on main. Previously reported CORRECT with the reason
    // "AgencySignature block present in commit message" — a false statement.
    const result = classifyCommitRecord(
      {
        trailers: "",
        message: "feat: x\n\nAgency-Signature-Version: 1\nAgent: shadow\n",
        timestamp: Date.parse("2026-08-20T00:00:00Z") / 1000,
        isoDate: "2026-08-20T00:00:00Z",
        authorEmail: "aaron_bond@yahoo.com",
        committerEmail: "noreply@github.com",
      },
      Date.parse("2026-05-28T20:22:11Z") / 1000,
      "2026-05-28T20:22:11Z",
      Date.parse("2026-08-15T00:00:00Z") / 1000,
      loadIdentityRoster(),
    );
    expect(result.status).toBe("RECOVERED-PARTIAL");
  });
});

describe("validateBlock", () => {
  test("a canonical block has no violations", () => {
    expect(validateBlock(block())).toEqual([]);
  });

  test("missing keys short-circuit, so one defect yields one finding", () => {
    const v = validateBlock("Agency-Signature-Version: 1\nAgent: shadow");
    expect(v.length).toBe(1);
    expect(v[0]?.code).toBe("missing-keys");
  });

  test("every enum key rejects a value outside its set", () => {
    for (const { key } of ENUMS) {
      if (key === "Agency-Signature-Version") continue; // version drives v2 branch
      const v = validateBlock(block({ [key]: "definitely-not-allowed" }));
      expect(v[0]?.code).toBe("invalid-enum");
      expect(v[0]?.key).toBe(key);
    }
  });

  test("CANONICAL_SHAPE names the Co-authored-by placement the spec omits", () => {
    // Spec Section 7.4's block ends at `Task:` and never says where
    // Co-authored-by goes; that omission is the upstream cause of 551 commits.
    expect(CANONICAL_SHAPE).toContain("Co-authored-by");
    expect(CANONICAL_SHAPE).toContain("blank line");
  });
});
