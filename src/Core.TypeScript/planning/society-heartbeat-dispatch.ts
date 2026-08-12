/**
 * society-heartbeat-dispatch.ts — trusted caller for the live society tick.
 *
 * Run only from a trusted environment that injects ZETA_SOCIETY_DISPATCH_TOKEN
 * (for example, an Actions secret or a private operator workstation). This
 * module intentionally has no browser import: GitHub Pages observes committed
 * events but never receives a dispatch-capable credential.
 */

export const SOCIETY_HEARTBEAT_WORKFLOW = "society-heartbeat.yml" as const;

export interface SocietyHeartbeatDispatchConfig {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
}

export interface DispatchFetch {
  (input: string, init: RequestInit): Promise<Response>;
}

export async function dispatchSocietyHeartbeat(
  config: SocietyHeartbeatDispatchConfig,
  fetchImpl: DispatchFetch = fetch,
): Promise<void> {
  if (!config.token.trim()) {
    throw new Error("teaching error: ZETA_SOCIETY_DISPATCH_TOKEN is required in a trusted runner");
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(config.owner) || !/^[A-Za-z0-9_.-]+$/.test(config.repo)) {
    throw new Error("teaching error: owner and repository must be simple GitHub identifiers");
  }

  const response = await fetchImpl(`https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${SOCIETY_HEARTBEAT_WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: "main",
    }),
  });

  if (!response.ok) {
    throw new Error(`teaching error: GitHub refused society dispatch (HTTP ${response.status}); verify Actions: write and Zeta-only repository access`);
  }
}

function configFromEnv(env: NodeJS.ProcessEnv): SocietyHeartbeatDispatchConfig {
  return {
    token: env.ZETA_SOCIETY_DISPATCH_TOKEN ?? "",
    owner: env.ZETA_SOCIETY_DISPATCH_OWNER ?? "Lucent-Financial-Group",
    repo: env.ZETA_SOCIETY_DISPATCH_REPO ?? "Zeta",
  };
}

if (import.meta.main) {
  dispatchSocietyHeartbeat(configFromEnv(process.env)).then(
    () => console.log("[society-dispatch] repository dispatch accepted"),
    error => {
      console.error(`[society-dispatch] ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 2;
    },
  );
}
