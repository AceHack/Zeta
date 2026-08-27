// output-path.test.ts — the falsifiers.
//
// The property that matters is a MODE, and a mode is the easiest thing in this file to assert
// vacuously: `mkdirSync(dir, { mode })` looks like it sets a permission, is masked by the umask,
// and is ignored outright when the directory already exists. A test that only creates a fresh
// directory and reads its mode back would pass while the real-world case — a directory left 0755 by
// a previous run — stays wide open. §"an EXISTING directory is repaired" is the case that matters.

import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ensurePeerCallOutputDir,
  outputStamp,
  PEER_CALL_OUTPUT_DIR_ENV,
  PEER_CALL_OUTPUT_DIRNAME,
  PEER_CALL_OUTPUT_MODE,
  peerCallOutputPath,
} from "./output-path.ts";

/** An isolated TMPDIR, so a test never touches the real peer-call output directory. */
function sandbox(): { env: NodeJS.ProcessEnv; root: string } {
  const root = mkdtempSync(join(tmpdir(), "zeta-peercall-out-"));
  return { env: { TMPDIR: root } as NodeJS.ProcessEnv, root };
}

const mode = (p: string): number => statSync(p).mode & 0o777;

describe("the directory is owner-only AND unique, which is what makes a predictable name safe", () => {
  test("created 0700 by mkdtemp, and the mode is READ BACK rather than assumed", () => {
    const { env, root } = sandbox();
    try {
      const { dir, secured } = ensurePeerCallOutputDir(env);
      expect(dir.startsWith(join(root, `${PEER_CALL_OUTPUT_DIRNAME}-`))).toBe(true);
      expect(mode(dir)).toBe(PEER_CALL_OUTPUT_MODE);
      // `secured` is a statSync measurement, so a platform that created it differently would say
      // so instead of reassuring the caller.
      expect(secured).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("EVERY CALL GETS ITS OWN DIRECTORY — a property the fixed name could not have", () => {
    // This is what the switch from `mkdir(fixed) + chmod` to `mkdtemp` buys beyond satisfying the
    // scanner: two concurrent peer calls cannot collide, and an attacker cannot pre-create a path
    // whose name does not exist until the moment it is created.
    const { env, root } = sandbox();
    try {
      const a = ensurePeerCallOutputDir(env).dir;
      const b = ensurePeerCallOutputDir(env).dir;
      expect(a).not.toBe(b);
      expect(mode(a)).toBe(PEER_CALL_OUTPUT_MODE);
      expect(mode(b)).toBe(PEER_CALL_OUTPUT_MODE);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the prefix survives, so the one live consumer's substring match still works", () => {
    // `orchestrator/validate-otto-diff.ts` tests `/peer-call-output/` — a regex LITERAL, not a path
    // segment — so the mkdtemp suffix does not break it. Pinned because that is the only thing
    // holding the prefix in place, and a future rename would look harmless.
    const { env, root } = sandbox();
    try {
      const p = peerCallOutputPath("riven", new Date("2026-08-27T18:04:05.123Z"), env);
      expect(/peer-call-output/.test(p)).toBe(true);
      expect(p.endsWith("20260827T180405Z-riven.md")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the hardcoded /tmp is gone", () => {
  test("the path follows TMPDIR rather than a literal /tmp", () => {
    const { env, root } = sandbox();
    try {
      const p = peerCallOutputPath("amara", new Date("2026-08-27T18:04:05.123Z"), env);
      expect(p.startsWith(join(root, `${PEER_CALL_OUTPUT_DIRNAME}-`))).toBe(true);
      expect(p.endsWith("20260827T180405Z-amara.md")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("no source file in this module names /tmp literally", () => {
    // The portability half: `/tmp` does not exist on Windows, and a literal defeats TMPDIR even
    // where it does. Asserted against the source so a future edit cannot quietly reintroduce it.
    const src = readFileSync(new URL("./output-path.ts", import.meta.url).pathname, "utf8");
    // CODE only. The docstring quotes the old `/tmp/peer-call-output/...` line while explaining
    // what was wrong with it, and a whole-file match convicts the documentation — a check that
    // fires on its own explanation is measuring the wrong thing, and would have to be deleted
    // rather than fixed.
    const code = src
      .split("\n")
      .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
      .join("\n");
    expect(code).not.toMatch(/["'`]\/tmp\//);
    // The prose SHOULD still name it — that is where the reader learns what was fixed.
    expect(src).toMatch(/\/tmp\/peer-call-output/);
  });
});

describe("PEER_CALL_OUTPUT_DIR is honoured, and left alone", () => {
  test("an operator-chosen directory is used verbatim", () => {
    const { root } = sandbox();
    try {
      const chosen = join(root, "operator-picked");
      const result = ensurePeerCallOutputDir({ [PEER_CALL_OUTPUT_DIR_ENV]: chosen } as NodeJS.ProcessEnv);
      expect(result.dir).toBe(chosen);
      expect(result.operatorChosen).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("its mode is NOT changed — hardening a directory the operator named would exceed the instruction", () => {
    const { root } = sandbox();
    try {
      const chosen = join(root, "operator-picked-2");
      mkdirSync(chosen, { recursive: true });
      chmodSync(chosen, 0o755);
      const result = ensurePeerCallOutputDir({ [PEER_CALL_OUTPUT_DIR_ENV]: chosen } as NodeJS.ProcessEnv);
      expect(mode(chosen)).toBe(0o755);
      expect(result.secured).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an EMPTY override is not an override — it falls back rather than writing to cwd", () => {
    const { env, root } = sandbox();
    try {
      const result = ensurePeerCallOutputDir({ ...env, [PEER_CALL_OUTPUT_DIR_ENV]: "" } as NodeJS.ProcessEnv);
      expect(result.dir.startsWith(join(root, `${PEER_CALL_OUTPUT_DIRNAME}-`))).toBe(true);
      expect(result.operatorChosen).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the stamp is stable and filesystem-safe", () => {
  test("colons and dashes are stripped, milliseconds dropped", () => {
    expect(outputStamp(new Date("2026-08-27T18:04:05.123Z"))).toBe("20260827T180405Z");
  });

  test("it is a pure function of its argument — the clock enters at ONE call site", () => {
    const d = new Date("2026-01-02T03:04:05.006Z");
    expect(outputStamp(d)).toBe(outputStamp(d));
  });
});
