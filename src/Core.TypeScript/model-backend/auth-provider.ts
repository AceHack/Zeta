// auth-provider.ts — OWN THE INTERFACE: a hexagonal auth port, many providers (shadow*).
//
// Aaron 2026-07-03: "build our own device-login flow, and the same-machine browser flow too — these
// seem like generic interfaces many platforms support for login, likely just specific OAuth-like
// flows. We can have our own interface (hexagonal arch — own the interface) and many different
// providers that all work together."
//
// So this is the PORT, not a vendor: an `AuthProvider` that yields OAuth tokens via either of the two
// generic flows every OAuth provider supports —
//   - DEVICE-CODE (RFC 8628): headless / any device. start → show a URL + code → poll → tokens.
//   - PKCE BROWSER (RFC 7636 + auth-code): same machine. authorize URL → localhost callback → exchange.
// Plus the shared REFRESH (grant_type=refresh_token). OpenAI/ChatGPT is the first provider
// (openai-auth.ts); Anthropic, Manus, etc. are just more implementations of this same port. The
// network crosses only through the injected `HttpTransport` (noninterference §13) — fake-testable, no
// secret. PKCE is generated here with node:crypto (no external dep).

import { createHash, randomBytes } from "node:crypto";
import type { HttpTransport } from "./backend.ts";

/// OAuth tokens — the common currency every provider yields.
export interface OAuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accountId?: string;
}

/// What a device-code flow hands back after `start`: show `userCode` at `verificationUri`, then poll.
export interface DeviceFlowStart {
  readonly deviceAuthId: string;
  readonly userCode: string;
  readonly verificationUri: string;
  readonly intervalSec: number;
}

/// A PKCE pair (RFC 7636): the verifier is secret + sent at exchange; the challenge goes in the URL.
export interface PkceChallenge {
  readonly verifier: string;
  readonly challenge: string;
  readonly method: "S256";
}

export type AuthResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };
/// A device poll is one of: authorized (tokens), still-pending (keep polling), or a hard error.
export type PollResult =
  | { readonly ok: true; readonly tokens: OAuthTokens }
  | { readonly ok: true; readonly pending: true }
  | { readonly ok: false; readonly error: string };

/// **The hexagonal auth port — own the interface.** Every login provider implements this; the login
/// runner + the model backends depend on THIS, never on a vendor's endpoints.
export interface AuthProvider {
  readonly name: string;
  /// Device-code flow — start (returns the URL + code to approve on any device).
  startDeviceFlow(transport: HttpTransport): Promise<AuthResult<DeviceFlowStart>>;
  /// Device-code flow — one poll (call on `intervalSec` until authorized or error).
  pollDevice(transport: HttpTransport, start: DeviceFlowStart): Promise<PollResult>;
  /// PKCE browser flow — the authorize URL to open (same machine catches the redirect).
  authorizeUrl(pkce: PkceChallenge, redirectUri: string, state: string): string;
  /// PKCE browser flow — exchange the redirect's `code` for tokens.
  exchangeCode(transport: HttpTransport, code: string, verifier: string, redirectUri: string): Promise<AuthResult<OAuthTokens>>;
  /// Shared — refresh an access token from a refresh token.
  refresh(transport: HttpTransport, refreshToken: string): Promise<AuthResult<OAuthTokens>>;
}

/// Generate a PKCE pair (RFC 7636): a high-entropy base64url verifier + its S256 challenge. Pure
/// crypto; no external dependency (the harness plugins pull `@openauthjs/openauth/pkce` — we don't).
export function generatePkce(): PkceChallenge {
  const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""); // '=' is only trailing padding in base64
  const verifier = b64url(randomBytes(32)); // 43-char base64url — within the RFC 43..128 range
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge, method: "S256" };
}

/// A random state value for CSRF protection on the browser flow.
export function createState(): string {
  return randomBytes(16).toString("hex");
}
