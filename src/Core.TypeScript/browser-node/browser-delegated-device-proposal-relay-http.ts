import type { DelegatedDeviceProposalSubmission } from "../planning/delegated-device-proposal-contract";
import type { ProposalAuthorRegistry } from "../planning/proposal-verifier";
import {
  createBrowserDelegatedDeviceProposalRelay,
  type BrowserDelegatedDeviceProposalIssuePort,
} from "./browser-delegated-device-proposal-relay";

export const BROWSER_DELEGATED_DEVICE_RELAY_PATH = "/v1/delegated-device-proposals" as const;
export const BROWSER_DELEGATED_DEVICE_RELAY_MAX_BYTES = 64 * 1024;

export interface BrowserDelegatedDeviceRelayAuthority {
  readonly registry: ProposalAuthorRegistry;
  readonly currentMainSha: string;
}

export interface BrowserDelegatedDeviceRelayAuthorityPort {
  load(): Promise<
    | { readonly ok: true; readonly value: BrowserDelegatedDeviceRelayAuthority }
    | { readonly ok: false; readonly detail: string }
  >;
}

function cors(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Private-Network": "true",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

function json(origin: string, status: number, value: unknown): Response {
  return Response.json(value, { status, headers: cors(origin) });
}

/** Create the loopback companion endpoint. Every accepted body is still signature-verified locally. */
export function createBrowserDelegatedDeviceProposalRelayHttpHandler(options: {
  readonly expectedOrigin: string;
  readonly authority: BrowserDelegatedDeviceRelayAuthorityPort;
  readonly issues: BrowserDelegatedDeviceProposalIssuePort;
  readonly now?: () => Date;
  readonly maxBytes?: number;
}): (request: Request) => Promise<Response> {
  const consumedProposalIds = new Set<string>();
  const consumedNonces = new Set<string>();
  const maxBytes = options.maxBytes ?? BROWSER_DELEGATED_DEVICE_RELAY_MAX_BYTES;

  return async (request) => {
    const origin = request.headers.get("Origin") ?? "";
    if (origin !== options.expectedOrigin) {
      return json(options.expectedOrigin, 403, { ok: false, detail: "The loopback relay refused a foreign origin." });
    }
    const url = new URL(request.url);
    if (url.pathname !== BROWSER_DELEGATED_DEVICE_RELAY_PATH) {
      return json(origin, 404, { ok: false, detail: "No proposal relay exists at this path." });
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== "POST") {
      return json(origin, 405, { ok: false, detail: "The proposal relay accepts POST only." });
    }
    if (request.headers.get("Content-Type")?.split(";", 1)[0] !== "application/json") {
      return json(origin, 415, { ok: false, detail: "The proposal relay accepts canonical JSON only." });
    }
    const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return json(origin, 413, { ok: false, detail: "The signed proposal exceeds the loopback relay byte cap." });
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await request.arrayBuffer());
    } catch {
      return json(origin, 400, { ok: false, detail: "The loopback relay could not read the request body." });
    }
    if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) {
      return json(origin, 413, { ok: false, detail: "The signed proposal is empty or exceeds the relay byte cap." });
    }
    let submission: DelegatedDeviceProposalSubmission;
    try {
      submission = JSON.parse(new TextDecoder().decode(bytes)) as DelegatedDeviceProposalSubmission;
    } catch {
      return json(origin, 400, { ok: false, detail: "The loopback relay received malformed JSON." });
    }
    let authority: Awaited<ReturnType<BrowserDelegatedDeviceRelayAuthorityPort["load"]>>;
    try {
      authority = await options.authority.load();
    } catch {
      return json(origin, 503, { ok: false, detail: "The local authority source threw while refreshing main." });
    }
    if (!authority.ok) return json(origin, 503, { ok: false, detail: authority.detail });
    const result = await createBrowserDelegatedDeviceProposalRelay({
      registry: authority.value.registry,
      currentMainSha: authority.value.currentMainSha,
      issues: options.issues,
      ...(options.now === undefined ? {} : { now: options.now }),
      consumedProposalIds,
      consumedNonces,
    }).submit(submission);
    return result.ok
      ? json(origin, 202, { ok: true, issueUrl: result.value.issueUrl })
      : json(origin, result.feedback.severity === "backpressure" ? 409 : 422, result);
  };
}
