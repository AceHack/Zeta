import { equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  PackageBoundaryRule,
  PackageSourceLayoutViolationReason,
  validatePackageDependencyBoundaries,
  validatePackageSourceLayout,
} from "../src/package-dependency-boundaries.ts";

const packagesRootDirectory = new URL("../..", import.meta.url);
const agenticOrganizationRootDirectory = new URL("../../..", import.meta.url);

describe("package dependency boundaries", () => {
  test("keeps application independent from state and runtime adapters", async () => {
    const violations = await validatePackageDependencyBoundaries({
      rootDirectory: packagesRootDirectory,
      rules: [
        {
          packageName: PackageBoundaryRule.Application,
          sourceGlob: "application/src/**/*.ts",
          forbiddenImportFragments: [
            "../../state",
            "../../../state",
            "state-cockroach",
            "cockroach",
            "nestjs",
            "@nestjs",
            "gatekeeper",
            "nats",
            "opa",
            "open-policy-agent",
            "dapr",
            "temporal",
            "drizzle",
            "pg",
            "postgres",
          ],
        },
        {
          packageName: PackageBoundaryRule.Messaging,
          sourceGlob: "messaging/src/**/*.ts",
          forbiddenImportFragments: ["../messaging-nats", "../../messaging-nats", "nats"],
        },
        {
          packageName: PackageBoundaryRule.Policy,
          sourceGlob: "policy/src/**/*.ts",
          forbiddenImportFragments: [
            "../../application",
            "../application",
            "../../runtime",
            "../runtime",
            "../../state",
            "../state",
            "../../state-cockroach",
            "../state-cockroach",
            "../../messaging",
            "../messaging",
            "../../messaging-nats",
            "../messaging-nats",
            "cockroach",
            "nestjs",
            "@nestjs",
            "gatekeeper",
            "nats",
            "jetstream",
            "opa",
            "open-policy-agent",
            "dapr",
            "temporal",
            "drizzle",
            "pg",
            "postgres",
          ],
        },
        {
          packageName: PackageBoundaryRule.Runtime,
          sourceGlob: "runtime/src/**/*.ts",
          forbiddenImportFragments: [
            "../../state-cockroach",
            "../state-cockroach",
            "../../messaging-nats",
            "../messaging-nats",
            "cockroach",
            "nestjs",
            "@nestjs",
            "nats",
            "jetstream",
            "dapr",
            "temporal",
            "drizzle",
            "pg",
            "postgres",
          ],
        },
        {
          packageName: PackageBoundaryRule.StateAdapter,
          sourceGlob: "state-cockroach/src/**/*.ts",
          forbiddenImportFragments: [
            "../../messaging",
            "../messaging",
            "../../runtime",
            "../runtime",
            "nats",
            "jetstream",
          ],
        },
        {
          packageName: PackageBoundaryRule.Workers,
          sourceGlob: "workers/src/**/*.ts",
          forbiddenImportFragments: [
            "../../state-cockroach",
            "../state-cockroach",
            "../../messaging-nats",
            "../messaging-nats",
            "nestjs",
            "@nestjs",
            "nats",
            "jetstream",
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

  test("keeps tests out of production source directories", async () => {
    const violations = await validatePackageSourceLayout({
      rootDirectory: packagesRootDirectory,
      rules: [
        {
          packageName: PackageBoundaryRule.ProductionSource,
          sourceGlob: "application/src/**/*.ts",
          forbiddenFileSuffix: ".test.ts",
          reason: PackageSourceLayoutViolationReason.TestFileInProductionSource,
        },
        {
          packageName: PackageBoundaryRule.ProductionSource,
          sourceGlob: "domain/src/**/*.ts",
          forbiddenFileSuffix: ".test.ts",
          reason: PackageSourceLayoutViolationReason.TestFileInProductionSource,
        },
        {
          packageName: PackageBoundaryRule.ProductionSource,
          sourceGlob: "governance/src/**/*.ts",
          forbiddenFileSuffix: ".test.ts",
          reason: PackageSourceLayoutViolationReason.TestFileInProductionSource,
        },
        {
          packageName: PackageBoundaryRule.ProductionSource,
          sourceGlob: "messaging/src/**/*.ts",
          forbiddenFileSuffix: ".test.ts",
          reason: PackageSourceLayoutViolationReason.TestFileInProductionSource,
        },
        {
          packageName: PackageBoundaryRule.ProductionSource,
          sourceGlob: "messaging-nats/src/**/*.ts",
          forbiddenFileSuffix: ".test.ts",
          reason: PackageSourceLayoutViolationReason.TestFileInProductionSource,
        },
        {
          packageName: PackageBoundaryRule.ProductionSource,
          sourceGlob: "observability/src/**/*.ts",
          forbiddenFileSuffix: ".test.ts",
          reason: PackageSourceLayoutViolationReason.TestFileInProductionSource,
        },
        {
          packageName: PackageBoundaryRule.ProductionSource,
          sourceGlob: "policy/src/**/*.ts",
          forbiddenFileSuffix: ".test.ts",
          reason: PackageSourceLayoutViolationReason.TestFileInProductionSource,
        },
        {
          packageName: PackageBoundaryRule.ProductionSource,
          sourceGlob: "runtime/src/**/*.ts",
          forbiddenFileSuffix: ".test.ts",
          reason: PackageSourceLayoutViolationReason.TestFileInProductionSource,
        },
        {
          packageName: PackageBoundaryRule.ProductionSource,
          sourceGlob: "state/src/**/*.ts",
          forbiddenFileSuffix: ".test.ts",
          reason: PackageSourceLayoutViolationReason.TestFileInProductionSource,
        },
        {
          packageName: PackageBoundaryRule.ProductionSource,
          sourceGlob: "state-cockroach/src/**/*.ts",
          forbiddenFileSuffix: ".test.ts",
          reason: PackageSourceLayoutViolationReason.TestFileInProductionSource,
        },
        {
          packageName: PackageBoundaryRule.ProductionSource,
          sourceGlob: "workers/src/**/*.ts",
          forbiddenFileSuffix: ".test.ts",
          reason: PackageSourceLayoutViolationReason.TestFileInProductionSource,
        },
      ],
    });

    equal(violations.length, 0, violations.map((violation) => violation.message).join("\n"));
  });

  test("keeps package code independent from app hosts", async () => {
    const violations = await validatePackageDependencyBoundaries({
      rootDirectory: packagesRootDirectory,
      rules: [
        {
          packageName: PackageBoundaryRule.Packages,
          sourceGlob: "application/src/**/*.ts",
          forbiddenImportFragments: ["apps/"],
        },
        {
          packageName: PackageBoundaryRule.Packages,
          sourceGlob: "domain/src/**/*.ts",
          forbiddenImportFragments: ["apps/"],
        },
        {
          packageName: PackageBoundaryRule.Packages,
          sourceGlob: "messaging/src/**/*.ts",
          forbiddenImportFragments: ["apps/"],
        },
        {
          packageName: PackageBoundaryRule.Packages,
          sourceGlob: "messaging-nats/src/**/*.ts",
          forbiddenImportFragments: ["apps/"],
        },
        {
          packageName: PackageBoundaryRule.Packages,
          sourceGlob: "observability/src/**/*.ts",
          forbiddenImportFragments: ["apps/"],
        },
        {
          packageName: PackageBoundaryRule.Packages,
          sourceGlob: "policy/src/**/*.ts",
          forbiddenImportFragments: ["apps/"],
        },
        {
          packageName: PackageBoundaryRule.Packages,
          sourceGlob: "runtime/src/**/*.ts",
          forbiddenImportFragments: ["apps/"],
        },
        {
          packageName: PackageBoundaryRule.Packages,
          sourceGlob: "state/src/**/*.ts",
          forbiddenImportFragments: ["apps/"],
        },
        {
          packageName: PackageBoundaryRule.Packages,
          sourceGlob: "state-cockroach/src/**/*.ts",
          forbiddenImportFragments: ["apps/"],
        },
        {
          packageName: PackageBoundaryRule.Packages,
          sourceGlob: "workers/src/**/*.ts",
          forbiddenImportFragments: ["apps/"],
        },
      ],
    });

    equal(violations.length, 0, violations.map((violation) => violation.message).join("\n"));
  });

  test("keeps app tests out of production source directories", async () => {
    const violations = await validatePackageSourceLayout({
      rootDirectory: agenticOrganizationRootDirectory,
      rules: [
        {
          packageName: PackageBoundaryRule.ApplicationHost,
          sourceGlob: "apps/workers/src/**/*.ts",
          forbiddenFileSuffix: ".test.ts",
          reason: PackageSourceLayoutViolationReason.TestFileInProductionSource,
        },
      ],
    });

    equal(violations.length, 0, violations.map((violation) => violation.message).join("\n"));
  });
});
