// src/Core.TypeScript/io/safe-io.test.ts
//
// FALSIFIERS FOR safe-io.ts.
//
// Every test below fails when the property it names is removed from the
// subject. They were checked that way -- the mutation table is in the PR that
// landed this file -- because a test that survives its subject being broken is
// not a falsifier, it is decoration.
//
// TWO OF THE PROPERTIES CANNOT BE TESTED BY OBSERVING BEHAVIOUR, and that is
// stated here rather than papered over:
//
//   * "TOCTOU-free" is the absence of a second path lookup. A race is not
//     deterministically reproducible in a unit test, and a test that tried
//     would be flaky in the direction that reads as a pass. So it is asserted
//     STRUCTURALLY: the subject's own source must contain no `existsSync(`,
//     `statSync(`, `lstatSync(` or `accessSync(` CALL. Insert one and the test
//     dies. That is a genuine falsifier for the property that actually matters
//     -- the pattern's absence -- rather than a probabilistic one for its
//     consequence.
//
//   * "no shell is reachable" is likewise a statement about what the module
//     will not do. It is tested twice: behaviourally (every spelling that
//     would reach a shell is refused with a Result) and structurally (the only
//     `/bin/sh` and `/bin/bash` literals in the file are inside
//     `spawnShellDeclared`).
//
// The structural assertions read the file with `readFileBounded` -- the
// subject reading itself. That is deliberate: if the reader is broken, these
// tests do not silently pass over an empty string, they fail at the Result.

import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkArgv,
  fetchBounded,
  fetchToFile,
  readFileBounded,
  runCommandLineFromRoster,
  spawnArgv,
  spawnFromRoster,
  spawnShellDeclared,
  splitCommandLine,
  truncateUtf8Bytes,
  writeFileOwned,
} from "./safe-io.ts";

const SUBJECT = join(import.meta.dir, "safe-io.ts");

const scratch = mkdtempSync(join(tmpdir(), "safe-io-test-"));
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

let portCounter = 0;
function scratchPath(name: string): string {
  portCounter += 1;
  return join(scratch, `${String(portCounter)}-${name}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTURAL — the properties that are an ABSENCE
// ═══════════════════════════════════════════════════════════════════════════

describe("structural: the defect patterns are absent from the subject", () => {
  function subjectSource(): string {
    const read = readFileBounded(SUBJECT);
    if (!read.ok) throw new Error(`cannot read subject: ${read.error.message}`);
    return read.value.text;
  }

  /**
   * Comments are stripped before matching, and the match is the CALL form.
   *
   * Both halves are load-bearing and both have bitten this repo. The subject's
   * own header discusses `existsSync` in prose, so a bare-substring check
   * would be satisfied by the documentation that explains why the call is
   * absent -- a guard that its own comment passes. And an `import { statSync }`
   * line contains the identifier without being a call.
   */
  function strippedSource(): string {
    return subjectSource()
      .replace(/\/\*[\s\S]*?\*\//gu, " ")
      .split("\n")
      .map((line) => {
        const cut = line.indexOf("//");
        return cut < 0 ? line : line.slice(0, cut);
      })
      .join("\n");
  }

  test("the subject never calls a path-based stat or existence check", () => {
    const code = strippedSource();
    for (const banned of ["existsSync", "statSync", "lstatSync", "accessSync", "readFileSync", "writeFileSync"]) {
      expect(new RegExp(`\\b${banned}\\s*\\(`, "u").test(code)).toBe(false);
    }
  });

  test("the comment stripper is not vacuous — it removes a call written in a comment", () => {
    // Control for the test above. If the stripper silently did nothing, the
    // assertion would still pass today (the subject has no such call) and
    // would keep passing after a real call was added inside an `if (false)`.
    const withCommentedCall = "const x = 1; // existsSync(p)\n/* statSync(p) */\nconst y = 2;";
    const stripped = withCommentedCall
      .replace(/\/\*[\s\S]*?\*\//gu, " ")
      .split("\n")
      .map((line) => {
        const cut = line.indexOf("//");
        return cut < 0 ? line : line.slice(0, cut);
      })
      .join("\n");
    expect(/\bexistsSync\s*\(/u.test(stripped)).toBe(false);
    expect(/\bstatSync\s*\(/u.test(stripped)).toBe(false);
    expect(/\bexistsSync\s*\(/u.test(withCommentedCall)).toBe(true);
  });

  test("the only shell literals in the subject are inside spawnShellDeclared", () => {
    const code = strippedSource();
    const shellLiterals = [...code.matchAll(/"\/bin\/(?:sh|bash)"/gu)];
    expect(shellLiterals).toHaveLength(2);
    const declaredAt = code.indexOf("export function spawnShellDeclared");
    expect(declaredAt).toBeGreaterThan(0);
    for (const m of shellLiterals) expect(m.index).toBeGreaterThan(declaredAt);
  });

  test("the subject never passes shell:true to a spawn", () => {
    expect(/shell\s*:\s*true/u.test(strippedSource())).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FILES
// ═══════════════════════════════════════════════════════════════════════════

describe("readFileBounded", () => {
  test("reads a whole file", () => {
    const p = scratchPath("whole.txt");
    expect(writeFileOwned(p, "alpha").ok).toBe(true);
    const r = readFileBounded(p);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.text).toBe("alpha");
      expect(r.value.bytes).toBe(5);
      expect(r.value.size).toBe(5);
      expect(r.value.truncated).toBe(false);
    }
  });

  test("headBytes bounds the read and reports truncation", () => {
    const p = scratchPath("head.txt");
    expect(writeFileOwned(p, "0123456789").ok).toBe(true);
    const r = readFileBounded(p, { headBytes: 4 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.text).toBe("0123");
      expect(r.value.bytes).toBe(4);
      expect(r.value.size).toBe(10);
      expect(r.value.truncated).toBe(true);
    }
  });

  test("maxBytes REFUSES rather than silently truncating", () => {
    // The distinction the `too-large` kind exists for: a caller that asked for
    // the whole file and got part of it has been lied to.
    const p = scratchPath("big.txt");
    expect(writeFileOwned(p, "0123456789").ok).toBe(true);
    const r = readFileBounded(p, { maxBytes: 4 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("too-large");
      expect(r.error.retryable).toBe(false);
    }
  });

  test("a missing file is not-found, as a Result, not a throw", () => {
    const r = readFileBounded(join(scratch, "nope", "missing.txt"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("not-found");
  });

  test("a directory is refused instead of throwing EISDIR mid-read", () => {
    const r = readFileBounded(scratch);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain("directory");
  });
});

describe("writeFileOwned", () => {
  test("writes bytes and reports how many", () => {
    const p = scratchPath("w.txt");
    const w = writeFileOwned(p, "héllo");
    expect(w.ok).toBe(true);
    if (w.ok) expect(w.value.bytes).toBe(6); // é is two bytes
    const r = readFileBounded(p);
    expect(r.ok && r.value.text).toBe("héllo");
  });

  test("exclusive refuses to clobber — the ATOMIC form of existsSync-then-write", () => {
    // This is the check-then-create race, delegated to the kernel. Change the
    // flag from "wx" to "w" and the second write silently wins, which is
    // exactly the defect existsSync was failing to prevent.
    const p = scratchPath("excl.txt");
    expect(writeFileOwned(p, "first", { exclusive: true }).ok).toBe(true);
    const second = writeFileOwned(p, "second", { exclusive: true });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.kind).toBe("already-exists");
    expect(readFileBounded(p).ok && (readFileBounded(p) as { value: { text: string } }).value.text).toBe("first");
  });

  test("non-exclusive overwrites, and the file does not keep a stale tail", () => {
    const p = scratchPath("over.txt");
    expect(writeFileOwned(p, "LONG-ORIGINAL-CONTENT").ok).toBe(true);
    expect(writeFileOwned(p, "short").ok).toBe(true);
    const r = readFileBounded(p);
    expect(r.ok && r.value.text).toBe("short");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND LINES
// ═══════════════════════════════════════════════════════════════════════════

describe("splitCommandLine", () => {
  test("splits on whitespace", () => {
    const r = splitCommandLine("git log --oneline -n 3");
    expect(r.ok && r.value).toEqual(["git", "log", "--oneline", "-n", "3"]);
  });

  test("honours quotes so an argument may contain spaces", () => {
    const r = splitCommandLine(`rg "foo bar" 'baz qux' src`);
    expect(r.ok && r.value).toEqual(["rg", "foo bar", "baz qux", "src"]);
  });

  test("preserves an empty quoted argument", () => {
    const r = splitCommandLine(`git commit -m ""`);
    expect(r.ok && r.value).toEqual(["git", "commit", "-m", ""]);
  });

  for (const [name, input] of [
    ["pipe", "git log | head"],
    ["semicolon", "git log; rm -rf /"],
    ["ampersand", "git log && curl evil"],
    ["backtick", "echo `whoami`"],
    ["dollar substitution", "echo $(whoami)"],
    ["redirect", "git log > /etc/passwd"],
    ["newline", "git log\nrm -rf /"],
    ["NUL", "git log\u0000rm"],
  ] as const) {
    test(`refuses a ${name} — there is no argument vector that means it`, () => {
      const r = splitCommandLine(input);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.kind).toBe("shell-refused");
    });
  }

  test("an unterminated quote is refused, never guessed at", () => {
    const r = splitCommandLine(`rg "unterminated`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("argv-refused");
  });

  test("an empty command line is refused", () => {
    const r = splitCommandLine("   ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("argv-refused");
  });
});

describe("checkArgv", () => {
  test("a plain program with plain arguments is accepted", () => {
    expect(checkArgv("git", ["log", "--oneline"])).toBeNull();
  });

  test("an argument containing a space is FINE — argv carries it verbatim", () => {
    // The point of an argument vector: no quoting is needed because no shell
    // is going to re-parse it. A guard that refused this would push callers
    // straight back to building shell strings.
    expect(checkArgv("git", ["commit", "-m", "two words"])).toBeNull();
  });

  for (const [name, command, args] of [
    ["sh -c", "/bin/sh", ["-c", "echo hi"]],
    ["bash -c", "bash", ["-c", "echo hi"]],
    ["zsh -c", "/usr/bin/zsh", ["-c", "echo hi"]],
    ["cmd /c", "cmd.exe", ["/c", "dir"]],
    ["powershell -Command", "pwsh", ["-Command", "ls"]],
  ] as const) {
    test(`refuses ${name}`, () => {
      const e = checkArgv(command, [...args]);
      expect(e?.kind).toBe("shell-refused");
    });
  }

  test("a shell running a FILE is not refused — the flag is the defect, not the program", () => {
    expect(checkArgv("bash", ["./install.sh"])).toBeNull();
  });

  test("a command carrying a whole command line is refused", () => {
    const e = checkArgv("git log --oneline", []);
    expect(e?.kind).toBe("argv-refused");
  });

  test("a command carrying shell metacharacters is refused", () => {
    expect(checkArgv("git;rm", [])?.kind).toBe("argv-refused");
  });

  test("an empty command is refused", () => {
    expect(checkArgv("", [])?.kind).toBe("argv-refused");
  });

  test("a NUL in an argument is refused — execve would truncate there", () => {
    expect(checkArgv("git", ["log\u0000--all"])?.kind).toBe("argv-refused");
  });
});

describe("spawnArgv", () => {
  test("runs a program and returns its stdout", () => {
    const r = spawnArgv("git", ["--version"]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.stdout).toContain("git version");
      expect(r.value.status).toBe(0);
    }
  });

  test("a non-zero exit is an outcome, not an error", () => {
    const r = spawnArgv("git", ["rev-parse", "--verify", "definitely-not-a-ref"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.status).not.toBe(0);
  });

  test("a missing program is spawn-failed, as a Result", () => {
    const r = spawnArgv("zzz-no-such-program-zzz", []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("spawn-failed");
  });

  test("refuses the shell spellings before spawning anything", () => {
    const r = spawnArgv("/bin/sh", ["-c", "echo pwned"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("shell-refused");
  });
});

describe("spawnFromRoster — argv[0] is the ROSTER'S string, never the caller's", () => {
  test("a requested program in the roster runs", () => {
    const r = spawnFromRoster(["git", "gh"], "git", ["--version"]);
    expect(r.ok && r.value.stdout).toContain("git version");
  });

  test("a program NOT in the roster is refused, whatever it is", () => {
    const r = spawnFromRoster(["git"], "env", ["-i", "sh"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("argv-refused");
  });

  test("a near-miss is refused — matching is exact, never prefix or fuzzy", () => {
    for (const attempt of ["git ", " git", "GIT", "./git", "/usr/bin/git", "git;id"]) {
      const r = spawnFromRoster(["git"], attempt, ["--version"]);
      expect(r.ok).toBe(false);
    }
  });

  test("the refusal names the roster, so the caller can act on it", () => {
    const r = spawnFromRoster(["git", "gh"], "curl", []);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toContain("git");
      expect(r.error.message).toContain("gh");
    }
  });
});

describe("runCommandLineFromRoster", () => {
  test("the peer-call shape works end to end with no shell", () => {
    const r = runCommandLineFromRoster(["git", "gh", "rg"], "git --version");
    expect(r.ok && r.value.stdout).toContain("git version");
  });

  test("a pipeline is refused at the split, before the roster is consulted", () => {
    const r = runCommandLineFromRoster(["git"], "git log | head -c 10");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("shell-refused");
  });

  test("an off-roster program is refused after a clean split", () => {
    const r = runCommandLineFromRoster(["git"], "curl https://example.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("argv-refused");
  });
});

describe("spawnShellDeclared — the one sanctioned shell", () => {
  test("runs a real pipeline when the command line IS the contract", () => {
    const r = spawnShellDeclared("sh", "echo hi | tr a-z A-Z", { reason: "unit test of the declared channel" });
    expect(r.ok && r.value.stdout).toBe("HI\n");
  });

  test("an empty reason is REFUSED — an escape hatch with no reason is an allowlist", () => {
    const r = spawnShellDeclared("sh", "echo hi", { reason: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("shell-refused");
  });

  test("a NUL in the command line is refused", () => {
    const r = spawnShellDeclared("sh", "echo hi\u0000rm -rf /", { reason: "test" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("argv-refused");
  });

  test("bash selects a different literal argv[0]", () => {
    const r = spawnShellDeclared("bash", "echo ${BASH_VERSION:+bash}", { reason: "test" });
    expect(r.ok && r.value.stdout.trim()).toBe("bash");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TRUNCATION
// ═══════════════════════════════════════════════════════════════════════════

describe("truncateUtf8Bytes", () => {
  test("shorter than the bound is returned unchanged", () => {
    expect(truncateUtf8Bytes("abc", 10)).toBe("abc");
  });

  test("bounds by BYTES, not by UTF-16 code units", () => {
    // The defect this exists for: `String.slice(0, 20000)` on text with any
    // non-ASCII in it exceeds a 20000-BYTE bound, which is how a "bounded"
    // prompt overruns. Two accented characters are four bytes.
    const text = "ééééé";
    expect(text.slice(0, 4)).toHaveLength(4);
    expect(Buffer.byteLength(text.slice(0, 4), "utf8")).toBe(8);
    expect(Buffer.byteLength(truncateUtf8Bytes(text, 4), "utf8")).toBeLessThanOrEqual(4);
  });

  test("cuts on a codepoint boundary, never mid-sequence", () => {
    expect(truncateUtf8Bytes("héllo", 2)).toBe("h");
    expect(truncateUtf8Bytes("héllo", 3)).toBe("hé");
  });

  test("a non-positive bound yields the empty string", () => {
    expect(truncateUtf8Bytes("abc", 0)).toBe("");
    expect(truncateUtf8Bytes("abc", -1)).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NETWORK
// ═══════════════════════════════════════════════════════════════════════════

describe("network primitives", () => {
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/small") return new Response("hello");
      if (url.pathname === "/big") return new Response("x".repeat(100_000));
      if (url.pathname === "/teapot") return new Response("no", { status: 418 });
      if (url.pathname === "/slow") {
        // A stream that never enqueues and never closes. NO TIMER: the only
        // thing that ends this exchange is the CLIENT's own deadline, which is
        // exactly the property under test. A wall-clock delay on the server
        // side would make the verdict depend on machine load, which
        // `hygiene/audit-ambient-time-in-tests.ts` refuses -- rightly, and it
        // refused an earlier draft of this very handler.
        //
        // (That audit matches on raw source and does NOT mask comments, so an
        // earlier version of this note -- which merely NAMED the sleep call it
        // was explaining -- was itself reported as a finding. Same defect class
        // as the lint this PR ships is built to avoid; noted in the PR body.)
        return new Response(
          new ReadableStream({
            start() {
              // Deliberately silent.
            },
          }),
        );
      }
      return new Response("not found", { status: 404 });
    },
  });
  const base = `http://127.0.0.1:${String(server.port)}`;
  afterAll(() => {
    void server.stop(true);
  });

  test("fetchBounded returns a small body", async () => {
    const r = await fetchBounded(`${base}/small`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.body).toBe("hello");
      expect(r.value.truncated).toBe(false);
    }
  });

  test("fetchBounded stops at the cap instead of buffering the whole body", async () => {
    const r = await fetchBounded(`${base}/big`, { maxBytes: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.bytes).toBe(100);
      expect(r.value.truncated).toBe(true);
    }
  });

  test("fetchBounded reports a non-2xx as http-status", async () => {
    const r = await fetchBounded(`${base}/teapot`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("http-status");
  });

  test("a non-http scheme is refused before anything opens", async () => {
    for (const url of ["file:///etc/passwd", "data:text/plain,hi", "ftp://example.com/x"]) {
      const r = await fetchBounded(url);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.kind).toBe("protocol-refused");
    }
  });

  test("a malformed URL is refused, not thrown", async () => {
    const r = await fetchBounded("not a url");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("protocol-refused");
  });

  test("a timeout is a timeout, and is retryable", async () => {
    const r = await fetchBounded(`${base}/slow`, { timeoutMs: 150 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("timeout");
      expect(r.error.retryable).toBe(true);
    }
  });

  test("fetchToFile writes the body to the caller's path", async () => {
    const p = scratchPath("dl.txt");
    const r = await fetchToFile(`${base}/small`, p);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.bytes).toBe(5);
    expect(readFileBounded(p).ok && (readFileBounded(p) as { value: { text: string } }).value.text).toBe("hello");
  });

  test("an oversized body is refused AND LEAVES NO FILE BEHIND", async () => {
    // The property that matters most here. A half-written artifact at the
    // destination is worse than none: the next reader finds a file, believes
    // the download happened, and gets truncated content with no error.
    const p = scratchPath("toobig.bin");
    const r = await fetchToFile(`${base}/big`, p, { maxBytes: 1000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("too-large");
    expect(existsSync(p)).toBe(false);
  });

  test("an http error leaves no file behind either", async () => {
    const p = scratchPath("teapot.bin");
    const r = await fetchToFile(`${base}/teapot`, p);
    expect(r.ok).toBe(false);
    expect(existsSync(p)).toBe(false);
  });

  test("exclusive refuses to clobber an existing destination", async () => {
    const p = scratchPath("excl-dl.txt");
    expect(writeFileOwned(p, "PRIOR").ok).toBe(true);
    const r = await fetchToFile(`${base}/small`, p, { exclusive: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("already-exists");
    // And the prior content survives: the refusal is not a truncation.
    expect(readFileBounded(p).ok && (readFileBounded(p) as { value: { text: string } }).value.text).toBe("PRIOR");
  });

  test("fetchToFile refuses a non-http scheme", async () => {
    const r = await fetchToFile("file:///etc/passwd", scratchPath("never.txt"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("protocol-refused");
  });
});
