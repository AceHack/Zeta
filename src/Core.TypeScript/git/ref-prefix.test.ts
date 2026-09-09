// src/Core.TypeScript/git/ref-prefix.test.ts
//
// Falsifiers for `stripRemotePrefix`. The load-bearing ones are the three
// metacharacter cases: each is an input on which the `new RegExp` spelling this
// function replaces gives a different -- and wrong -- answer. Each therefore
// fails if anyone reintroduces a regex here, however carefully escaped.

import { describe, expect, test } from "bun:test";

import { stripRemotePrefix } from "./ref-prefix.ts";

describe("stripRemotePrefix", () => {
  test("strips the ordinary case", () => {
    expect(stripRemotePrefix("origin/automation/pr-archive-1", "origin")).toBe("automation/pr-archive-1");
  });

  test("leaves a ref that does not carry the prefix", () => {
    expect(stripRemotePrefix("upstream/main", "origin")).toBe("upstream/main");
  });

  test("a dot in the remote is LITERAL, not any-character", () => {
    // `new RegExp("^o.i/")` strips this; the remote `o.i` does not name it.
    expect(stripRemotePrefix("oXi/main", "o.i")).toBe("oXi/main");
    expect(stripRemotePrefix("o.i/main", "o.i")).toBe("main");
  });

  test("an alternation bar in the remote does not split the pattern", () => {
    // `new RegExp("^a|b/")` means "starts with a, OR contains b/", so it strips
    // from the MIDDLE of this ref. There is no pattern here, only literal text.
    expect(stripRemotePrefix("keep/b/main", "a|b")).toBe("keep/b/main");
  });

  test("an unbalanced paren in the remote does not throw", () => {
    // `new RegExp("^(/")` raises SyntaxError from inside a .map -- a crash where
    // the caller expected a name. Total function, no compilation, no throw.
    expect(stripRemotePrefix("origin/main", "(")).toBe("origin/main");
    expect(stripRemotePrefix("(/main", "(")).toBe("main");
  });

  test("only ONE prefix is removed, and only at the start", () => {
    expect(stripRemotePrefix("origin/origin/main", "origin")).toBe("origin/main");
    expect(stripRemotePrefix("x/origin/main", "origin")).toBe("x/origin/main");
  });

  test("an empty remote strips nothing, and must not eat a leading slash", () => {
    expect(stripRemotePrefix("/main", "")).toBe("/main");
  });

  test("a remote that is a prefix of a longer name does not match", () => {
    // `origin` must not strip `originals/`; the separator is part of the prefix.
    expect(stripRemotePrefix("originals/main", "origin")).toBe("originals/main");
  });
});
