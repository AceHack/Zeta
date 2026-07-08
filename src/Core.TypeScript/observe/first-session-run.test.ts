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
      ...parseArgs(["--demo", "--script", "local-only", "--dry-run"]),
      runner,
      home: "/home/zeta",
      markerPath: marker,
    };
    const final = await runFirstSession(opts);
    expect(final.complete).toBe(true);
  });

  it("runFirstSession setup-gh local-only dry-run emits happy-path serial proof", async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    try {
      const marker = join(mkdtempSync(join(tmpdir(), "zeta-marker-")), "complete.marker");
      const opts: RunOptions = {
        ...parseArgs(["--demo", "--script", "setup-gh,local-only", "--dry-run"]),
        runner: fakeRunner({}),
        home: "/home/zeta",
        markerPath: marker,
      };

      const final = await runFirstSession(opts);
      const serial = logs.join("\n");

      expect(final.complete).toBe(true);
      expect(serial).toContain("zeta-first-session: choice kind=setup_credential vendor=gh");
      expect(serial).toContain("zeta-first-session: choice kind=use_local_llm_only");
      expect(serial).toContain("zeta-first-session: complete canSelfRegister=true");
    } finally {
      console.log = originalLog;
    }
  });

  it("runFirstSession setup-gh with ZETA_IDENTITY_AUTH_MODE=mock exercises stub", async () => {
    const prev = process.env.ZETA_IDENTITY_AUTH_MODE;
    process.env.ZETA_IDENTITY_AUTH_MODE = "mock";
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    try {
      const marker = join(mkdtempSync(join(tmpdir(), "zeta-marker-")), "complete.marker");
      const opts: RunOptions = {
        ...parseArgs(["--demo", "--script", "setup-gh,local-only", "--dry-run"]),
        runner: fakeRunner({ which: () => null }),
        home: "/home/zeta",
        markerPath: marker,
      };

      const final = await runFirstSession(opts);
      const serial = logs.join("\n");

      expect(final.complete).toBe(true);
      expect(final.credentials.gh).toBe("ready");
      expect(serial).toContain("zeta-first-session: identity-auth-mock-begin");
      expect(serial).toContain("zeta-first-session: identity-auth-mock-ok");
      expect(serial).toContain("zeta-first-session: complete canSelfRegister=true");
      expect(serial).not.toContain("zeta-first-session: dry-run setup gh");
    } finally {
      console.log = originalLog;
      if (prev === undefined) delete process.env.ZETA_IDENTITY_AUTH_MODE;
      else process.env.ZETA_IDENTITY_AUTH_MODE = prev;
    }
  });

  it("runFirstSession setup-gh with ZETA_IDENTITY_AUTH_MODE=skip emits skip marker", async () => {
    const prev = process.env.ZETA_IDENTITY_AUTH_MODE;
    process.env.ZETA_IDENTITY_AUTH_MODE = "skip";
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    try {
      const marker = join(mkdtempSync(join(tmpdir(), "zeta-marker-")), "complete.marker");
      // After skip auth, local-only still completes; gh stays missing → canSelfRegister=false
      // unless we also skip_credential — here setup-gh is attempted then skipped by mode.
      const opts: RunOptions = {
        ...parseArgs(["--demo", "--script", "setup-gh,local-only", "--dry-run"]),
        runner: fakeRunner({}),
        home: "/home/zeta",
        markerPath: marker,
      };

      const final = await runFirstSession(opts);
      const serial = logs.join("\n");

      expect(final.complete).toBe(true);
      expect(serial).toContain("zeta-first-session: identity-auth-skip");
      expect(serial).toContain("zeta-first-session: setup-gh outcome=skipped");
      // CI skip marks gh skipped (not ready) so self-register stays false
      expect(final.credentials.gh).toBe("skipped");
      expect(serial).toContain("zeta-first-session: complete canSelfRegister=false");
    } finally {
      console.log = originalLog;
      if (prev === undefined) delete process.env.ZETA_IDENTITY_AUTH_MODE;
      else process.env.ZETA_IDENTITY_AUTH_MODE = prev;
    }
  });

  it("runFirstSession skip-gh local-only dry-run emits continue-later proof", async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    try {
      const marker = join(mkdtempSync(join(tmpdir(), "zeta-marker-")), "complete.marker");
      const opts: RunOptions = {
        ...parseArgs(["--demo", "--script", "skip-gh,local-only", "--dry-run"]),
        runner: fakeRunner({}),
        home: "/home/zeta",
        markerPath: marker,
      };

      const final = await runFirstSession(opts);
      const serial = logs.join("\n");

      expect(final.complete).toBe(true);
      expect(serial).toContain("zeta-first-session: choice kind=skip_credential vendor=gh");
      expect(serial).toContain("Continue later:");
      expect(serial).toContain("SSH in and set up GitHub there");
      expect(serial).toContain("zeta-first-session: complete canSelfRegister=false");
    } finally {
      console.log = originalLog;
    }
  });
});
