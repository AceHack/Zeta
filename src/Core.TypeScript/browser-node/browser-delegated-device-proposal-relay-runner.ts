import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DelegatedDeviceProposalSubmission } from "../planning/delegated-device-proposal";
import { loadProposalAuthorRegistry } from "../planning/proposal-gated-commit";
import { createGitHubCliDelegatedDeviceProposalIssuePort } from "./browser-delegated-device-proposal-gh-cli";
import { createBrowserDelegatedDeviceProposalRelay } from "./browser-delegated-device-proposal-relay";

const REPOSITORY = "Lucent-Financial-Group/Zeta";

function git(args: readonly string[]): string {
  return execFileSync("git", [...args], { encoding: "utf8" }).trim();
}

async function run(): Promise<number> {
  const source = process.argv[2];
  if (!source) {
    process.stderr.write(
      "usage: bun src/Core.TypeScript/browser-node/browser-delegated-device-proposal-relay-runner.ts <signed-submission.json>\n",
    );
    return 2;
  }
  try {
    const repoRoot = git(["rev-parse", "--show-toplevel"]);
    const registry = loadProposalAuthorRegistry(resolve(repoRoot, "docs/security/proposal-author-registry.json"));
    if (!registry.ok) {
      process.stderr.write(`${registry.message}\n`);
      return 1;
    }
    const submission = JSON.parse(readFileSync(resolve(source), "utf8")) as DelegatedDeviceProposalSubmission;
    const relay = createBrowserDelegatedDeviceProposalRelay({
      registry: registry.value,
      currentMainSha: git(["rev-parse", "origin/main"]),
      issues: createGitHubCliDelegatedDeviceProposalIssuePort(REPOSITORY),
    });
    const result = await relay.submit(submission);
    if (!result.ok) {
      process.stderr.write(`${result.feedback.detail}\n`);
      return 1;
    }
    process.stdout.write(`${result.value.issueUrl}\n`);
    return 0;
  } catch {
    process.stderr.write("The local proposal relay could not read or validate the signed submission.\n");
    return 1;
  }
}

if (import.meta.main) process.exitCode = await run();
