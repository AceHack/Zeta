/**
 * cli-surface.test.ts — falsifiers for a CLI a machine can drive.
 *
 * The failures that matter here are the quiet ones. A mistyped flag that is IGNORED gives an agent
 * an answer to a different question than it asked, with no way to notice. A `describe` output that
 * drifts from the parser teaches an agent commands that do not exist. Both are pinned below, along
 * with the exit-code contract an agent branches on before it parses anything.
 */

import { describe, expect, test } from "bun:test";
import {
  COMMANDS,
  commandByName,
  commandNames,
  Exit,
  flagValue,
  flagValues,
  hasFlag,
  helpText,
  matchCommand,
  parseFlags,
  surfaceJson,
} from "./cli-surface";

describe("the surface is discoverable, and cannot drift from the parser", () => {
  test("describe emits every command the parser knows", () => {
    const parsed = JSON.parse(surfaceJson()) as { commands: { name: string }[] };
    expect(parsed.commands.map((c) => c.name).sort()).toEqual(COMMANDS.map((c) => c.name).sort());
  });

  test("EVERY DESCRIBED COMMAND ACTUALLY MATCHES — no command exists only on paper", () => {
    // The drift failure. A described command the parser cannot match teaches an agent to call
    // something that does not exist, and it finds out at run time.
    for (const c of COMMANDS) {
      const m = matchCommand(c.name.split(" "));
      expect(m?.command.name).toBe(c.name);
    }
  });

  test("describe carries the exit codes, so an agent need not hardcode them", () => {
    const parsed = JSON.parse(surfaceJson()) as { exitCodes: Record<string, number> };
    expect(parsed.exitCodes.ok).toBe(Exit.Ok);
    expect(parsed.exitCodes.refused).toBe(Exit.Refused);
    expect(parsed.exitCodes.usage).toBe(Exit.Usage);
  });

  test("every command explains itself, and read-only ones are marked", () => {
    for (const c of COMMANDS) {
      expect(c.what.length).toBeGreaterThan(20);
      expect(typeof c.writes).toBe("boolean");
    }
    expect(COMMANDS.some((c) => !c.writes)).toBe(true);
    expect(COMMANDS.some((c) => c.writes)).toBe(true);
  });

  test("every flag explains itself", () => {
    for (const c of COMMANDS) {
      for (const f of c.flags) {
        expect(f.name.startsWith("--")).toBe(true);
        expect(f.what.length).toBeGreaterThan(10);
      }
    }
  });

  test("no command declares the same flag twice", () => {
    for (const c of COMMANDS) {
      const names = c.flags.map((f) => f.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  test("help mentions every command", () => {
    const help = helpText();
    for (const c of COMMANDS) expect(help).toContain(c.name);
  });
});

describe("multi-word commands match before their prefixes", () => {
  test("LONGEST NAME WINS — 'org source add' is not parsed as 'org list'", () => {
    const m = matchCommand(["org", "source", "add", "--kind", "jira"]);
    expect(m?.command.name).toBe("org source add");
    expect(m?.rest).toEqual(["--kind", "jira"]);
  });

  test("names are ordered longest first", () => {
    const names = commandNames();
    for (let i = 1; i < names.length; i++) {
      expect((names[i - 1] ?? "").length >= (names[i] ?? "").length).toBe(true);
    }
  });

  test("the rest excludes the whole command name, however many words", () => {
    expect(matchCommand(["demand", "--rework"])?.rest).toEqual(["--rework"]);
    expect(matchCommand(["org", "create", "--id", "x"])?.rest).toEqual(["--id", "x"]);
  });

  test("an unknown command matches nothing rather than guessing", () => {
    expect(matchCommand(["deploy"])).toBeUndefined();
    expect(matchCommand([])).toBeUndefined();
  });

  test("a prefix of a real command is not a command", () => {
    expect(matchCommand(["org", "source"])).toBeUndefined();
  });
});

describe("A MISTYPED FLAG IS REFUSED, never ignored", () => {
  const demand = commandByName("demand");

  test("an unknown flag is a usage error that lists what is accepted", () => {
    if (demand === undefined) throw new Error("no demand command");
    const r = parseFlags(demand, ["--reworks"]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("--reworks");
    expect(r.reason).toContain("--rework");
  });

  test("a bare argument is refused — these commands take flags only", () => {
    if (demand === undefined) throw new Error("no demand command");
    const r = parseFlags(demand, ["ELERA-149570"]);
    expect(r.ok).toBe(false);
  });

  test("a missing required flag names the flag and what it is for", () => {
    const task = commandByName("task");
    if (task === undefined) throw new Error("no task command");
    const r = parseFlags(task, []);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("--work");
  });

  test("a flag needing a value is refused when the next token is another flag", () => {
    const task = commandByName("task");
    if (task === undefined) throw new Error("no task command");
    const r = parseFlags(task, ["--work", "--json"]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("needs a value");
  });

  test("A CLOSED SET IS ENFORCED, and the message lists the legal values", () => {
    const create = commandByName("org create");
    if (create === undefined) throw new Error("no create command");
    const r = parseFlags(create, [
      "--id", "x", "--name", "X", "--store", "/tmp/x",
      "--intake", "hybrid",
      "--verification", "authored_scripts",
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("greenfield");
    expect(r.reason).toContain("source_synced");
  });

  test("a valid invocation parses, and values come back", () => {
    const create = commandByName("org create");
    if (create === undefined) throw new Error("no create command");
    const r = parseFlags(create, [
      "--id", "elera", "--name", "ELERA Core", "--store", "/tmp/elera",
      "--intake", "source_synced",
      "--verification", "existing_harness",
      "--json",
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(flagValue(r.flags, "--id")).toBe("elera");
    expect(flagValue(r.flags, "--name")).toBe("ELERA Core");
    expect(hasFlag(r.flags, "--json")).toBe(true);
    expect(hasFlag(r.flags, "--autonomy")).toBe(false);
  });

  test("a repeatable flag keeps every value in order", () => {
    const add = commandByName("org source add");
    if (add === undefined) throw new Error("no source add command");
    const r = parseFlags(add, [
      "--kind", "jira", "--source-id", "j", "--location", "https://jira.example",
      "--select", "PROJ = ELERA", "--select", "PROJ = PAY",
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(flagValues(r.flags, "--select")).toEqual(["PROJ = ELERA", "PROJ = PAY"]);
  });

  test("a boolean flag takes no value and does not swallow the next token", () => {
    if (demand === undefined) throw new Error("no demand command");
    const r = parseFlags(demand, ["--rework", "--work", "T-1"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(hasFlag(r.flags, "--rework")).toBe(true);
    expect(flagValue(r.flags, "--work")).toBe("T-1");
  });
});

describe("the credential discipline is stated in the surface itself", () => {
  test("every flag that takes a path is marked, so a driver knows not to pass a secret", () => {
    const add = commandByName("org source add");
    const authFile = add?.flags.find((f) => f.name === "--auth-file");
    expect(authFile?.isPath).toBe(true);
    expect(authFile?.what.toLowerCase()).toContain("path");
  });

  test("NO FLAG ANYWHERE ASKS FOR A TOKEN, PASSWORD OR SECRET BY VALUE", () => {
    // argv is world-readable on a shared machine, so a flag that took a credential would publish
    // it to every process. The surface must not offer one.
    for (const c of COMMANDS) {
      for (const f of c.flags) {
        expect(/--(token|password|secret|api-key|apikey)$/.test(f.name)).toBe(false);
      }
    }
  });

  test("the source command says sources are read-only", () => {
    const add = commandByName("org source add");
    expect(`${add?.what ?? ""} ${add?.then ?? ""}`.toLowerCase()).toContain("read-only");
  });
});

describe("exit codes distinguish refusal from failure", () => {
  test("refused is not an error code shared with usage or port failure", () => {
    const codes = [Exit.Ok, Exit.Refused, Exit.Usage, Exit.NotFound, Exit.PortFailure];
    expect(new Set(codes).size).toBe(codes.length);
    expect(Exit.Ok).toBe(0);
  });

  test("commands that can be refused say so, so an agent does not retry forever", () => {
    // Only the WIRED commands that actually return Exit.Refused. Naming an unwired one here made
    // this test pass against a command that no longer existed — it looked up `undefined` and
    // asserted on an empty string.
    for (const name of ["org create", "org source add"]) {
      const c = commandByName(name);
      expect(c).toBeDefined();
      expect(`${c?.what ?? ""} ${c?.then ?? ""}`.toLowerCase()).toContain("refus");
    }
  });
});
