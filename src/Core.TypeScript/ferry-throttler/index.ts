export * from "./ferry-throttler";
export { createInternalChannel } from "./internal-channel.ts";
export type { InternalChannel } from "./internal-channel.ts";
export * from "./drain-scheduler";
export * from "./lane-notifier";
export * from "./priority-config";
export { PriorityFerryThrottler } from "./priority-ferry-throttler.ts";
export { PriorityFerryThrottlerWithResult } from "./priority-ferry-throttler-with-result.ts";
// ─── Heat-aware scheduling ──────────────────────────────────────────────────
export {
  createHeatAwareScheduler,
  HOT_FACTOR,
  CRITICAL_FACTOR,
  RECOVERY_STEP,
  MIN_WEIGHT,
} from "./heat-aware-scheduler";
export type { HeatAwareScheduler } from "./heat-aware-scheduler";
// ─── Network transport adapter ───────────────────────────────────────────────
export {
  createNetworkProcessBatch,
  createReticulumProcessBatch,
  fakeNetworkTransport,
  batchTemperatureReadout,
} from "./network-transport";
export type {
  NetworkTransport,
  BatchFrame,
  SendOutcome,
  FerryNetworkAdapterOptions,
  TemperatureReadout,
} from "./network-transport";
