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
  ACTION_MODE_BY_HUMAN_AUTHORITY,
  CANONICAL_SHAPE,
  ENUMS,
  ACCOUNTABLE_PARTIES,
  ACCOUNTABILITY_KEYS,
  AUTHORITY_BASES,
  GOVERNANCE_KEYS,
  HUMAN_REVIEW_BY_HUMAN_AUTHORITY,
  accountabilityAnchor,
  reconcileHumanReview,
  reconcileReviewEvidence,
  validateAccountabilityPair,
  REQUIRED_KEYS,
  blockValue,
  detectBlockDisagreement,
  detectReconciliations,
  reconcileActionMode,
  findAllSignatureBlocks,
  findSignatureBlock,
  missingRequiredKeys,
  normalizeLineEndings,
  validateBlock,
  validateText,
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
  // Required keys first, in canonical order; any EXTRA key an override supplies
  // (`Accountable-Party`, `Authority-Basis`, `Cell`, a stray) follows in the same
  // paragraph, because contiguity is what makes it one block.
  const extra = Object.keys(over).filter((k) => !REQUIRED_KEYS.includes(k));
  return [...REQUIRED_KEYS.filter((k) => merged[k] !== undefined), ...extra]
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

describe("transport line endings are not AgencySignature values", () => {
  test("browser-style CRLF metadata remains a valid canonical block", () => {
    const crlf = block().replace(/\n/g, "\r\n");
    expect(normalizeLineEndings(crlf)).toBe(block());
    expect(validateText(`## Summary\r\n\r\nWork.\r\n\r\n${crlf}\r\n`).violations).toEqual([]);
    expect(preMergeAccepts(`## Summary\r\n\r\nWork.\r\n\r\n${crlf}\r\n`)).toBe(true);
    expect(postMergeAccepts(crlf)).toBe(true);
  });

  test("FALSIFIER: CRLF normalization does not admit an invalid enum", () => {
    const crlfInvalid = block({ "Action-Mode": "autonomous" }).replace(/\n/g, "\r\n");
    const violation = validateText(crlfInvalid).violations[0];
    expect(violation?.code).toBe("invalid-enum");
    expect(violation?.key).toBe("Action-Mode");
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

describe("LAYOUT TOLERANCE: trailing text is legal (Aaron 2026-08-16)", () => {
  test("FALSIFIER: a block followed by an IDE tagline PASSES", () => {
    // The forcing case. Riven's PRs carry `Made with [Cursor](https://cursor.com)`
    // appended below the body; Aaron's own #10949 hit it. The author cannot stop
    // the append, so failing for it is a gate firing on correct work.
    // BEFORE this change this body FAILED; that is the direction of the mutation.
    const body = `## Summary\n\nWork.\n\n${block()}\n\nMade with [Cursor](https://cursor.com)\n`;
    expect(preMergeAccepts(body)).toBe(true);
  });

  test("FALSIFIER: a block followed by a forge-re-emitted Co-authored-by PASSES", () => {
    const body = `feat: x\n\n${block()}\n\nCo-authored-by: shadow <s@z.agents>\n`;
    expect(preMergeAccepts(body)).toBe(true);
  });

  test("post-merge: the same shape is CORRECT, not a defect", () => {
    const message = `feat: x\n\n${block()}\n\nCo-authored-by: shadow <s@z.agents>\n`;
    const result = classifyCommitRecord(
      {
        trailers: "", // exactly what git returns for this shape
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
    expect(result.status).toBe("CORRECT");
  });

  test("LAYOUT tolerance is not FIELD tolerance — a short block still fails", () => {
    // The guard on the guard: relaxing placement must not relax the ten fields.
    const body = "## Summary\n\nAgency-Signature-Version: 1\nAgent: shadow\n\ntagline\n";
    expect(preMergeAccepts(body)).toBe(false);
  });

  test("post-merge: a version key with NO complete block is still RECOVERED-PARTIAL", () => {
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

describe("LAST-WINS: the last complete block is authoritative", () => {
  const quoted = block({ Agent: "example-persona", Task: "quoted-template" });
  const real = block({ Agent: "shadow", Task: "the-real-work" });

  test("FALSIFIER: a quoted example BEFORE the real block does not win", () => {
    // This is why last-wins and trailing-text-legality are ONE decision: once
    // text may follow the block, taking the first would let a doc PR that quotes
    // the template outrank the signature of the PR itself.
    const text = `docs: show the template\n\n${quoted}\n\nand here is ours:\n\n${real}\n\nMade with Cursor\n`;
    const found = findSignatureBlock(text);
    expect(blockValue((found ?? []).join("\n"), "Agent")).toBe("shadow");
    expect(blockValue((found ?? []).join("\n"), "Task")).toBe("the-real-work");
  });

  test("findAllSignatureBlocks returns every block in document order", () => {
    const all = findAllSignatureBlocks(`x\n\n${quoted}\n\ny\n\n${real}\n`);
    expect(all.length).toBe(2);
    expect(blockValue((all[0] ?? []).join("\n"), "Agent")).toBe("example-persona");
    expect(blockValue((all[1] ?? []).join("\n"), "Agent")).toBe("shadow");
  });

  test("a single block is still that block", () => {
    expect(blockValue((findSignatureBlock(`x\n\n${real}\n`) ?? []).join("\n"), "Agent")).toBe(
      "shadow",
    );
  });
});

describe("BLOCK-DISAGREEMENT: contradictory governance claims are loud", () => {
  test("FALSIFIER: two blocks disagreeing on Human-Review is an ERROR, not a pick", () => {
    // Live shape on main: c417b28c6357 has `Human-Review: none` and `explicit`.
    // Last-wins would RECORD A REVIEW THE OTHER BLOCK DENIES.
    const a = block({ "Human-Review": "none", "Human-Review-Evidence": "none" });
    const z = block({ "Human-Review": "explicit", "Human-Review-Evidence": "pr-review" });
    const text = `chore: squash\n\n${a}\n\n* second\n\n${z}\n`;
    const d = detectBlockDisagreement(text);
    expect(d).not.toBeNull();
    expect(d?.keys).toContain("Human-Review");
    const v = validateText(text).violations;
    expect(v[0]?.code).toBe("block-disagreement");
    expect(preMergeAccepts(text)).toBe(false);
  });

  // CHANGED 2026-08-23. This case used to pair `supervised` with
  // `autonomous-fail-open`, which now RECONCILES (both directions collapse to a
  // claim of absence, so nothing is manufactured). The pair kept here is the one
  // that must stay loud forever: two claims of human PRESENCE, neither implied by
  // the other. See §ACTION-MODE RECONCILIATION below for the full boundary.
  test("FALSIFIER: an Action-Mode disagreement between two human-presence claims is an error", () => {
    const a = block({ "Action-Mode": "supervised" });
    const z = block({ "Action-Mode": "human-directed" });
    expect(detectBlockDisagreement(`x\n\n${a}\n\ny\n\n${z}\n`)).not.toBeNull();
  });

  test("INCIDENTAL disagreement is ACCEPTED silently — Task, Agent, runtime", () => {
    // 17 of the 47 disagreements on main are incidental-only (28 involve Task).
    // Erroring on those would be false alarms on every multi-author squash.
    const a = block({ Agent: "vera", Task: "081M0085XQT087G0R003W4KFS4", "Agent-Runtime": "Codex" });
    const z = block({ Agent: "shadow", Task: "other-work", "Agent-Runtime": "Claude Code" });
    const text = `chore: squash\n\n${a}\n\n* second\n\n${z}\n`;
    expect(detectBlockDisagreement(text)).toBeNull();
    expect(preMergeAccepts(text)).toBe(true);
  });

  test("identical repeated blocks do not disagree", () => {
    const b = block();
    expect(detectBlockDisagreement(`x\n\n${b}\n\ny\n\n${b}\n`)).toBeNull();
  });

  test("disagreement is detected across ALL blocks, not just first vs last", () => {
    // Three blocks where the ends AGREE and the middle contradicts both.
    const ends = block({ "Action-Mode": "supervised" });
    const mid = block({ "Action-Mode": "human-directed" });
    const text = `x\n\n${ends}\n\na\n\n${mid}\n\nb\n\n${ends}\n`;
    expect(detectBlockDisagreement(text)).not.toBeNull();
  });

  test("disagreement is checked BEFORE value validation", () => {
    // A contradiction must not be masked by the last block being well-formed.
    const a = block({ "Human-Review": "none", "Human-Review-Evidence": "none" });
    const z = block({ "Human-Review": "explicit", "Human-Review-Evidence": "pr-review" });
    const v = validateText(`x\n\n${a}\n\ny\n\n${z}\n`).violations;
    expect(v.length).toBe(1);
    expect(v[0]?.code).toBe("block-disagreement");
  });
});

// ---------------------------------------------------------------------------
// MAINTENANCE COMMITS — pinning the honest path that was only ACCIDENTAL.
// ---------------------------------------------------------------------------
// 2026-08-18. Several stale PRs looked blocked on a premise that turned out to
// be false, and was MEASURED false: that a non-authoring agent cannot merge
// `main` into someone else's branch without asserting trailer values it cannot
// witness (`Credential-Mode: dedicated-agent`, `Human-Review: explicit`). It
// can. `findAllSignatureBlocks` keeps paragraphs carrying all ten keys and
// `detectBlockDisagreement` returns null below two blocks, so a blockless
// maintenance commit contributes ZERO blocks and ZERO disagreement — git's
// default `Merge branch 'main' into X` message asserts nothing and passes.
//
// SILENCE IS NOT A FALSE CLAIM. That is the property, and until this block
// existed NOTHING asserted it. A future tightening — someone "fixing" the scan
// to require every commit to be signed — would have silently deleted the only
// honest maintenance path and re-created the blockage for real, leaving a
// maintainer to choose between lying in a trailer and leaving PRs stuck. These
// tests are what makes such a tightening fail loudly instead of quietly.
//
// The rule an agent reads before it ever gets here:
// `.claude/rules/maintenance-commit-on-another-agents-branch-carries-no-block.md`.

describe("MAINTENANCE COMMITS: silence asserts nothing, and that is the honest record", () => {
  /** What git writes with no author input at all. Ten keys short, on purpose. */
  const BLOCKLESS_MERGE = "Merge branch 'main' into vera/some-work";
  const branchWork = `feat: the branch's own work\n\n${block({
    Agent: "vera",
    Task: "081M0085XQT087G0R003W4KFS4",
  })}`;

  /**
   * The squash preimage as CI reconstructs it:
   * `gh api .../pulls/N/commits --jq '.[].commit.message'` emits one message per
   * jq record, so the text is a plain newline join, oldest commit first.
   */
  const preimage = (...messages: readonly string[]): string => messages.join("\n");

  test("LOAD-BEARING: a blockless maintenance commit contributes no block and no disagreement", () => {
    // If this goes red, the honest maintenance path has been removed and the
    // only remaining way to merge `main` into another agent's branch is to
    // assert something the maintaining agent cannot witness.
    expect(findAllSignatureBlocks(BLOCKLESS_MERGE)).toEqual([]);
    expect(detectBlockDisagreement(BLOCKLESS_MERGE)).toBeNull();
    expect(validateText(BLOCKLESS_MERGE).blockCount).toBe(0);
  });

  test("LOAD-BEARING: branch block + blockless merge = ONE block, and it PASSES", () => {
    const text = preimage(branchWork, BLOCKLESS_MERGE);
    expect(findAllSignatureBlocks(text).length).toBe(1);
    expect(detectBlockDisagreement(text)).toBeNull();
    expect(validateText(text).violations).toEqual([]);
    expect(preMergeAccepts(text)).toBe(true);

    // Same verdict when GitHub composes the squash itself, `---------`-separated,
    // and again when the merge commit is the OLDER of the two.
    expect(preMergeAccepts([branchWork, BLOCKLESS_MERGE].join("\n\n---------\n\n"))).toBe(true);
    expect(preMergeAccepts(preimage(BLOCKLESS_MERGE, branchWork))).toBe(true);
  });

  test("silence is legal ALONGSIDE authorship, never INSTEAD of it", () => {
    // The guard on the guard. A blockless commit is quiet, not exempt: a
    // proposal whose commits are ALL blockless carries no signature anywhere and
    // is still refused. Without this, "silence is honest" would read as a licence
    // to sign nothing at all.
    expect(preMergeAccepts(BLOCKLESS_MERGE)).toBe(false);
  });

  test("a maintainer who DID decide content signs as itself — agreeing blocks pass", () => {
    // Resolving a conflict or fixing a lint is authored work, so it carries a
    // block with the maintaining agent's OWN honest values. Differing only on
    // incidental fields (Agent, Task) is two true statements, not a conflict.
    const maintainerWork = `fix: resolve the conflict in ThisFile.fs\n\n${block({
      Agent: "shadow",
      Task: "resolve-conflict-on-vera-branch",
    })}`;
    const text = preimage(branchWork, maintainerWork);
    expect(findAllSignatureBlocks(text).length).toBe(2);
    expect(detectBlockDisagreement(text)).toBeNull();
    expect(preMergeAccepts(text)).toBe(true);
  });

  test("FALSIFIER: an HONEST maintenance block that disagrees on a governance key is LOUD", () => {
    // And that is the mechanism WORKING. A maintaining agent that cannot read its
    // credential records `Credential-Mode: unknown` — the honest floor, exactly
    // as `heartbeatMergePrBody` degrades rather than asserting a convenient
    // value. Against a branch claiming `dedicated-agent` that is a real
    // contradiction about one change, so it must be loud. The remedy is to hand
    // the PR back to its owner, never to overwrite the honest value.
    const maintainerWork = `fix: resolve the conflict\n\n${block({
      Agent: "shadow",
      "Credential-Mode": "unknown",
    })}`;
    const text = preimage(branchWork, maintainerWork);
    const d = detectBlockDisagreement(text);
    expect(d?.keys).toContain("Credential-Mode");
    expect(validateText(text).violations[0]?.code).toBe("block-disagreement");
    expect(preMergeAccepts(text)).toBe(false);
  });

  test("ADMISSION, not a guard: two identical blocks PASS — a copy is byte-identical", () => {
    // Stated out loud so nobody reads this pass as a licence. The parser CANNOT
    // distinguish a copied attestation from an earned one: an agent that pastes
    // the branch's block onto its own maintenance commit produces bytes
    // indistinguishable from the branch author having written it, so no test here
    // can ever catch it. Only the rule stops that —
    // `.claude/rules/maintenance-commit-on-another-agents-branch-carries-no-block.md`
    // — which is exactly why the rule has to live where an agent reads it at cold
    // start, rather than in a check that reads the bytes.
    const copied = preimage(branchWork, `chore: merge main\n\n${block({ Agent: "vera" })}`);
    expect(detectBlockDisagreement(copied)).toBeNull();
    expect(preMergeAccepts(copied)).toBe(true);
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

  // Added 2026-08-17, maintainer-authorized. Two producers independently coined
  // `autonomous-fail-closed` and a third `operator-delegated` before either was
  // legal here, and mapping them onto the nearest allowed value would have
  // recorded something false — `operator-delegated`→`shared` loses the
  // delegation, `autonomous-fail-closed`→`autonomous-fail-open` claims a reach
  // on error the actor does not take.
  describe("the 2026-08-17 vocabulary extension", () => {
    test("operator-delegated is a legal Credential-Mode", () => {
      expect(validateBlock(block({ "Credential-Mode": "operator-delegated" }))).toEqual([]);
    });

    test("autonomous-fail-closed is a legal Action-Mode", () => {
      expect(validateBlock(block({ "Action-Mode": "autonomous-fail-closed" }))).toEqual([]);
    });

    // ADDITIONS, never renames: nothing previously valid may become invalid,
    // or this change would retroactively condemn commits already on main.
    test("every pre-extension value is still accepted", () => {
      for (const mode of ["shared", "dedicated-agent", "human-only", "unknown"]) {
        expect(validateBlock(block({ "Credential-Mode": mode }))).toEqual([]);
      }
      for (const mode of ["autonomous-fail-open", "human-directed", "supervised"]) {
        expect(validateBlock(block({ "Action-Mode": mode }))).toEqual([]);
      }
    });

    // Widening a vocabulary must not widen it to everything.
    test("the sets are still closed — a near-miss is still refused", () => {
      expect(validateBlock(block({ "Action-Mode": "autonomous-fail-cloed" }))[0]?.code).toBe(
        "invalid-enum",
      );
      expect(validateBlock(block({ "Credential-Mode": "operator-delegate" }))[0]?.code).toBe(
        "invalid-enum",
      );
      expect(validateBlock(block({ "Action-Mode": "fail-closed" }))[0]?.code).toBe("invalid-enum");
    });
  });

  test("CANONICAL_SHAPE names the Co-authored-by placement the spec omits", () => {
    // Spec Section 7.4's block ends at `Task:` and never says where
    // Co-authored-by goes; that omission is the upstream cause of 551 commits.
    expect(CANONICAL_SHAPE).toContain("Co-authored-by");
    expect(CANONICAL_SHAPE).toContain("blank line");
  });
});


// ---------------------------------------------------------------------------
// ACTION-MODE RECONCILIATION — the falsifiers for the 2026-08-23 carve-out.
// ---------------------------------------------------------------------------
// Aaron: *"accept the mixed Action-Mode (shadow*)"*. The carve-out is only as
// good as its scope, so the scope is machine-checked here rather than asserted in
// a comment. Four properties, in the order the module's doc-comment names them:
//
//   1. resolves only to a value a constituent actually wrote,
//   2. resolves only DOWNWARD (never above the minimum present),
//   3. refuses to resolve to a claim of human presence,
//   4. refuses to order a value outside the enum,
//
// plus the one that keeps it narrow: NO OTHER GOVERNANCE KEY changed.

describe("ACTION-MODE RECONCILIATION: weakest claim, never the strongest", () => {
  const AM = "Action-Mode";

  /** Every subset of the enum with two or more members — 11 of them. */
  function subsets(): readonly (readonly string[])[] {
    const out: string[][] = [];
    const n = ACTION_MODE_BY_HUMAN_AUTHORITY.length;
    for (let mask = 0; mask < 1 << n; mask++) {
      const pick = ACTION_MODE_BY_HUMAN_AUTHORITY.filter((_, i) => (mask & (1 << i)) !== 0);
      if (pick.length >= 2) out.push([...pick]);
    }
    return out;
  }

  test("THE FALSIFIER: human-directed + autonomous-fail-open NEVER resolves to human-directed", () => {
    // The live shape of PR #14251: six commits a human asked for, one later
    // autonomous maintenance fix. If this ever comes out `human-directed`, the
    // check has manufactured a human direction nobody gave.
    const mixed = ["human-directed", "autonomous-fail-open"];
    expect(reconcileActionMode(mixed)).toBe("autonomous-fail-open");
    expect(reconcileActionMode([...mixed].reverse())).toBe("autonomous-fail-open");
    expect(reconcileActionMode(mixed)).not.toBe("human-directed");

    // ...and end to end, through the actual gate, in BOTH commit orders. Order
    // must not matter: last-wins is exactly what this replaces.
    const human = block({ [AM]: "human-directed" });
    const auto = block({ [AM]: "autonomous-fail-open" });
    for (const text of [
      `deps: roll\n\n${human}\n\n* fix\n\n${auto}\n`,
      `deps: roll\n\n${auto}\n\n* fix\n\n${human}\n`,
    ]) {
      expect(detectBlockDisagreement(text)).toBeNull();
      expect(validateText(text).violations).toEqual([]);
      expect(preMergeAccepts(text)).toBe(true);
      expect(detectReconciliations(text)[0]?.resolved).toBe("autonomous-fail-open");
    }
  });

  test("EXHAUSTIVE: every resolution is a member of its input and never above the minimum", () => {
    for (const values of subsets()) {
      const resolved = reconcileActionMode(values);
      if (resolved === null) continue;
      // (1) nothing is invented
      expect(values).toContain(resolved);
      // (2) nothing is strengthened
      const ranks = values.map((v) => ACTION_MODE_BY_HUMAN_AUTHORITY.indexOf(v));
      expect(ACTION_MODE_BY_HUMAN_AUTHORITY.indexOf(resolved)).toBe(Math.min(...ranks));
      // (3) never a claim of human presence
      expect(resolved.startsWith("autonomous-")).toBe(true);
    }
  });

  test("REFUSED: two claims of human PRESENCE stay loud — neither implies the other", () => {
    expect(reconcileActionMode(["supervised", "human-directed"])).toBeNull();
    const text = `x\n\n${block({ [AM]: "supervised" })}\n\ny\n\n${block({ [AM]: "human-directed" })}\n`;
    expect(detectBlockDisagreement(text)?.keys).toContain(AM);
    expect(preMergeAccepts(text)).toBe(false);
  });

  test("REFUSED: a value outside the enum has no rank, so it is not ordered", () => {
    // 58 commits on main carry the retired `autonomous` / `agent-chosen`
    // spellings. Unknown vocabulary fails CLOSED rather than being guessed in.
    expect(reconcileActionMode(["autonomous", "human-directed"])).toBeNull();
    expect(reconcileActionMode(["agent-chosen", "autonomous-fail-open"])).toBeNull();
    expect(reconcileActionMode(["human-directed", ""])).toBeNull();
  });

  test("fail-open beats fail-closed — a squash never reads SAFER than a commit in it", () => {
    expect(reconcileActionMode(["autonomous-fail-closed", "autonomous-fail-open"])).toBe(
      "autonomous-fail-open",
    );
  });

  test("SCOPE: no OTHER governance key became reconcilable", () => {
    // The narrowing falsifier. If a later edit generalises the carve-out into a
    // table, this goes red for whichever key was added.
    const others = GOVERNANCE_KEYS.filter((k) => k !== AM);
    expect(others.length).toBe(6);
    const alt: Readonly<Record<string, readonly [string, string]>> = {
      "Agency-Signature-Version": ["1", "2"],
      "Credential-Mode": ["shared", "dedicated-agent"],
      // Still loud here, and that is the point: these blocks carry NO
      // accountability anchor, so the 2026-08-24 carve-out does not apply to them
      // and `Human-Review` behaves exactly as it did before it existed.
      "Human-Review": ["explicit", "none"],
      "Human-Review-Evidence": ["chat", "none"],
      // The two accountability keys: governance-critical and NEVER reconcilable.
      "Accountable-Party": ["acehack", "lucent-financial-group"],
      "Authority-Basis": ["standing-grant", "per-act"],
    };
    for (const key of others) {
      const pair = alt[key];
      expect(pair).toBeDefined();
      const a = block({ [key]: pair?.[0] ?? "" });
      const z = block({ [key]: pair?.[1] ?? "" });
      const text = `x\n\n${a}\n\ny\n\n${z}\n`;
      expect(detectBlockDisagreement(text)?.keys).toContain(key);
      expect(validateText(text).violations[0]?.code).toBe("block-disagreement");
    }
  });

  test("DISCRIMINATION: the #14430 shape stays BLOCKED on Human-Review", () => {
    // Same mixed Action-Mode as #14251, but its constituents also disagree about
    // whether a human reviewed the change. That half must NOT be unblocked here:
    // `Human-Review` is a claim about THE CHANGE, and one change cannot have been
    // both reviewed and not reviewed.
    const reviewed = block({
      "Human-Review": "explicit",
      "Human-Review-Evidence": "chat",
      [AM]: "human-directed",
    });
    const not = block({
      "Human-Review": "not-implied-by-credential",
      "Human-Review-Evidence": "none",
      [AM]: "autonomous-fail-closed",
    });
    const text = `feat: agendas\n\n${reviewed}\n\n* later\n\n${not}\n`;
    const d = detectBlockDisagreement(text);
    expect(d).not.toBeNull();
    expect(d?.keys).toContain("Human-Review");
    expect(d?.keys).toContain("Human-Review-Evidence");
    // ...and Action-Mode is no longer among the reasons, which is the whole
    // point: the diagnosis now names only the fields that are really in conflict.
    expect(d?.keys).not.toContain(AM);
    expect(preMergeAccepts(text)).toBe(false);
  });

  test("the verdict CARRIES the resolution, so a report cannot print the stronger value", () => {
    // The last block is the human-directed one. A caller reading
    // `verdict.block`'s Action-Mode would print `human-directed` for a squash
    // resolved as autonomous.
    const text = `x\n\n${block({ [AM]: "autonomous-fail-open" })}\n\ny\n\n${block({ [AM]: "human-directed" })}\n`;
    const verdict = validateText(text);
    expect(blockValue((verdict.block ?? []).join("\n"), AM)).toBe("human-directed");
    expect(verdict.reconciliations[0]).toEqual({
      key: AM,
      resolved: "autonomous-fail-open",
      from: ["autonomous-fail-open", "human-directed"],
    });
  });

  test("the AUDITOR must not report a reconciled squash as an AGREEING one — BOTH paths", () => {
    // The report defect this reconciliation introduced, and its falsifier. The
    // multi-block CORRECT line said "they agree on every governance field",
    // which stops being true the moment a field is RESOLVED instead of matched —
    // a report claiming more than was checked, on the one field where
    // overclaiming is the hazard.
    //
    // Both classification paths are driven, because which one a commit takes is
    // decided by the FORGE (whether its blank line left the block git-parseable)
    // and has nothing to do with whether a value was discarded. The landed
    // squash of #14251 takes the canonical-scan path; a locally-authored one
    // takes the strict path.
    const first = block({ [AM]: "human-directed" });
    const last = block({ [AM]: "autonomous-fail-open" });
    const mixed = `deps: roll\n\n${first}\n\n* fix\n\n${last}\n`;
    const paths: readonly (readonly [string, string])[] = [
      ["git-parseable (strict)", `${last}\n`],
      ["canonical scan (layout-tolerant)", ""],
    ];
    for (const [name, trailers] of paths) {
      const record = classifyCommitRecord(
        {
          trailers,
          message: mixed,
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
      expect(`${name}: ${record.status}`).toBe(`${name}: CORRECT`);
      expect(record.reason).not.toContain("agree on every governance field");
      expect(record.reason).toContain("RECONCILED to the weakest claim");
      expect(record.reason).toContain("'autonomous-fail-open'");
    }
  });

  test("an UNreconciled multi-block CORRECT still says they agree — the note is not always-on", () => {
    // The other half of the falsifier: a note that appeared on every multi-block
    // commit would carry no information. This one is emitted only when something
    // was really discarded.
    const b = block({ [AM]: "human-directed" });
    const record = classifyCommitRecord(
      {
        trailers: "",
        message: `deps: roll\n\n${b}\n\n* more\n\n${b}\n`,
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
    expect(record.status).toBe("CORRECT");
    expect(record.reason).toContain("agree on every governance field");
    expect(record.reason).not.toContain("RECONCILED");
  });

  test("an unmixed Action-Mode reports no reconciliation at all", () => {
    const b = block({ [AM]: "human-directed" });
    expect(detectReconciliations(`x\n\n${b}\n\ny\n\n${b}\n`)).toEqual([]);
    expect(validateText(`x\n\n${b}\n`).reconciliations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// THE ACCOUNTABILITY SPLIT — falsifiers for the 2026-08-24 additive keys.
// ---------------------------------------------------------------------------
// `Human-Review` was doing two jobs: (a) a named party is accountable — constant
// across a branch, because it follows from a standing grant — and (b) a human read
// this diff, which legitimately varies per commit. The gate reported (b)'s honest
// variation as a contradiction about (a).
//
// Four properties are checked here, and the LAST is the falsifier for the whole
// design. Without it this is a permissive schema wearing a governance vocabulary.
//
//   1. v1 IS UNTOUCHED. Every block that lacks the keys behaves exactly as before.
//   2. The keys VALIDATE — rostered values, all-or-nothing, v1 and v2 alike.
//   3. The #14430 shape resolves ONCE ANCHORED, in the understating direction.
//   4. TWO ACCOUNTABLE PARTIES FAILS LOUDLY, and no anchor can buy its way out.

describe("ACCOUNTABILITY SPLIT: who carries blame is not whether a human looked", () => {
  const AP = "Accountable-Party";
  const AB = "Authority-Basis";
  const HR = "Human-Review";
  const HRE = "Human-Review-Evidence";

  /** A block carrying the standing-grant anchor Aaron's grant actually describes. */
  function anchored(over: Readonly<Record<string, string>> = {}): string {
    return block({ [AP]: "acehack", [AB]: "standing-grant", ...over });
  }
  const join = (...blocks: readonly string[]): string =>
    blocks.map((b, i) => `prose ${String(i)}\n\n${b}`).join("\n\n") + "\n";

  // -- 1. v1 IS UNTOUCHED ---------------------------------------------------

  test("THE REGRESSION FLOOR: a block with neither key validates exactly as before", () => {
    // 17,087 v1 blocks on `main` carry neither key. If this goes red the change
    // was not additive and the corpus was invalidated in one commit.
    expect(validateBlock(block())).toEqual([]);
    expect(validateBlock(block({ "Agency-Signature-Version": "1" }))).toEqual([]);
    expect(accountabilityAnchor([block().split("\n")])).toBeNull();
  });

  test("SILENCE IS NOT A DEFAULT: an absent party is never inferred", () => {
    // The v1 corpus is permanently silent on accountability —
    // `not-implied-by-credential` does not determine an accountable party, because
    // the information was never captured. Reading a default out of it would be the
    // manufacture-an-authorisation failure this module exists to prevent.
    const v1 = block({ [HR]: "not-implied-by-credential", [HRE]: "none" });
    expect(blockValue(v1, AP)).toBe("");
    expect(accountabilityAnchor([v1.split("\n")])).toBeNull();
    // ...and silence buys NOTHING: an unanchored #14430 shape is as loud as ever.
    const text = join(
      block({ [HR]: "explicit", [HRE]: "chat", "Action-Mode": "human-directed" }),
      block({ [HR]: "not-implied-by-credential", [HRE]: "none" }),
    );
    expect(detectBlockDisagreement(text)?.keys).toContain(HR);
    expect(validateText(text).violations[0]?.code).toBe("block-disagreement");
  });

  test("SILENCE IS NOT A COMPETING CLAIM: named + unnamed is quiet, and the name survives", () => {
    // Absence of a blame claim is not a rival blame claim. The direction of the
    // error is what licenses this: accepting liability for work whose other
    // constituent named nobody is the OPPOSITE of a privilege escalation.
    const text = join(anchored(), block());
    expect(detectBlockDisagreement(text)).toBeNull();
  });

  // -- 2. THE KEYS VALIDATE -------------------------------------------------

  test("the roster refuses a party that names nobody", () => {
    // `Accountable-Party: nobody` would pass a shape check while naming no one who
    // could have withheld the act — a field that cannot fail.
    for (const bad of ["nobody", "the-team", "unknown", "TBD", ""]) {
      const v = validateBlock(anchored({ [AP]: bad }));
      expect(v[0]?.key).toBe(AP);
      // An EMPTY value is the half-record case, not an out-of-roster one: the
      // block claims a basis and names no one. Both are refusals; they differ in
      // which of the two sentences the record failed to write.
      expect(v[0]?.code).toBe(bad === "" ? "accountability-half-recorded" : "invalid-enum");
    }
    // `unknown` is deliberately NOT on the roster, and this is the sharpest of the
    // five: every other enum in this file admits an honest `unknown` floor, and
    // that is right for them — `Credential-Mode: unknown` truthfully reports a
    // credential we could not determine. An UNKNOWN ACCOUNTABLE PARTY is not a
    // measurement, it is the absence of one wearing a value, and it would pass a
    // gate while naming nobody who could have withheld the act. Silence already
    // says that, honestly, by omitting the pair.
    expect(ACCOUNTABLE_PARTIES).not.toContain("unknown");
    // Trailing whitespace is TRANSPORT, not value — `blockValue` trims space/tab
    // for the same reason `normalizeLineEndings` exists, so this is not a smuggled
    // roster entry, it is the same name.
    expect(validateBlock(anchored({ [AP]: "acehack " }))).toEqual([]);
    for (const good of ACCOUNTABLE_PARTIES) expect(validateBlock(anchored({ [AP]: good }))).toEqual([]);
    for (const good of AUTHORITY_BASES) expect(validateBlock(anchored({ [AB]: good }))).toEqual([]);
  });

  test("the pair is all-or-nothing — half a record reads as complete and is refused", () => {
    expect(validateBlock(block({ [AP]: "acehack" }))[0]?.code).toBe("accountability-half-recorded");
    expect(validateBlock(block({ [AB]: "standing-grant" }))[0]?.code).toBe(
      "accountability-half-recorded",
    );
    expect(validateAccountabilityPair(block())).toBeNull();
    expect(validateAccountabilityPair(anchored())).toBeNull();
  });

  test("standing-grant is the word the schema lacked — the 99% case gets an affirmative spelling", () => {
    // 15,387 of 15,516 blocks over the last 3,000 commits on `main` say
    // `not-implied-by-credential`: the central governance field spends 99.17% of
    // its records negating the word in its own key. This is the statement that was
    // not writeable — "LFG is accountable, under standing authority, and no human
    // reviewed it" — and it must now validate with nothing phrased as an absence.
    const affirmative = block({
      [AP]: "lucent-financial-group",
      [AB]: "standing-grant",
      [HR]: "not-implied-by-credential",
      [HRE]: "none",
    });
    expect(validateBlock(affirmative)).toEqual([]);
    expect(blockValue(affirmative, AP)).toBe("lucent-financial-group");
  });

  test("the keys are optional in v1 AND v2 — the dual-accept window is unchanged", () => {
    const v2 = anchored({ "Agency-Signature-Version": "2", Agent: "soraya", Cell: "core" });
    expect(validateBlock(v2)).toEqual([]);
    const v2Silent = block({ "Agency-Signature-Version": "2", Agent: "soraya", Cell: "core" });
    expect(validateBlock(v2Silent)).toEqual([]);
  });

  // -- 3. THE #14430 SHAPE, ANCHORED ---------------------------------------

  test("THE DISSOLUTION: #14430's real shape resolves once the anchor is present", () => {
    // The three real commits of PR #14430, verbatim field values, PLUS the anchor
    // its standing grant always implied. Held constant: `Accountable-Party`,
    // `Authority-Basis`. Left mixed exactly as they are: the causal facts.
    const text = join(
      anchored({ [HR]: "explicit", [HRE]: "chat", "Action-Mode": "human-directed" }),
      anchored({ [HR]: "explicit", [HRE]: "chat", "Action-Mode": "human-directed" }),
      anchored({
        [HR]: "not-implied-by-credential",
        [HRE]: "none",
        "Action-Mode": "autonomous-fail-closed",
      }),
    );
    const verdict = validateText(text);
    expect(detectBlockDisagreement(text)).toBeNull();
    expect(verdict.violations).toEqual([]);
    expect(verdict.blockCount).toBe(3);

    // The resolution is in the UNDERSTATING direction on every reconciled key.
    const byKey = new Map(verdict.reconciliations.map((r) => [r.key, r.resolved]));
    expect(byKey.get(HR)).toBe("not-implied-by-credential");
    expect(byKey.get(HRE)).toBe("none");
    expect(byKey.get("Action-Mode")).toBe("autonomous-fail-closed");
    // ...and the discarded claim is PRINTED, never silently dropped (#14594).
    expect(verdict.reconciliations.find((r) => r.key === HR)?.from).toContain("explicit");
  });

  test("THE DIRECTION: Human-Review never resolves UP to a claim of review", () => {
    // The whole safety argument, and the same invariant as `reconcileActionMode`:
    // the record may understate human backing; it may never overstate it.
    for (const set of [
      ["explicit", "not-implied-by-credential"],
      ["explicit", "none"],
      ["none", "not-implied-by-credential"],
      ["not-implied-by-credential", "explicit", "none"],
    ]) {
      const resolved = reconcileHumanReview(set);
      expect(resolved).not.toBeNull();
      const value = resolved ?? "";
      expect(value).not.toBe("explicit");
      expect(set).toContain(value); // never invents a value
      const ranks = set.map((v) => HUMAN_REVIEW_BY_HUMAN_AUTHORITY.indexOf(v));
      expect(HUMAN_REVIEW_BY_HUMAN_AUTHORITY.indexOf(value)).toBe(Math.min(...ranks));
      // order must not matter — last-wins is exactly what this replaces
      expect(reconcileHumanReview([...set].reverse()) ?? "").toBe(value);
    }
  });

  test("an out-of-enum review spelling is never guessed into position", () => {
    // `main` carries 25 out-of-enum `Human-Review` spellings over 273 blocks —
    // `pending` x77, `EXPLICIT` x38, `implied-by-interactive-session` x60, and free
    // text such as `aaron-lets-do-it`. None has a rank, so none is ordered.
    for (const bad of ["pending", "EXPLICIT", "implied-by-interactive-session", "aaron-lets-do-it"]) {
      expect(reconcileHumanReview([bad, "not-implied-by-credential"])).toBeNull();
    }
    const text = join(anchored({ [HR]: "explicit", [HRE]: "chat" }), anchored({ [HR]: "pending" }));
    expect(detectBlockDisagreement(text)?.keys).toContain(HR);
  });

  test("evidence reconciles only as a CONSEQUENCE — never on its own", () => {
    // Two live evidence pointers under an agreeing explicit review are two true
    // statements, and collapsing them to `none` would assert there is no evidence
    // when there is. That stays loud.
    const both = join(
      anchored({ [HR]: "explicit", [HRE]: "chat" }),
      anchored({ [HR]: "explicit", [HRE]: "pr-review" }),
    );
    expect(detectBlockDisagreement(both)?.keys).toContain(HRE);
    expect(reconcileReviewEvidence(["explicit"], ["chat", "pr-review"])).toBeNull();
    // ...and `none` is never invented when no constituent wrote it.
    expect(reconcileReviewEvidence(["explicit", "none"], ["chat", "pr-review"])).toBeNull();
  });

  test("a PARTIAL anchor buys nothing — full coverage is required to relax", () => {
    // One commit's claim about the others is the manufacture wearing the new field.
    const text = join(
      anchored({ [HR]: "explicit", [HRE]: "chat" }),
      block({ [HR]: "not-implied-by-credential", [HRE]: "none" }), // no anchor
    );
    expect(accountabilityAnchor(findAllSignatureBlocks(text))).toBeNull();
    expect(detectBlockDisagreement(text)?.keys).toContain(HR);
  });

  test("an UNROSTERED anchor buys nothing", () => {
    const text = join(
      block({ [AP]: "acme-corp", [AB]: "standing-grant", [HR]: "explicit", [HRE]: "chat" }),
      block({ [AP]: "acme-corp", [AB]: "standing-grant", [HR]: "none" }),
    );
    expect(accountabilityAnchor(findAllSignatureBlocks(text))).toBeNull();
    expect(detectBlockDisagreement(text)?.keys).toContain(HR);
  });

  // -- 4. THE FALSIFIER -----------------------------------------------------

  test("THE FALSIFIER: two accountable parties FAIL LOUDLY, and nothing resolves them", () => {
    // A change with two accountable parties has no accountable party. There is no
    // reconciliation rule for this and there must never be one: if the accountable
    // party genuinely differs across a squash's constituents, that is a signal the
    // commits should not have been squashed together, and surfacing it IS the job.
    const text = join(
      block({ [AP]: "acehack", [AB]: "standing-grant" }),
      block({ [AP]: "lucent-financial-group", [AB]: "standing-grant" }),
    );
    const disagreement = detectBlockDisagreement(text);
    expect(disagreement?.keys).toContain(AP);
    expect(validateText(text).violations[0]?.code).toBe("block-disagreement");
    // NOT reconciled away, and NOT resolved by last-wins.
    expect(validateText(text).reconciliations.map((r) => r.key)).not.toContain(AP);
    expect(accountabilityAnchor(findAllSignatureBlocks(text))).toBeNull();
  });

  test("THE FALSIFIER, deeper: two parties cannot be laundered by agreeing on everything else", () => {
    // The tempting failure: every other field identical, so the record LOOKS
    // coherent. It is the least coherent record the schema can hold.
    const text = join(
      block({ [AP]: "acehack", [AB]: "standing-grant", "Action-Mode": "autonomous-fail-open" }),
      block({
        [AP]: "lucent-financial-group",
        [AB]: "standing-grant",
        "Action-Mode": "autonomous-fail-open",
      }),
    );
    const d = detectBlockDisagreement(text);
    expect(d?.keys).toEqual([AP]);
    expect(d?.details[0]).toContain("acehack");
    expect(d?.details[0]).toContain("lucent-financial-group");
  });

  test("THE FALSIFIER, third form: a differing Authority-Basis is loud too", () => {
    // `standing-grant` and `gated-class-approval` are not orderable — neither
    // implies the other — so there is no weakest and no resolution.
    const text = join(
      anchored({ [AB]: "standing-grant" }),
      anchored({ [AB]: "gated-class-approval" }),
    );
    expect(detectBlockDisagreement(text)?.keys).toContain(AB);
    expect(accountabilityAnchor(findAllSignatureBlocks(text))).toBeNull();
  });

  test("SCOPE: the two accountability keys are governance-critical and never reconcilable", () => {
    for (const key of ACCOUNTABILITY_KEYS) expect(GOVERNANCE_KEYS).toContain(key);
    const text = join(anchored(), anchored({ [AP]: "lucent-financial-group" }));
    expect(detectReconciliations(text)).toEqual([]);
  });
});
