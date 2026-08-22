import { execFileSync } from "node:child_process";
import type {
  BrowserDelegatedDeviceProposalIssuePort,
  BrowserDelegatedDeviceProposalRelayResult,
} from "./browser-delegated-device-proposal-relay";

export type GitHubIssueCreateExec = (args: readonly string[], body: string) => string;

function refused(detail: string): BrowserDelegatedDeviceProposalRelayResult {
  return {
    ok: false,
    feedback: { severity: "heat", code: "device-proposal-carrier-refused", detail },
  };
}

/** Use `gh`'s credential store without exposing a token to the PWA or this adapter. */
export function createGitHubCliDelegatedDeviceProposalIssuePort(
  repository: string,
  execute: GitHubIssueCreateExec = (args, body) =>
    execFileSync("gh", [...args], {
      encoding: "utf8",
      input: body,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim(),
): BrowserDelegatedDeviceProposalIssuePort {
  return {
    async publish(input) {
      try {
        const issueUrl = execute(
          ["issue", "create", "--repo", repository, "--title", input.title, "--body-file", "-"],
          input.body,
        ).trim();
        return /^https:\/\/github\.com\/[^\s]+\/issues\/\d+$/u.test(issueUrl)
          ? { ok: true, value: { issueUrl } }
          : refused("GitHub CLI returned no canonical issue URL after accepting the signed proposal.");
      } catch {
        return refused(
          "GitHub CLI refused the signed proposal. Complete one local `gh auth login` device ceremony and retry without moving the token into the browser.",
        );
      }
    },
  };
}
