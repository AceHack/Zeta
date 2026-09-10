/**
 * run-org.test.ts — the production entry point, driven as a caller would drive it.
 *
 * `main` is what makes "it runs end to end" a statement about a code path something outside a test
 * suite takes. Tested through its EXIT CODE and its real output, because those are what a caller
 * actually consumes.
 */

import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fidelityOf, Port } from "./providers";
import { WorkState, WorkType as WorkTypeValue, type CascadeNode } from "./goal-cascade";
import { artifactProducersFromArgs, churnThresholdFor, gateAttemptsFor, hasSource, main, parseArgs, PRE_CODE_GATES, providersFromArgs, trackerMapper, KNOWN_FLAGS, unknownFlags} from "./run-org";
import { RunOutcome } from "./qa";
import { GateKind, ORDERED_GATES } from "./quality-gate";
import { Severity } from "./intake";

/** Run `main`, capturing what it printed. */
async function capture(argv: readonly string[]): Promise<{ code: number; out: string }> {
  const lines: string[] = [];
  const log = console.log;
  const err = console.error;
  console.log = (...a: unknown[]) => void lines.push(a.map(String).join(" "));
  console.error = (...a: unknown[]) => void lines.push(a.map(String).join(" "));
  try {
    const code = await main(argv);
    return { code, out: lines.join("\n") };
  } finally {
    console.log = log;
    console.error = err;
  }
}

describe("AN UNKNOWN FLAG IS REFUSED, NOT IGNORED", () => {
  test("a flag this CLI does not know is named", () => {
    // Found the hard way: every run in one session passed `--at <iso>` believing it set the clock.
    // The flag does not exist — it is `--now` — so nowMs stayed 0 and every timestamp in the log
    // was the epoch. Nothing complained. A flag that silently does nothing is the vacuity class
    // wearing a CLI: the operator believes a setting is in force and it is not.
    expect(unknownFlags(["--at", "2026-01-01"]).length).toBe(1);
    expect(unknownFlags(["--at", "2026-01-01"])[0]).toContain("--at");
  });

  test("it suggests what you probably meant", () => {
    expect(unknownFlags(["--at"])[0]).toContain("--now");
  });

  test("known flags pass, including their values", () => {
    expect(unknownFlags(["--store", "/tmp/x", "--now", "2026-01-01T00:00:00Z", "--json"])).toEqual([]);
  });

  test("a value that happens to start with two dashes is still checked", () => {
    // `--store --now` is a typo that would otherwise consume the next flag as a path.
    expect(unknownFlags(["--store", "--nope"]).length).toBe(1);
  });

  test("--flag=value form names the flag, not the whole token", () => {
    expect(unknownFlags(["--wibble=3"])[0]?.startsWith("--wibble")).toBe(true);
  });

  test("positional arguments are not flags", () => {
    expect(unknownFlags(["run", "/tmp/store"])).toEqual([]);
  });

  test("every flag the CLI reads is in the known set", () => {
    // The list is written by hand, so this greps the source for what it actually reads. A flag
    // added without being listed becomes a silent no-op the day somebody types it.
    const source = readFileSync(new URL("./run-org.ts", import.meta.url), "utf-8");
    const used = new Set<string>();
    for (const m of source.matchAll(/(?:valueAfter|valuesAfter)\(argv, "(--[a-z-]+)"\)/g)) used.add(m[1] as string);
    for (const m of source.matchAll(/argv\.includes\("(--[a-z-]+)"\)/g)) used.add(m[1] as string);
    for (const m of source.matchAll(/a === "(--[a-z-]+)"/g)) used.add(m[1] as string);
    const missing = [...used].filter((f) => !KNOWN_FLAGS.has(f));
    expect(missing).toEqual([]);
  });
});

describe("A PASS-THROUGH ARGUMENT IS NOT THIS CLI'S FLAG", () => {
  // Every one of these flags exists to hand an argument VERBATIM to a child process, and real
  // command arguments begin with a dash. `unknownFlags` scanned every token in argv, so
  // `--test-arg --maxWorkers=2` read as the flag `--maxWorkers` and refused the run before it
  // started -- on the exact combination jest requires. Measured: exit 2, nothing ran.

  test("a value beginning with -- is passed through, not refused", () => {
    expect(unknownFlags(["--work-arg", "--allow-empty"])).toEqual([]);
    expect(unknownFlags(["--test-arg", "--maxWorkers=2"])).toEqual([]);
    expect(parseArgs(["--work-arg", "--allow-empty"]).workArgs).toEqual(["--allow-empty"]);
  });

  test("a value that NAMES a real flag is still consumed as a value", () => {
    // Otherwise `--work-arg --json` would quietly switch this CLI's own output format while also
    // reaching the child, which is two surprises for one token.
    expect(unknownFlags(["--work-arg", "--json"])).toEqual([]);
  });

  test("...and a genuine unknown flag is STILL refused", () => {
    // The narrowing must not become a hole. A dash-prefixed token that is not the value of a
    // pass-through flag is exactly as suspicious as it ever was.
    expect(unknownFlags(["--allow-empty"])).toHaveLength(1);
    expect(unknownFlags(["--work-arg", "ok", "--maxWorkers=2"])).toHaveLength(1);
    // A typo in a PATH flag stays caught: the operator meant to give a directory and gave a flag.
    expect(unknownFlags(["--store", "/tmp/x", "--nope"])).toHaveLength(1);
  });
});

describe("argument parsing", () => {
  test("defaults are all off", () => {
    // `store` is undefined by default: persisting is a SIDE EFFECT, and a reporting CLI should
    // not have one unless told to.
    expect(parseArgs([])).toEqual({
      qaFails: false, churn: false, json: false, cycleOnly: false, admin: false, store: undefined,
      // Absent by default: with no facilitator wired, meetings are booked and held by nobody, and
      // the run SAYS that rather than reporting an outcome it did not have.
      meetingCmd: undefined, meetingArgs: [],
      // NO CHECKPOINTS BY DEFAULT, and this is the assertion that keeps it that way. A default that
      // drifted to "both" would stop every unattended run at its first gate, and the run would look
      // like it had crashed rather than like it was waiting.
      actions: undefined, blockers: undefined, checkpoints: [],
      // NO PRICE TABLE BY DEFAULT. Every crossing is still measured; the cost is reported absent
      // rather than as a number nobody configured — see `meter.ts`.
      pricing: {},
      // Rooms are absent by default: a run with no --rooms answers no conversations, which is
      // the right behaviour for one nobody told about them.
      rooms: undefined, roomCmd: undefined, roomArgs: [],
      memory: undefined, studyCmd: undefined, studyArgs: [],
      // `--week` runs the organization DRIVING ITSELF rather than the scripted cycle. Off by
      // default like every other mode; `days` is absent rather than undefined, because
      // `exactOptionalPropertyTypes` makes those different things and the parser respects it.
      week: false,
      // Every port unspecified means every port SIMULATED — and `providersFromArgs` is where that
      // becomes an adapter, so the default is a decision made in one visible place.
      inbox: undefined, workCmd: undefined, testCmd: undefined, git: undefined, baseBranch: "main",
      workArgs: [], testArgs: [],
      // Every gate unreviewed means AUTO-APPROVE — the register's own long-standing behaviour,
      // which is now an adapter that says so rather than a constant nobody could see.
      reviewQueue: undefined, reviewCmd: undefined, reviewArgs: [],
      worktrees: undefined,
      // The three ports that had no command-line path until now. Absent still means simulated, and
      // the fidelity block still says so — reaching a tracker, an agent or a model is opt-in.
      reviewModel: undefined, tracker: undefined, trackerItems: undefined,
      trackerHeaders: [], trackerMap: [], trackerSource: "tracker", trackerSeverity: [],
      workAgent: undefined, workModel: undefined, until: undefined, windowStart: undefined, windowTarget: undefined, now: undefined, agentDelivers: false, sourceRepos: [], sourceSubdir: undefined,
      confluenceAuthFile: undefined, confluenceSpaces: [], confluenceCql: undefined, confluenceLimit: undefined,
      skillBindings: [], workAgentArgs: [], workVerify: undefined, workVerifyArgs: [],
      // The process layer, empty by default: an organization states its own, and one that has
      // stated nothing follows the register's few defaults rather than these fields.
      practices: [], directives: [], repoSources: [],
      // Absent means each adapter keeps its own default. Two minutes is right for a build command
      // and wrong for an agent, so the choice belongs to whoever knows which one they wired up.
      portTimeoutMs: undefined,
      // Three, decided in org-cycle. An operator watching a CONVERGING revision may raise it;
      // absent means the register keeps its own judgement about when churn is churn.
      maxGateAttempts: undefined,
      // Three, decided in escalation.ts. It fires BEFORE maxGateAttempts, so raising only the
      // attempt bound changes nothing an operator can observe.
      churnThreshold: undefined,
      // Absent leaves the pre-code phases judgement-only, which is what they have always been.
      artifactCmd: undefined,
      artifactArgs: [],
      // The organization reads a corpus and its own record; it never writes to either. Absent means
      // the pre-code phases stay judgement-only, which is what they have always been.
      orgDocs: undefined, contextLimit: undefined, contextOut: undefined,
    });
    expect(parseArgs(["--store", "/tmp/x"]).store).toBe("/tmp/x");
  });

  test("--port-timeout-ms reaches the SPAWNED port, proven by killing a slow one", async () => {
    // This flag exists because of a real failure. With nothing setting it, every spawned adapter
    // kept its 2-minute default; a work agent given a defect in a real codebase was killed at 120s,
    // the register carried on to the gates with an empty diff, every gate correctly rejected
    // nothing, and the run reported NOT DELIVERED in under two minutes. No gate was wrong — the
    // organization was simply never given time to produce anything for them to judge.
    //
    // So this is asserted through BEHAVIOUR, not by reading the parsed field back. A flag that is
    // parsed and then dropped on the floor would satisfy any test that only re-reads `parseArgs`.
    expect(parseArgs([]).portTimeoutMs).toBeUndefined();
    expect(parseArgs(["--port-timeout-ms", "5400000"]).portTimeoutMs).toBe(5_400_000);
    expect(parseArgs(["--max-gate-attempts", "6"]).maxGateAttempts).toBe(6);

    // Asserted through the DECISION, not the parsed field. Reading `parseArgs(...).x` back only
    // proves the parser stored what it was given; two mutants that dropped the value on its way to
    // the runtime both survived a test written that way, which is the whole reason this one exists.
    expect(gateAttemptsFor(parseArgs([]))).toBeUndefined();          // the register keeps its own 3
    expect(gateAttemptsFor(parseArgs(["--churn"]))).toBe(5);          // the bundle's posture
    expect(gateAttemptsFor(parseArgs(["--max-gate-attempts", "6"]))).toBe(6);
    // The narrower, later statement wins over the bundle rather than being overwritten by it.
    expect(gateAttemptsFor(parseArgs(["--churn", "--max-gate-attempts", "9"]))).toBe(9);
    expect(gateAttemptsFor(parseArgs(["--max-gate-attempts", "9", "--churn"]))).toBe(9);

    // Every gate BEFORE implementation gets a producer, and none after it — the later phases
    // already have something real to judge and must not be handed a document instead.
    expect(artifactProducersFromArgs(parseArgs([])).size).toBe(0);

    // A source is DECLARED by either flag, and the org's own record counts as one — a run with a
    // record and no repository still has a corpus to grow from.
    expect(hasSource(parseArgs([]))).toBe(false);
    expect(hasSource(parseArgs(["--source-repo", "/r"]))).toBe(true);
    expect(hasSource(parseArgs(["--org-docs", "/d"]))).toBe(true);

    // A tracker's severity words are its own. Jira ships "3 - Medium", which nothing in the register
    // recognises, so it fell to Low — right in the abstract, silently wrong in practice: a Medium
    // defect would have been prioritised, staffed and scheduled as Low.
    const jira = trackerMapper("jira", ["externalId=key", "title=fields.summary", "severity=fields.priority.name"],
                               ["3 - Medium=medium", "2 - High=high", "1 - Critical=critical"]);
    const issue = { key: "AIAGENT-1637", fields: { summary: "archival is broken", priority: { name: "3 - Medium" } } };
    expect(jira(issue).severity).toBe(Severity.Medium);
    expect(jira(issue).externalId).toBe("AIAGENT-1637");

    // Unmapped STILL falls to Low. A severity nobody translated is a severity nobody knows, and
    // guessing upward would let a tracker's vocabulary set this organization's priorities.
    const unmapped = { key: "X-1", fields: { summary: "t", priority: { name: "Blocker!!" } } };
    expect(jira(unmapped).severity).toBe(Severity.Low);

    // And the register's own words keep working with no mapping at all.
    const plain = trackerMapper("t", ["externalId=id", "title=t", "severity=sev"]);
    expect(plain({ id: "1", t: "x", sev: "high" }).severity).toBe(Severity.High);

    // ── ONE MAPPER, ANY TOOL. Config, not code. ──────────────────────────────
    // The register must not learn a vendor. These are three real response shapes from three
    // different systems, each read by the SAME function with different flags — which is the whole
    // claim: swapping task tracker or document store is a configuration change, and nothing in the
    // core is allowed to name the tool it is talking to.
    const shapes = [
      {
        tool: "Jira",
        map: ["externalId=key", "title=fields.summary", "severity=fields.priority.name"],
        sev: ["3 - Medium=medium"],
        item: { key: "AIAGENT-1637", fields: { summary: "archival broken", priority: { name: "3 - Medium" } } },
        id: "AIAGENT-1637",
      },
      {
        tool: "GitHub Issues",
        map: ["externalId=number", "title=title", "severity=labels.0.name"],
        sev: ["bug:p2=medium"],
        item: { number: "4471", title: "archival broken", labels: [{ name: "bug:p2" }] },
        id: "4471",
      },
      {
        tool: "ServiceNow",
        map: ["externalId=sys_id", "title=short_description", "severity=impact"],
        sev: ["2=medium"],
        item: { sys_id: "INC0012345", short_description: "archival broken", impact: "2" },
        id: "INC0012345",
      },
    ];
    for (const shape of shapes) {
      const read = trackerMapper(shape.tool, shape.map, shape.sev);
      const event = read(shape.item);
      expect(event.externalId).toBe(shape.id);
      expect(event.title).toBe("archival broken");
      expect(event.severity).toBe(Severity.Medium);
      // The citation names the system it came from, so a work item can be traced back to its tool.
      expect(event.evidenceRefs?.[0]).toBe(`${shape.tool}/${shape.id}`);
    }
    const withCmd = artifactProducersFromArgs(parseArgs(["--artifact-cmd", "bash", "--artifact-arg", "w.sh"]));
    expect([...withCmd.keys()]).toEqual([...PRE_CODE_GATES]);
    expect(withCmd.has(GateKind.ImplementationReview)).toBe(false);
    expect(withCmd.has(GateKind.RuntimeValidation)).toBe(false);
    expect(withCmd.has(GateKind.FinalBusinessValidation)).toBe(false);
    // DERIVED from the chain, not listed: the boundary is implementation_review's position.
    expect(PRE_CODE_GATES).toEqual(ORDERED_GATES.slice(0, ORDERED_GATES.indexOf(GateKind.ImplementationReview)));
    expect(PRE_CODE_GATES).toContain(GateKind.CostApproval);
    expect(PRE_CODE_GATES).toContain(GateKind.AdversarialReview);

    expect(churnThresholdFor(parseArgs([]))).toBeUndefined();
    expect(churnThresholdFor(parseArgs(["--churn"]))).toBe(2);
    expect(churnThresholdFor(parseArgs(["--churn-threshold", "8"]))).toBe(8);
    expect(churnThresholdFor(parseArgs(["--churn", "--churn-threshold", "8"]))).toBe(8);

    const slow = ["--git", ".", "--work-cmd", process.execPath, "--work-arg", "-e", "--work-arg", "setTimeout(() => {}, 4000)"];
    const item: CascadeNode = {
      workId: "task-1",
      workType: WorkTypeValue.Task,
      title: "a slow one",
      state: WorkState.Open,
      ownerHatId: "tech_lead",
      assigneeHatId: "backend_implementer",
    };

    // A budget SHORTER than the command: the port must be killed, and say so rather than pretend.
    const impatient = providersFromArgs(parseArgs([...slow, "--port-timeout-ms", "250"]), [], RunOutcome.Passed);
    const killed = await impatient.work.execute(item, { branch: "b" });
    expect(killed.ok).toBe(false);

    // A budget LONGER than the command, through the same flag: the identical command now finishes.
    // Same port, same argv, one number different — which is what makes this a test of the flag.
    const patient = providersFromArgs(parseArgs([...slow, "--port-timeout-ms", "60000"]), [], RunOutcome.Passed);
    const finished = await patient.work.execute(item, { branch: "b" });
    expect(finished.ok).toBe(true);
  });

  test("REPEATED --work-arg accumulates IN ORDER — these become argv for a real process", () => {
    // Taking only the last occurrence is the usual shortcut and it silently drops arguments the
    // operator wrote down; reversing them is a different command.
    expect(parseArgs(["--work-arg", "run", "--work-arg", "build"]).workArgs).toEqual(["run", "build"]);
    expect(parseArgs(["--work-arg", "build", "--work-arg", "run"]).workArgs).toEqual(["build", "run"]);
    // A trailing flag with nothing after it contributes nothing rather than an undefined argument.
    expect(parseArgs(["--work-arg"]).workArgs).toEqual([]);
    expect(parseArgs(["--test-arg", "-t"]).testArgs).toEqual(["-t"]);
  });

  test("--churn implies --qa-fails, since churn needs something to fail", () => {
    const a = parseArgs(["--churn"]);
    expect(a.churn).toBe(true);
    expect(a.qaFails).toBe(true);
  });

  test("unknown flags are ignored rather than fatal", () => {
    expect(parseArgs(["--nonsense"]).json).toBe(false);
  });
});

describe("the default run delivers", () => {
  test("exit 0, and the whole pipeline is visible in the output", async () => {
    const { code, out } = await capture([]);
    expect(code).toBe(0);
    expect(out).toContain("=== DELIVERED ===");
    // Every phase left a trace.
    expect(out).toContain("intake accepted");
    expect(out).toContain("accepted 'checkout double-charges");
    expect(out).toContain("owns initiative");
    expect(out).toContain("bound to");
    expect(out).toContain("the accountable chain met");
    expect(out).toContain("offered 1 item(s); picked");
    expect(out).toContain("approved and it merged");
    expect(out).toContain("qa_engineer: 1/1 passed");
    // DERIVED, not a literal. This line asserted "all 7 gates" while the chain held fourteen —
    // so the test was pinning the stale count rather than catching it, which is the shape of a
    // check that agrees with the defect. It now fails if either side drifts from the real chain.
    // Each item names its own chain now; "all 14" was true of nothing.
    expect(out).toContain("gate(s) this defect owes");
    expect(out).toContain("and is done");
    expect(out).toContain("DELIVERED");
  });

  test("the levels engaged run from the C-suite to the contributor", async () => {
    const { out } = await capture([]);
    expect(out).toContain("c_suite → director → manager → lead → individual_contributor");
  });

  test("the DUPLICATE and the INCOMPLETE report are both refused", async () => {
    const { out } = await capture([]);
    expect(out).toContain("duplicate");
    expect(out).toContain("missing_reproduction");
  });

  test("the status readout is printed", async () => {
    const { out } = await capture([]);
    expect(out).toContain("--- status ---");
    expect(out).toContain("whitewash:   threshold");
    expect(out).toContain("qa:");
    expect(out).toContain("queue:");
  });

  test("the dev's communication brief names all eight tools", async () => {
    const { out } = await capture([]);
    expect(out).toContain("communication brief");
    for (const tool of [
      "ask_question",
      "report_blocker",
      "request_decision",
      "request_resource",
      "request_review",
      "report_risk",
      "suggest_improvement",
      "request_escalation",
    ]) {
      expect(out).toContain(tool);
    }
  });
});

describe("THE CLI SUPPLIES THE HISTORY THE DELIVERY GUARD NEEDS", () => {
  // -- WHY THIS TEST IS HERE AND NOT IN real-adapters.test.ts ----------------
  // That file pins the done-with-nothing-merged rule from every angle -- and hands the runtime
  // `alreadyLanded` itself, in the test. `run-org` builds TWO dependency objects, and only the
  // `--week` one carried the field, so on every ordinary run it arrived undefined and the rule
  // skipped itself by its own "not measured is not a failure" clause. The runtime was covered; the
  // WIRING was not, and the wiring is what shipped.
  //
  // MEASURED 2026-09-10 against a real clone of a working repository: nothing merged, `main` never
  // moved, and the CLI printed `goal DELIVERED` with the disagreement logged beside it.

  function tinyRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), "zeta-cli-hist-"));
    const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf-8" });
    git("init", "-q", "-b", "main");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "T");
    writeFileSync(join(dir, "README.md"), "# checkout\n");
    git("add", "-A");
    git("commit", "-q", "-m", "init");
    return dir;
  }

  test("a run whose work never lands is NOT DELIVERED, and says why", async () => {
    const repo = tinyRepo();
    const store = mkdtempSync(join(tmpdir(), "zeta-cli-store-"));
    const wt = mkdtempSync(join(tmpdir(), "zeta-cli-wt-"));
    const lines: string[] = [];
    const log = console.log;
    console.log = (...a: unknown[]) => void lines.push(a.map(String).join(" "));
    try {
      // Real change control, simulated work -- so the cascade completes and the repository stays
      // exactly where it started. Whether that combination is USEFUL is beside the point; what
      // matters is that the two records disagree, which is the only condition this rule reads.
      const code = await main([
        "--git", repo, "--base", "main", "--worktrees", wt, "--store", store, "--until", "2",
      ]);

      const out = lines.join("\n");
      // NOTHING MERGED. The premise of the assertions below, checked against git rather than
      // assumed -- a test that asserted the verdict without checking the repository would pass
      // just as happily if the run HAD merged something.
      expect(
        execFileSync("git", ["log", "--merges", "--oneline", "main"], { cwd: repo, encoding: "utf-8" }).trim(),
      ).toBe("");

      // ...so the run must not claim delivery, and must name the reason.
      expect(code).toBe(1);
      expect(out).toContain("NOT DELIVERED");
      expect(out).toContain("no commit exists for it");
    } finally {
      console.log = log;
      rmSync(repo, { recursive: true, force: true });
      rmSync(store, { recursive: true, force: true });
      rmSync(wt, { recursive: true, force: true });
    }
  }, 180_000);

  test("...AND A RESUMED RUN OVER WORK THAT DID LAND STILL DELIVERS", async () => {
    // -- THE PAIR, AND THE HALF THAT IS EASY TO GET WRONG ----------------------
    // The test above pins the guard FIRING. This one pins it staying quiet, and it is the half a
    // careless fix breaks: supplying `new Set<string>()` instead of folding the log would satisfy
    // the test above exactly as well, and would then call every already-shipped item unlanded on
    // every resume -- a verdict that fires on healthy runs rather than broken ones.
    //
    // Same store, same repository, run twice. The only difference between the two runs is what the
    // log says, which is precisely the input under test.
    const repo = tinyRepo();
    const store = mkdtempSync(join(tmpdir(), "zeta-cli-store2-"));
    const wt = mkdtempSync(join(tmpdir(), "zeta-cli-wt2-"));
    const lines: string[] = [];
    const log = console.log;
    console.log = (...a: unknown[]) => void lines.push(a.map(String).join(" "));
    try {
      // Work that genuinely commits, onto the change's own branch in its own worktree. `-m` takes
      // the workId, which `argsFor` appends last.
      const argv = [
        "--git", repo, "--base", "main", "--worktrees", wt, "--store", store, "--until", "3",
        "--work-cmd", "git",
        "--work-arg", "commit", "--work-arg", "--allow-empty", "--work-arg", "-m",
      ];

      expect(await main(argv)).toBe(0);
      // IT REALLY MERGED. Asked of git, not of the run's own account of itself.
      const merges = execFileSync("git", ["log", "--merges", "--oneline", "main"], {
        cwd: repo, encoding: "utf-8",
      }).trim();
      expect(merges).not.toBe("");

      lines.length = 0;
      // Resume. The work is done and the commit is in git; the cascade opens no new change for it,
      // so the projection sits below `Merged` and only the LOG can say this was already shipped.
      expect(await main(argv)).toBe(0);
      const out = lines.join("\n");
      expect(out).toContain("DELIVERED");
      expect(out).not.toContain("no commit exists for it");

      // …and the repository is where the first run left it: a resume ships nothing twice.
      expect(
        execFileSync("git", ["log", "--merges", "--oneline", "main"], { cwd: repo, encoding: "utf-8" }).trim(),
      ).toBe(merges);
    } finally {
      console.log = log;
      rmSync(repo, { recursive: true, force: true });
      rmSync(store, { recursive: true, force: true });
      rmSync(wt, { recursive: true, force: true });
    }
  }, 180_000);
});

describe("the failure modes exit non-zero", () => {
  test("--qa-fails does not deliver", async () => {
    const { code, out } = await capture(["--qa-fails"]);
    expect(code).toBe(1);
    expect(out).toContain("=== NOT DELIVERED ===");
    expect(out).toContain("runtime_validation");
  });

  test("--churn escalates, and says what the escalation DID", async () => {
    const { code, out } = await capture(["--churn"]);
    expect(code).toBe(1);
    expect(out).toContain("escalated");
    expect(out).toContain("changes_the_input");
  });

  test("--cycle runs the delivery loop alone and delivers", async () => {
    const { code, out } = await capture(["--cycle"]);
    expect(code).toBe(0);
    expect(out).toContain("DELIVERED");
  });

  test("--json emits parseable JSON carrying the report", async () => {
    const { code, out } = await capture(["--json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(out) as { delivered: boolean; events: string[]; bindings: unknown[] };
    expect(parsed.delivered).toBe(true);
    expect(parsed.events.length).toBeGreaterThan(0);
    expect(parsed.bindings).toHaveLength(2);
  });
});

describe("--admin exercises the operator surface, refusals included", () => {
  test("every authority check is shown refusing where it should", async () => {
    const { out } = await capture(["--admin"]);
    expect(out).toContain("--- operator surface ---");
    // The refusals are the point: a surface that only demonstrates success has not shown what
    // makes it safe.
    expect(out).toContain("revoke by a stranger:   refused");
    expect(out).toContain("revoke by a supervisor: done");
    expect(out).toContain("approve an ACTIVE binding: refused");
    expect(out).toContain("heartbeat a finished claim: refused");
    expect(out).toContain("NaN → refused");
    expect(out).toContain("evidence ok: false");
    expect(out).toContain("missing_reproduction");
  });

  test("it shows the authority ladder differing by level", async () => {
    const { out } = await capture(["--admin"]);
    // A manager gets three verdicts; a director additionally gets `waived`.
    expect(out).toContain("a manager's gate verdicts:  approved, changes_requested, rejected");
    expect(out).toContain("a director's:              approved, changes_requested, rejected, waived");
    expect(out).toContain("a lead's priority options: (none");
    expect(out).toContain("a manager may set it: false");
  });

  test("the accountability chain is printed for real work", async () => {
    const { out } = await capture(["--admin"]);
    expect(out).toContain("--- accountability for");
    expect(out).toContain("chain:");
    expect(out).toContain("rung:      lead");
  });
});

describe("PROVIDERS ARE CHOSEN AT THE COMMAND LINE, and never fall back", () => {
  test("no flags means every port simulated — and the run is replayable", () => {
    const set = providersFromArgs(parseArgs([]), [], RunOutcome.Passed);
    const report = fidelityOf(set);
    expect(report.replayable).toBe(true);
    expect(report.realPorts).toEqual([]);
  });

  test("ONE flag makes ONE port real, and the others stay simulated", () => {
    // The property that matters: asking for a real inbox does not quietly upgrade anything else,
    // and it does not quietly downgrade the inbox either.
    const report = fidelityOf(providersFromArgs(parseArgs(["--inbox", "/tmp/in"]), [], RunOutcome.Passed));
    expect(report.realPorts).toEqual([Port.Intake]);
    expect(report.replayable).toBe(false);
  });

  test("every flag together makes every port real", () => {
    const args = parseArgs(["--inbox", "/tmp/in", "--work-cmd", "w", "--test-cmd", "t", "--git", "/tmp/repo"]);
    const report = fidelityOf(providersFromArgs(args, [], RunOutcome.Passed));
    expect([...report.realPorts].sort()).toEqual([Port.ChangeControl, Port.Intake, Port.TestExecution, Port.WorkExecution].sort());
  });

  test("the QA fallback reaches the SIMULATED runner, and is ignored by the real one", () => {
    // `--qa-fails` is a property of the simulation. Once a command runs the tests, the command's
    // exit code decides and a configured fallback would be a lie about what was observed.
    expect(providersFromArgs(parseArgs([]), [], RunOutcome.Failed).tests.meta.describes).toContain("failed");
    expect(providersFromArgs(parseArgs(["--test-cmd", "t"]), [], RunOutcome.Failed).tests.meta.describes).not.toContain("falling back");
  });

  test("--work-arg values become LEADING arguments; the work id is appended last", async () => {
    // Order is the whole point: `bun build.ts <workId>` and `bun <workId> build.ts` are different
    // commands, and the id has to be last so a script can read it positionally.
    const args = parseArgs(["--work-cmd", process.execPath, "--work-arg", "-e", "--work-arg", "process.exit(0)"]);
    const r = await providersFromArgs(args, [], RunOutcome.Passed).work.execute(
      { workId: "task-9", workType: WorkTypeValue.Task, title: "t", state: WorkState.Open, ownerHatId: "tech_lead" },
      { branch: "b" },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.artifacts).toEqual(["-e", "process.exit(0)", "task-9"]);
  });
});
