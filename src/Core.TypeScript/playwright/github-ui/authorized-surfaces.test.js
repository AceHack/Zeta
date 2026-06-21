import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const DATA_PATH = resolve(import.meta.dir, "authorized-surfaces.json");
const SCHEMA_PATH = resolve(import.meta.dir, "authorized-surfaces.schema.json");
async function loadJson(path) {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw);
}
describe("authorized-surfaces.json", () => {
    let data;
    test("parses as valid JSON", async () => {
        data = await loadJson(DATA_PATH);
        expect(data).toBeDefined();
    });
    test("has version 1", async () => {
        data = await loadJson(DATA_PATH);
        expect(data.version).toBe(1);
    });
    test("has at least 3 surfaces", async () => {
        data = await loadJson(DATA_PATH);
        expect(data.surfaces.length).toBeGreaterThanOrEqual(3);
    });
    test("surface ids are unique", async () => {
        data = await loadJson(DATA_PATH);
        const ids = data.surfaces.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
    test("surface ids are kebab-case", async () => {
        data = await loadJson(DATA_PATH);
        const kebabPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
        for (const surface of data.surfaces) {
            expect(surface.id).toMatch(kebabPattern);
        }
    });
    test("every surface has required fields", async () => {
        data = await loadJson(DATA_PATH);
        for (const surface of data.surfaces) {
            expect(surface.id).toBeTruthy();
            expect(surface.urlPattern).toBeTruthy();
            expect(surface.description).toBeTruthy();
            expect(surface.allowedActions.length).toBeGreaterThan(0);
            expect(surface.addedBy).toBe("maintainer");
            expect(surface.addedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
    });
    test("allowedActions are kebab-case", async () => {
        data = await loadJson(DATA_PATH);
        const kebabPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
        for (const surface of data.surfaces) {
            for (const action of surface.allowedActions) {
                expect(action).toMatch(kebabPattern);
            }
        }
    });
    test("allowedActions have no duplicates per surface", async () => {
        data = await loadJson(DATA_PATH);
        for (const surface of data.surfaces) {
            expect(new Set(surface.allowedActions).size).toBe(surface.allowedActions.length);
        }
    });
});
describe("authorized-surfaces.schema.json", () => {
    test("parses as valid JSON", async () => {
        const schema = await loadJson(SCHEMA_PATH);
        expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
        expect(schema.type).toBe("object");
    });
    test("defines surface $def", async () => {
        const schema = await loadJson(SCHEMA_PATH);
        const defs = schema.$defs;
        expect(defs).toBeDefined();
        expect(defs.surface).toBeDefined();
    });
});
