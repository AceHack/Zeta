/**
 * service/service-manager.ts — IServiceManager port interface.
 *
 * Hexagonal: we own the contract; launchd/Task Scheduler/systemd are adapters.
 * One `install --persona X` works on every OS.
 */

export type ServiceState = "installed-running" | "installed-stopped" | "not-installed";

export interface ServiceManagerResult {
  readonly ok: boolean;
  readonly message: string;
}

export interface ServiceManagerStatus {
  readonly state: ServiceState;
  readonly label: string;
  readonly persona: string;
}

export interface InstallOpts {
  readonly schedule?: number; // override interval in seconds
  readonly repoRoot?: string; // override repo root path
}

export interface IServiceManager {
  /** Install the loop service for a persona. Idempotent (reinstalls if exists). */
  install(persona: string, opts?: InstallOpts): Promise<ServiceManagerResult>;

  /** Uninstall the loop service for a persona. Idempotent (no-op if not installed). */
  uninstall(persona: string): Promise<ServiceManagerResult>;

  /** Query the service state for a persona. */
  status(persona: string): Promise<ServiceManagerStatus>;
}
