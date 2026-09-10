// Acceptance against a service this suite starts itself. No browser is needed for an HTTP API, so
// the browser download is not a prerequisite for the gate that runs it.
import { defineConfig } from "playwright/test";
export default defineConfig({ testDir: ".", reporter: "list", timeout: 30_000, workers: 1 });
