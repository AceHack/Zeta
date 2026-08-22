import { execFileSync } from "node:child_process";
import { validateProposalAuthorRegistry } from "../planning/proposal-verifier";
import { createGitHubCliDelegatedDeviceProposalIssuePort } from "./browser-delegated-device-proposal-gh-cli";
import { createBrowserDelegatedDeviceProposalRelayHttpHandler } from "./browser-delegated-device-proposal-relay-http";

const REPOSITORY = "Lucent-Financial-Group/Zeta";
const EXPECTED_ORIGIN = "https://lucent-financial-group.github.io";

function git(args: readonly string[]): string {
  return execFileSync("git", [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function portFromEnvironment(): number {
  const value = Number(process.env.ZETA_DEVICE_RELAY_PORT ?? "8787");
  return Number.isSafeInteger(value) && value >= 1024 && value <= 65_535 ? value : 8787;
}

const handler = createBrowserDelegatedDeviceProposalRelayHttpHandler({
  expectedOrigin: EXPECTED_ORIGIN,
  issues: createGitHubCliDelegatedDeviceProposalIssuePort(REPOSITORY),
  authority: {
    async load() {
      try {
        git(["fetch", "origin", "main", "--quiet"]);
        const currentMainSha = git(["rev-parse", "origin/main"]);
        const registry = validateProposalAuthorRegistry(
          JSON.parse(git(["show", "origin/main:docs/security/proposal-author-registry.json"])) as unknown,
        );
        return registry.ok
          ? { ok: true, value: { registry: registry.value, currentMainSha } }
          : { ok: false, detail: registry.message };
      } catch {
        return {
          ok: false,
          detail: "The local relay could not refresh protected main and its proposal-author registry.",
        };
      }
    },
  },
});

if (import.meta.main) {
  const server = Bun.serve({ hostname: "127.0.0.1", port: portFromEnvironment(), fetch: handler });
  process.stdout.write(`Zeta delegated-device relay listening on ${server.url.toString()}\n`);
}
