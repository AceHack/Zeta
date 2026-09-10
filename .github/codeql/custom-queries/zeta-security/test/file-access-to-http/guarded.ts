// MUST BE SILENT - and silent because the CODE is different, not because a
// rule was turned off anywhere. Two checks, both of them real refusals:
//   * the destination must be one of the origins this deployment configured,
//     so a rewritten baseUrl cannot redirect the credential;
//   * the token must have the shape the issuer actually mints, so a truncated,
//     wrapped or substituted secret is rejected before it is presented.
// Both are `TaintTracking` barrier guards the shipped queries already know
// (`WhitelistContainmentCallSanitizer`, `SanitizingRegExpTest`), which is why
// the alert closes with no customisation at all.
import { readCreds } from "./creds";

const ALLOWED_ORIGINS = ["https://zeta.example.com", "https://zeta.atlassian.net"];

export async function call(credentialsPath: string, path: string): Promise<unknown> {
  const creds = readCreds(credentialsPath);
  if (!ALLOWED_ORIGINS.includes(creds.baseUrl)) {
    throw new Error(`refusing to send credentials to ${creds.baseUrl}`);
  }
  if (!/^[A-Za-z0-9_-]{20,4096}$/u.test(creds.token)) {
    throw new Error("credential file does not carry a token of the expected shape");
  }
  const response = await fetch(`${creds.baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${creds.token}`, Accept: "application/json" },
  });
  return response.json();
}
