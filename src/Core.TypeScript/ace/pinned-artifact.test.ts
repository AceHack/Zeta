// pinned-artifact.test.ts — falsifiers for the pinned-install verifier.
//
// THE ONLY HALF THAT MATTERS IS THE REFUSAL. A verifier exercised solely on matching input
// cannot distinguish "the check passed" from "the check is not wired up" — which is the exact
// defect class the pin was written to remove. So the tests below are written so that DELETING
// the digest comparison in pinned-artifact.ts turns them red, not green.

import { describe, expect, test } from "bun:test";
import { digestMatches, installPinnedArtifact, parsePin, sha256Hex, type InstallEffects } from "./pinned-artifact.ts";
import { parseArgs } from "./install-pinned-artifact.ts";

const PAYLOAD = new TextEncoder().encode("pretend this is a 1.4GB tarball");
const PAYLOAD_SHA = sha256Hex(PAYLOAD);

const goodPin = () => ({
  entry: {
    name: "ollama",
    version: "0.32.13",
    contentAddress: `sha256:${PAYLOAD_SHA}`,
    weight: 1,
    packageManager: "ace",
    lastUpdated: "2026-08-16T00:00:00Z",
  },
  artifact: {
    tag: "v0.32.13",
    asset: "ollama-linux-amd64.tar.zst",
    url: "https://example.invalid/ollama-linux-amd64.tar.zst",
    platform: "linux/x86_64",
    sizeBytes: PAYLOAD.length,
    installsInto: "/usr/local",
    verify: { binary: "ollama", versionArgs: ["--version"] },
  },
});

interface Trace {
  readonly extracted: string[];
  readonly fetched: string[];
  /** `<path> <argv…>` for every process the module actually started. */
  readonly ran: string[];
  readonly madeExecutable: string[];
}

function effects(
  opts: {
    serve?: Uint8Array;
    fetchThrows?: string;
    host?: string;
    extractOk?: boolean;
    onPath?: boolean;
    versionOutput?: string;
    installerOk?: boolean;
    chmodOk?: boolean;
  } = {},
): { fx: InstallEffects; trace: Trace } {
  const trace: Trace = { extracted: [], fetched: [], ran: [], madeExecutable: [] };
  const fx: InstallEffects = {
    hostPlatform: () => opts.host ?? "linux/x86_64",
    fetchBytes: async (url) => {
      trace.fetched.push(url);
      if (opts.fetchThrows !== undefined) throw new Error(opts.fetchThrows);
      return opts.serve ?? PAYLOAD;
    },
    writeTemp: async (name) => `/tmp/${name}`,
    extract: async (archive, dest) => {
      trace.extracted.push(`${archive} -> ${dest}`);
      return opts.extractOk === false ? { ok: false, message: "tar refused" } : { ok: true, message: "" };
    },
    makeExecutable: async (path) => {
      trace.madeExecutable.push(path);
      return opts.chmodOk === false ? { ok: false, message: "chmod refused" } : { ok: true, message: "" };
    },
    which: async (b) => (opts.onPath === false ? null : `/usr/local/bin/${b}`),
    run: async (binary, args) => {
      trace.ran.push([binary, ...args].join(" "));
      // A run-installer invocation is the one that may be told to fail; the --version probe
      // that follows it is never the subject of `installerOk`.
      if (opts.installerOk === false && !args.includes("--version")) {
        return { ok: false, output: "rustup-init: could not write to ~/.cargo" };
      }
      return {
        ok: true,
        // The real `ollama --version` with no server running prints a warning FIRST and the
        // version on the second line — reproduced here because a `head -1` style match would
        // have rejected a perfectly good install.
        output:
          opts.versionOutput ??
          "Warning: could not connect to a running Ollama instance\nWarning: client version is 0.32.13\n",
      };
    },
    log: () => {},
  };
  return { fx, trace };
}

describe("digestMatches", () => {
  test("accepts the pinned bytes", () => {
    expect(digestMatches(`sha256:${PAYLOAD_SHA}`, PAYLOAD)).toBe(true);
  });

  test("REJECTS a single flipped byte", () => {
    const tampered = new Uint8Array(PAYLOAD);
    tampered[0] = (tampered[0] ?? 0) ^ 0x01;
    expect(digestMatches(`sha256:${PAYLOAD_SHA}`, tampered)).toBe(false);
  });

  test("REJECTS truncated bytes", () => {
    expect(digestMatches(`sha256:${PAYLOAD_SHA}`, PAYLOAD.slice(0, PAYLOAD.length - 1))).toBe(false);
  });

  test("REJECTS empty bytes — the shape a silently-failed download takes", () => {
    expect(digestMatches(`sha256:${PAYLOAD_SHA}`, new Uint8Array(0))).toBe(false);
  });
});

describe("parsePin refuses malformed pins rather than fetching on undefined", () => {
  test("a non-sha256 contentAddress", () => {
    const p = goodPin();
    const r = parsePin({ ...p, entry: { ...p.entry, contentAddress: "blake3:abc" } });
    expect(r.ok).toBe(false);
  });

  test("a SHORT hex digest — the shape that would 'verify' nothing", () => {
    const p = goodPin();
    const r = parsePin({ ...p, entry: { ...p.entry, contentAddress: "sha256:abc123" } });
    expect(r.ok).toBe(false);
  });

  test("a non-https url", () => {
    const p = goodPin();
    const r = parsePin({ ...p, artifact: { ...p.artifact, url: "http://example.invalid/x" } });
    expect(r.ok).toBe(false);
  });

  test("a missing verify block", () => {
    const p = goodPin() as Record<string, unknown>;
    const artifact = { ...(p["artifact"] as Record<string, unknown>) };
    delete artifact["verify"];
    expect(parsePin({ ...p, artifact }).ok).toBe(false);
  });

  test("the committed pin file itself parses", async () => {
    const raw = await Bun.file(new URL("../../../.github/ollama-pin.json", import.meta.url)).json();
    const r = parsePin(raw);
    expect(r.ok).toBe(true);
  });
});

describe("installPinnedArtifact", () => {
  test("happy path installs and reports the pinned version", async () => {
    const { fx, trace } = effects();
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(true);
    expect(trace.extracted.length).toBe(1);
  });

  test("WRONG BYTES ⇒ digest-mismatch AND NOTHING IS EXTRACTED", async () => {
    // The load-bearing assertion is the second one. A verifier that reports a mismatch after
    // having already unpacked the payload has detected nothing useful.
    const { fx, trace } = effects({ serve: new TextEncoder().encode("malicious replacement") });
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("digest-mismatch");
    expect(trace.extracted).toEqual([]);
  });

  test("an EMPTY response is refused, not treated as success", async () => {
    const { fx, trace } = effects({ serve: new Uint8Array(0) });
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(false);
    expect(trace.extracted).toEqual([]);
  });

  test("a wrong-platform host REFUSES instead of installing something that fits", async () => {
    const { fx, trace } = effects({ host: "darwin/arm64" });
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("platform-mismatch");
    expect(trace.fetched).toEqual([]); // refused before touching the network
  });

  test("a download failure is an outcome, not a throw", async () => {
    const { fx } = effects({ fetchThrows: "ECONNRESET" });
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("download-failed");
  });

  test("extraction failure surfaces as extract-failed", async () => {
    const { fx } = effects({ extractOk: false });
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("extract-failed");
  });

  test("binary absent from PATH after extraction is a failure", async () => {
    const { fx } = effects({ onPath: false });
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("not-on-path");
  });

  test("A SHADOWING OLDER BINARY is caught — correct archive, wrong thing on PATH", async () => {
    const { fx } = effects({ versionOutput: "ollama version is 0.19.0" });
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("version-mismatch");
  });

  test("the real two-line --version output (warning first) is ACCEPTED", async () => {
    const { fx } = effects({
      versionOutput: "Warning: could not connect to a running Ollama instance\nWarning: client version is 0.32.13\n",
    });
    const out = await installPinnedArtifact(goodPin(), fx);
    expect(out.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-PLATFORM PINS AND `run-installer` (081M24HZCYN087G0R002MT55TV)
//
// The rustup pin forced two capabilities the Ollama pin never needed: a LIST of artifacts
// (one digest cannot describe four platform builds) and bytes that are EXECUTED rather than
// unpacked. Both are only worth having if their refusals work, so every test below is written
// so that deleting the check turns it red.
// ─────────────────────────────────────────────────────────────────────────────

const INSTALLER = new TextEncoder().encode("#!/bin/sh\npretend this is rustup-init\n");
const INSTALLER_SHA = sha256Hex(INSTALLER);

/** Shaped exactly like tools/setup/rustup-pin.json, with a two-platform artifact list. */
const rustupPin = (over: Record<string, unknown> = {}) => ({
  entry: { name: "rustup-init", version: "1.29.1", weight: 1, packageManager: "ace", lastUpdated: "" },
  artifacts: [
    {
      tag: "1.29.1",
      asset: "rustup-init",
      url: "https://example.invalid/x86_64/rustup-init",
      platform: "linux/x86_64",
      sizeBytes: INSTALLER.length,
      contentAddress: `sha256:${INSTALLER_SHA}`,
      kind: "run-installer",
      runArgs: ["-y", "--no-modify-path"],
      installsInto: "~/.cargo",
      verify: { binary: "~/.cargo/bin/rustup", versionArgs: ["--version"] },
    },
    {
      tag: "1.29.1",
      asset: "rustup-init",
      url: "https://example.invalid/arm64/rustup-init",
      platform: "linux/arm64",
      // Deliberately a DIFFERENT digest: a shared one would let the wrong platform's bytes
      // satisfy this row, which is the whole reason inheritance is withheld from a list.
      sizeBytes: 1,
      contentAddress: `sha256:${"0".repeat(64)}`,
      kind: "run-installer",
      runArgs: ["-y", "--no-modify-path"],
      installsInto: "~/.cargo",
      verify: { binary: "~/.cargo/bin/rustup", versionArgs: ["--version"] },
    },
  ],
  ...over,
});

const RUSTUP_VERSION_LINE = "rustup 1.29.1 (0000000000 2026-01-01)";

describe("parsePin — multi-platform artifact lists", () => {
  test("the committed rustup pin parses", async () => {
    const raw = await Bun.file(new URL("../../../tools/setup/rustup-pin.json", import.meta.url)).json();
    const r = parsePin(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pin.artifacts.length).toBe(4);
  });

  test("REFUSES a list whose rows share one inherited digest — it could match at most one platform", () => {
    const p = rustupPin() as Record<string, unknown>;
    const artifacts = (p["artifacts"] as Record<string, unknown>[]).map((a) => {
      const copy = { ...a };
      delete copy["contentAddress"];
      return copy;
    });
    const r = parsePin({
      entry: { ...(p["entry"] as Record<string, unknown>), contentAddress: `sha256:${INSTALLER_SHA}` },
      artifacts,
    });
    expect(r.ok).toBe(false);
  });

  test("REFUSES a document declaring BOTH artifact and artifacts", () => {
    const single = goodPin();
    const r = parsePin({ ...single, artifacts: rustupPin().artifacts });
    expect(r.ok).toBe(false);
  });

  test("REFUSES the same platform twice — the second row could never be reached", () => {
    const p = rustupPin();
    const dup = [p.artifacts[0], { ...p.artifacts[0] }];
    expect(parsePin({ ...p, artifacts: dup }).ok).toBe(false);
  });

  test("REFUSES an empty artifact list rather than treating it as nothing-to-do", () => {
    expect(parsePin({ ...rustupPin(), artifacts: [] }).ok).toBe(false);
  });

  test("a SINGLE-artifact pin may still inherit entry.contentAddress — the ollama shape is untouched", () => {
    expect(parsePin(goodPin()).ok).toBe(true);
  });

  test("REFUSES runArgs on an archive rather than ignoring them", () => {
    const p = goodPin();
    expect(parsePin({ ...p, artifact: { ...p.artifact, runArgs: ["-y"] } }).ok).toBe(false);
  });

  test("REFUSES an unknown kind", () => {
    const p = goodPin();
    expect(parsePin({ ...p, artifact: { ...p.artifact, kind: "exec-it" } }).ok).toBe(false);
  });

  test("REFUSES a run-installer whose asset name carries a path separator", () => {
    // argv[0] decides what rustup-init believes it is; a path there is not a name.
    const p = rustupPin();
    const bad = [{ ...p.artifacts[0], asset: "bin/rustup-init" }];
    expect(parsePin({ ...p, artifacts: bad }).ok).toBe(false);
  });
});

describe("installPinnedArtifact — run-installer", () => {
  test("happy path: verifies, marks executable, RUNS, and proves the version", async () => {
    const { fx, trace } = effects({ serve: INSTALLER, versionOutput: RUSTUP_VERSION_LINE });
    const out = await installPinnedArtifact(rustupPin(), fx, ["--default-toolchain", "none"]);
    expect(out.ok).toBe(true);
    expect(trace.extracted).toEqual([]); // an installer is never unpacked
    expect(trace.madeExecutable).toEqual(["/tmp/rustup-init"]);
    // The caller's extra argv is appended to the pin's own, in that order.
    expect(trace.ran[0]).toBe("/tmp/rustup-init -y --no-modify-path --default-toolchain none");
  });

  test("WRONG BYTES ⇒ digest-mismatch AND NOTHING IS EXECUTED", async () => {
    // The load-bearing assertion is the second one. This is the entire difference from
    // `curl … | sh`, where the bytes have already run by the time anything could object.
    const { fx, trace } = effects({ serve: new TextEncoder().encode("malicious replacement") });
    const out = await installPinnedArtifact(rustupPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("digest-mismatch");
    expect(trace.ran).toEqual([]);
    expect(trace.madeExecutable).toEqual([]);
  });

  test("an EMPTY response is refused, not executed", async () => {
    const { fx, trace } = effects({ serve: new Uint8Array(0) });
    const out = await installPinnedArtifact(rustupPin(), fx);
    expect(out.ok).toBe(false);
    expect(trace.ran).toEqual([]);
  });

  test("selects the row matching the host, not the first row", async () => {
    // The arm64 row's digest is all zeroes, so reaching it with the x86_64 payload must fail.
    // That is what proves selection happened rather than index 0 being taken.
    const { fx } = effects({ host: "linux/arm64", serve: INSTALLER, versionOutput: RUSTUP_VERSION_LINE });
    const out = await installPinnedArtifact(rustupPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("digest-mismatch");
  });

  test("a host in NO row REFUSES before touching the network, and names the declared platforms", async () => {
    const { fx, trace } = effects({ host: "windows/x86_64" });
    const out = await installPinnedArtifact(rustupPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("platform-mismatch");
      expect(out.message).toContain("linux/arm64");
    }
    expect(trace.fetched).toEqual([]);
  });

  test("a chmod failure is installer-failed, and the installer is NOT run anyway", async () => {
    const { fx, trace } = effects({ serve: INSTALLER, chmodOk: false });
    const out = await installPinnedArtifact(rustupPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("installer-failed");
    expect(trace.ran).toEqual([]);
  });

  test("a non-zero installer exit is installer-failed, never a silent success", async () => {
    const { fx } = effects({ serve: INSTALLER, installerOk: false });
    const out = await installPinnedArtifact(rustupPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("installer-failed");
  });

  test("a SHADOWING older rustup is caught — correct installer, wrong thing resolvable", async () => {
    const { fx } = effects({ serve: INSTALLER, versionOutput: "rustup 1.26.0 (aaaaaaaaa 2023-04-05)" });
    const out = await installPinnedArtifact(rustupPin(), fx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("version-mismatch");
  });

  test("--run-arg against an ARCHIVE is refused, not silently dropped", async () => {
    // Dropping them would run an install nobody asked for while reporting success.
    const { fx, trace } = effects();
    const out = await installPinnedArtifact(goodPin(), fx, ["--default-toolchain", "none"]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("bad-pin");
    expect(trace.fetched).toEqual([]);
  });
});

describe("install-pinned-artifact parseArgs", () => {
  test("--run-arg=<value> carries a value that is ITSELF a flag", () => {
    // The attached form is what workflows must use: `audit-workflow-cli-flags.ts` reads command
    // lines as text with no operand model, so a separated `--run-arg --default-toolchain` reads
    // as an unknown flag handed to this tool and is refused.
    const a = parseArgs(["--pin", "p.json", "--run-arg=--default-toolchain", "--run-arg=none"]);
    expect(a.error).toBeUndefined();
    expect(a.runArgs).toEqual(["--default-toolchain", "none"]);
  });

  test("the separated form still works for a hand-typed invocation", () => {
    expect(parseArgs(["--pin", "p.json", "--run-arg", "-y"]).runArgs).toEqual(["-y"]);
  });

  test("--pin is required, and an unknown flag is an ERROR rather than a silent ignore", () => {
    expect(parseArgs([]).error).toBeDefined();
    expect(parseArgs(["--pin", "p.json", "--force"]).error).toBeDefined();
  });
});
