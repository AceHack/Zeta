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
  GOVERNANCE_KEYS,
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
    expect(others.length).toBe(4);
    const alt: Readonly<Record<string, readonly [string, string]>> = {
      "Agency-Signature-Version": ["1", "2"],
      "Credential-Mode": ["shared", "dedicated-agent"],
      "Human-Review": ["explicit", "none"],
      "Human-Review-Evidence": ["chat", "none"],
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

  test("an unmixed Action-Mode reports no reconciliation at all", () => {
    const b = block({ [AM]: "human-directed" });
    expect(detectReconciliations(`x\n\n${b}\n\ny\n\n${b}\n`)).toEqual([]);
    expect(validateText(`x\n\n${b}\n`).reconciliations).toEqual([]);
  });
});
