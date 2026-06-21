import { expect, test, describe } from "bun:test";
import { WeakMapWrapper } from "./mixin";
describe("WeakMapWrapper", () => {
    test("basic set, get, has, delete operations", () => {
        const map = new WeakMapWrapper();
        const key1 = { name: "key1" };
        const key2 = { name: "key2" };
        map.set(key1, 100);
        map.set(key2, 200);
        expect(map.get(key1)).toBe(100);
        expect(map.get(key2)).toBe(200);
        expect(map.has(key1)).toBe(true);
        expect(map.delete(key1)).toBe(true);
        expect(map.get(key1)).toBeUndefined();
        expect(map.has(key1)).toBe(false);
        expect(map.delete(key1)).toBe(false);
    });
});
