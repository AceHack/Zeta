// self-register-reconvergence.test.ts — 081M0BTFK85087G0R000A705AK
//
// THE FALSIFIER for "a marker-gated oneshot cannot re-converge, and repair IS
// re-convergence."
//
// These tests EXECUTE the real `tools/installer/zeta-self-register.sh` — not a
// TypeScript re-implementation of its logic — against stubbed `gh` and `git`
// binaries on PATH. That choice is the point: a second copy of the convergence
// rule in TypeScript would drift from the copy that actually runs on a node, and
// a test that passes while the shipped artifact is wrong is the vacuity class.
// The stubs emulate only the I/O boundary (what GitHub answers); every decision
// the assertions are about is made by the script.
//
// `reconverges after a prior successful registration` is the regression test that
// FAILS on the pre-fix script: with a marker present it exited 0 immediately and
// never looked at the world.
//
// WHAT THESE TESTS DO NOT SHOW, stated so the change does not read as more
// verified than it is:
//   * No NixOS node is booted here. Timer elapse, `startLimitIntervalSec`
//     behaviour, StateDirectory ownership, and ordering against
//     zeta-creds-restore are UNTESTED — reviewed only.
//   * The stubs assert what we believe `gh` returns. A change in gh's `--json`
//     output shape would break the node and not these tests.

import { afterEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(import.meta.dir, "../../../tools/installer/zeta-self-register.sh");
const HOST = "node-abc123";
const LOGIN = "qemu-ci";
const NODE_PATH = `maintainers/${LOGIN}/cluster-nodes/${HOST}/node.yaml`;

interface OpenPr {
  readonly headRefName: string;
  readonly number: number;
}

/** What the stubbed GitHub answers. Everything else is the script's own reasoning. */
interface World {
  /** `gh auth status` exit code 0? */
  readonly authed: boolean;
  /** Does `node.yaml` exist on main — i.e. is the node actually registered? */
  readonly registeredOnMain: boolean;
  /** Open PRs the stub reports from `gh pr list --json headRefName,number`. */
  readonly openPrs: readonly OpenPr[];
  /** Simulate an unreachable API on the contents probe (not a 404). */
  readonly contentsUnreachable?: boolean;
  /** Simulate `gh pr list` failing outright. */
  readonly prListFails?: boolean;
  /** Emit pretty-printed `gh --json` output (what gh does on a TTY). */
  readonly prettyJson?: boolean;
  /**
   * What `gh api /user --jq .id` returns. The script needs the NUMERIC id to build
   * `<id>+<login>@users.noreply.github.com`; the plain `<login>@users.noreply.github.com`
   * form resolves to whoever owns that username on github.com (AH005). `""` models the
   * read failing, and the script must then REFUSE rather than fall back to the plain form.
   */
  readonly userId?: string;
}

const DEFAULT_WORLD: World = { authed: true, registeredOnMain: false, openPrs: [], userId: "4242" };

interface RunResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
  /** One line per stubbed subprocess invocation, e.g. `gh pr create ...`. */
  readonly calls: readonly string[];
  /** Parsed receipt file, or null when the script wrote none. */
  readonly receipt: Record<string, string> | null;
}

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    const dir = roots.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * `gh` and `git` stubs, written as `#!/usr/bin/env bun` executables — no new
 * shell files anywhere in this harness.
 */
const GH_STUB = `#!/usr/bin/env bun
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
const world = JSON.parse(readFileSync(process.env.ZETA_TEST_WORLD, "utf8"));
const argv = process.argv.slice(2);
appendFileSync(process.env.ZETA_TEST_CALLS, "gh " + argv.join(" ") + "\\n");
const sub = argv.join(" ");
if (sub.startsWith("auth status")) process.exit(world.authed ? 0 : 1);
if (sub.startsWith("auth setup-git")) process.exit(0);
if (sub.startsWith("api /user")) {
  // Two DIFFERENT reads share this path. \`--jq .id\` yields the numeric account id,
  // \`--jq .login\` the username; collapsing them is what made the stub answer a
  // question it had not been asked.
  if (sub.includes(".id")) {
    if (!world.userId) { process.stderr.write("gh: Not Found (HTTP 404)\\n"); process.exit(1); }
    process.stdout.write(world.userId + "\\n");
    process.exit(0);
  }
  process.stdout.write(world.login + "\\n");
  process.exit(0);
}
if (argv[0] === "api" && argv[1]?.includes("/contents/")) {
  if (world.contentsUnreachable) {
    process.stderr.write("dial tcp: lookup api.github.com: no such host\\n");
    process.exit(1);
  }
  if (world.registeredOnMain) { process.stdout.write("{}\\n"); process.exit(0); }
  process.stderr.write("gh: Not Found (HTTP 404)\\n");
  process.exit(1);
}
if (argv[0] === "pr" && argv[1] === "list") {
  if (world.prListFails) { process.stderr.write("HTTP 503\\n"); process.exit(1); }
  // gh emits COMPACT json to a pipe and PRETTY-PRINTS to a TTY. Both shapes are
  // real, so both are exercised (see the prettyJson world flag).
  process.stdout.write((world.prettyJson ? JSON.stringify(world.openPrs, null, 2) : JSON.stringify(world.openPrs)) + "\\n");
  process.exit(0);
}
if (argv[0] === "pr" && argv[1] === "create") {
  process.stdout.write("https://github.com/o/r/pull/999\\n");
  process.exit(0);
}
process.stderr.write("unstubbed gh call: " + sub + "\\n");
process.exit(70);
`;

const GIT_STUB = `#!/usr/bin/env bun
import { appendFileSync, mkdirSync } from "node:fs";
const argv = process.argv.slice(2);
appendFileSync(process.env.ZETA_TEST_CALLS, "git " + argv.join(" ") + "\\n");
if (argv[0] === "clone") { mkdirSync(argv[argv.length - 1], { recursive: true }); process.exit(0); }
// The script guards against an empty commit with \`git diff --cached --quiet\`;
// non-zero means "there are staged changes", which is the healthy path.
if (argv[0] === "diff") process.exit(1);
process.exit(0);
`;

function makeStub(dir: string, name: string, body: string): void {
  const path = join(dir, name);
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

function run(world: Partial<World>, opts: { receiptSeed?: string } = {}): RunResult {
  const root = mkdtempSync(join(tmpdir(), "zeta-selfreg-"));
  roots.push(root);
  const bin = join(root, "bin");
  const home = join(root, "home");
  mkdirSync(bin, { recursive: true });
  mkdirSync(home, { recursive: true });

  const receiptPath = join(root, "state", "self-registered.marker");
  if (opts.receiptSeed !== undefined) {
    mkdirSync(join(root, "state"), { recursive: true });
    writeFileSync(receiptPath, opts.receiptSeed);
  }

  const worldPath = join(root, "world.json");
  const callsPath = join(root, "calls.log");
  writeFileSync(worldPath, JSON.stringify({ ...DEFAULT_WORLD, ...world, login: LOGIN }));
  writeFileSync(callsPath, "");

  makeStub(bin, "gh", GH_STUB);
  makeStub(bin, "git", GIT_STUB);
  makeStub(bin, "hostname", `#!/usr/bin/env bun\nprocess.stdout.write("${HOST}\\n");\n`);

  const proc = spawnSync("bash", [SCRIPT], {
    encoding: "utf8",
    env: {
      // Deliberately minimal: only what the systemd unit actually exports, plus
      // the stub plumbing. An inherited PATH would let a real gh/git leak in —
      // the stub dir is FIRST and the tail carries no gh/git of its own. bun's
      // own directory is appended because the stubs are `#!/usr/bin/env bun`.
      PATH: `${bin}:${resolve(process.execPath, "..")}:/usr/bin:/bin:/usr/sbin:/sbin`,
      HOME: home,
      ZETA_SELF_REGISTER_MARKER: receiptPath,
      ZETA_SELF_REGISTER_REPO_SLUG: "o/r",
      ZETA_TEST_WORLD: worldPath,
      ZETA_TEST_CALLS: callsPath,
    },
  });

  let receipt: Record<string, string> | null = null;
  try {
    receipt = Object.fromEntries(
      readFileSync(receiptPath, "utf8")
        .split("\n")
        .filter((l) => l.includes("="))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    );
  } catch {
    receipt = null;
  }

  return {
    status: proc.status ?? -1,
    stdout: proc.stdout ?? "",
    stderr: proc.stderr ?? "",
    calls: readFileSync(callsPath, "utf8").split("\n").filter(Boolean),
    receipt,
  };
}

const createdPr = (r: RunResult): boolean => r.calls.some((c) => c.startsWith("gh pr create"));

/** A receipt in the shape the pre-fix script wrote after a successful run. */
const legacyReceipt = "https://github.com/o/r/pull/1\n";

describe("zeta-self-register level-triggered convergence (081M0BTFK85087G0R000A705AK)", () => {
  it("registers when diverged and nothing is in flight", () => {
    const r = run({ registeredOnMain: false, openPrs: [] });
    expect(r.status).toBe(0);
    expect(createdPr(r)).toBe(true);
    expect(r.receipt?.state).toBe("pr-opened");
  });

  it("commits under the id-verified noreply address, never the plain-username form", () => {
    // AH005. `<login>@users.noreply.github.com` is the LEGACY form and GitHub resolves it
    // to whoever owns that username TODAY — for a login that is also an ordinary first
    // name, that is a stranger. `<id>+<login>@…` is checked by GitHub against the login.
    const r = run({ registeredOnMain: false, openPrs: [], userId: "4242" });
    expect(r.status).toBe(0);
    const commit = r.calls.find((c) => c.split(/\s+/).includes("commit")) ?? "";
    const configured = /(?:^|\s)-c\s+user\.email=(\S+)/.exec(commit)?.[1];
    expect(configured).toBe(`4242+${LOGIN}@users.noreply.github.com`);
  });

  it("REFUSES when the numeric id cannot be resolved — it does not fall back to the plain form", () => {
    // The falsifier for the fix. Guessing here would attribute the commit to whoever owns
    // the login, which is worse than a registration that retries on the next tick.
    const r = run({ registeredOnMain: false, openPrs: [], userId: "" });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain("ambiguous identity");
    // Assert on the `user.email=` FLAG, not on a bare substring of the host. A plain
    // `.includes("users.noreply.github.com")` is `js/incomplete-url-substring-sanitization`
    // -- the host can sit anywhere in a longer string -- and CodeQL is right to flag the
    // shape even here: this assertion is only meaningful if it is bound to the position
    // that decides the identity.
    const configuredEmail = /(?:^|\s)-c\s+user\.email=(\S+)/;
    expect(r.calls.some((c) => configuredEmail.test(c))).toBe(false);
    // And nothing was committed at all -- the refusal happens before the commit.
    expect(r.calls.some((c) => c.split(/\s+/).includes("commit"))).toBe(false);
    expect(createdPr(r)).toBe(false);
  });

  it("stands down when already converged — and does not touch git at all", () => {
    const r = run({ registeredOnMain: true });
    expect(r.status).toBe(0);
    expect(createdPr(r)).toBe(false);
    expect(r.calls.some((c) => c.startsWith("git clone"))).toBe(false);
    expect(r.receipt?.state).toBe("converged");
    expect(r.receipt?.["node-path"]).toBe(NODE_PATH);
  });

  // THE REGRESSION TEST. Pre-fix, a present marker short-circuited everything, so
  // a node whose registration was wiped stayed unregistered forever.
  it("re-converges after a prior successful registration when the node is wiped from main", () => {
    const r = run({ registeredOnMain: false, openPrs: [] }, { receiptSeed: legacyReceipt });
    expect(r.status).toBe(0);
    expect(createdPr(r)).toBe(true);
    expect(r.receipt?.state).toBe("pr-opened");
  });

  it("a legacy marker does not suppress the converged reading either", () => {
    const r = run({ registeredOnMain: true }, { receiptSeed: legacyReceipt });
    expect(r.status).toBe(0);
    expect(r.receipt?.state).toBe("converged");
  });

  it("is idempotent: N runs against a converged world have the effect of one", () => {
    const states = [run({ registeredOnMain: true }), run({ registeredOnMain: true }), run({ registeredOnMain: true })];
    for (const r of states) {
      expect(r.status).toBe(0);
      expect(createdPr(r)).toBe(false);
      expect(r.receipt?.state).toBe("converged");
    }
  });
});

describe("the storm bounds this change is responsible for", () => {
  it("never opens a second PR while one is already open for this host", () => {
    const r = run({
      registeredOnMain: false,
      openPrs: [{ headRefName: `register-${HOST}-20260819T000000Z`, number: 4242 }],
    });
    expect(r.status).toBe(0);
    expect(createdPr(r)).toBe(false);
    expect(r.receipt?.state).toBe("converging");
    expect(r.receipt?.detail).toContain("4242");
  });

  // gh pretty-prints --json on a TTY (`"headRefName": "x"`) and emits compact JSON
  // to a pipe (`"headRefName":"x"`). A compact-only matcher misses the in-flight PR
  // in the operator-runs-it-by-hand case and opens a duplicate. Found in self-review,
  // not by a failing test — so it gets one.
  it("sees an in-flight PR in pretty-printed gh output too, not just compact", () => {
    const r = run({
      registeredOnMain: false,
      prettyJson: true,
      openPrs: [{ headRefName: `register-${HOST}-20260819T000000Z`, number: 4242 }],
    });
    expect(r.status).toBe(0);
    expect(createdPr(r)).toBe(false);
    expect(r.receipt?.state).toBe("converging");
    expect(r.receipt?.detail).toContain("4242");
  });

  it("another host's open registration PR does not suppress this host's", () => {
    const r = run({
      registeredOnMain: false,
      openPrs: [{ headRefName: "register-some-other-node-20260819T000000Z", number: 7 }],
    });
    expect(createdPr(r)).toBe(true);
  });

  it("throttles a fresh attempt when one was made inside the min interval", () => {
    const now = Math.floor(Date.now() / 1000);
    const r = run(
      { registeredOnMain: false, openPrs: [] },
      { receiptSeed: `state=pr-failed\nlast-pr-attempt-epoch=${now - 60}\n` },
    );
    expect(r.status).toBe(0);
    expect(createdPr(r)).toBe(false);
    expect(r.receipt?.state).toBe("throttled");
  });

  it("the throttle expires — it bounds, it does not give up", () => {
    const now = Math.floor(Date.now() / 1000);
    const r = run(
      { registeredOnMain: false, openPrs: [] },
      { receiptSeed: `state=pr-failed\nlast-pr-attempt-epoch=${now - 90_000}\n` },
    );
    expect(createdPr(r)).toBe(true);
  });
});

describe("a failed check is not a negative result", () => {
  it("refuses to register when the contents probe is unreachable rather than 404", () => {
    const r = run({ contentsUnreachable: true });
    expect(r.status).toBe(1);
    expect(createdPr(r)).toBe(false);
    expect(r.receipt?.state).toBe("check-failed");
  });

  it("refuses to register when the in-flight-PR probe fails", () => {
    const r = run({ registeredOnMain: false, prListFails: true });
    expect(r.status).toBe(1);
    expect(createdPr(r)).toBe(false);
    expect(r.receipt?.state).toBe("check-failed");
  });

  it("skips cleanly and records why when gh is not authenticated", () => {
    const r = run({ authed: false });
    expect(r.status).toBe(0);
    expect(createdPr(r)).toBe(false);
    expect(r.receipt?.state).toBe("unauthenticated");
  });
});
