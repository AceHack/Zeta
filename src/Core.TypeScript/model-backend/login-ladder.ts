// login-ladder.ts — ranked account-login methods for the custom agent harness.
//
// Aaron 2026-08-26: device login first (GitHub and any vendor that has it);
// otherwise some other account login (OAuth-like); smoothest for remote /
// no-browser machines; a browser on the machine is last-resort because of
// user + OS setup. If we cannot reverse a vendor's login, run THEIR CLI
// once and import the token.
//
// Rank is the remote/headless cost, not marketing. Lower rank = prefer.

export const LOGIN_FLOWS = ["device-code", "paste-code", "vendor-cli-import", "pkce-localhost", "api-key"] as const;
export type LoginFlow = (typeof LOGIN_FLOWS)[number];

export const LOGIN_LADDER: readonly { readonly flow: LoginFlow; readonly rank: number; readonly remoteOk: boolean; readonly localBrowser: boolean }[] = [
  { flow: "device-code", rank: 0, remoteOk: true, localBrowser: false },
  { flow: "paste-code", rank: 1, remoteOk: true, localBrowser: false },
  { flow: "vendor-cli-import", rank: 2, remoteOk: true, localBrowser: false },
  { flow: "pkce-localhost", rank: 3, remoteOk: false, localBrowser: true },
  { flow: "api-key", rank: 4, remoteOk: true, localBrowser: false },
];

export function rankOf(flow: LoginFlow): number {
  const row = LOGIN_LADDER.find((r) => r.flow === flow);
  return row === undefined ? LOGIN_LADDER.length : row.rank;
}

/// Best flow this provider actually offers, walking the ladder.
export function preferredFlow(offered: readonly LoginFlow[]): LoginFlow | null {
  let best: LoginFlow | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const flow of offered) {
    const r = rankOf(flow);
    if (r < bestRank) {
      best = flow;
      bestRank = r;
    }
  }
  return best;
}
