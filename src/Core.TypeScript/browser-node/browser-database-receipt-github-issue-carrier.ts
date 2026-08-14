import type {
  BrowserDatabaseReceiptProposalCarrier,
  BrowserDatabaseReceiptProposalCarrierRequest,
  BrowserDatabaseReceiptProposalResult,
} from "./browser-database-receipt-proposal";

export const BROWSER_DATABASE_RECEIPT_PROPOSAL_ISSUE_MARKER = "<!-- zeta-proposal-v2 -->" as const;

export interface NativeBrowserDatabaseReceiptGitHubIssueCarrierOptions {
  readonly root: unknown;
  readonly repository: "Lucent-Financial-Group/Zeta";
  readonly maxUrlBytes: number;
}

interface NativeIssueHost {
  readonly openBlank: () => unknown;
  readonly isolate: (opened: Readonly<Record<string, unknown>>) => boolean;
  readonly navigate: (opened: Readonly<Record<string, unknown>>, url: string) => boolean;
}

function succeeded<T>(value: T): BrowserDatabaseReceiptProposalResult<T> {
  return { ok: true, value };
}

function failed(detail: string, severity: "backpressure" | "heat" = "heat"): BrowserDatabaseReceiptProposalResult<never> {
  return { ok: false, feedback: { severity, code: "receipt-proposal-carrier-rejected", detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nativeHost(root: unknown): NativeIssueHost | null {
  if (!isRecord(root)) return null;
  try {
    const open = Reflect.get(root, "open");
    if (typeof open !== "function") return null;
    return {
      openBlank: () => Reflect.apply(open, root, ["", "_blank"]) as unknown,
      isolate: (opened) => Reflect.set(opened, "opener", null),
      navigate: (opened, url) => {
        const location = Reflect.get(opened, "location");
        return isRecord(location) && Reflect.set(location, "href", url);
      },
    };
  } catch {
    return null;
  }
}

/** Encode the exact issue carrier consumed by the gated-commit workflow. */
export function encodeBrowserDatabaseReceiptProposalIssueBody(
  request: BrowserDatabaseReceiptProposalCarrierRequest,
): string {
  return `${BROWSER_DATABASE_RECEIPT_PROPOSAL_ISSUE_MARKER}\n\n## Requested change\n\n${request.artifact.patch.trim()}\n\n## Signed proposal envelope\n\n\`\`\`json\n${JSON.stringify(request.proposal, null, 2)}\n\`\`\`\n`;
}

function issueUrl(repository: string, request: BrowserDatabaseReceiptProposalCarrierRequest): string {
  const title = `Browser receipt ${request.artifact.contentHash.slice("blake3:".length, "blake3:".length + 16)}`;
  const query = new URLSearchParams({ title, body: encodeBrowserDatabaseReceiptProposalIssueBody(request) });
  return `https://github.com/${repository}/issues/new?${query.toString()}`;
}

/**
 * Present a GitHub-owned issue composer without exposing a repository token to
 * the page. Presentation is not submission; durable acceptance is observed later.
 */
export function createNativeBrowserDatabaseReceiptGitHubIssueCarrier(
  options: NativeBrowserDatabaseReceiptGitHubIssueCarrierOptions,
): BrowserDatabaseReceiptProposalResult<BrowserDatabaseReceiptProposalCarrier> {
  const host = nativeHost(options.root);
  if (
    host === null ||
    options.repository !== "Lucent-Financial-Group/Zeta" ||
    !Number.isSafeInteger(options.maxUrlBytes) ||
    options.maxUrlBytes < 1
  ) {
    return failed("The GitHub issue carrier requires the Zeta repository, a browser navigation edge, and a finite URL budget.");
  }

  return succeeded({
    carry: (request) => {
      const url = issueUrl(options.repository, request);
      if (new TextEncoder().encode(url).byteLength > options.maxUrlBytes) {
        return Promise.resolve(
          failed(
            `The GitHub issue composer URL exceeds its ${options.maxUrlBytes.toString()} byte budget.`,
            "backpressure",
          ),
        );
      }
      let opened: unknown;
      try {
        opened = host.openBlank();
      } catch {
        return Promise.resolve(failed("The browser threw while opening the GitHub issue composer."));
      }
      if (opened === null || opened === undefined) {
        return Promise.resolve(
          failed("The browser blocked the GitHub issue composer; no proposal was presented.", "backpressure"),
        );
      }
      if (!isRecord(opened)) {
        return Promise.resolve(failed("The browser returned no controllable GitHub issue composer."));
      }
      try {
        if (!host.isolate(opened)) {
          return Promise.resolve(failed("The browser could not isolate the GitHub issue composer from its opener."));
        }
        if (!host.navigate(opened, url)) {
          return Promise.resolve(failed("The browser could not navigate the isolated GitHub issue composer."));
        }
      } catch {
        return Promise.resolve(failed("The browser could not isolate and navigate the GitHub issue composer."));
      }
      return Promise.resolve(
        succeeded({
          proposalId: request.proposal.proposalId,
          reference: `github-issue-compose:${request.proposal.proposalId}`,
          disposition: "presented",
        }),
      );
    },
  });
}
