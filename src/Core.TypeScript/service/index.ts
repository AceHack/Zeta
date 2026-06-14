/**
 * service/index.ts — barrel export for the unified loop service module.
 */

export type { PersonaConfig } from "./persona-registry";
export { PERSONAS, getPersona, listPersonas } from "./persona-registry";

export type { LoopEnv } from "./env-schema";
export { resolveEnv, defaultPaths } from "./env-schema";

export type { ServiceState, ServiceManagerResult, ServiceManagerStatus, InstallOpts, IServiceManager } from "./service-manager";
