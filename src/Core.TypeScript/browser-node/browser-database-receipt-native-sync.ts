import { createBrowserDatabaseReceiptProposalAcceptanceHandoff } from "./browser-database-receipt-proposal-acceptance";
import { createNativeBrowserDatabaseReceiptGitHubIssueCarrier } from "./browser-database-receipt-github-issue-carrier";
import { createNativeBrowserDatabaseReceiptIntentSource } from "./browser-database-receipt-native-intent-source";
import { createNativeBrowserDatabaseReceiptPasskeySigner } from "./browser-database-receipt-passkey-signer";
import {
  createBrowserDatabaseReceiptPagesSource,
  type BrowserDatabaseReceiptPagesFetch,
} from "./browser-database-receipt-pages-source";
import { createBrowserDatabaseReceiptProposalPort } from "./browser-database-receipt-proposal";
import {
  createBrowserDatabaseReceiptSyncRuntime,
  type BrowserDatabaseReceiptSyncResult,
  type BrowserDatabaseReceiptSyncRuntime,
} from "./browser-database-receipt-sync-runtime";
import type {
  BrowserDatabaseReceiptArchiveMaintenancePort,
  BrowserDatabaseReceiptBatchHasher,
  BrowserDatabaseReceiptHandoffLimits,
} from "./browser-database-receipt-handoff";

export interface NativeBrowserDatabaseReceiptSyncLimits {
  readonly pagesIndexBytes: number;
  readonly pagesRecords: number;
  readonly pagesAuthors: number;
  readonly recordBytes: number;
  readonly patchBytes: number;
  readonly issueUrlBytes: number;
  readonly passkeyTimeoutMs: number;
  readonly proposalLifetimeMs: number;
}

export interface NativeBrowserDatabaseReceiptSyncOptions {
  readonly root: unknown;
  readonly baseUrl: string;
  readonly expectedOrigin: string;
  readonly rpId: string;
  readonly databaseNodeId: string;
  readonly archiveNodeId: string;
  readonly targetNodeId: string;
  readonly archive: BrowserDatabaseReceiptArchiveMaintenancePort;
  readonly hasher: BrowserDatabaseReceiptBatchHasher;
  readonly handoffLimits: BrowserDatabaseReceiptHandoffLimits;
  readonly limits: NativeBrowserDatabaseReceiptSyncLimits;
  readonly now: () => number;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nativeFetch(root: unknown): BrowserDatabaseReceiptPagesFetch | null {
  if (!isRecord(root)) return null;
  try {
    const candidate = Reflect.get(root, "fetch");
    return typeof candidate === "function"
      ? (input, init) => Reflect.apply(candidate, root, [input, init]) as Promise<Response>
      : null;
  } catch {
    return null;
  }
}

function configurationFailure(detail: string): BrowserDatabaseReceiptSyncResult<never> {
  return {
    ok: false,
    feedback: { severity: "heat", code: "receipt-sync-configuration-invalid", detail },
  };
}

/** Compose native browser edges without giving the page a repository credential. */
export function createNativeBrowserDatabaseReceiptSync(
  options: NativeBrowserDatabaseReceiptSyncOptions,
): BrowserDatabaseReceiptSyncResult<BrowserDatabaseReceiptSyncRuntime> {
  const fetchImpl = nativeFetch(options.root);
  if (fetchImpl === null) {
    return configurationFailure("The native receipt synchronization edge requires browser fetch.");
  }
  const pages = createBrowserDatabaseReceiptPagesSource({
    baseUrl: options.baseUrl,
    expectedOrigin: options.expectedOrigin,
    fetch: fetchImpl,
    limits: {
      maxIndexBytes: options.limits.pagesIndexBytes,
      maxRecords: options.limits.pagesRecords,
      maxAuthors: options.limits.pagesAuthors,
      maxRecordBytes: options.limits.recordBytes,
    },
  });
  if (!pages.ok) return { ok: false, feedback: pages.feedback };

  const intents = createNativeBrowserDatabaseReceiptIntentSource({
    root: options.root,
    expectedOrigin: options.expectedOrigin,
    rpId: options.rpId,
    now: options.now,
    expiresInMs: options.limits.proposalLifetimeMs,
    pages: pages.value,
  });
  if (!intents.ok) return { ok: false, feedback: intents.feedback };
  const signer = createNativeBrowserDatabaseReceiptPasskeySigner({
    root: options.root,
    expectedOrigin: options.expectedOrigin,
    rpId: options.rpId,
    timeoutMs: options.limits.passkeyTimeoutMs,
    now: options.now,
    intents: intents.value,
  });
  if (!signer.ok) return { ok: false, feedback: signer.feedback };
  const carrier = createNativeBrowserDatabaseReceiptGitHubIssueCarrier({
    root: options.root,
    repository: "Lucent-Financial-Group/Zeta",
    maxUrlBytes: options.limits.issueUrlBytes,
  });
  if (!carrier.ok) return { ok: false, feedback: carrier.feedback };
  const proposal = createBrowserDatabaseReceiptProposalPort({
    hasher: options.hasher,
    signer: signer.value,
    carrier: carrier.value,
    limits: { maxPatchBytes: options.limits.patchBytes },
  });
  if (!proposal.ok) return { ok: false, feedback: proposal.feedback };
  const acceptance = createBrowserDatabaseReceiptProposalAcceptanceHandoff({
    targetNodeId: options.targetNodeId,
    source: pages.value,
    hasher: options.hasher,
    maxRecordBytes: options.limits.recordBytes,
  });
  if (!acceptance.ok) return { ok: false, feedback: acceptance.feedback };
  return createBrowserDatabaseReceiptSyncRuntime({
    databaseNodeId: options.databaseNodeId,
    archiveNodeId: options.archiveNodeId,
    targetNodeId: options.targetNodeId,
    archive: options.archive,
    hasher: options.hasher,
    limits: options.handoffLimits,
    proposal: proposal.value,
    acceptance: acceptance.value,
  });
}
