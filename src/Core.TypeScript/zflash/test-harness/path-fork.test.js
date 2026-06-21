import { describe, expect, test } from "bun:test";
import { FRESH_CLUSTER_SERIAL_MARKERS, MIGRATE_EXISTING_CREDS_SERIAL_MARKERS, assertPathForkSerialMarkers, executePathForkRuntimePlan, planPathForkRuntime, } from "./path-fork";
const ISO_PATH = "fixtures/zeta.iso";
const BOOT_IMAGE_PATH = "fixtures/zflash-boot.img";
const STARTING_DISK_PATH = "run/zeta.qcow2";
const MIGRATE_SERIAL_LOG_PATH = "run/migrate.serial.log";
const FRESH_SERIAL_LOG_PATH = "run/fresh.serial.log";
const FRESH_BOOT_IMAGE_PATH = "fixtures/zflash-boot-fresh.img";
function pathForkPlan() {
    const result = planPathForkRuntime({
        isoPath: ISO_PATH,
        bootImagePath: BOOT_IMAGE_PATH,
        freshBootImagePath: FRESH_BOOT_IMAGE_PATH,
        startingDiskPath: STARTING_DISK_PATH,
        migrateSerialLogPath: MIGRATE_SERIAL_LOG_PATH,
        freshSerialLogPath: FRESH_SERIAL_LOG_PATH,
    });
    if ("error" in result) {
        throw new Error(result.error.reason);
    }
    return result.ok.forks;
}
describe("path-fork serial marker assertions", () => {
    test("path-fork fork plans stop on B-0891 markers without requiring a second full install", () => {
        const result = planPathForkRuntime({
            isoPath: ISO_PATH,
            bootImagePath: BOOT_IMAGE_PATH,
            freshBootImagePath: FRESH_BOOT_IMAGE_PATH,
            startingDiskPath: STARTING_DISK_PATH,
            migrateSerialLogPath: MIGRATE_SERIAL_LOG_PATH,
            freshSerialLogPath: FRESH_SERIAL_LOG_PATH,
        });
        if ("error" in result) {
            throw new Error(result.error.reason);
        }
        const migrate = result.ok.forks.find((fork) => fork.forkId === "migrate-existing-creds");
        const fresh = result.ok.forks.find((fork) => fork.forkId === "fresh-cluster");
        expect(migrate?.stopCondition.successMarkers).toEqual(MIGRATE_EXISTING_CREDS_SERIAL_MARKERS);
        expect(fresh?.stopCondition.successMarkers).toEqual(FRESH_CLUSTER_SERIAL_MARKERS);
        expect(migrate?.requiredSerialMarkers).not.toContain("[iter-5.1]");
    });
    test("accepts each fork when all required markers and no forbidden markers appear", () => {
        for (const fork of pathForkPlan()) {
            const result = assertPathForkSerialMarkers(fork, fork.requiredSerialMarkers.join("\n"));
            expect(result).toHaveProperty("ok");
            if ("ok" in result) {
                expect(result.ok.forkId).toBe(fork.forkId);
                expect(result.ok.matchedRequiredMarkers).toEqual(fork.requiredSerialMarkers);
                expect(result.ok.absentForbiddenMarkers).toEqual(fork.forbiddenSerialMarkers);
            }
        }
    });
    test("reports missing markers before checking forbidden markers", () => {
        const migrate = pathForkPlan().find((fork) => fork.forkId === "migrate-existing-creds");
        if (migrate === undefined) {
            throw new Error("missing migrate-existing-creds fork");
        }
        const firstRequiredMarker = migrate.requiredSerialMarkers[0];
        if (firstRequiredMarker === undefined) {
            throw new Error("migrate-existing-creds fork has no required markers");
        }
        const result = assertPathForkSerialMarkers(migrate, [...migrate.requiredSerialMarkers.slice(1), ...FRESH_CLUSTER_SERIAL_MARKERS].join("\n"));
        expect(result).toHaveProperty("error");
        if ("error" in result) {
            if (result.error.kind !== "missing-serial-markers") {
                throw new Error(`expected missing markers feedback, got ${result.error.kind}`);
            }
            expect(result.error.forkId).toBe("migrate-existing-creds");
            expect(result.error.missingMarkers).toEqual([firstRequiredMarker]);
        }
    });
    test("rejects forbidden fresh markers in the migrate fork", () => {
        const migrate = pathForkPlan().find((fork) => fork.forkId === "migrate-existing-creds");
        if (migrate === undefined) {
            throw new Error("missing migrate-existing-creds fork");
        }
        const result = assertPathForkSerialMarkers(migrate, [...migrate.requiredSerialMarkers, ...FRESH_CLUSTER_SERIAL_MARKERS].join("\n"));
        expect(result).toHaveProperty("error");
        if ("error" in result) {
            if (result.error.kind !== "forbidden-serial-markers-present") {
                throw new Error(`expected forbidden markers feedback, got ${result.error.kind}`);
            }
            expect(result.error.forkId).toBe("migrate-existing-creds");
            expect(result.error.presentMarkers).toEqual(FRESH_CLUSTER_SERIAL_MARKERS);
        }
    });
    test("executePathForkRuntimePlan runs both forks through an injected executor", () => {
        const planned = planPathForkRuntime({
            isoPath: ISO_PATH,
            bootImagePath: BOOT_IMAGE_PATH,
            freshBootImagePath: FRESH_BOOT_IMAGE_PATH,
            startingDiskPath: STARTING_DISK_PATH,
            migrateSerialLogPath: MIGRATE_SERIAL_LOG_PATH,
            freshSerialLogPath: FRESH_SERIAL_LOG_PATH,
        });
        if ("error" in planned) {
            throw new Error(planned.error.reason);
        }
        const serialOutputs = {
            [MIGRATE_SERIAL_LOG_PATH]: planned.ok.forks
                .find((fork) => fork.forkId === "migrate-existing-creds")
                .requiredSerialMarkers.join("\n"),
            [FRESH_SERIAL_LOG_PATH]: planned.ok.forks
                .find((fork) => fork.forkId === "fresh-cluster")
                .requiredSerialMarkers.join("\n"),
        };
        const successfulExecution = (step, command) => ({
            step,
            command,
            exitCode: 0,
            stdout: "",
            stderr: "",
        });
        const executed = executePathForkRuntimePlan(planned.ok, {
            runCommand: successfulExecution,
            runCommandUntilSerialMarkers: successfulExecution,
            readSerialOutput: (path) => serialOutputs[path] ?? "",
        });
        expect("ok" in executed).toBe(true);
        if (!("ok" in executed)) {
            throw new Error(JSON.stringify(executed.error));
        }
        expect(executed.ok.forkExecutions).toHaveLength(2);
    });
    test("rejects forbidden migrate markers in the fresh fork", () => {
        const fresh = pathForkPlan().find((fork) => fork.forkId === "fresh-cluster");
        if (fresh === undefined) {
            throw new Error("missing fresh-cluster fork");
        }
        const result = assertPathForkSerialMarkers(fresh, [...fresh.requiredSerialMarkers, ...MIGRATE_EXISTING_CREDS_SERIAL_MARKERS].join("\n"));
        expect(result).toHaveProperty("error");
        if ("error" in result) {
            if (result.error.kind !== "forbidden-serial-markers-present") {
                throw new Error(`expected forbidden markers feedback, got ${result.error.kind}`);
            }
            expect(result.error.forkId).toBe("fresh-cluster");
            expect(result.error.presentMarkers).toEqual(MIGRATE_EXISTING_CREDS_SERIAL_MARKERS);
        }
    });
});
