#!/usr/bin/env bun
import { describe, it, expect } from "bun:test";
import { checkPeerSessions, formatResult, mainResult, PGREP_ERROR_EXIT } from "./cron-sentinel-mutex";
import type { spawnSync } from "node:child_process";

type SpawnSync = typeof spawnSync;

function fakeSpawn(stdoutLines: string[], status = 0, error?: Error): SpawnSync {
  return (() => ({
    pid: 1,
    output: [],
    stdout: stdoutLines.join("\n"),
    stderr: "",
    status,
    signal: null,
    error,
  })) as unknown as SpawnSync;
}

describe("checkPeerSessions", () => {
  it("returns peerDetected=false when no peers found", () => {
    const r = checkPeerSessions(12345, fakeSpawn([], 1));
    expect(r.peerDetected).toBe(false);
    expect(r.peerPids).toEqual([]);
    expect(r.myPid).toBe(12345);
  });

  it("excludes the self-PID from peers", () => {
    const lines = [
      "12345 /path/to/claude-code --output-format stream-json --verbose --input-format stream-json",
      "67890 /path/to/claude-code --output-format stream-json --input-format stream-json",
    ];
    const r = checkPeerSessions(12345, fakeSpawn(lines, 0));
    expect(r.peerDetected).toBe(true);
    expect(r.peerPids).toEqual([67890]);
  });

  it("excludes parent/disclaimer/finder helpers lacking the stdio flags", () => {
    const lines = [
      "100 /Applications/Claude.app/Contents/MacOS/Claude",
      "200 /Applications/Claude.app/Contents/Helpers/disclaimer",
      "300 /path/to/claude-code --output-format stream-json --input-format stream-json",
    ];
    const r = checkPeerSessions(999, fakeSpawn(lines, 0));
    // Only 300 has the stdio-mode flags; 100 and 200 are ancestors.
    expect(r.peerPids).toEqual([300]);
    expect(r.peerDetected).toBe(true);
  });

  it("returns no peers when pgrep stdout is empty even if status=0", () => {
    const r = checkPeerSessions(1, fakeSpawn([], 0));
    expect(r.peerDetected).toBe(false);
  });

  it("ignores malformed pgrep lines", () => {
    const lines = [
      "not-a-pid /path/to/claude-code --output-format ...",
      "  ",
      "999 /path/to/claude-code --output-format stream-json --input-format stream-json",
    ];
    const r = checkPeerSessions(1, fakeSpawn(lines, 0));
    expect(r.peerPids).toEqual([999]);
  });

  it("excludes the self-PID even when its line matches the stdio pattern", () => {
    const lines = [
      "555 /path/to/claude-code --output-format stream-json --input-format stream-json",
    ];
    const r = checkPeerSessions(555, fakeSpawn(lines, 0));
    expect(r.peerDetected).toBe(false);
  });

  it("returns pgrepError when spawn fails (binary missing or permission denied)", () => {
    const r = checkPeerSessions(1, fakeSpawn([], 0, new Error("ENOENT: pgrep not found")));
    expect(r.peerDetected).toBe(false);
    expect(r.pgrepError).toBe("ENOENT: pgrep not found");
    expect(r.peerPids).toEqual([]);
  });

  it("returns pgrepError when pgrep exits with status > 1 (runtime error)", () => {
    const r = checkPeerSessions(1, fakeSpawn([], 2));
    expect(r.peerDetected).toBe(false);
    expect(r.pgrepError).toBe("pgrep exited with status 2");
  });
});

describe("formatResult", () => {
  it("formats no-peers case as a single line", () => {
    const out = formatResult({ myPid: 42, peerPids: [], peerLines: [], peerDetected: false });
    expect(out).toContain("no peer");
    expect(out).toContain("self PID 42");
  });

  it("formats pgrep error case with unknown-mutex-state message", () => {
    const out = formatResult({ myPid: 42, peerPids: [], peerLines: [], peerDetected: false, pgrepError: "ENOENT: pgrep not found" });
    expect(out).toContain("pgrep failed");
    expect(out).toContain("ENOENT: pgrep not found");
    expect(out).toContain("mutex state unknown");
  });

  it("formats peer-detected case with multi-line summary", () => {
    const out = formatResult({
      myPid: 42,
      peerPids: [100, 200],
      peerLines: ["100 cmd a", "200 cmd b"],
      peerDetected: true,
    });
    expect(out).toContain("2 peer");
    expect(out).toContain("100 cmd a");
    expect(out).toContain("200 cmd b");
  });
});

describe("mainResult", () => {
  it("returns 0 when no peers and no error", () => {
    expect(mainResult({ myPid: 1, peerPids: [], peerLines: [], peerDetected: false })).toBe(0);
  });

  it("returns 1 + peer count when peers detected", () => {
    expect(mainResult({ myPid: 1, peerPids: [99], peerLines: ["99 ..."], peerDetected: true })).toBe(2);
    expect(mainResult({ myPid: 1, peerPids: [99, 100, 101], peerLines: [], peerDetected: true })).toBe(4);
  });

  it("clamps peer-count exit code to 250", () => {
    const manyPeers = Array.from({ length: 300 }, (_, i) => i);
    expect(mainResult({ myPid: 1, peerPids: manyPeers, peerLines: [], peerDetected: true })).toBe(250);
  });

  it("returns PGREP_ERROR_EXIT (251) when pgrepError is set, even with no peers", () => {
    expect(mainResult({
      myPid: 1, peerPids: [], peerLines: [], peerDetected: false,
      pgrepError: "ENOENT: pgrep not found",
    })).toBe(PGREP_ERROR_EXIT);
    expect(PGREP_ERROR_EXIT).toBe(251);
  });

  it("returns PGREP_ERROR_EXIT even when peers were also detected (error takes precedence)", () => {
    expect(mainResult({
      myPid: 1, peerPids: [99], peerLines: [], peerDetected: true,
      pgrepError: "pgrep exited with status 2",
    })).toBe(PGREP_ERROR_EXIT);
  });
});
