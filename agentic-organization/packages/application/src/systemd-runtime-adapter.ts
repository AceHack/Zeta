/**
 * Systemd runtime adapter — port of
 * `full-ai-cluster/nixos/modules/zeta-ai-agent.nix` `makeAgentService`
 * (Merge1 §09).
 *
 * The systemd service config (restart policy, RestartSec, memory + CPU limits,
 * tick interval, network-not-cluster dependency) becomes room lifecycle
 * parameters. `RoomBudget` (maxSteps / maxWallClockMs) maps onto the memory +
 * CPU limits; the tick interval becomes the room's step frequency.
 *
 * The donor deliberately depends on `network-online.target` and NOT on
 * `k3s.service` so an agent runs regardless of cluster state and can repair the
 * cluster when it is broken — modelled here by `independentOfCluster`.
 */

import type { AgentPersonaConfig } from "./agent-persona-registry.ts";

export interface RoomLifecycleConfig {
  /** "always" = restart on any exit; "on-failure" = only on non-zero exit; "no" = never. */
  readonly restartPolicy: "always" | "on-failure" | "no";
  /** Seconds between restart attempts (systemd RestartSec). */
  readonly restartSec: number;
  /** Memory limit in bytes (systemd MemoryMax). */
  readonly memoryLimitBytes: number;
  /** CPU quota as a percentage of one core (systemd CPUQuota). */
  readonly cpuQuotaPercent: number;
  /** Tick interval in seconds — how often the agent loop runs. */
  readonly tickIntervalSec: number;
  /** Whether the room runs regardless of cluster state (mutual repair). */
  readonly independentOfCluster: boolean;
}

export const DEFAULT_ROOM_LIFECYCLE: RoomLifecycleConfig = {
  restartPolicy: "always",
  restartSec: 5,
  memoryLimitBytes: 2 * 1024 * 1024 * 1024, // 2 GiB
  cpuQuotaPercent: 100,
  tickIntervalSec: 60,
  independentOfCluster: true,
};

/** Build a room lifecycle config from a persona config + optional overrides. */
export function buildRoomLifecycle(
  persona: AgentPersonaConfig,
  overrides?: Partial<RoomLifecycleConfig>,
): RoomLifecycleConfig {
  void persona; // persona currently selects no per-vendor lifecycle deltas; reserved for future tuning
  return { ...DEFAULT_ROOM_LIFECYCLE, ...overrides };
}

/**
 * A rendered systemd-style unit description for a persona (the structured shape
 * `makeAgentService` produces). Pure + deterministic so the unit contract can be
 * asserted in tests without touching a real init system.
 */
export type RenderedAgentUnit = {
  readonly description: string;
  readonly after: readonly string[];
  readonly wants: readonly string[];
  readonly wantedBy: readonly string[];
  readonly serviceType: "simple";
  readonly restart: "always" | "on-failure" | "no";
  readonly restartSec: number;
  readonly memoryMax: number;
  readonly cpuQuota: number;
  readonly execStart: readonly string[];
};

/** Render the systemd-style unit for a persona under a lifecycle config (pure). */
export function renderAgentUnit(persona: AgentPersonaConfig, lifecycle: RoomLifecycleConfig): RenderedAgentUnit {
  return {
    description: `${persona.description} (${persona.vendor})`,
    // Deliberately NOT after k3s/cluster — only network — so the agent can repair the cluster.
    after: ["network-online.target"],
    wants: ["network-online.target"],
    wantedBy: ["multi-user.target"],
    serviceType: "simple",
    restart: lifecycle.restartPolicy,
    restartSec: lifecycle.restartSec,
    memoryMax: lifecycle.memoryLimitBytes,
    cpuQuota: lifecycle.cpuQuotaPercent,
    execStart: [persona.binary, ...persona.invocationArgs],
  };
}
