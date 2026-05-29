import { describe, expect, test } from "bun:test";

import {
  findLeakedFiles,
  isContentMarked,
  parseContentMark,
} from "./audit-content-marking";

describe("parseContentMark", () => {
  test("detects nsfw: true", () => {
    expect(parseContentMark("---\nnsfw: true\n---\nbody")).toEqual({
      nsfw: true,
      private: false,
    });
  });

  test("detects private: true", () => {
    expect(parseContentMark("---\nprivate: true\n---\nbody")).toEqual({
      nsfw: false,
      private: true,
    });
  });

  test("detects both", () => {
    expect(parseContentMark("---\nprivate: true\nnsfw: true\n---\n")).toEqual({
      nsfw: true,
      private: true,
    });
  });

  test("unmarked frontmatter → neither", () => {
    expect(parseContentMark("---\nid: B-1\ntitle: x\n---\nbody")).toEqual({
      nsfw: false,
      private: false,
    });
  });

  test("no frontmatter → unmarked even if words appear in body", () => {
    expect(parseContentMark("# heading\nnsfw: true\n")).toEqual({
      nsfw: false,
      private: false,
    });
  });

  test("marking only counts inside the leading frontmatter block", () => {
    // `nsfw: true` appears in the body after the frontmatter closes
    expect(parseContentMark("---\nid: x\n---\nnsfw: true\n")).toEqual({
      nsfw: false,
      private: false,
    });
  });

  test("case-insensitive + yes/on truthy synonyms", () => {
    expect(parseContentMark("---\nNSFW: Yes\n---")).toEqual({
      nsfw: true,
      private: false,
    });
    expect(parseContentMark("---\nPrivate: ON\n---")).toEqual({
      nsfw: false,
      private: true,
    });
  });

  test("explicit false is not marked", () => {
    expect(parseContentMark("---\nnsfw: false\n---")).toEqual({
      nsfw: false,
      private: false,
    });
  });
});

describe("isContentMarked", () => {
  test("true when nsfw or private", () => {
    expect(isContentMarked("---\nnsfw: true\n---")).toBe(true);
    expect(isContentMarked("---\nprivate: true\n---")).toBe(true);
  });

  test("false otherwise", () => {
    expect(isContentMarked("---\nid: x\n---")).toBe(false);
    expect(isContentMarked("plain body, no frontmatter")).toBe(false);
  });
});

describe("findLeakedFiles", () => {
  test("returns only the marked tracked files", () => {
    const contents: Record<string, string> = {
      "a.md": "---\nid: a\n---\nok",
      "b.md": "---\nnsfw: true\n---\nleaked",
      "c.md": "---\nprivate: true\n---\nalso leaked",
    };
    expect(
      findLeakedFiles(["a.md", "b.md", "c.md"], (f) => contents[f]),
    ).toEqual(["b.md", "c.md"]);
  });

  test("skips unreadable files without throwing", () => {
    const leaks = findLeakedFiles(["x.md", "y.md"], (f) => {
      if (f === "x.md") throw new Error("gone");
      return "---\nnsfw: true\n---";
    });
    expect(leaks).toEqual(["y.md"]);
  });

  test("clean set returns empty", () => {
    expect(findLeakedFiles(["a.md"], () => "no frontmatter")).toEqual([]);
  });
});
