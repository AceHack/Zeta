# Merge1 §09 — Agent Runtime (systemd) → Agentic-Org Migration

**Scope:** Port the systemd-based agent runtime and installer infrastructure from `full-ai-cluster/` into the agentic-organization TypeScript codebase. The systemd persona registry (otto/vera/lior/alexa/riven) becomes room agent personas, mutual repair becomes room federation recovery, and the installer's provisioning workflow becomes room initialization.

**Outside sources:**

- `full-ai-cluster/nixos/modules/zeta-ai-agent.nix` — parameterized systemd services for ≥3 vendor-diverse AI agents
- `full-ai-cluster/nixos/modules/zeta-self-register.nix` — post-install self-registration service
- `full-ai-cluster/nixos/modules/zeta-creds-restore.nix` — boot-time credential restore
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh` — greedy N-disk installer
- `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh` — first-boot auto-installer
- `full-ai-cluster/PROVISIONING.md` — cookie-cutter provisioning workflow
- `full-ai-cluster/nixos/modules/common.nix` — shared baseline

**Agentic-org files touched:**

- `packages/application/src/room.ts`
- `packages/application/src/rmo.ts`
- `packages/application/src/org-runtime.ts`
- `packages/application/src/work-os-runtime.ts`
- `packages/application/src/observe.ts`
- `docs/ORGANIZATION_RUNTIME_ARCHITECTURE.md`
- `docs/ALWAYS_ON_ORCHESTRATION_RUNTIME.md`
- NEW: `packages/application/src/agent-persona-registry.ts`
- NEW: `packages/application/src/systemd-runtime-adapter.ts`
- NEW: `packages/application/src/mutual-repair.ts`

**Governing doctrine:** §10 (MP-1 DST Replayability, MP-2 Seam Injectability, MP-3 ZetaId Addressability, MP-5 Freedom-Always-In-Menu, MP-7 Result Over Exception)

---

## 1. What's Solved Outside

| Component | File:Line | What it does |
|---|---|---|
| persona registry | `zeta-ai-agent.nix:50` | 5 personas: otto (Anthropic/Claude), alexa (Alibaba-Qwen/Kiro), riven (xAI/Grok), vera (OpenAI/Codex), lior (Google/Gemini) |
| `makeAgentService` | `zeta-ai-agent.nix:107` | Parameterized systemd unit builder per persona |
| systemd unit config | `zeta-ai-agent.nix:117` | `Type=simple`, `User=zeta`, `Restart=always`, `RestartSec`, memory+CPU limits |
| mutual repair | `zeta-ai-agent.nix:23` | ≥3 vendor-diverse agents can fix each other + k3s; deliberately NOT depending on k3s |
| `after = [network-online.target]` | `zeta-ai-agent.nix:113` | Agents run regardless of k3s state (can repair k3s when broken) |
| invocation args | `zeta-ai-agent.nix:57` | Per-vendor: Claude `--print <<autonomous-loop>>`, Codex `exec <<autonomous-loop>>`, Gemini `-p <<autonomous-loop>>` |
| zeta-self-register | `zeta-self-register.nix` | Post-install self-registration service |
| zeta-creds-restore | `zeta-creds-restore.nix` | Boot-time credential restore (see §08) |
| zeta-install.sh | `usb-nixos-installer/` | Greedy N-disk installer |
| zeta-first-boot.sh | `usb-nixos-installer/` | First-boot auto-installer |
| PROVISIONING.md | `PROVISIONING.md` | Cookie-cutter provisioning: 6 values per box |

---

## 2. What Exists in Agentic-Org Today

| TS Type | File:Line | What it does | Gap vs systemd |
|---|---|---|---|
| `OrgCycleDeps` | `org-runtime.ts:38` | Org cycle dependencies (orgId, workItemId, createId, appendEvent, ...) | No persona registry; no systemd lifecycle |
| `OrgCycleReport` | `org-runtime.ts:69` | Cycle report (finalStage, totalEvents, bindingsCreated, ...) | No mutual repair; no restart policy |
| `work-os-runtime.ts` | `work-os-runtime.ts` | Work OS runtime | No systemd service lifecycle |
| `RunLifecyclePhase` | `observe.ts:86` | 9-phase run lifecycle | No systemd restart/recovery |
| `AgentPersona` | (not in agentic-org) | — | Missing entirely; needs port from §03 |

---

## 3. Migration Plan

### 3.1 Persona registry → room agent personas

**Create:** `packages/application/src/agent-persona-registry.ts`

Port the systemd persona registry as room agent personas.

```typescript
// packages/application/src/agent-persona-registry.ts

/** Port of full-ai-cluster/nixos/modules/zeta-ai-agent.nix persona registry.
 * ≥3 vendor-diverse AI agents as room personas, each independently restartable,
 * mutually reparable, cluster-reparable from outside the failure domain. */

export interface AgentPersonaConfig {
  readonly name: string;
  readonly vendor: string;
  readonly binary: string;
  readonly invocationArgs: readonly string[];
  readonly description: string;
}

/** The canonical persona registry — 5 vendor-diverse AI agents.
 * Port of zeta-ai-agent.nix `personas` let-binding. */
export const PERSONA_REGISTRY: Readonly<Record<string, AgentPersonaConfig>> = {
  otto: {
    name: "otto",
    vendor: "anthropic",
    binary: "claude",
    invocationArgs: ["--print", "<<autonomous-loop>>"],
    description: "Otto AI agent — Claude Code (Anthropic)",
  },
  alexa: {
    name: "alexa",
    vendor: "alibaba-qwen",
    binary: "kiro",
    invocationArgs: [],
    description: "Alexa AI agent — Kiro (Qwen Coder)",
  },
  riven: {
    name: "riven",
    vendor: "xai-grok",
    binary: "grok",
    invocationArgs: [],
    description: "Riven AI agent — Grok / Grok-Build (xAI)",
  },
  vera: {
    name: "vera",
    vendor: "openai",
    binary: "codex",
    invocationArgs: ["exec", "<<autonomous-loop>>"],
    description: "Vera AI agent — Codex (OpenAI)",
  },
  lior: {
    name: "lior",
    vendor: "google-gemini",
    binary: "gemini",
    invocationArgs: ["-p", "<<autonomous-loop>>"],
    description: "Lior AI agent — Gemini CLI (Google)",
  },
};

/** Get a persona config by name. */
export function getPersona(name: string): AgentPersonaConfig | undefined {
  return PERSONA_REGISTRY[name];
}

/** List all enabled personas (for room initialization). */
export function listPersonas(): readonly AgentPersonaConfig[] {
  return Object.values(PERSONA_REGISTRY);
}
```

**Composes with Room:** Each room is initialized with one or more personas from the registry. The persona's `binary` + `invocationArgs` become the room's agent invocation contract.

> **Cross-reference:** The 5 personas here (otto/alexa/riven/vera/lior) are a subset of the 8 core `AgentPersona` registry defined in §03. The other 3 (aaron/addison/max) are room-only personas without systemd service units. The 16-variant `RoomAgentId` in §04 adds surface suffixes (otto-cli, otto-desktop, etc.) to the 8 core personas.

### 3.2 Systemd service lifecycle → room lifecycle

**Create:** `packages/application/src/systemd-runtime-adapter.ts`

Port the systemd service lifecycle (restart policy, memory+CPU limits, tick interval) as room lifecycle parameters.

```typescript
// packages/application/src/systemd-runtime-adapter.ts

/** Port of full-ai-cluster/nixos/modules/zeta-ai-agent.nix makeAgentService.
 * The systemd service config becomes room lifecycle parameters. */
export interface RoomLifecycleConfig {
  /** Restart policy: "always" = restart on any exit; "on-failure" = restart only on non-zero exit. */
  restartPolicy: "always" | "on-failure" | "no";
  /** Seconds between restart attempts. */
  restartSec: number;
  /** Memory limit in bytes. */
  memoryLimitBytes: number;
  /** CPU quota (percentage of one core). */
  cpuQuotaPercent: number;
  /** Tick interval in seconds (how often the agent loop runs). */
  tickIntervalSec: number;
  /** Whether the room runs regardless of k3s state (mutual repair). */
  independentOfCluster: boolean;
}

export const DEFAULT_ROOM_LIFECYCLE: RoomLifecycleConfig = {
  restartPolicy: "always",
  restartSec: 5,
  memoryLimitBytes: 2 * 1024 * 1024 * 1024,  // 2GB
  cpuQuotaPercent: 100,
  tickIntervalSec: 60,
  independentOfCluster: true,
};

/** Build a room lifecycle config from a persona config + overrides. */
export function buildRoomLifecycle(
  persona: AgentPersonaConfig,
  overrides?: Partial<RoomLifecycleConfig>,
): RoomLifecycleConfig {
  return { ...DEFAULT_ROOM_LIFECYCLE, ...overrides };
}
```

**Composes with Room:** `RoomBudget` (maxSteps, maxWallClockMs) maps to the systemd memory+CPU limits. The tick interval becomes the room's step frequency. `independentOfCluster: true` means the room runs even when the k8s cluster is down (mutual repair).

### 3.3 Mutual repair → room federation recovery

**Create:** `packages/application/src/mutual-repair.ts`

Port the mutual repair concept — ≥3 vendor-diverse agents can fix each other and the k8s cluster.

```typescript
// packages/application/src/mutual-repair.ts

/** Port of full-ai-cluster/nixos/modules/zeta-ai-agent.nix mutual repair.
 * ≥3 vendor-diverse AI agents can fix each other + k3s when it's down.
 * Vendor-diversity provides outage resilience AND self-modification safety
 * (≥3 floor needed for BFT margin when one update breaks ≥1 agent). */

export interface MutualRepairPort {
  /** Check if a peer room is healthy. */
  checkPeerHealth(peerRoomId: string): Promise<HealthStatus>;
  /** Attempt to repair a peer room (restart its agent, fix its config). */
  repairPeer(peerRoomId: string): Promise<RepairResult>;
  /** Attempt to repair the k8s cluster from outside the failure domain. */
  repairCluster(): Promise<RepairResult>;
}

export type HealthStatus =
  | { healthy: true; lastTickAt: string }
  | { healthy: false; reason: string; lastTickAt?: string };

export type RepairResult =
  | { outcome: "repaired"; action: string }
  | { outcome: "repair_failed"; reason: string }
  | { outcome: "peer_not_found"; peerRoomId: string };

/** BFT quorum: at least 3 healthy peers needed for mutual repair. */
export const MIN_PEERS_FOR_BFT = 3;

/** Can we attempt mutual repair? Need ≥3 healthy peers. */
export function canAttemptRepair(healthStatuses: readonly HealthStatus[]): boolean {
  const healthy = healthStatuses.filter((s) => s.healthy).length;
  return healthy >= MIN_PEERS_FOR_BFT;
}
```

**Composes with Room Federation:** When a room detects a peer is unhealthy, it can attempt repair via the `MutualRepairPort`. The BFT quorum (≥3 healthy peers) ensures that a single broken agent doesn't cascade.

### 3.4 Self-registration → room initialization

**Create:** room self-registration in `createRealRoom` (§08).

Port the `zeta-self-register.nix` post-install self-registration as room self-registration on first boot.

```typescript
// In create-real-room.ts — AFTER upgrade

/** Port of full-ai-cluster/nixos/modules/zeta-self-register.nix.
 * On first boot, the room registers itself with the federation. */
export async function selfRegisterRoom(
  room: Room,
  transport: TransportPort,
): Promise<Result<void, RegistrationError>> {
  // Publish a "spawn" message to the bus announcing this room
  const message: BusMessageEnvelope = {
    id: room.ids.createId("spawn"),
    from: room.identity?.agentId as SenderRoomAgentId,
    to: "*",
    topic: "heartbeat",
    payload: { topic: "heartbeat", payload: { status: "alive", note: "first boot" } },
    publishedAt: room.clock.now(),
    ttlMs: 60_000,
  };
  const result = await transport.publish(message);
  if (result.outcome === "feedback") {
    return { outcome: "feedback", feedback: { kind: "publish_failed", reason: result.reason } };
  }
  return { outcome: "ok", value: undefined };
}
```

### 3.5 Installer → room storage allocation

The installer's greedy N-disk partitioning becomes room storage allocation. The "6 values per box" from PROVISIONING.md becomes room initialization config.

```typescript
// packages/application/src/room-initialization.ts

/** Port of full-ai-cluster/PROVISIONING.md "6 values per box".
 * Each room is initialized with 6 configuration values:
 *   1. Node hostname (public identifier)
 *   2. Operator SSH pubkey (public identifier)
 *   3. zeta user password (secret material)
 *   4. WiFi credentials (secret material)
 *   5. Cluster join token (secret material)
 *   6. Agent vendor API keys (secret material) */
export interface RoomInitializationConfig {
  hostname: string;
  operatorSshPubkey: string;
  // Secret material — injected via credential proxy, never visible to agent
  zetaUserPasswordHash: string;
  wifiCredentials?: { ssid: string; psk: string };
  clusterJoinToken?: string;
  vendorApiKeys?: Readonly<Record<string, string>>;
}

/** Initialize a room from the 6-value provisioning config. */
export async function initializeRoom(
  config: RoomInitializationConfig,
  bootstrap: CredentialBootstrap,
): Promise<Result<Room, InitializationError>> {
  // 1. Restore credentials from encrypted blob
  // 2. Create SPIFFE identity
  // 3. Create room with real adapters
  // 4. Self-register with federation
}
```

### 3.6 org-runtime.ts upgrade

**Upgrade `org-runtime.ts`:** Absorb the systemd service lifecycle.

```typescript
// org-runtime.ts — AFTER upgrade
export type OrgCycleDeps = {
  organizationId: string;
  workItemId: string;
  baseTimeMs: number;
  createId: (prefix: string) => string;
  appendEvent: (event: OrgEvent) => Promise<Result<void, string>>;
  upsertBinding: (binding: HatBinding) => Promise<Result<void, string>>;
  rmoCandidateSource: OrgCycleRmoCandidateSource;
  hats?: readonly HatDefinition[];
  rmoAssignmentChooser?: OrgChooser<RankedRmoHatCandidate>;
  // NEW: room lifecycle config (ported from systemd)
  lifecycle?: RoomLifecycleConfig;
  // NEW: mutual repair port
  mutualRepair?: MutualRepairPort;
};
```

---

## 4. Upgrade Path

### 4.1 `org-runtime.ts` — EXTEND

**Before:** `OrgCycleDeps` has no lifecycle or mutual repair concepts.

**After:** `OrgCycleDeps` gains `lifecycle?: RoomLifecycleConfig` and `mutualRepair?: MutualRepairPort`. The org cycle can now restart on failure, respect memory+CPU limits, and attempt mutual repair.

### 4.2 `work-os-runtime.ts` — EXTEND

**Before:** Work OS runtime with no systemd service lifecycle.

**After:** Work OS runtime gains the persona registry and lifecycle config. Each work-OS instance is backed by a systemd service (in production) or a mock (in DST).

---

## 5. Dependencies

- **Depends on:** §10 (doctrine), §01 (F# core — SimulationEnvironment), §03 (agent-loop — AgentPersona), §04 (bus — self-registration via bus), §08 (identity/isolation — credential bootstrap for first boot)
- **Blocks:** None (this is the top-level runtime layer)

---

## 6. Testing Strategy

### 6.1 Persona registry

```typescript
Deno.test("Persona registry has ≥3 vendor-diverse agents", () => {
  const personas = listPersonas();
  assert(personas.length >= 3);
  const vendors = new Set(personas.map((p) => p.vendor));
  assert(vendors.size >= 3);  // vendor-diverse
});
```

### 6.2 Room lifecycle config

```typescript
Deno.test("Room lifecycle defaults to always-restart", () => {
  const lifecycle = buildRoomLifecycle(PERSONA_REGISTRY.otto);
  assertEquals(lifecycle.restartPolicy, "always");
  assertEquals(lifecycle.independentOfCluster, true);
});
```

### 6.3 Mutual repair BFT quorum

```typescript
Deno.test("Need ≥3 healthy peers for mutual repair", () => {
  assert(!canAttemptRepair([healthy, unhealthy]));  // 1 healthy
  assert(!canAttemptRepair([healthy, healthy]));    // 2 healthy
  assert(canAttemptRepair([healthy, healthy, healthy]));  // 3 healthy
});
```

### 6.4 Self-registration

```typescript
Deno.test("Room self-registers on first boot", async () => {
  const transport = createMockBusTransport();
  const room = createDeterministicRoom({ roomId: "test", hatIds: ["hat-1"] });
  const result = await selfRegisterRoom(room, transport);
  assertEquals(result.outcome, "ok");
  const messages = await transport.list({});
  assertEquals(messages.length, 1);
  assertEquals(messages[0].topic, "heartbeat");
});
```

### 6.5 DST replay with lifecycle

```typescript
Deno.test("Room with lifecycle config is DST-replayable", () => {
  const env = createVirtualEnvironment(42n);
  const lifecycle = buildRoomLifecycle(PERSONA_REGISTRY.otto, { tickIntervalSec: 1 });
  const room = createDeterministicRoom({
    roomId: "test",
    hatIds: ["hat-1"],
    // lifecycle config doesn't break DST — same seed → same trace
  });
  // ... run ticks, verify deterministic
});
```

### 6.6 Initialization from 6-value config

```typescript
Deno.test("Room initializes from 6-value provisioning config", async () => {
  const env = createVirtualEnvironment(42n);  // DST: deterministic env for reproducible test
  const config: RoomInitializationConfig = {
    hostname: "node-1",
    operatorSshPubkey: "ssh-ed25519 AAAA...",
    zetaUserPasswordHash: "$6$...",
  };
  const bootstrap = createMockCredentialBootstrap();
  const result = await initializeRoom(config, bootstrap);
  assertEquals(result.outcome, "ok");
});
```
