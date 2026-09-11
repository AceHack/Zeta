/**
 * org-cli.test.ts — the CLI an agent drives, end to end against an in-memory filesystem.
 *
 * The property that matters most is one a usage test never checks: EVERY COMMAND `describe`
 * ADVERTISES IS WIRED. A table entry with no handler teaches a driving agent to call something
 * inert, and it finds out at run time against a real organization. That is asserted here by running
 * every declared command and requiring none of them to answer "declared but not wired".
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMMANDS, Exit } from "./cli-surface";
import { main, PLANNED, type CliDeps } from "./org-cli";
import { buildOrgChart } from "./org-chart";
import { Autonomy, Intake, runReadinessOf, SourceKind, validateOrg, type OrgRecord } from "./org-registry";
import { basePolicy } from "./org-policy";
import { SEED_HATS } from "./org-seed";

const built = buildOrgChart(SEED_HATS);
if (!built.ok) throw new Error(built.reason);
const CHART = built.chart;

const REG = "/reg/registry.json";

interface Harness {
  readonly deps: CliDeps;
  readonly files: Map<string, string>;
  readonly stdout: string[];
  readonly stderr: string[];
}

let seq = 0;

function harness(files: Record<string, string> = {}): Harness {
  const map = new Map(Object.entries(files));
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    files: map,
    stdout,
    stderr,
    deps: {
      readFile: (p) => map.get(p),
      writeFile: (p, c) => void map.set(p, c),
      out: (l) => void stdout.push(l),
      err: (l) => void stderr.push(l),
      registryPath: REG,
      nowMs: 1_700_000_000_000,
      // Pinned, not read from the real environment: a test that picked up the developer's
      // USERNAME would pass on their machine and fail in CI, and the failure would look like a
      // defect in the code rather than in the test.
      env: { ORG_OPERATOR: "max" },
      // Deterministic ids, so an assertion can name one. Uniqueness is what the queue needs and
      // a counter supplies it within a single process.
      newId: (prefix) => `${prefix}-${String(++seq)}`,
      // The seed chart, so the raise-derivation asks a real organization who could author and
      // approve a gate. A stub chart would answer "nobody" for every gate and manufacture a
      // staffing gap in every test.
      chart: CHART,
    },
  };
}

// A REAL TEMP DIRECTORY, NOT A FAKE ABSOLUTE PATH.
//
// This used to be the literal `/store/elera`, on the reasonable assumption that the harness's
// injected `deps` (readFile/writeFile over an in-memory Map) meant nothing reached disk. It does
// not hold: `main` is only HALF injected. It reads and writes the registry through `deps`, and
// then calls `appendAction` and `appendEvent`, which are real-filesystem modules by design --
// `action-queue.ts` uses `mkdirSync`/`readdirSync` throughout, and its own tests correctly use
// temp dirs. So the store path reached `node:fs` unmediated.
//
// The consequence was a LOCAL/CI SPLIT, which is the expensive kind of test defect: a Linux CI
// runner happily creates `/store`, so six tests passed there, while macOS's read-only root
// answers `EROFS: read-only file system, mkdir '/store'` and the same six fail on a developer's
// machine. A test whose verdict depends on which operating system ran it is not reporting on the
// code.
//
// The harness's own comment, twenty lines below, states the exact principle this violated: a test
// that picks up something from the real environment "would pass on their machine and fail in CI,
// and the failure would look like a defect in the code rather than in the test." That was written
// about `env`; the same class escaped through `fs`.
const STORE_ROOT = mkdtempSync(join(tmpdir(), "org-cli-store-"));

const CREATE = [
  "org", "create",
  "--id", "elera", "--name", "ELERA Core", "--store", join(STORE_ROOT, "elera"),
  "--intake", "greenfield", "--verification", "existing_harness",
];

describe("A METHOD MUST NAME A VERB THAT EXISTS, AND A REASON", () => {
  const bind = async (h: Harness, kind: string, why: string) =>
    main(
      ["org", "method", "bind", "--org", "elera", "--kind", kind, "--skill", "requirement-grilling", "--why", why],
      h.deps,
    );

  test("a real verb with a reason binds", async () => {
    const h = harness();
    await main(CREATE, h.deps);
    expect(await bind(h, "request_information", "a shallow question gets a shallow answer")).toBe(Exit.Ok);
  });

  test("a MISSPELLED verb is refused, not stored", async () => {
    // A method attached to a verb that does not exist is offered to nobody and reports itself as
    // configured — the vacuity class, entered through a typo. Caught here or discovered never.
    const h = harness();
    await main(CREATE, h.deps);
    expect(await bind(h, "reqest_information", "because")).toBe(Exit.NotFound);
    expect(h.stderr.join("")).toContain("reqest_information");
  });

  test("a method with NO REASON is refused", async () => {
    // A method with no reason is an instruction: an agent handed one cannot tell whether it still
    // applies to what it is doing, so it follows it because it arrived.
    const h = harness();
    await main(CREATE, h.deps);
    expect(await bind(h, "request_information", "")).toBe(Exit.Usage);
    expect(h.stderr.join("")).toContain("instruction");
  });

  test("an org that bound nothing reports the DEFAULTS in force, and says they are defaults", async () => {
    // This asserted "the way it always was" until the register grew defaults, and that message is
    // now false: an organization that configured nothing IS interviewing its requirements. A
    // listing that describes the configuration file rather than the running system is the same
    // class of defect as a metric that disagrees with what it counts.
    const h = harness();
    await main(CREATE, h.deps);
    h.stdout.length = 0;
    expect(await main(["org", "method", "list", "--org", "elera"], h.deps)).toBe(Exit.Ok);
    const out = h.stdout.join("");
    expect(out).toContain("requirement-grilling");
    expect(out).toContain("(default)");
    expect(out).toContain("nothing was bound");
  });

  test("a declined method disappears from what is in force, with its reason kept", async () => {
    const h = harness();
    await main(CREATE, h.deps);
    expect(
      await main(
        ["org", "method", "unbind", "--org", "elera", "--kind", "request_information", "--why", "our BAs run intake their own way"],
        h.deps,
      ),
    ).toBe(Exit.Ok);
    h.stdout.length = 0;
    await main(["org", "method", "list", "--org", "elera", "--json"], h.deps);
    const v = JSON.parse(h.stdout.join("")) as {
      inForce: { kind: string }[];
      configured: { kind: string; skillId: string; why: string }[];
    };
    expect(v.inForce.some((m) => m.kind === "request_information")).toBe(false);
    // The DECISION is still on the record, with why — declining is not the same as never deciding.
    const declined = v.configured.find((m) => m.kind === "request_information");
    expect(declined?.skillId).toBe("");
    expect(declined?.why).toContain("their own way");
  });

  test("declining without a reason is refused", async () => {
    const h = harness();
    await main(CREATE, h.deps);
    expect(
      await main(["org", "method", "unbind", "--org", "elera", "--kind", "request_information", "--why", ""], h.deps),
    ).toBe(Exit.Usage);
  });
});

describe("every advertised command is wired", () => {
  test("NO DECLARED COMMAND ANSWERS 'declared but not wired'", async () => {
    for (const c of COMMANDS) {
      const h = harness();
      // Minimum viable invocation: required flags get a plausible value from their spec.
      const argv = [...c.name.split(" ")];
      for (const f of c.flags) {
        if (f.required !== true) continue;
        argv.push(f.name);
        if (f.takesValue === true) argv.push(f.oneOf?.[0] ?? "x");
      }
      await main(argv, h.deps);
      expect(h.stderr.join(" ")).not.toContain("declared but not wired");
    }
  });

  test("the planned list and the advertised table do not overlap", () => {
    // A command cannot be both "coming later" and offered to an agent today.
    const advertised = new Set(COMMANDS.map((c) => c.name));
    for (const p of PLANNED) expect(advertised.has(p)).toBe(false);
  });
});

describe("discovery", () => {
  test("describe --json lists commands and exit codes", async () => {
    const h = harness();
    const code = await main(["describe", "--json"], h.deps);
    expect(code).toBe(Exit.Ok);
    const parsed = JSON.parse(h.stdout.join("")) as { commands: unknown[]; exitCodes: Record<string, number> };
    expect(parsed.commands.length).toBe(COMMANDS.length);
    expect(parsed.exitCodes.refused).toBe(Exit.Refused);
  });

  test("no arguments prints help rather than failing", async () => {
    const h = harness();
    expect(await main([], h.deps)).toBe(Exit.Ok);
    expect(h.stdout.join("")).toContain("org create");
  });

  test("an unknown command is a USAGE error, not a crash", async () => {
    const h = harness();
    expect(await main(["deploy"], h.deps)).toBe(Exit.Usage);
    expect(h.stderr.join("")).toContain("unknown command");
  });

  test("a mistyped flag is a usage error and names the accepted flags", async () => {
    const h = harness();
    expect(await main(["demand", "--reworks"], h.deps)).toBe(Exit.Usage);
    expect(h.stderr.join("")).toContain("--rework");
  });
});

describe("configuring an organization", () => {
  test("create writes a registry and reports the id", async () => {
    const h = harness();
    expect(await main([...CREATE, "--json"], h.deps)).toBe(Exit.Ok);
    expect(h.files.has(REG)).toBe(true);
    expect(JSON.parse(h.stdout.join("")).created).toBe("elera");
  });

  test("A MISSING REGISTRY IS AN EMPTY ONE — the first command is not 'init'", async () => {
    const h = harness();
    expect(await main(["org", "list", "--json"], h.deps)).toBe(Exit.Ok);
    expect(JSON.parse(h.stdout.join("")).orgs).toEqual([]);
  });

  test("a MALFORMED registry is refused rather than silently replaced", async () => {
    // Starting over would discard configuration somebody wrote.
    const h = harness({ [REG]: "{ not json" });
    expect(await main(["org", "list"], h.deps)).toBe(Exit.Usage);
    expect(h.stderr.join("")).toContain("not valid JSON");
  });

  test("creating the same id twice is REFUSED, not overwritten", async () => {
    const h = harness();
    await main(CREATE, h.deps);
    expect(await main(CREATE, h.deps)).toBe(Exit.Refused);
    expect(h.stderr.join("")).toContain("already exists");
  });

  test("an org with no verification approach cannot be created", async () => {
    const h = harness();
    const code = await main(
      ["org", "create", "--id", "x", "--name", "X", "--store", "/s", "--intake", "greenfield"],
      h.deps,
    );
    expect(code).toBe(Exit.Usage);
    expect(h.stderr.join("")).toContain("--verification");
  });

  test("a source-synced org with no sources is CREATED, and refused only when asked to run", () => {
    // THE REFUSAL MOVED, DELIBERATELY. `validateOrg` used to reject this on every write, which made
    // it impossible to reach: `org create --intake source_synced` is the step BEFORE `org source
    // add`, so the only way to have an org with sources was to have an org with sources already.
    // Guided setup could never walk anybody from one state to the other.
    //
    // Being half-configured is the normal state of something a person is still configuring; being
    // half-configured and asked to WORK is the mistake. So the check lives at the point of running,
    // where "would read an empty backlog forever" is actually true.
    const half: OrgRecord = {
      orgId: "x", name: "X", storeDir: "/s",
      intake: Intake.SourceSynced, autonomy: Autonomy.Directed,
      policy: basePolicy("x", "existing_harness"),
      sources: [], humanCheckpoints: [], skills: [], createdAtMs: 1,
    };
    expect(validateOrg(half).ok).toBe(true);

    const ready = runReadinessOf(half);
    expect(ready.ok).toBe(false);
    if (!ready.ok) {
      expect(ready.reason).toContain("empty backlog");
      // And it says what to do about it, naming the org, because a refusal that does not is a wall.
      expect(ready.reason).toContain("org source add");
      expect(ready.reason).toContain("x");
    }

    // Connect one and it is ready — the same record, one step later.
    expect(runReadinessOf({ ...half, sources: [{ kind: SourceKind.Linear, id: "linear-eng", location: "https://api.linear.app/graphql" }] }).ok).toBe(true);
  });

  test("the CLI really does accept the half-configured create", async () => {
    // The rule above is only true if the command agrees with it.
    const h = harness();
    const code = await main(
      ["org", "create", "--id", "x", "--name", "X", "--store", "/s",
       "--intake", "source_synced", "--verification", "existing_harness"],
      h.deps,
    );
    expect(code).toBe(Exit.Ok);
    // …and the guided plan then names connecting a source as the next required thing, which is the
    // whole point of letting the creation through.
    h.stdout.length = 0;
    await main(["org", "configure", "--org", "x", "--json"], h.deps);
    const plan = JSON.parse(h.stdout.join("")) as { complete: boolean; next?: { step: string } };
    expect(plan.complete).toBe(false);
    expect(plan.next?.step).toBe("connect_sources");
  });

  test("list shows what was created", async () => {
    const h = harness();
    await main(CREATE, h.deps);
    h.stdout.length = 0;
    await main(["org", "list", "--json"], h.deps);
    const orgs = JSON.parse(h.stdout.join("")).orgs as { orgId: string; verification: string }[];
    expect(orgs).toHaveLength(1);
    expect(orgs[0]?.orgId).toBe("elera");
    expect(orgs[0]?.verification).toBe("existing_harness");
  });
});

describe("sources are paths to credentials, never credentials", () => {
  async function withOrg(): Promise<Harness> {
    const h = harness();
    await main(CREATE, h.deps);
    h.stdout.length = 0;
    return h;
  }

  test("a source with an auth FILE is accepted", async () => {
    const h = await withOrg();
    const code = await main(
      ["org", "source", "add", "--kind", "jira", "--source-id", "j",
       "--location", "https://jira.example", "--auth-file", "/secrets/.jiraauth", "--json"],
      h.deps,
    );
    expect(code).toBe(Exit.Ok);
    expect(h.files.get(REG)).toContain("/secrets/.jiraauth");
  });

  test("A BARE TOKEN IN --auth-file IS REFUSED", async () => {
    // The field is a path. A value here reaches disk and every process listing, and nobody notices
    // a working token sitting in a config file.
    const h = await withOrg();
    const code = await main(
      ["org", "source", "add", "--kind", "jira", "--source-id", "j",
       "--location", "https://jira.example",
       "--auth-file", "ATATT3xFfGF0abcdefghijklmnopqrstuvwxyz012345"],
      h.deps,
    );
    expect(code).toBe(Exit.Refused);
    expect(h.stderr.join("")).toContain("CREDENTIAL");
  });

  test("credentials embedded in a location URL are refused", async () => {
    const h = await withOrg();
    const code = await main(
      ["org", "source", "add", "--kind", "jira", "--source-id", "j",
       "--location", "https://user:s3cr3t@jira.example"],
      h.deps,
    );
    expect(code).toBe(Exit.Refused);
  });

  test("two sources with the same id are refused", async () => {
    const h = await withOrg();
    const args = ["org", "source", "add", "--kind", "git", "--source-id", "repo", "--location", "/repo"];
    await main(args, h.deps);
    expect(await main(args, h.deps)).toBe(Exit.Refused);
  });

  test("adding a source to an unknown org is NOT FOUND, not refused", async () => {
    const h = await withOrg();
    const code = await main(
      ["org", "source", "add", "--org", "nope", "--kind", "git",
       "--source-id", "r", "--location", "/r"],
      h.deps,
    );
    expect(code).toBe(Exit.NotFound);
  });

  test("--select is repeatable and every value is kept", async () => {
    const h = await withOrg();
    await main(
      ["org", "source", "add", "--kind", "jira", "--source-id", "j",
       "--location", "https://jira.example",
       "--select", "project = ELERA", "--select", "project = PAY", "--json"],
      h.deps,
    );
    const written = h.files.get(REG) ?? "";
    expect(written).toContain("project = ELERA");
    expect(written).toContain("project = PAY");
  });
});

describe("reading an organization that has no store yet", () => {
  test("demand on an empty store is OK and empty, not an error", async () => {
    const h = harness();
    await main(CREATE, h.deps);
    h.stdout.length = 0;
    const code = await main(["demand", "--json"], h.deps);
    expect(code).toBe(Exit.Ok);
    const parsed = JSON.parse(h.stdout.join("")) as { ready: unknown[]; blocked: unknown[] };
    expect(parsed.ready).toEqual([]);
    expect(parsed.blocked).toEqual([]);
  });

  test("task on a work item that does not exist is NOT FOUND", async () => {
    const h = harness();
    await main(CREATE, h.deps);
    expect(await main(["task", "--work", "NOPE-1"], h.deps)).toBe(Exit.NotFound);
  });

  test("a command needing an org says so when none is configured", async () => {
    const h = harness();
    expect(await main(["demand"], h.deps)).toBe(Exit.NotFound);
    expect(h.stderr.join("")).toContain("org create");
  });

  test("with several orgs, --org becomes required and the choices are listed", async () => {
    const h = harness();
    await main(CREATE, h.deps);
    await main(
      ["org", "create", "--id", "pay", "--name", "Payments", "--store", "/store/pay",
       "--intake", "greenfield", "--verification", "authored_scripts"],
      h.deps,
    );
    h.stderr.length = 0;
    expect(await main(["demand"], h.deps)).toBe(Exit.NotFound);
    expect(h.stderr.join("")).toContain("elera");
    expect(h.stderr.join("")).toContain("pay");
  });

  test("with exactly one org, --org is unnecessary", async () => {
    const h = harness();
    await main(CREATE, h.deps);
    expect(await main(["demand"], h.deps)).toBe(Exit.Ok);
  });
});

describe("the human write path queues a request rather than writing state", () => {
  async function withOrg(): Promise<Harness> {
    const h = harness();
    await main(CREATE, h.deps);
    h.stdout.length = 0;
    return h;
  }

  test("approve on a work item that does not exist is NOT FOUND, and queues nothing", async () => {
    // Otherwise a typo'd id sits in the queue forever looking like a decision somebody made.
    const h = await withOrg();
    const code = await main(
      ["approve", "--work", "NOPE-1", "--gate", "brd_approval", "--reason", "looks right"],
      h.deps,
    );
    expect(code).toBe(Exit.NotFound);
  });

  test("goal needs no existing work item — it is how work STARTS", async () => {
    const h = await withOrg();
    const code = await main(
      ["goal", "--title", "Declines never happen silently", "--reason", "customers churn", "--json"],
      h.deps,
    );
    expect(code).toBe(Exit.Ok);
    const queued = JSON.parse(h.stdout.join("")).queued as { kind: string; byHuman: string };
    expect(queued.kind).toBe("submit_goal");
    expect(queued.byHuman).toBe("max");
  });

  test("A MISSING REASON IS REFUSED — an unexplainable action is the one review needs most", async () => {
    const h = await withOrg();
    const code = await main(["goal", "--title", "something"], h.deps);
    expect(code).toBe(Exit.Usage);
    expect(h.stderr.join("")).toContain("--reason");
  });

  test("--as names the actor, overriding the environment", async () => {
    const h = await withOrg();
    await main(
      ["goal", "--title", "t", "--reason", "r", "--as", "alexa", "--json"],
      h.deps,
    );
    expect(JSON.parse(h.stdout.join("")).queued.byHuman).toBe("alexa");
  });

  test("AN ORG WITH NO CHECKPOINTS AND NOTHING RAISED HAS AN EMPTY INBOX", async () => {
    // The property the broken version could never produce: it listed every ready step, so it was
    // incapable of saying "nothing is waiting on you".
    const h = await withOrg();
    const code = await main(["inbox", "--json"], h.deps);
    expect(code).toBe(Exit.Ok);
    const view = JSON.parse(h.stdout.join("")) as { asked: unknown[]; checkpoint: unknown[] };
    expect(view.asked).toEqual([]);
    expect(view.checkpoint).toEqual([]);
  });

  test("a checkpoint is CONFIGURED at creation and survives into the record", async () => {
    const h = harness();
    await main([...CREATE, "--checkpoint", "grooming", "--checkpoint", "approach"], h.deps);
    h.stdout.length = 0;
    await main(["org", "list", "--json"], h.deps);
    expect(h.files.get(REG)).toContain("grooming");
    expect(h.files.get(REG)).toContain("approach");
  });

  test("an unknown checkpoint is refused with the legal values", async () => {
    const h = harness();
    const code = await main([...CREATE, "--checkpoint", "vibes"], h.deps);
    expect(code).toBe(Exit.Usage);
    expect(h.stderr.join("")).toContain("grooming");
  });
});

describe("skills are OPTIONAL configuration, defaulting to the repo", () => {
  async function withOrg(): Promise<Harness> {
    const h = harness();
    await main(CREATE, h.deps);
    h.stdout.length = 0;
    return h;
  }

  test("A NEW ORG BINDS NOTHING and every gate still resolves", async () => {
    const h = await withOrg();
    const code = await main(["org", "skill", "list", "--json"], h.deps);
    expect(code).toBe(Exit.Ok);
    const v = JSON.parse(h.stdout.join("")) as { bound: unknown[]; resolved: { bound: boolean }[] };
    // The organization has configured nothing — that half is unchanged.
    expect(v.bound).toEqual([]);
    // …and it is still not in a degraded state: some gates carry the register's own method, the
    // rest fall back to the repo, and NOTHING is unresolved.
    expect(v.resolved.length).toBeGreaterThan(0);
    expect(v.resolved.some((r) => r.bound)).toBe(true);
    expect(v.resolved.some((r) => !r.bound)).toBe(true);
  });

  test("binding a gate changes only that gate", async () => {
    const h = await withOrg();
    await main(
      ["org", "skill", "bind", "--gate", "qa_uat", "--skill", "house-qa", "--source", "repo"],
      h.deps,
    );
    h.stdout.length = 0;
    await main(["org", "skill", "list", "--json"], h.deps);
    const v = JSON.parse(h.stdout.join("")) as { resolved: { gate: string; bound: boolean }[] };
    expect(v.resolved.find((r) => r.gate === "qa_uat")?.bound).toBe(true);
    // ONLY THAT GATE CHANGED. Counted as a DELTA against the unconfigured organization rather than
    // against zero, because the register now defaults three gates and an absolute count would fail
    // for a reason that has nothing to do with what this test is about.
    const before = (await (async () => {
      const clean = await withOrg();
      await main(["org", "skill", "list", "--json"], clean.deps);
      return JSON.parse(clean.stdout.join("")) as { resolved: { bound: boolean }[] };
    })()).resolved.filter((r) => r.bound).length;
    expect(v.resolved.filter((r) => r.bound)).toHaveLength(before + 1);
  });

  test("A MARKETPLACE SKILL WITHOUT A MARKETPLACE IS REFUSED", async () => {
    const h = await withOrg();
    const code = await main(
      ["org", "skill", "bind", "--gate", "qa_uat", "--skill", "pro-qa", "--source", "marketplace"],
      h.deps,
    );
    expect(code).toBe(Exit.Refused);
    expect(h.stderr.join("")).toContain("marketplace");
  });

  test("a per-project binding overrides the org-wide one for that item only", async () => {
    const h = await withOrg();
    await main(["org", "skill", "bind", "--gate", "qa_uat", "--skill", "house-qa", "--source", "repo"], h.deps);
    await main(
      ["org", "skill", "bind", "--gate", "qa_uat", "--skill", "pay-qa", "--source", "repo", "--for", "EPIC-1"],
      h.deps,
    );
    h.stdout.length = 0;
    await main(["org", "skill", "list", "--for", "EPIC-1", "--json"], h.deps);
    const inScope = JSON.parse(h.stdout.join("")) as { resolved: { gate: string; skill: string }[] };
    expect(inScope.resolved.find((r) => r.gate === "qa_uat")?.skill).toBe("pay-qa");

    h.stdout.length = 0;
    await main(["org", "skill", "list", "--for", "EPIC-OTHER", "--json"], h.deps);
    const outOfScope = JSON.parse(h.stdout.join("")) as { resolved: { gate: string; skill: string }[] };
    expect(outOfScope.resolved.find((r) => r.gate === "qa_uat")?.skill).toBe("house-qa");
  });

  test("binding the same gate twice at the same scope is refused", async () => {
    const h = await withOrg();
    const args = ["org", "skill", "bind", "--gate", "qa_uat", "--skill", "a", "--source", "repo"];
    await main(args, h.deps);
    expect(await main(args, h.deps)).toBe(Exit.Refused);
  });

  test("THE HUMAN RENDER TELLS THE THREE STATES APART", async () => {
    // Every other test here reads --json, and the text render drifted behind it unnoticed: on a
    // freshly created organization it printed "0 binding(s)" as the header of a THREE-ROW list,
    // and credited each of those rows to "(repo)" for a skill the REGISTER supplied. Both halves
    // are asserted, because the header and the rows drifted independently.
    const h = await withOrg();
    await main(["org", "skill", "list"], h.deps);
    const out = h.stdout.join("");

    // A default is labelled a default -- not "(repo)", which names a place it did not come from.
    expect(out).toContain("business_context_grooming");
    expect(out).toContain("(default)");
    expect(out).not.toContain("(repo)");

    // …and the header agrees with the rows beneath it. Counting the defaults as "bound here"
    // reports a choice nobody made; counting them as unresolved contradicts the list.
    expect(out).toContain("0 bound here");
    expect(out).toContain("3 by default");
  });

  test("a gate bound BY HAND is not reported as a default", async () => {
    // The other direction. A render that labelled every row "(default)" would pass the test above
    // while erasing the distinction it exists to draw.
    const h = await withOrg();
    await main(["org", "skill", "bind", "--gate", "qa_uat", "--skill", "house-qa", "--source", "repo"], h.deps);
    h.stdout.length = 0;
    await main(["org", "skill", "list"], h.deps);
    const out = h.stdout.join("");
    expect(out).toContain("qa_uat  house-qa  (repo)");
    expect(out).toContain("1 bound here");
  });

  test("every resolution explains itself, bound or not", async () => {
    const h = await withOrg();
    await main(["org", "skill", "list", "--json"], h.deps);
    const v = JSON.parse(h.stdout.join("")) as { resolved: { because: string }[] };
    expect(v.resolved.every((r) => r.because.length > 15)).toBe(true);
  });
});

describe("the guided walkthrough is a resumable conversation", () => {
  test("with nothing configured it says how to start, rather than refusing", async () => {
    // The one command that must work with no org. Refusing here would leave a person with
    // nothing to run first.
    const h = harness();
    const code = await main(["org", "configure", "--json"], h.deps);
    expect(code).toBe(Exit.Ok);
    const p = JSON.parse(h.stdout.join("")) as { complete: boolean; next: { command: string } };
    expect(p.complete).toBe(false);
    expect(p.next.command).toContain("org create");
  });

  test("A STATED GOAL SATISFIES THE WORK STEP IMMEDIATELY", async () => {
    // The organization has not run, so no cascade node exists for some minutes. Counting only
    // nodes asked for a goal again seconds after one was given, and invited a duplicate.
    const h = harness();
    await main(CREATE, h.deps);
    await main(["goal", "--title", "no silent declines", "--reason", "churn"], h.deps);
    h.stdout.length = 0;
    await main(["org", "configure", "--json"], h.deps);
    const p = JSON.parse(h.stdout.join("")) as { complete: boolean; optional: { step: string }[] };
    expect(p.complete).toBe(true);
    // And the optional steps are still offered — configured is not the same as fully set up.
    expect(p.optional.map((o) => o.step)).toContain("bind_skills");
  });

  test("binding a skill stops it being offered", async () => {
    const h = harness();
    await main(CREATE, h.deps);
    await main(["goal", "--title", "t", "--reason", "r"], h.deps);
    await main(["org", "skill", "bind", "--gate", "qa_uat", "--skill", "q", "--source", "repo"], h.deps);
    h.stdout.length = 0;
    await main(["org", "configure", "--json"], h.deps);
    const p = JSON.parse(h.stdout.join("")) as { optional: { step: string }[] };
    expect(p.optional.map((o) => o.step)).not.toContain("bind_skills");
  });

  test("a source-synced org is walked to its sources first", async () => {
    const h = harness();
    await main(
      ["org", "create", "--id", "sync", "--name", "S", "--store", "/s",
       "--intake", "source_synced", "--verification", "existing_harness"],
      h.deps,
    );
    // Refused at creation with no sources, so configure still reports nothing configured.
    h.stdout.length = 0;
    await main(["org", "configure", "--json"], h.deps);
    const p = JSON.parse(h.stdout.join("")) as { complete: boolean };
    expect(p.complete).toBe(false);
  });
});

describe("A CHECKPOINT IS A NAME OR A GATE, and anything else is refused", () => {
  // The two names stop at brd_approval and architecture_approval, which a defect owes neither of,
  // and the parsers dropped every other value - so asking for a defect sign-off asked for nothing.
  const org = (humanCheckpoints: readonly string[]): OrgRecord =>
    ({
      orgId: "x", name: "X", storeDir: "/s",
      intake: Intake.SourceSynced, autonomy: Autonomy.Directed,
      policy: basePolicy("x", "existing_harness"),
      sources: [], humanCheckpoints, skills: [], createdAtMs: 1,
    }) as unknown as OrgRecord;

  test("a gate is accepted as a checkpoint, alongside the names", () => {
    expect(validateOrg(org(["approach", "release_readiness"])).ok).toBe(true);
  });

  test("a value that is neither is refused, naming what would be accepted", () => {
    const r = validateOrg(org(["release-readiness"]));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain("release-readiness");
      expect(r.reason).toContain("release_readiness");
    }
  });
});

describe("HOW A MERGE REQUEST IS WRITTEN IS STATED, AND ONLY WHAT CAN MEAN SOMETHING IS STORED", () => {
  const set = (h: Harness, extra: readonly string[]) =>
    main(["org", "change-requests", "set", "--org", "elera", ...extra], h.deps);

  test("sections, keep-out patterns and a sync method are stored in order and shown back", async () => {
    const h = harness();
    await main(CREATE, h.deps);
    const code = await set(h, [
      "--section", "Problem statement=what the reporter saw",
      "--section", "Root cause=why it happened",
      "--keep-out", "*.png",
      "--sync", "merge_target",
      "--replies", "reply_and_resolve",
      "--after-open", "comment=aireview",
      "--after-update", "comment=aireview",
      "--review-rounds", "6",
      "--pipelines", "until_green",
      "--why", "reviewers read the problem first",
    ]);
    expect(code).toBe(Exit.Ok);
    const saved = JSON.parse(h.files.get(REG) ?? "{}") as { orgs: { changeRequests?: { sections: { heading: string }[]; sync: string; replies?: string; pipelines?: string } }[] };
    expect(saved.orgs[0]?.changeRequests?.sections.map((s) => s.heading)).toEqual(["Problem statement", "Root cause"]);
    expect(saved.orgs[0]?.changeRequests?.sync).toBe("merge_target");
    expect(saved.orgs[0]?.changeRequests?.replies).toBe("reply_and_resolve");
    h.stdout.length = 0;
    expect(await main(["org", "change-requests", "show", "--org", "elera"], h.deps)).toBe(Exit.Ok);
    expect(h.stdout.join("")).toContain("## Root cause");
    expect(h.stdout.join("")).toContain("reviewers' comments: reply_and_resolve");
    expect(h.stdout.join("")).toContain("after each fix is pushed: comment 'aireview' (up to 6 rounds, then a person decides)");
    expect(saved.orgs[0]?.changeRequests?.pipelines).toBe("until_green");
  });

  test("a section with no statement, an unknown sync method, rebasing, or no answer about replies is refused and nothing is written", async () => {
    const h = harness();
    await main(CREATE, h.deps);
    const before = h.files.get(REG);
    const replies = ["--replies", "reply", "--after-open", "none", "--after-update", "none", "--pipelines", "flag_only"];
    expect(await set(h, ["--section", "Root cause", "--sync", "merge_target", ...replies, "--why", "w"])).toBe(Exit.Usage);
    expect(await set(h, ["--section", "Root cause=why", "--sync", "rebase", ...replies, "--why", "w"])).toBe(Exit.Usage);
    expect(await set(h, ["--section", "Root cause= ", "--sync", "merge_target", ...replies, "--why", "w"])).toBe(Exit.Refused);
    // Whether a reviewer is answered is asked, never defaulted - and only a known answer is kept.
    expect(await set(h, ["--section", "Root cause=why", "--sync", "merge_target", "--why", "w"])).toBe(Exit.Usage);
    expect(await set(h, ["--section", "Root cause=why", "--sync", "merge_target", "--replies", "sometimes", "--why", "w"])).toBe(Exit.Usage);
    // And what a red pipeline means is asked the same way: not stated is refused, not read as "none".
    expect(await set(h, ["--section", "Root cause=why", "--sync", "merge_target", "--replies", "reply", "--after-open", "none", "--after-update", "none", "--why", "w"])).toBe(Exit.Usage);
    expect(await set(h, ["--section", "Root cause=why", "--sync", "merge_target", ...replies.slice(0, 6), "--pipelines", "eventually", "--why", "w"])).toBe(Exit.Usage);
    expect(h.files.get(REG)).toBe(before);
  });
});

describe("HOW A RUN STARTS IS STATED WITH THE ORGANIZATION, NEVER A CREDENTIAL", () => {
  const profileFile = "/cfg/tpm.json";
  const setProfile = (h: Harness, body: unknown, why = "comments should not wait for a person") => {
    h.files.set(profileFile, JSON.stringify(body));
    return main(["org", "run-profile", "set", "--org", "elera", "--name", "agentic-tpm", "--from", profileFile, "--why", why], h.deps);
  };
  const args = ["--org", "elera", "--store", "/s/tpm", "--git", "/r/tpm"];

  test("a profile is stored and listed back, its environment by key only", async () => {
    const h = harness();
    await main(CREATE, h.deps);
    expect(await setProfile(h, { args, env: { VERIFY_STEPS: "[]" }, everyMinutes: 5, maxRunMinutes: 720 })).toBe(Exit.Ok);
    const saved = JSON.parse(h.files.get(REG) ?? "{}") as { orgs: { runProfiles?: { name: string; everyMinutes: number }[] }[] };
    expect(saved.orgs[0]?.runProfiles?.map((p) => [p.name, p.everyMinutes])).toEqual([["agentic-tpm", 5]]);
    h.stdout.length = 0;
    expect(await main(["org", "run-profile", "list", "--org", "elera"], h.deps)).toBe(Exit.Ok);
    expect(h.stdout.join("")).toContain("agentic-tpm: every 5 min");
  });

  test("a secret in the environment, a missing store, or another organization is refused and nothing is written", async () => {
    const h = harness();
    await main(CREATE, h.deps);
    const before = h.files.get(REG);
    expect(await setProfile(h, { args, env: { GITLAB_TOKEN: "glpat-secret" }, everyMinutes: 5, maxRunMinutes: 60 })).toBe(Exit.Refused);
    expect(await setProfile(h, { args: ["--org", "elera"], env: {}, everyMinutes: 5, maxRunMinutes: 60 })).toBe(Exit.Refused);
    expect(await setProfile(h, { args: ["--org", "other", "--store", "/s"], env: {}, everyMinutes: 5, maxRunMinutes: 60 })).toBe(Exit.Refused);
    expect(h.files.get(REG)).toBe(before);
  });
});
