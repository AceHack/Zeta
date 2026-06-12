#!/usr/bin/env bun
/**
 * Cursor GitHub MCP launcher.
 *
 * The Cursor marketplace "GitHub" plugin (plugin-github-github) tries OAuth
 * against api.githubcopilot.com/mcp/, which rejects malformed/empty Bearer
 * headers ("Authorization header is badly formatted"). This wrapper injects a
 * fresh token from `gh auth token` (keyring) into the official docker image.
 *
 * Prereqs: `gh auth login`, Docker running.
 */
import { spawn, spawnSync } from "node:child_process";

function fail(message: string): never {
  console.error(`github-mcp: ${message}`);
  process.exit(1);
}

const gh = spawnSync("gh", ["auth", "token"], { encoding: "utf8" });
if (gh.status !== 0) {
  fail("run `gh auth login` first");
}
const token = gh.stdout.trim();
if (!token) {
  fail("empty token from `gh auth token`");
}

const child = spawn(
  "docker",
  [
    "run",
    "-i",
    "--rm",
    "-e",
    `GITHUB_PERSONAL_ACCESS_TOKEN=${token}`,
    "ghcr.io/github/github-mcp-server",
  ],
  { stdio: "inherit" },
);

child.on("error", (err) => {
  fail(err.message);
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
