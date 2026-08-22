import { describe, expect, test } from "bun:test";
import type { DelegatedDeviceProposalSubmission } from "../planning/delegated-device-proposal";
import type { ProposalAuthorRegistry } from "../planning/proposal-verifier";
import { createGitHubCliDelegatedDeviceProposalIssuePort } from "./browser-delegated-device-proposal-gh-cli";
import {
  createBrowserDelegatedDeviceProposalRelay,
  type BrowserDelegatedDeviceProposalIssuePort,
} from "./browser-delegated-device-proposal-relay";

const EMPTY_REGISTRY: ProposalAuthorRegistry = {
  schema: "zeta.proposal-author-registry.v2",
  repository: "Lucent-Financial-Group/Zeta",
  sequence: 1,
  issuedAt: "2026-08-14T14:00:00.000Z",
  authors: [],
  revoked: {},
};

describe("browser delegated-device proposal relay", () => {
  test("BDPR-1: the gh adapter sends the signed body over stdin and accepts no credential argument", async () => {
    let captured: { readonly args: readonly string[]; readonly body: string } | undefined;
    const port = createGitHubCliDelegatedDeviceProposalIssuePort("Lucent-Financial-Group/Zeta", (args, body) => {
      captured = { args, body };
      return "https://github.com/Lucent-Financial-Group/Zeta/issues/42";
    });

    const result = await port.publish({ title: "bounded proposal", body: "signed-public-envelope" });

    expect(result).toEqual({
      ok: true,
      value: { issueUrl: "https://github.com/Lucent-Financial-Group/Zeta/issues/42" },
    });
    expect(captured?.args).toEqual([
      "issue",
      "create",
      "--repo",
      "Lucent-Financial-Group/Zeta",
      "--title",
      "bounded proposal",
      "--body-file",
      "-",
    ]);
    expect(captured?.body).toBe("signed-public-envelope");
    expect(captured?.args.join(" ")).not.toContain("token");
  });

  test("BDPR-2 FAULT INJECTION: malformed browser input never reaches the authenticated issue port", async () => {
    let calls = 0;
    const issues: BrowserDelegatedDeviceProposalIssuePort = {
      publish: () => {
        calls += 1;
        return Promise.resolve({
          ok: true,
          value: { issueUrl: "https://github.com/Lucent-Financial-Group/Zeta/issues/42" },
        });
      },
    };
    const relay = createBrowserDelegatedDeviceProposalRelay({
      registry: EMPTY_REGISTRY,
      currentMainSha: "a".repeat(40),
      issues,
      now: () => new Date("2026-08-14T14:00:00.000Z"),
    });

    const result = await relay.submit({} as DelegatedDeviceProposalSubmission);

    expect(result).toMatchObject({ ok: false, feedback: { code: "device-proposal-refused" } });
    expect(calls).toBe(0);
  });

  test("BDPR-3: a missing local gh login is typed backpressure rather than a leaked exception", async () => {
    const port = createGitHubCliDelegatedDeviceProposalIssuePort("Lucent-Financial-Group/Zeta", () => {
      throw new Error("not logged in");
    });

    expect(await port.publish({ title: "bounded proposal", body: "signed-public-envelope" })).toMatchObject({
      ok: false,
      feedback: { code: "device-proposal-carrier-refused", detail: expect.stringContaining("gh auth login") },
    });
  });
});
