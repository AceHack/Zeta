import {
  BROWSER_DATABASE_RECEIPT_ACCEPTED_RECORD_SCHEMA,
  type BrowserDatabaseReceiptAcceptedRecord,
  type BrowserDatabaseReceiptAcceptedRecordSource,
} from "./browser-database-receipt-proposal-acceptance";
import type { BrowserDatabaseReceiptHandoffResult } from "./browser-database-receipt-handoff";
import {
  BROWSER_DATABASE_RECEIPT_PAGES_INDEX_PATH,
  BROWSER_DATABASE_RECEIPT_PAGES_INDEX_SCHEMA,
  BROWSER_DATABASE_RECEIPT_PAGES_RECORD_ROOT,
  type BrowserDatabaseReceiptPagesIndex,
  type BrowserDatabaseReceiptPagesIndexEntry,
  type BrowserDatabaseReceiptPagesProposalAuthor,
} from "./browser-database-receipt-pages-contract";
import {
  BROWSER_DATABASE_RECEIPT_PROPOSAL_REPOSITORY,
  BROWSER_DATABASE_RECEIPT_PROPOSAL_ROOT,
} from "./browser-database-receipt-proposal";

export interface BrowserDatabaseReceiptPagesSourceLimits {
  readonly maxIndexBytes: number;
  readonly maxRecords: number;
  readonly maxAuthors: number;
  readonly maxRecordBytes: number;
}

export interface BrowserDatabaseReceiptPagesFetch {
  (input: string, init: RequestInit): Promise<Response>;
}

export interface BrowserDatabaseReceiptPagesSourceOptions {
  readonly baseUrl: string;
  readonly expectedOrigin: string;
  readonly fetch: BrowserDatabaseReceiptPagesFetch;
  readonly limits: BrowserDatabaseReceiptPagesSourceLimits;
}

export interface BrowserDatabaseReceiptPagesSource extends BrowserDatabaseReceiptAcceptedRecordSource {
  readIndex(): Promise<BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptPagesIndex | null>>;
}

type PagesFeedbackCode =
  | "receipt-handoff-acceptance-pages-configuration-invalid"
  | "receipt-handoff-acceptance-pages-transport-failed"
  | "receipt-handoff-acceptance-pages-index-invalid"
  | "receipt-handoff-acceptance-pages-capacity-exhausted";

const RECORD_PATH_PATTERN = new RegExp(
  `^${BROWSER_DATABASE_RECEIPT_PROPOSAL_ROOT.replaceAll("/", "\\/")}\\/([0-9a-f]{64})\\.json$`,
);

function succeeded<T>(value: T): BrowserDatabaseReceiptHandoffResult<T> {
  return { ok: true, value };
}

function failed(
  code: PagesFeedbackCode,
  detail: string,
  severity: "backpressure" | "heat" = "heat",
): BrowserDatabaseReceiptHandoffResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validLimits(limits: BrowserDatabaseReceiptPagesSourceLimits): boolean {
  return (
    Number.isSafeInteger(limits.maxIndexBytes) &&
    limits.maxIndexBytes >= 1 &&
    Number.isSafeInteger(limits.maxRecords) &&
    limits.maxRecords >= 1 &&
    Number.isSafeInteger(limits.maxAuthors) &&
    limits.maxAuthors >= 1 &&
    Number.isSafeInteger(limits.maxRecordBytes) &&
    limits.maxRecordBytes >= 1
  );
}

async function cancel(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // The response is already refused; cancellation is best-effort cleanup.
  }
}

async function boundedBytes(
  response: Response,
  maxBytes: number,
): Promise<BrowserDatabaseReceiptHandoffResult<Uint8Array>> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      return failed(
        "receipt-handoff-acceptance-pages-transport-failed",
        "The Pages response carried an invalid content-length.",
      );
    }
    if (parsed > maxBytes) {
      return failed(
        "receipt-handoff-acceptance-pages-capacity-exhausted",
        `The Pages response declares ${parsed.toString()} bytes; its read budget is ${maxBytes.toString()}.`,
        "backpressure",
      );
    }
  }
  if (response.body === null) return succeeded(new Uint8Array(0));

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.byteLength;
      if (total > maxBytes) {
        await cancel(reader);
        return failed(
          "receipt-handoff-acceptance-pages-capacity-exhausted",
          `The streamed Pages response exceeded its ${maxBytes.toString()} byte budget.`,
          "backpressure",
        );
      }
      chunks.push(item.value);
    }
  } catch {
    return failed(
      "receipt-handoff-acceptance-pages-transport-failed",
      "The Pages response stream failed before producing a complete value.",
      "backpressure",
    );
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return succeeded(output);
}

function decodeIndex(
  payload: Uint8Array,
  limits: BrowserDatabaseReceiptPagesSourceLimits,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptPagesIndex> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payload));
  } catch {
    return failed("receipt-handoff-acceptance-pages-index-invalid", "The Pages receipt index is not valid UTF-8 JSON.");
  }
  if (
    !isRecord(parsed) ||
    parsed.schema !== BROWSER_DATABASE_RECEIPT_PAGES_INDEX_SCHEMA ||
    parsed.repository !== BROWSER_DATABASE_RECEIPT_PROPOSAL_REPOSITORY ||
    parsed.ref !== "main" ||
    typeof parsed.revision !== "string" ||
    !/^[0-9a-f]{40}$/.test(parsed.revision) ||
    !isRecord(parsed.proposalAuthority) ||
    typeof parsed.proposalAuthority.registrySequence !== "number" ||
    !Number.isSafeInteger(parsed.proposalAuthority.registrySequence) ||
    parsed.proposalAuthority.registrySequence < 0 ||
    !Array.isArray(parsed.proposalAuthority.authors) ||
    !Array.isArray(parsed.records)
  ) {
    return failed(
      "receipt-handoff-acceptance-pages-index-invalid",
      "The Pages receipt index is not bound to this repository and an immutable main revision.",
    );
  }
  if (parsed.records.length > limits.maxRecords) {
    return failed(
      "receipt-handoff-acceptance-pages-capacity-exhausted",
      `The Pages receipt index carries ${parsed.records.length.toString()} records; its read budget is ${limits.maxRecords.toString()}.`,
      "backpressure",
    );
  }
  if (parsed.proposalAuthority.authors.length > limits.maxAuthors) {
    return failed(
      "receipt-handoff-acceptance-pages-capacity-exhausted",
      `The Pages receipt index carries ${parsed.proposalAuthority.authors.length.toString()} proposal authors; its read budget is ${limits.maxAuthors.toString()}.`,
      "backpressure",
    );
  }

  const authors: BrowserDatabaseReceiptPagesProposalAuthor[] = [];
  let previousCredentialId = "";
  for (const value of parsed.proposalAuthority.authors) {
    if (
      !isRecord(value) ||
      typeof value.credentialId !== "string" ||
      value.credentialId.length < 1 ||
      value.credentialId.length > 4096 ||
      value.credentialId <= previousCredentialId ||
      typeof value.origin !== "string" ||
      typeof value.rpId !== "string"
    ) {
      return failed(
        "receipt-handoff-acceptance-pages-index-invalid",
        "The Pages receipt index contains an invalid, duplicate, or unsorted proposal author.",
      );
    }
    let origin: URL;
    try {
      origin = new URL(value.origin);
    } catch {
      return failed(
        "receipt-handoff-acceptance-pages-index-invalid",
        "The Pages receipt index contains an invalid proposal-author origin.",
      );
    }
    if (origin.protocol !== "https:" || origin.origin !== value.origin || origin.hostname !== value.rpId) {
      return failed(
        "receipt-handoff-acceptance-pages-index-invalid",
        "The Pages receipt index contains a proposal author outside its exact HTTPS relying party.",
      );
    }
    authors.push({ credentialId: value.credentialId, origin: value.origin, rpId: value.rpId });
    previousCredentialId = value.credentialId;
  }

  const records: BrowserDatabaseReceiptPagesIndexEntry[] = [];
  let previousPath = "";
  for (const value of parsed.records) {
    if (
      !isRecord(value) ||
      typeof value.targetPath !== "string" ||
      RECORD_PATH_PATTERN.exec(value.targetPath) === null ||
      typeof value.byteLength !== "number" ||
      !Number.isSafeInteger(value.byteLength) ||
      value.byteLength < 0 ||
      value.targetPath <= previousPath
    ) {
      return failed(
        "receipt-handoff-acceptance-pages-index-invalid",
        "The Pages receipt index contains an invalid, duplicate, or unsorted record entry.",
      );
    }
    if (value.byteLength > limits.maxRecordBytes) {
      return failed(
        "receipt-handoff-acceptance-pages-capacity-exhausted",
        `The Pages receipt index declares ${value.byteLength.toString()} bytes for ${value.targetPath}; the record budget is ${limits.maxRecordBytes.toString()}.`,
        "backpressure",
      );
    }
    records.push({ targetPath: value.targetPath, byteLength: value.byteLength });
    previousPath = value.targetPath;
  }
  return succeeded({
    schema: BROWSER_DATABASE_RECEIPT_PAGES_INDEX_SCHEMA,
    repository: BROWSER_DATABASE_RECEIPT_PROPOSAL_REPOSITORY,
    ref: "main",
    revision: parsed.revision,
    proposalAuthority: {
      registrySequence: parsed.proposalAuthority.registrySequence,
      authors,
    },
    records,
  });
}

function request(url: URL): readonly [string, RequestInit] {
  return [
    url.href,
    {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers: { Accept: "application/json" },
    },
  ];
}

async function fetchResponse(
  fetchImpl: BrowserDatabaseReceiptPagesFetch,
  url: URL,
): Promise<BrowserDatabaseReceiptHandoffResult<Response>> {
  try {
    const response = await fetchImpl(...request(url));
    return succeeded(response);
  } catch {
    return failed(
      "receipt-handoff-acceptance-pages-transport-failed",
      "The same-origin Pages request failed before producing a response.",
      "backpressure",
    );
  }
}

function httpFailure(response: Response): BrowserDatabaseReceiptHandoffResult<never> {
  return failed(
    "receipt-handoff-acceptance-pages-transport-failed",
    `The same-origin Pages request returned HTTP ${response.status.toString()}.`,
    response.status === 429 || response.status >= 500 ? "backpressure" : "heat",
  );
}

/** Adapt a static Pages projection into the host-neutral accepted-record source. */
export function createBrowserDatabaseReceiptPagesSource(
  options: BrowserDatabaseReceiptPagesSourceOptions,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptPagesSource> {
  let baseUrl: URL;
  let expectedOrigin: string;
  try {
    baseUrl = new URL(options.baseUrl);
    expectedOrigin = new URL(options.expectedOrigin).origin;
  } catch {
    return failed(
      "receipt-handoff-acceptance-pages-configuration-invalid",
      "The Pages accepted-record source requires absolute base and origin URLs.",
    );
  }
  if (
    baseUrl.protocol !== "https:" ||
    baseUrl.origin !== expectedOrigin ||
    baseUrl.username.length > 0 ||
    baseUrl.password.length > 0 ||
    !validLimits(options.limits) ||
    typeof options.fetch !== "function"
  ) {
    return failed(
      "receipt-handoff-acceptance-pages-configuration-invalid",
      "The Pages accepted-record source requires one credential-free HTTPS origin and positive finite limits.",
    );
  }
  if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";
  baseUrl.search = "";
  baseUrl.hash = "";

  const readIndex = async (): Promise<BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptPagesIndex | null>> => {
    const response = await fetchResponse(options.fetch, new URL(BROWSER_DATABASE_RECEIPT_PAGES_INDEX_PATH, baseUrl));
    if (!response.ok) return response;
    if (response.value.status === 404) return succeeded(null);
    if (!response.value.ok) return httpFailure(response.value);
    const payload = await boundedBytes(response.value, options.limits.maxIndexBytes);
    return payload.ok ? decodeIndex(payload.value, options.limits) : payload;
  };

  return succeeded({
    readIndex,
    read: async (targetPath) => {
      const target = RECORD_PATH_PATTERN.exec(targetPath);
      if (target === null || target[1] === undefined) {
        return failed(
          "receipt-handoff-acceptance-pages-index-invalid",
          "The accepted-record source was asked for a non-canonical receipt path.",
        );
      }

      const index = await readIndex();
      if (!index.ok || index.value === null) return index;
      const entry = index.value.records.find((record) => record.targetPath === targetPath);
      if (entry === undefined) return succeeded(null);

      const recordUrl = new URL(`${BROWSER_DATABASE_RECEIPT_PAGES_RECORD_ROOT}/${target[1]}.json`, baseUrl);
      if (recordUrl.origin !== expectedOrigin) {
        return failed(
          "receipt-handoff-acceptance-pages-configuration-invalid",
          "The accepted receipt record resolved outside the trusted Pages origin.",
        );
      }
      const recordResponse = await fetchResponse(options.fetch, recordUrl);
      if (!recordResponse.ok) return recordResponse;
      if (recordResponse.value.status === 404) return succeeded(null);
      if (!recordResponse.value.ok) return httpFailure(recordResponse.value);
      const payload = await boundedBytes(recordResponse.value, options.limits.maxRecordBytes);
      if (!payload.ok) return payload;
      if (payload.value.byteLength !== entry.byteLength) {
        return failed(
          "receipt-handoff-acceptance-pages-index-invalid",
          "The accepted receipt bytes do not match the length committed by the Pages index.",
        );
      }

      const record: BrowserDatabaseReceiptAcceptedRecord = Object.freeze({
        schema: BROWSER_DATABASE_RECEIPT_ACCEPTED_RECORD_SCHEMA,
        repository: BROWSER_DATABASE_RECEIPT_PROPOSAL_REPOSITORY,
        ref: "main",
        revision: index.value.revision,
        targetPath,
        payload: payload.value,
      });
      return succeeded(record);
    },
  });
}
