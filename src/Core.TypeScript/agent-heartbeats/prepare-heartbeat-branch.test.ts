import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "bun:test";

import { prepareHeartbeatBranch } from "./prepare-heartbeat-branch";

const roots: string[] = [];

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function fixture(): { readonly root: string; readonly work: string } {
  const root = mkdtempSync(join(tmpdir(), "zeta-heartbeat-accumulate-"));
  roots.push(root);
  git(root, "init", "--bare", "origin.git");
  git(root, "clone", join(root, "origin.git"), "work");
  const work = join(root, "work");
  git(work, "config", "user.name", "test");
  git(work, "config", "user.email", "test@example.invalid");
  git(work, "switch", "-c", "main");
  writeFileSync(join(work, "base.txt"), "base\n");
  git(work, "add", "base.txt");
  git(work, "commit", "-m", "base");
  git(work, "push", "-u", "origin", "main");
  return { root, work };
}

function commitFile(work: string, path: string, content: string, message: string): void {
  writeFileSync(join(work, path), content);
  git(work, "add", path);
  git(work, "commit", "-m", message);
}

function pushLane(work: string): void {
  git(work, "push", "--force-with-lease", "origin", "heartbeat/alexa");
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("prepareHeartbeatBranch", () => {
  it("starts a new lane from current main without staged state", () => {
    const { work } = fixture();
    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toEqual({
      ok: true,
      value: { head: "heartbeat/alexa", remoteFound: false, carried: false },
    });
    expect(git(work, "branch", "--show-current")).toBe("heartbeat/alexa");
  });

  it("carries multiple unflushed ticks when the mutable lane is rebuilt", () => {
    const { work } = fixture();
    git(work, "switch", "-c", "heartbeat/alexa");
    commitFile(work, "event-1.json", '{"tick":1}\n', "tick 1");
    pushLane(work);

    git(work, "switch", "main");
    const firstCarry = prepareHeartbeatBranch("alexa", work);
    expect(firstCarry).toMatchObject({ ok: true, value: { remoteFound: true, carried: true } });
    git(work, "commit", "-m", "carry tick 1");
    commitFile(work, "event-2.json", '{"tick":2}\n', "tick 2");
    pushLane(work);

    git(work, "switch", "main");
    const secondCarry = prepareHeartbeatBranch("alexa", work);
    expect(secondCarry).toMatchObject({ ok: true, value: { remoteFound: true, carried: true } });
    expect(readFileSync(join(work, "event-1.json"), "utf8")).toContain('"tick":1');
    expect(readFileSync(join(work, "event-2.json"), "utf8")).toContain('"tick":2');
    expect(git(work, "diff", "--cached", "--name-only").split("\n").sort()).toEqual(["event-1.json", "event-2.json"]);
  });

  it("does not restage a lane whose final tree already landed by squash", () => {
    const { work } = fixture();
    git(work, "switch", "-c", "heartbeat/alexa");
    commitFile(work, "event-1.json", '{"tick":1}\n', "tick 1");
    pushLane(work);

    git(work, "switch", "main");
    git(work, "merge", "--squash", "origin/heartbeat/alexa");
    git(work, "commit", "-m", "flush tick 1");
    git(work, "push", "origin", "main");

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result).toMatchObject({ ok: true, value: { remoteFound: true, carried: false } });
    expect(readFileSync(join(work, "event-1.json"), "utf8")).toContain('"tick":1');
    expect(git(work, "diff", "--cached", "--name-only")).toBe("");
  });

  it("reports a content conflict and leaves the remote lane unchanged", () => {
    const { work } = fixture();
    git(work, "switch", "-c", "heartbeat/alexa");
    commitFile(work, "base.txt", "lane\n", "lane edit");
    pushLane(work);
    const remoteBefore = git(work, "rev-parse", "origin/heartbeat/alexa");

    git(work, "switch", "main");
    commitFile(work, "base.txt", "main\n", "main edit");
    git(work, "push", "origin", "main");

    const result = prepareHeartbeatBranch("alexa", work);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("conflicting state was accepted");
    expect(result.error).toContain("carry unflushed heartbeat state failed");
    expect(git(work, "ls-remote", "origin", "refs/heads/heartbeat/alexa").split("\t")[0]).toBe(remoteBefore);
  });

  it("rejects an unsafe lane name as a value", () => {
    const { work } = fixture();
    expect(prepareHeartbeatBranch("../../main", work)).toEqual({
      ok: false,
      error: "agent must be one safe branch component; got ../../main",
    });
  });
});
