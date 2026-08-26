import { describe, expect, test } from "bun:test";
import { dispatch } from "./harny.ts";

describe("harny", () => {
  test("help names login, manus --from-file, and indexed search", async () => {
    const out: string[] = [];
    const io = { out: (l: string) => out.push(l), err: () => undefined };
    expect(await dispatch(["help"], io)).toBe(0);
    expect(out.some((l) => l.includes("login"))).toBe(true);
    expect(out.some((l) => l.includes("search"))).toBe(true);
    expect(out.some((l) => l.includes("manus") && l.includes("--from-file"))).toBe(true);
    expect(out.some((l) => l.includes("remote-only"))).toBe(true);
  });

  test("search routes argv to the injected search door — no git, no stderr, no index", async () => {
    const seen: string[][] = [];
    const io = { out: () => undefined, err: () => undefined };
    expect(await dispatch(["search"], io, { search: (args) => { seen.push([...args]); return 2; } })).toBe(2);
    expect(await dispatch(["search", "landauer"], io, { search: (args) => { seen.push([...args]); return 0; } })).toBe(0);
    expect(seen).toEqual([[], ["landauer"]]);
  });

  test("login routes through the injected login door — no homedir, no mkdir", async () => {
    const seen: string[][] = [];
    const io = { out: () => undefined, err: () => undefined };
    expect(
      await dispatch(["login", "manus", "--from-file", "/k"], io, {
        login: (args) => {
          seen.push([...args]);
          return Promise.resolve(0);
        },
      }),
    ).toBe(0);
    expect(seen).toEqual([["login", "manus", "--from-file", "/k"]]);
  });
});
