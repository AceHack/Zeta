/**
 * service/service-manager.ts — IServiceManager port interface.
 *
 * Hexagonal: we own the contract; launchd/Task Scheduler/systemd are adapters.
 * One `install --persona X` works on every OS.
 */
