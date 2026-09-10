// MUST STAY PARTLY LOUD - one alert, not zero and not two.
// The destination is pinned to an allowlist, so the baseUrl flow is closed.
// The token is still attached without ever being checked, so THAT flow is
// still reported. A customisation that collapsed this file to zero would be
// hiding a real remaining flow behind a guard that does not cover it.
import { readCreds } from "./creds";

const ALLOWED_ORIGINS = ["https://zeta.example.com", "https://zeta.atlassian.net"];

export async function call(credentialsPath: string, path: string): Promise<unknown> {
  const creds = readCreds(credentialsPath);
  if (!ALLOWED_ORIGINS.includes(creds.baseUrl)) {
    throw new Error(`refusing to send credentials to ${creds.baseUrl}`);
  }
  const response = await fetch(`${creds.baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${creds.token}`, Accept: "application/json" },
  });
  return response.json();
}
