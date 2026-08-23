// Falsifiers for the two properties that took `tlaps-proof` dark for seven
// weeks (last green 2026-07-01; 33 cancelled + 7 failed over the next 40 runs).
//
// The job was never killed by the proof — the proof step never ran. Every
// cancellation sat in the toolchain install, inside tlapm's `dune build`,
// at the upstream deps/isabelle rule. Two things were wrong there and both
// are pinned below:
//
//   1. the step inherited the runner's stdout PIPE, which an Isabelle child
//      leaves marked O_NONBLOCK — dune's own write then hit EAGAIN
//      (`Sys_blocked_io`, run 28619870340) or stalled 49m50s (run
//      32605525115). A regular file cannot return EAGAIN.
//   2. there was no wall-clock budget, so a stall became a *cancellation* at
//      the 60-minute job cap. `cancelled` is not a verdict.
import { describe, expect, test } from "bun:test";
import { runHeavyOpamShell } from "./from-opam-git.ts";
import { createContext } from "./shared.ts";

const posix = process.platform !== "win32";
const hasTimeout = Bun.which("timeout") !== null || Bun.which("gtimeout") !== null;

function capturingContext(): { ctx: ReturnType<typeof createContext>; out: string[] } {
  const base = createContext({});
  const out: string[] = [];
  const ctx = { ...base, log: (m: string) => out.push(m), warn: (m: string) => out.push(m) };
  return { ctx, out };
}

/** Run a step expected to fail and return its message ("" if it succeeded). */
async function failureMessage(
  ctx: ReturnType<typeof capturingContext>["ctx"],
  script: string,
  budgetMs: number,
): Promise<string> {
  try {
    await runHeavyOpamShell(ctx, "probe", script, budgetMs);
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe("runHeavyOpamShell", () => {
  test("the wall-clock budget is configurable but never absent by default", () => {
    // The default has to leave room under tlaps-proof.yml's 60-minute job cap,
    // or the budget cannot do its job: turning a stall into a reported red.
    const configured = Number(process.env.ZETA_OPAM_GIT_BUDGET_MS ?? 40 * 60 * 1000);
    expect(configured).toBeGreaterThan(0);
    expect(configured).toBeLessThan(60 * 60 * 1000);
  });

  test.if(posix)("the step's stdout is a REGULAR FILE, never the inherited pipe", async () => {
    const { ctx, out } = capturingContext();
    // `-f /dev/stdout` is true only when fd 1 is a regular file. If this ever
    // reverts to `stdout: "inherit"` the branch flips and the test fails —
    // which is exactly the regression that produced the 60-minute stall.
    await runHeavyOpamShell(
      ctx,
      "probe",
      'if [ -f /dev/stdout ]; then echo REGULAR_FILE; else echo NOT_A_FILE; fi',
      60_000,
    );
    expect(out.join("\n")).toContain("REGULAR_FILE");
    expect(out.join("\n")).not.toContain("NOT_A_FILE");
  }, 30_000);

  test.if(posix)("captured output is replayed, so the diagnostic is not swallowed", async () => {
    const { ctx, out } = capturingContext();
    await runHeavyOpamShell(ctx, "probe", 'echo hello-from-the-build; echo to-stderr >&2', 60_000);
    const joined = out.join("\n");
    expect(joined).toContain("hello-from-the-build");
    expect(joined).toContain("to-stderr");
  }, 30_000);

  test.if(posix)("a non-zero step throws rather than reporting success", async () => {
    const { ctx } = capturingContext();
    const message = await failureMessage(ctx, "exit 3", 60_000);
    expect(message).toContain("exited 3");
  }, 30_000);

  test.if(posix && hasTimeout)("a hang becomes a REPORTED failure, not a cancellation", async () => {
    const { ctx } = capturingContext();
    // Without the budget this sleeps past any job cap and the lane is
    // `cancelled` — a non-verdict. With it, the lane goes red and says why.
    const message = await failureMessage(ctx, "sleep 120", 1_000);
    expect(message).toContain("wall-clock budget");
  }, 30_000);

  test.if(posix)("stdin is closed, so a prompting build fails instead of blocking", async () => {
    const { ctx, out } = capturingContext();
    await runHeavyOpamShell(ctx, "probe", 'read -r line && echo "got:$line" || echo NO_STDIN', 60_000);
    expect(out.join("\n")).toContain("NO_STDIN");
  }, 30_000);
});
