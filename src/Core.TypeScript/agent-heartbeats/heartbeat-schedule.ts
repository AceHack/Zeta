/**
 * Heartbeat schedule contract.
 *
 * GitHub documents that scheduled workflows can be delayed or dropped under
 * high Actions load, including at the start of each hour. This guard verifies
 * only the declared mitigation: an off-boundary 15-minute cadence. It does
 * not convert a provider schedule into a delivery guarantee.
 *
 * Anchor: https://docs.github.com/actions/using-workflows/events-that-trigger-workflows#schedule
 */
export const OFF_BOUNDARY_HEARTBEAT_CRON = "7,22,37,52 * * * *";
const OFF_BOUNDARY_HEARTBEAT_CRON_LINE = `- cron: "${OFF_BOUNDARY_HEARTBEAT_CRON}"`;
const TOP_OF_HOUR_QUARTER_HOURLY_CRON_LINE = '- cron: "*/15 * * * *"';

export function assertOffBoundaryHeartbeatSchedule(workflowSource: string): void {
  if (!workflowSource.includes("schedule:")) {
    throw new Error("teaching error: agent heartbeat workflow has no declared schedule");
  }
  if (!workflowSource.includes(OFF_BOUNDARY_HEARTBEAT_CRON_LINE)) {
    throw new Error(
      `teaching error: agent heartbeat workflow must use the off-boundary 15-minute cron ${OFF_BOUNDARY_HEARTBEAT_CRON}`,
    );
  }
  if (workflowSource.includes(TOP_OF_HOUR_QUARTER_HOURLY_CRON_LINE)) {
    throw new Error(
      "teaching error: agent heartbeat retains the top-of-hour quarter-hour cron that increases documented schedule delay/drop risk",
    );
  }
}
