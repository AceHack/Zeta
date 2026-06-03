/** Varying scopes a single run can be observed at (operator idea 5). */
export const RunScope = {
  Run: "run",
  WorkItem: "work_item",
  Initiative: "initiative",
  Project: "project",
  Organization: "organization",
} as const;

export type RunScope = (typeof RunScope)[keyof typeof RunScope];
