// MUST STAY LOUD. Two flows reach the network from the credential file:
//   1. baseUrl decides WHERE the request goes
//   2. token is attached to it
// Nothing checks either, so a credential file that has been swapped, or a
// baseUrl that was never the configured one, sends the token wherever it says.
// This is the shape `js/file-access-to-http` exists to report, and if the
// guards in ../../README.md ever start silencing THIS file, the guard has
// stopped being a guard and become a suppression.
import { readCreds } from "./creds";

export async function call(credentialsPath: string, path: string): Promise<unknown> {
  const creds = readCreds(credentialsPath);
  const response = await fetch(`${creds.baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${creds.token}`, Accept: "application/json" },
  });
  return response.json();
}
