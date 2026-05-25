import { equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { PackageBoundaryRule, validatePackageDependencyBoundaries } from "./package-dependency-boundaries.ts";

describe("package dependency boundaries", () => {
  test("keeps application independent from state and runtime adapters", async () => {
    const violations = await validatePackageDependencyBoundaries({
      rootDirectory: new URL("../..", import.meta.url),
      rules: [
        {
          packageName: PackageBoundaryRule.Application,
          sourceGlob: "application/src/**/*.ts",
          forbiddenImportFragments: [
            "../../state",
            "../../../state",
            "state-cockroach",
            "nestjs",
            "@nestjs",
            "nats",
            "dapr",
            "temporal",
            "drizzle",
            "pg",
            "postgres",
          ],
        },
      ],
    });

    equal(violations.length, 0, violations.map((violation) => violation.message).join("\n"));
  });
});
