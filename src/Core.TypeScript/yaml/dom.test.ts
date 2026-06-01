import { test, expect } from "bun:test";
import { parse } from "./dom";
import type { YamlValue } from "./dom";

interface Vector {
  id: string;
  yaml: string;
}

interface Fixture {
  vectors: Vector[];
}

const fixturePath = new URL(
  "../../../tests/cross-verification/yaml/vectors.json",
  import.meta.url,
);
const fixture = (await Bun.file(fixturePath).json()) as Fixture;
const byId = new Map(fixture.vectors.map((v) => [v.id, v.yaml]));

function yamlFor(id: string): string {
  const y = byId.get(id);
  if (y === undefined) throw new Error(`fixture missing vector ${id}`);
  return y;
}

function expectOk(id: string): YamlValue {
  const result = parse(yamlFor(id));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`parse declined for ${id}: ${result.feedback}`);
  return result.value;
}

// Vector 2 — flat-scalars: typed leaves, Map order preserved.
test("dom: flat-scalars yields typed ordered map", () => {
  const value = expectOk("flat-scalars");
  expect(value).toEqual({
    t: "Map",
    entries: [
      ["name", { t: "Str", value: "zeta" }],
      ["count", { t: "Int", value: 42n }],
      ["ratio", { t: "Float", value: 3.14 }],
      ["ok", { t: "Bool", value: true }],
      ["gone", { t: "Null" }],
    ],
  } satisfies YamlValue);
});

// Vector 6 — nested-map.
test("dom: nested-map yields nested ordered maps", () => {
  const value = expectOk("nested-map");
  expect(value).toEqual({
    t: "Map",
    entries: [
      [
        "outer",
        {
          t: "Map",
          entries: [["inner", { t: "Int", value: 1n }]],
        },
      ],
    ],
  } satisfies YamlValue);
});

// Vector 7 — sequence.
test("dom: sequence yields a Seq of Str leaves", () => {
  const value = expectOk("sequence");
  expect(value).toEqual({
    t: "Seq",
    items: [
      { t: "Str", value: "a" },
      { t: "Str", value: "b" },
    ],
  } satisfies YamlValue);
});

// Vector 8 — sequence-of-maps.
test("dom: sequence-of-maps yields a Map containing a Seq of Maps", () => {
  const value = expectOk("sequence-of-maps");
  expect(value).toEqual({
    t: "Map",
    entries: [
      [
        "items",
        {
          t: "Seq",
          items: [
            {
              t: "Map",
              entries: [
                ["id", { t: "Str", value: "x" }],
                ["n", { t: "Int", value: 1n }],
              ],
            },
            {
              t: "Map",
              entries: [
                ["id", { t: "Str", value: "y" }],
                ["n", { t: "Int", value: 2n }],
              ],
            },
          ],
        },
      ],
    ],
  } satisfies YamlValue);
});

// Map insertion order must be preserved (list of pairs, not an object).
test("dom: map preserves insertion order", () => {
  const value = expectOk("flat-scalars");
  if (value.t !== "Map") throw new Error("expected Map");
  expect(value.entries.map(([k]) => k)).toEqual(["name", "count", "ratio", "ok", "gone"]);
});

// Decline channel propagates through the DOM fold.
test("dom: declines propagate (tab indentation)", () => {
  const result = parse("a:\n\tb: 1\n");
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.feedback).toBe("TabIndentation");
});
