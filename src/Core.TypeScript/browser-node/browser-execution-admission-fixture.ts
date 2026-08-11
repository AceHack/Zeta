import type { BrowserExecutionAdmissionResult } from "./browser-execution-admission";
import { createNativeBrowserExecutionAdmission } from "./browser-web-lock-execution-admission";

export const BROWSER_EXECUTION_ADMISSION_FIXTURE_SCHEMA = "zeta.browser-execution-admission-fixture.v1" as const;

export interface BrowserExecutionAdmissionFixtureReadout {
  readonly schema: typeof BROWSER_EXECUTION_ADMISSION_FIXTURE_SCHEMA;
  readonly status: "ready" | "requesting" | "holding" | "settled" | "failed";
  readonly feedbackCode: string | null;
}

export interface BrowserExecutionAdmissionFixtureApi {
  read(): BrowserExecutionAdmissionFixtureReadout;
  hold(): void;
  run(value: string): Promise<BrowserExecutionAdmissionResult<string>>;
}

const selected = createNativeBrowserExecutionAdmission(globalThis);
let status: BrowserExecutionAdmissionFixtureReadout["status"] = selected.ok ? "ready" : "failed";
let feedbackCode = selected.ok ? null : selected.feedback.code;

const api: BrowserExecutionAdmissionFixtureApi = selected.ok
  ? {
      read: () => ({ schema: BROWSER_EXECUTION_ADMISSION_FIXTURE_SCHEMA, status, feedbackCode }),
      hold: () => {
        if (status !== "ready") return;
        status = "requesting";
        void selected.value
          .tryRun("database/browser-global", async () => {
            status = "holding";
            await new Promise<void>(() => undefined);
            return "closed";
          })
          .then((result) => {
            status = "settled";
            feedbackCode = result.ok ? null : result.feedback.code;
          });
      },
      run: (value) => selected.value.tryRun("database/browser-global", () => Promise.resolve(value)),
    }
  : {
      read: () => ({ schema: BROWSER_EXECUTION_ADMISSION_FIXTURE_SCHEMA, status, feedbackCode }),
      hold: () => undefined,
      run: () => Promise.resolve(selected),
    };

Reflect.set(globalThis, "__zetaBrowserExecutionAdmission", api);
