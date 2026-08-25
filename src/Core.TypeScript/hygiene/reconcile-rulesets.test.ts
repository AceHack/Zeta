import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  applyPlan,
  buildPlan,
  loadDesiredFiles,
  main,
  parseArgs,
  patchBody,
  sha256Canonical,
  validateApproval,
  writeRollback,
  type GitHubApi,
  type Manifest,
  type WideningApproval,
} from "./reconcile-rulesets";
import { canonicalJson, normalizeRuleset, type Ruleset } from "./ruleset-model";

// ---------------------------------------------------------------------------
// Fixtures — no network. `gh` is never invoked; the API seam is injected.
// ---------------------------------------------------------------------------

const HEARTBEAT_LIVE: Ruleset = {
  id: 16934633,
  name: "Heartbeat Branch Protection",
  target: "branch",
  enforcement: "active",
  conditions: { ref_name: { include: ["refs/heads/heartbeat/*"], exclude: [] } },
  rules: [{ type: "deletion" }],
  bypass_actors: [],
};

const REFS = [
  "refs/heads/main",
  "refs/heads/heartbeat/otto",
  "refs/heads/heartbeat/society-buffer",
  "refs/heads/heartbeat/alexa-flush",
  "refs/heads/heartbeat/otto-flush-aaaa",
  "refs/heads/heartbeat/otto-flush-bbbb",
  "refs/heads/heartbeat/society-flush-cccc",
];

interface FakeState {
  readonly rulesets: Map<number, Ruleset>;
  readonly patches: { id: number; body: unknown }[];
  /** Simulates GitHub silently storing something other than what you sent. */
  mutateOnWrite?: (body: Ruleset) => Ruleset;
  failReads?: boolean;
}

function fakeApi(state: FakeState): GitHubApi {
  return {
    async listRulesetIds() {
      if (state.failReads === true) throw new Error("403 resource not accessible");
      return [...state.rulesets.keys()];
    },
    async getRuleset(_repo, id) {
      if (state.failReads === true) throw new Error("403 resource not accessible");
      const r = state.rulesets.get(id);
      if (r === undefined) throw new Error(`no ruleset ${String(id)}`);
      return r;
    },
    async patchRuleset(_repo, id, body) {
      state.patches.push({ id, body });
      const asRuleset = { ...(body as object), id } as Ruleset;
      state.rulesets.set(
        id,
        state.mutateOnWrite === undefined ? asRuleset : state.mutateOnWrite(asRuleset),
      );
    },
    async listBranchRefs() {
      return REFS;
    },
  };
}

function freshState(): FakeState {
  return { rulesets: new Map([[16934633, HEARTBEAT_LIVE]]), patches: [] };
}

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "zeta-rulesets-"));
  mkdirSync(join(dir, "approvals"), { recursive: true });
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const MANIFEST: Manifest = {
  repo: "Lucent-Financial-Group/Zeta",
  default_branch: "main",
  managed_ruleset_ids: [16934633],
};

function writeDesired(over: Partial<Ruleset> = {}): Ruleset {
  const desired = normalizeRuleset({ ...HEARTBEAT_LIVE, ...over } as Ruleset);
  writeFileSync(
    join(dir, "16934633-heartbeat-branch-protection.json"),
    `${canonicalJson(desired)}\n`,
    "utf8",
  );
  return desired as unknown as Ruleset;
}

function writeApproval(a: WideningApproval): void {
  writeFileSync(
    join(dir, "approvals", `${String(a.ruleset_id)}.approval.json`),
    `${JSON.stringify(a, null, 2)}\n`,
    "utf8",
  );
}

// ---------------------------------------------------------------------------

describe("parseArgs", () => {
  test("--repo OWNER/NAME → success with default desired dir", () => {
    const r = parseArgs(["--repo", "Lucent-Financial-Group/Zeta"]);
    expect(r.kind).toBe("args");
    if (r.kind === "args") {
      expect(r.args.repo).toBe("Lucent-Financial-Group/Zeta");
      expect(r.args.apply).toBe(false);
      expect(r.args.desired).toMatch(/rulesets[/]Lucent-Financial-Group[/]Zeta$/);
    }
  });

  test("plan is the DEFAULT — a reconciler you run by accident does nothing", () => {
    const r = parseArgs(["--repo", "a/b"]);
    expect(r.kind === "args" && r.args.apply).toBe(false);
  });

  test("--apply is opt-in", () => {
    const r = parseArgs(["--repo", "a/b", "--apply"]);
    expect(r.kind === "args" && r.args.apply).toBe(true);
  });

  test("closed flag set: an unknown arg is an error, never ignored", () => {
    const r = parseArgs(["--repo", "a/b", "--force"]);
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.message).toContain("unknown arg");
  });

  test("--repo without a value is an error", () => {
    const r = parseArgs(["--repo"]);
    expect(r.kind).toBe("error");
  });

  test("missing --repo is an error", () => {
    const prior = process.env["GH_REPO"];
    delete process.env["GH_REPO"];
    try {
      expect(parseArgs([]).kind).toBe("error");
    } finally {
      if (prior !== undefined) process.env["GH_REPO"] = prior;
    }
  });
});

// ---------------------------------------------------------------------------
// THE WIDENING GATE. These are the falsifiers the whole design rests on.
// ---------------------------------------------------------------------------

describe("validateApproval — the gate REFUSES", () => {
  const sha = "a".repeat(64);
  const good: WideningApproval = {
    ruleset_id: 16934633,
    desired_sha256: sha,
    expected_released_refs: 3,
    reason: "release transient snapshot refs",
    approved_by: "acehack",
    approved_at: "2026-08-25T00:00:00Z",
  };

  test("a matching approval passes", () => {
    expect(validateApproval(good, 16934633, sha, 3).ok).toBe(true);
  });

  test("NO approval → refused", () => {
    const r = validateApproval(null, 16934633, sha, 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("no widening approval");
  });

  test("approval for a DIFFERENT ruleset → refused", () => {
    const r = validateApproval({ ...good, ruleset_id: 999 }, 16934633, sha, 3);
    expect(r.ok).toBe(false);
  });

  test("CONTENT DRIFT: the file changed after approval → refused", () => {
    // The crux. An approval that survives an edit is a licence, not an
    // approval: approve a benign widening, then quietly broaden the file.
    const r = validateApproval(good, 16934633, "b".repeat(64), 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("changed after it was approved");
  });

  test("METERED: releasing more refs than approved → refused", () => {
    const r = validateApproval(good, 16934633, sha, 1612);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("actually releases 1612");
  });

  test("METERED: releasing ZERO when 1612 were approved → refused (catches a no-op pattern)", () => {
    // This is what a wrong glob looks like from the gate's point of view: the
    // author believed they were releasing 1612 refs; the matcher says 0.
    const r = validateApproval(
      { ...good, expected_released_refs: 1612 },
      16934633,
      sha,
      0,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("actually releases 0");
  });

  test("an empty reason → refused", () => {
    const r = validateApproval({ ...good, reason: "   " }, 16934633, sha, 3);
    expect(r.ok).toBe(false);
  });
});

describe("buildPlan — end to end against a fake GitHub", () => {
  test("desired === live is a NO-OP, and re-running stays a NO-OP (idempotent)", async () => {
    writeDesired();
    const state = freshState();
    for (const _ of [0, 1]) {
      const out = await buildPlan(fakeApi(state), MANIFEST, dir);
      expect(out.kind).toBe("plan");
      if (out.kind === "plan") {
        expect(out.plans[0]?.classification.verdict).toBe("no-op");
        expect(out.plans[0]?.gate).toBeNull();
      }
    }
    expect(state.patches.length).toBe(0);
  });

  test("REFUSES a desired file for a ruleset outside the allowlist", async () => {
    writeDesired();
    writeFileSync(
      join(dir, "15256879-default.json"),
      `${canonicalJson({ ...HEARTBEAT_LIVE, id: 15256879, name: "Default" })}\n`,
      "utf8",
    );
    const out = await buildPlan(fakeApi(freshState()), MANIFEST, dir);
    expect(out.kind).toBe("refused");
    if (out.kind === "refused") {
      expect(out.reasons.join(" ")).toContain("NOT in manifest.managed_ruleset_ids");
    }
  });

  test("REFUSES a managed id with no desired-state file", async () => {
    const out = await buildPlan(fakeApi(freshState()), MANIFEST, dir);
    expect(out.kind).toBe("refused");
    if (out.kind === "refused") {
      expect(out.reasons.join(" ")).toContain("no desired-state file");
    }
  });

  test("REFUSES a managed ruleset that does not exist live (never creates)", async () => {
    writeDesired();
    const state: FakeState = { rulesets: new Map(), patches: [] };
    const out = await buildPlan(fakeApi(state), MANIFEST, dir);
    expect(out.kind).toBe("refused");
    if (out.kind === "refused") {
      expect(out.reasons.join(" ")).toContain("never CREATES or DELETES");
    }
  });

  test("a widening change with NO approval is gated shut", async () => {
    writeDesired({
      conditions: {
        ref_name: {
          include: ["refs/heads/heartbeat/*"],
          exclude: ["refs/heads/heartbeat/*-flush-*"],
        },
      },
    });
    const out = await buildPlan(fakeApi(freshState()), MANIFEST, dir);
    expect(out.kind).toBe("plan");
    if (out.kind === "plan") {
      const p = out.plans[0];
      expect(p?.classification.verdict).toBe("widening");
      expect(p?.gate?.ok).toBe(false);
      expect(p?.coverage?.released.length).toBe(3);
    }
  });

  test("the SAME widening passes once a correct approval is committed", async () => {
    const desired = writeDesired({
      conditions: {
        ref_name: {
          include: ["refs/heads/heartbeat/*"],
          exclude: ["refs/heads/heartbeat/*-flush-*"],
        },
      },
    });
    writeApproval({
      ruleset_id: 16934633,
      desired_sha256: sha256Canonical(desired),
      expected_released_refs: 3,
      reason: "release transient snapshot refs left by the pre-#15309 scheme",
      approved_by: "acehack",
      approved_at: "2026-08-25T00:00:00Z",
    });
    const out = await buildPlan(fakeApi(freshState()), MANIFEST, dir);
    expect(out.kind).toBe("plan");
    if (out.kind === "plan") expect(out.plans[0]?.gate?.ok).toBe(true);
  });

  test("a WRONG-GLOB widening is caught by the metered count even with an approval", async () => {
    // The author intended `heartbeat/*-flush-*` and typed `*-flush-*`.
    const desired = writeDesired({
      conditions: {
        ref_name: {
          include: ["refs/heads/heartbeat/*"],
          exclude: ["refs/heads/*-flush-*"],
        },
      },
    });
    writeApproval({
      ruleset_id: 16934633,
      desired_sha256: sha256Canonical(desired),
      expected_released_refs: 3,
      reason: "release transient snapshot refs",
      approved_by: "acehack",
      approved_at: "2026-08-25T00:00:00Z",
    });
    const out = await buildPlan(fakeApi(freshState()), MANIFEST, dir);
    expect(out.kind).toBe("plan");
    if (out.kind === "plan") {
      expect(out.plans[0]?.coverage?.released.length).toBe(0);
      expect(out.plans[0]?.gate?.ok).toBe(false);
    }
  });
});

describe("applyPlan — the write half verifies itself", () => {
  async function planFor(over: Partial<Ruleset>, state: FakeState) {
    const desired = writeDesired(over);
    writeApproval({
      ruleset_id: 16934633,
      desired_sha256: sha256Canonical(desired),
      expected_released_refs: 3,
      reason: "release transient snapshot refs",
      approved_by: "acehack",
      approved_at: "2026-08-25T00:00:00Z",
    });
    const out = await buildPlan(fakeApi(state), MANIFEST, dir);
    if (out.kind !== "plan") throw new Error("expected a plan");
    return out.plans;
  }

  const EXCLUDE = {
    conditions: {
      ref_name: {
        include: ["refs/heads/heartbeat/*"],
        exclude: ["refs/heads/heartbeat/*-flush-*"],
      },
    },
  };

  test("applies, writes a rollback snapshot, and verifies the read-back", async () => {
    const state = freshState();
    const plans = await planFor(EXCLUDE, state);
    const rb = join(dir, "rollback");
    const results = await applyPlan(fakeApi(state), MANIFEST.repo, plans, rb, "T", () => {});
    expect(results[0]?.applied).toBe(true);
    expect(results[0]?.verified).toBe(true);
    // The rollback snapshot holds the PRE-apply state, so re-applying it reverts.
    const snap = JSON.parse(readFileSync(join(rb, "16934633.prior-T.json"), "utf8")) as {
      conditions: { ref_name: { exclude: string[] } };
    };
    expect(snap.conditions.ref_name.exclude).toEqual([]);
  });

  test("FALSIFIER: verification FAILS when live does not end up matching intent", async () => {
    // Simulate GitHub storing something other than what was sent — the exact
    // case a reconciler that trusts its own PATCH would report as success.
    const state = freshState();
    state.mutateOnWrite = (r) => ({
      ...r,
      conditions: { ref_name: { include: ["refs/heads/heartbeat/*"], exclude: [] } },
    });
    const plans = await planFor(EXCLUDE, state);
    const results = await applyPlan(
      fakeApi(state),
      MANIFEST.repo,
      plans,
      join(dir, "rollback"),
      "T",
      () => {},
    );
    expect(results[0]?.applied).toBe(true);
    expect(results[0]?.verified).toBe(false);
    expect(results[0]?.message).toContain("POST-APPLY VERIFICATION FAILED");
  });

  test("a no-op plan sends NO PATCH at all (apply-N-times === apply-once)", async () => {
    writeDesired();
    const state = freshState();
    const out = await buildPlan(fakeApi(state), MANIFEST, dir);
    if (out.kind !== "plan") throw new Error("expected a plan");
    const results = await applyPlan(
      fakeApi(state),
      MANIFEST.repo,
      out.plans,
      join(dir, "rollback"),
      "T",
      () => {},
    );
    expect(state.patches.length).toBe(0);
    expect(results[0]?.applied).toBe(false);
    expect(results[0]?.verified).toBe(true);
  });

  test("applying twice is idempotent: second run is a no-op and sends nothing new", async () => {
    const state = freshState();
    const plans = await planFor(EXCLUDE, state);
    await applyPlan(fakeApi(state), MANIFEST.repo, plans, join(dir, "rollback"), "T", () => {});
    expect(state.patches.length).toBe(1);

    const second = await buildPlan(fakeApi(state), MANIFEST, dir);
    expect(second.kind).toBe("plan");
    if (second.kind === "plan") {
      expect(second.plans[0]?.classification.verdict).toBe("no-op");
      await applyPlan(
        fakeApi(state),
        MANIFEST.repo,
        second.plans,
        join(dir, "rollback"),
        "T2",
        () => {},
      );
    }
    expect(state.patches.length).toBe(1);
  });

  test("a gated-shut widening is NOT applied", async () => {
    writeDesired(EXCLUDE); // no approval written
    const state = freshState();
    const out = await buildPlan(fakeApi(state), MANIFEST, dir);
    if (out.kind !== "plan") throw new Error("expected a plan");
    const results = await applyPlan(
      fakeApi(state),
      MANIFEST.repo,
      out.plans,
      join(dir, "rollback"),
      "T",
      () => {},
    );
    expect(state.patches.length).toBe(0);
    expect(results[0]?.applied).toBe(false);
    expect(results[0]?.message).toContain("refused");
  });

  test("FAIL-CLOSED: an unwritable rollback directory aborts before any PATCH", async () => {
    const state = freshState();
    const plans = await planFor(EXCLUDE, state);
    // A path whose parent is a FILE cannot be created.
    const blocker = join(dir, "blocker");
    writeFileSync(blocker, "x", "utf8");
    await expect(
      applyPlan(fakeApi(state), MANIFEST.repo, plans, join(blocker, "rollback"), "T", () => {}),
    ).rejects.toThrow();
    expect(state.patches.length).toBe(0);
  });
});

describe("main — exit codes are the contract", () => {
  function writeManifest(): void {
    writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(MANIFEST, null, 2)}\n`, "utf8");
  }

  test("in-sync → 0", async () => {
    writeManifest();
    writeDesired();
    expect(await main(["--repo", MANIFEST.repo, "--desired", dir], fakeApi(freshState()))).toBe(0);
  });

  test("pending change in plan mode → 1", async () => {
    writeManifest();
    writeDesired({ rules: [{ type: "deletion" }, { type: "non_fast_forward" }] });
    expect(await main(["--repo", MANIFEST.repo, "--desired", dir], fakeApi(freshState()))).toBe(1);
  });

  test("ungated widening → 3 (REFUSED)", async () => {
    writeManifest();
    writeDesired({ rules: [] });
    expect(await main(["--repo", MANIFEST.repo, "--desired", dir], fakeApi(freshState()))).toBe(3);
  });

  test("INDETERMINATE read failure → 2, never a silent 0", async () => {
    // A check that could not run must not read as a check that passed.
    writeManifest();
    writeDesired();
    const state = freshState();
    state.failReads = true;
    expect(await main(["--repo", MANIFEST.repo, "--desired", dir], fakeApi(state))).toBe(2);
  });

  test("post-apply verification failure → 4", async () => {
    writeManifest();
    const desired = writeDesired({
      conditions: {
        ref_name: {
          include: ["refs/heads/heartbeat/*"],
          exclude: ["refs/heads/heartbeat/*-flush-*"],
        },
      },
    });
    writeApproval({
      ruleset_id: 16934633,
      desired_sha256: sha256Canonical(desired),
      expected_released_refs: 3,
      reason: "release transient snapshot refs",
      approved_by: "acehack",
      approved_at: "2026-08-25T00:00:00Z",
    });
    const state = freshState();
    state.mutateOnWrite = (r) => ({
      ...r,
      conditions: { ref_name: { include: ["refs/heads/heartbeat/*"], exclude: [] } },
    });
    expect(
      await main(
        ["--repo", MANIFEST.repo, "--desired", dir, "--apply", "--rollback-out", join(dir, "rb")],
        fakeApi(state),
      ),
    ).toBe(4);
  });

  test("manifest/--repo mismatch → 2", async () => {
    writeManifest();
    writeDesired();
    expect(await main(["--repo", "Other/Repo", "--desired", dir], fakeApi(freshState()))).toBe(2);
  });

  test("FAIL-CLOSED: an unknown flag exits non-zero and writes NOTHING", async () => {
    writeManifest();
    writeDesired();
    const before = snapshotTree(dir);
    const code = await main(
      ["--repo", MANIFEST.repo, "--desired", dir, "--apply", "--yolo"],
      fakeApi(freshState()),
    );
    expect(code).not.toBe(0);
    expect(snapshotTree(dir)).toEqual(before);
  });

  test("positive control: the tree snapshot CAN detect a write", () => {
    const before = snapshotTree(dir);
    writeFileSync(join(dir, "canary.json"), "{}", "utf8");
    expect(snapshotTree(dir)).not.toEqual(before);
  });
});

function snapshotTree(root: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(`${p}:${String(statSync(p).size)}`);
    }
  };
  walk(root);
  return out;
}

describe("patchBody / loadDesiredFiles", () => {
  test("patchBody sends only writable fields — never id or server bookkeeping", () => {
    const body = patchBody(normalizeRuleset(HEARTBEAT_LIVE));
    expect(Object.keys(body).sort()).toEqual([
      "bypass_actors",
      "conditions",
      "enforcement",
      "name",
      "rules",
      "target",
    ]);
    expect("id" in body).toBe(false);
  });

  test("loadDesiredFiles rejects a filename id that disagrees with the body id", () => {
    writeFileSync(
      join(dir, "99999-wrong.json"),
      `${canonicalJson(normalizeRuleset(HEARTBEAT_LIVE))}\n`,
      "utf8",
    );
    expect(() => loadDesiredFiles(dir)).toThrow(/disagrees/);
  });

  test("loadDesiredFiles ignores manifest.json and the approvals directory", () => {
    writeFileSync(join(dir, "manifest.json"), "{}", "utf8");
    writeDesired();
    writeApproval({
      ruleset_id: 16934633,
      desired_sha256: "x",
      expected_released_refs: 0,
      reason: "r",
      approved_by: "a",
      approved_at: "t",
    });
    const files = loadDesiredFiles(dir);
    expect(files.length).toBe(1);
    expect(files[0]?.id).toBe(16934633);
  });
});

describe("writeRollback", () => {
  test("writes the prior state so a revert is just re-applying the file", () => {
    const p = writeRollback(join(dir, "rb"), 16934633, normalizeRuleset(HEARTBEAT_LIVE), "S");
    expect(readFileSync(p, "utf8")).toContain("Heartbeat Branch Protection");
  });
});
