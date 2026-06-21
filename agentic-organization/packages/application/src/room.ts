/**
 * Room — an ephemeral, deterministic-simulation container that hosts hats and
 * injects either real or mock IO interfaces at every seam.
 *
 * A room is "simple RISC-like micro-operations before execution": you bind the
 * seams (real or mock), seat the hats, declare the budget, then step. Same
 * inputs -> same trace (DST). Its `roomId` is content-addressed (ZetaId-shaped)
 * and IS its Reticulum destination, so a room is a first-class mesh endpoint and
 * cross-room messages route to `roomId`.
 *
 * Every agent lives in a room — including the ephemeral observe.ts agents. A
 * room is the per-agent isolation boundary: a bwrap sandbox plus a credential
 * proxy bound to the agent's OAuth identity. The agent holds no raw secrets; it
 * goes through observe.ts, which invokes the credential proxy to turn a chosen
 * slot into a scoped, allowed tool grant.
 *
 * Design: ../../docs/ROOMS_AS_DETERMINISTIC_SIMULATIONS.md
 * Seam discipline: real seams do real I/O; the mock seam substitutes a
 * deterministic double at the SAME boundary (Feathers' seam, made universal —
 * see docs/research/2026-06-07-test-seam-deterministic-simulation-of-all-nouns-and-verbs).
 */
import type { Clock, IdGenerator } from "./ports.ts";

/** Whether a seam binds the real-world adapter or a deterministic double. */
export type SeamMode = "real" | "mock";

/**
 * How participants in (and across) a room exchange meaning. A room can speak in
 * structured artifacts, plain English, or chip-8 assembly (the rehearsal-arena
 * / DST-replayable emulator voice — cf. src/Core/DarkHall.fs).
 */
export type CommunicationStrategy = "artifact" | "english" | "chip8";

/** The named universal IO seams a room can bind real-or-mock. */
export type RoomSeamName =
  | "clock"
  | "ids"
  | "telemetry"
  | "chat_completion"
  | "change_control"
  | "command_state_store"
  | "transport"
  | "work_provider"
  | "sandbox"
  | "credential_proxy";

/** Per-seam binding: which mode, and an audit note naming the bound adapter. */
export type RoomSeamBinding = {
  seam: RoomSeamName;
  mode: SeamMode;
  /** e.g. "system-clock" | "frozen-clock" | "ollama" | "bwrap" | "fixed-grant-mock" */
  adapter: string;
};

/** A room's compute/step budget (the RISC micro-op ceiling). */
export type RoomBudget = {
  maxSteps: number;
  maxWallClockMs?: number;
};

/**
 * The authenticated identity a room runs as. The agent authenticates with its
 * own OAuth identity (the SPIRE/JWT hat token); the credential proxy binds tool
 * grants to this identity. See ORGANIZATION_RUNTIME_ARCHITECTURE.md §Hat
 * Authorization.
 */
export type AgentIdentity = {
  agentId: string;
  /** OAuth subject / token id the agent authenticated as. */
  subject: string;
};

/**
 * A bubblewrap (bwrap) sandbox spec — process-level defence-in-depth inside the
 * k3s/Cilium/SPIRE/OPA stack (CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md
 * §Bubblewrapped Sandbox Boundary). `subprocess` is the weaker engine already in
 * code (apps/workers/.../subprocess-sandbox.ts); `none` is for pure simulation.
 */
export type SandboxSpec = {
  engine: "bwrap" | "subprocess" | "none";
  /** Read-write workspace mount; everything else is read-only or absent. */
  workspaceMount: string;
  /** Allowed network egress hosts (empty = no egress). */
  allowedEgress: readonly string[];
  /** Hard kill/revoke when the hat token expires or is revoked. */
  revokeOnExpiry: boolean;
};

/** A credential-scoped tool grant: what observe.ts may route a chosen slot to. */
export type ToolGrant = {
  tool: string;
  credentialScope: string;
};

/**
 * The credential proxy: given the room's authenticated identity and the hats it
 * wears, returns the tool grants the agent may use. observe.ts invokes this to
 * turn a chosen slot into an authorized tool call — the agent never names a tool
 * or holds a raw secret (CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md §Credential
 * Proxy).
 */
export type CredentialProxyPort = {
  grantsFor: (identity: AgentIdentity, hatIds: readonly string[]) => readonly ToolGrant[];
};

/**
 * A Room. Content-addressed (`roomId` == ZetaId == Reticulum destination), so a
 * room is a first-class mesh endpoint; cross-room comms route to `roomId`.
 * The per-seam bindings in `seams` may override the room-wide `seamMode`.
 */
export type Room = {
  /** ZetaId-shaped fingerprint == Reticulum destination hash. */
  roomId: string;
  /** Room-wide default; individual `seams` entries may differ. */
  seamMode: SeamMode;
  clock: Clock;
  ids: IdGenerator;
  seams: readonly RoomSeamBinding[];
  hatIds: readonly string[];
  communicationStrategy: CommunicationStrategy;
  budget: RoomBudget;
  /** The agent this room runs as (absent for pure, identity-less simulation). */
  identity?: AgentIdentity | undefined;
  /** Process isolation boundary (bwrap in production). */
  sandbox: SandboxSpec;
  /** OAuth-identity → allowed-tool-grants mediator, invoked via observe.ts. */
  credentialProxy: CredentialProxyPort;
};

export type CreateDeterministicRoomInput = {
  roomId: string;
  hatIds: readonly string[];
  /** Epoch ms the frozen clock starts at (default 0 = 1970-01-01T00:00:00Z). */
  baseTimeMs?: number;
  /** Ms the clock advances per `now()` call (default 1). */
  stepMs?: number;
  budget?: RoomBudget;
  communicationStrategy?: CommunicationStrategy;
  seams?: readonly RoomSeamBinding[];
  identity?: AgentIdentity;
  sandbox?: SandboxSpec;
  credentialProxy?: CredentialProxyPort;
};

/**
 * A deterministic credential proxy: grants exactly one tool per seated hat,
 * scoped to that hat, in sorted order. Same inputs -> same grants (DST), so the
 * whole authorization path replays under simulation.
 */
export const mockCredentialProxy: CredentialProxyPort = {
  grantsFor: (_identity, hatIds) =>
    [...hatIds]
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((hatId) => ({ tool: `tool:${hatId}`, credentialScope: `scope:${hatId}` })),
};

/**
 * Build an all-mock room: a frozen, monotonically-advancing clock, a
 * deterministic id generator, a `none`-engine sandbox, and the fixed-grant
 * credential proxy. Same inputs -> same room behaviour (DST). This is the
 * "inject mock IO" half; a real-room factory binds the live adapters (Ollama
 * chat, OTLP telemetry, NATS transport, bwrap sandbox, Cockroach/SPIRE-backed
 * credential proxy, …) at the same seams.
 */
export function createDeterministicRoom(input: CreateDeterministicRoomInput): Room {
  const baseTimeMs = input.baseTimeMs ?? 0;
  const stepMs = input.stepMs ?? 1;
  let tick = 0;
  const counters = new Map<string, number>();
  const clock: Clock = {
    now: () => new Date(baseTimeMs + tick++ * stepMs).toISOString(),
  };
  const ids: IdGenerator = {
    createId: (prefix: string) => {
      const next = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, next);
      return `${prefix}-${String(next).padStart(3, "0")}`;
    },
  };
  const seams: readonly RoomSeamBinding[] =
    input.seams ?? [
      { seam: "clock", mode: "mock", adapter: "frozen-clock" },
      { seam: "ids", mode: "mock", adapter: "sequential-ids" },
      { seam: "sandbox", mode: "mock", adapter: "none-engine" },
      { seam: "credential_proxy", mode: "mock", adapter: "fixed-grant-mock" },
    ];
  return {
    roomId: input.roomId,
    seamMode: "mock",
    clock,
    ids,
    seams,
    hatIds: input.hatIds,
    communicationStrategy: input.communicationStrategy ?? "english",
    budget: input.budget ?? { maxSteps: 1024 },
    identity: input.identity,
    sandbox: input.sandbox ?? { engine: "none", workspaceMount: "/workspace", allowedEgress: [], revokeOnExpiry: true },
    credentialProxy: input.credentialProxy ?? mockCredentialProxy,
  };
}
