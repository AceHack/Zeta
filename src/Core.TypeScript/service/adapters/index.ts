/**
 * service/adapters/index.ts — adapter barrel + OS auto-detection.
 */
import { platform } from "node:os";
import type { IServiceManager } from "../service-manager";

export { LaunchdAdapter } from "./launchd";
export { TaskSchedulerAdapter } from "./task-scheduler";
export { SystemdAdapter } from "./systemd";

/** Detect the current OS and return the appropriate adapter. */
export function createServiceManager(repoRoot?: string): IServiceManager {
  switch (platform()) {
    case "darwin": {
      const { LaunchdAdapter } = require("./launchd");
      return new LaunchdAdapter(repoRoot);
    }
    case "win32": {
      const { TaskSchedulerAdapter } = require("./task-scheduler");
      return new TaskSchedulerAdapter(repoRoot);
    }
    default: {
      const { SystemdAdapter } = require("./systemd");
      return new SystemdAdapter(repoRoot);
    }
  }
}
