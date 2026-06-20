import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  expandHome,
  manifestPathsForVendor,
  probeAllCredentials,
  probeVendorStatus,
  type ShellRunner,
} from "./first-session-executor";
import {
  actionFromDemoToken,
  parseArgs,
  runFirstSession,
  sessionFromProbe,
  type RunOptions,
} from "./first-session-run";
import { defaultNodeSession } from "./first-session";

function fakeRunner(overrides: Partial<ShellRunner>): ShellRunner {
  return {
    run: overrides.run ?? (() => ({ exitCode: 1 })),
    spawnInteractive: overrides.spawnInteractive ?? (() => ({ exitCode: 0 })),
    which: overrides.which ?? ((cmd) => (cmd === "gh" ? "/usr/bin/gh" : null)),
  };
}

describe("first-session-executor — probe", () => {
  it("expandHome resolves tilde paths", () => {
    expect(expandHome("~/.config/gh/hosts.yml", "/home/zeta")).toBe("/home/zeta/.config/gh/hosts.yml");
  });

  it("manifestPathsForVendor returns gh hosts.yml", () => {
    const paths = manifestPathsForVendor("gh", "/home/zeta");
    expect(paths[0]).toContain(".config/gh/hosts.yml");
  });

  it("probeVendorStatus gh ready when auth status succeeds", () => {
    const runner = fakeRunner({
      run: (cmd, args) =>
        cmd === "gh" && args[0] === "auth" && args[1] === "status"
          ? { exitCode: 0 }
          : { exitCode: 1 },
    });
    expect(probeVendorStatus("gh", runner)).toBe("ready");
  });

  it("probeVendorStatus claude ready when manifest path exists", () => {
    const home = mkdtempSync(join(tmpdir(), "zeta-fs-"));
    const credPath = join(home, ".config/claude/credentials.json");
    mkdirSync(join(home, ".config/claude"), { recursive: true });
    writeFileSync(credPath, "{}", { mode: 0o600 });
    const runner = fakeRunner({ which: () => null });
    expect(probeVendorStatus("claude", runner, home)).toBe("ready");
  });

  it("probeAllCredentials reports missing vendors by default", () => {
    const runner = fakeRunner({});
    const all = probeAllCredentials(runner, "/nonexistent-home");
    expect(all.gh).toBe("missing");
    expect(all.claude).toBe("missing");
  });
});

describe("first-session-run — demo script", () => {
  it("actionFromDemoToken resolves setup-gh alias", () => {
    const session = defaultNodeSession();
    const action = actionFromDemoToken("setup-gh", session);
    expect(action?.kind).toBe("setup_credential");
    if (action?.kind === "setup_credential") expect(action.vendor).toBe("gh");
  });

  it("parseArgs reads --demo --script", () => {
    const opts = parseArgs(["--demo", "--script", "setup-gh,complete", "--dry-run"]);
    expect(opts.demo).toBe(true);
    expect(opts.dryRun).toBe(true);
    expect(opts.demoScript).toEqual(["setup-gh", "complete"]);
  });

  it("sessionFromProbe marks gh ready when runner reports auth", () => {
    const runner = fakeRunner({
      run: (cmd, args) =>
        cmd === "gh" && args[0] === "auth" ? { exitCode: 0 } : { exitCode: 1 },
    });
    const session = sessionFromProbe(runner, "/home/zeta");
    expect(session.credentials.gh).toBe("ready");
  });

  it("runFirstSession demo completes with dry-run", async () => {
    const runner = fakeRunner({
      run: (cmd, args) =>
        cmd === "gh" && args[0] === "auth" ? { exitCode: 0 } : { exitCode: 1 },
    });
    const marker = join(mkdtempSync(join(tmpdir(), "zeta-marker-")), "complete.marker");
    const opts: RunOptions = {
      ...parseArgs(["--demo", "--script", "skip-optional,complete", "--dry-run"]),
      runner,
      home: "/home/zeta",
      markerPath: marker,
    };
    const final = await runFirstSession(opts);
    expect(final.complete).toBe(true);
  });
});
