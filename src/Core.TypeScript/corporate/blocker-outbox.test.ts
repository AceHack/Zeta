/**
 * blocker-outbox.test.ts — the channel out, and the surfaces that read it.
 *
 * Three things are pinned here, and they are the three ways this can fail quietly:
 *
 *   - A QUESTION IS LOST. One unreadable file must not hide the rest, and the unreadable one must
 *     still be reported — a question that vanished with no trace is worse than one refused, because
 *     the organization believes it asked.
 *   - THE PAGE STOPS WORKING. The dashboard's script lives inside a template literal, which `tsc`
 *     does not look inside. A broken quote there is invisible to every other check in this repo and
 *     leaves a page that renders nothing while the server reports itself healthy. It happened once
 *     while writing this feature, which is why the check exists.
 *   - THE ANSWER NEVER ARRIVES. A raise with no reply path spends a person's attention and releases
 *     nobody.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { outboxProblems, raiseBlocker, readBlockers } from "./blocker-outbox";
import { acceptBlocker, openBlockers, type RaisedBlocker } from "./human-blocker";
import { acceptAction, HumanActionKind } from "./human-action";
import { appendAction, readActions } from "./action-queue";

const dir = (): string => mkdtempSync(join(tmpdir(), "zeta-outbox-"));

function blocker(over: Record<string, unknown> = {}): RaisedBlocker {
  const r = acceptBlocker({
    about: "whether we may retain archived sessions past 90 days",
    blocking: "task-011",
    exhaustion: { kind: "outside_org_authority", what: "the customer's retention policy" },
    unblocks: "the retention window can be set",
    byHatId: "backend_implementer",
    atMs: 1000,
    ...over,
  });
  if (!r.ok) throw new Error(r.reason);
  return r.blocker;
}

describe("the organization can say it has stopped, and be heard", () => {
  test("a raised blocker comes back out", () => {
    const d = dir();
    raiseBlocker(blocker(), d);
    const back = readBlockers(d);
    expect(back.length).toBe(1);
    expect(back[0]!.blocking).toBe("task-011");
    expect(back[0]!.why).toContain("not this organization's to decide");
  });

  test("RAISING THE SAME BLOCKER TWICE IS ONE ENTRY, not two", () => {
    // A stuck agent stays stuck and raises this on every tick. Without idempotence a person opens
    // the page to four hundred copies of one question, which is the same as not being asked.
    const d = dir();
    raiseBlocker(blocker(), d);
    raiseBlocker(blocker({ atMs: 9999 }), d);
    expect(readBlockers(d).length).toBe(1);
  });

  test("two different stoppages are two questions", () => {
    const d = dir();
    raiseBlocker(blocker(), d);
    raiseBlocker(blocker({ blocking: "task-013", atMs: 1100 }), d);
    expect(readBlockers(d).length).toBe(2);
  });

  test("ordered by the blocker's own clock, never by filename", () => {
    const d = dir();
    raiseBlocker(blocker({ blocking: "zzz-late", atMs: 5000 }), d);
    raiseBlocker(blocker({ blocking: "aaa-early", atMs: 1000 }), d);
    expect(readBlockers(d).map((b) => b.blocking)).toEqual(["aaa-early", "zzz-late"]);
  });

  test("a missing directory is 'nothing has stopped', not a crash", () => {
    expect(readBlockers(join(dir(), "not-created"))).toEqual([]);
    expect(outboxProblems(join(dir(), "not-created"))).toEqual([]);
  });

  test("ONE BAD FILE DOES NOT HIDE THE REST, and is reported rather than dropped", () => {
    const d = dir();
    raiseBlocker(blocker(), d);
    writeFileSync(join(d, "torn.json"), "{ not json", "utf-8");
    writeFileSync(join(d, "empty-ask.json"), JSON.stringify({ about: "x" }), "utf-8");
    expect(readBlockers(d).length).toBe(1);
    const problems = outboxProblems(d);
    expect(problems.map((p) => p.file).sort()).toEqual(["empty-ask.json", "torn.json"]);
    expect(problems.every((p) => p.reason.length > 0)).toBe(true);
  });

  test("a file that is not JSON at all is ignored, not parsed", () => {
    const d = dir();
    raiseBlocker(blocker(), d);
    writeFileSync(join(d, "notes.txt"), "a person's scratch file", "utf-8");
    expect(readBlockers(d).length).toBe(1);
    expect(outboxProblems(d)).toEqual([]);
  });
});

describe("THE REPLY PATH CLOSES THE LOOP — through the one inbound door", () => {
  test("an answer written to the ACTION QUEUE closes a blocker in the OUTBOX", () => {
    // Two directories, two directions, one derivation. The dashboard can only ever append to the
    // inbound queue, and the blocker leaves the open list because of what it found there.
    const out = dir();
    const queue = dir();
    const b = blocker();
    raiseBlocker(b, out);
    expect(openBlockers(readBlockers(out), readActions(queue)).length).toBe(1);

    const answer = acceptAction({
      kind: HumanActionKind.AnswerBlocker,
      byHuman: "max",
      subjectId: b.blockerId,
      reason: "I own the retention policy",
      atMs: 2000,
      detail: { answer: "90 days, hard delete after" },
    });
    if (!answer.ok) throw new Error(answer.reason);
    appendAction(answer.action, queue);

    expect(openBlockers(readBlockers(out), readActions(queue))).toEqual([]);
  });
});

describe("THE DASHBOARD'S OWN SCRIPT IS CHECKED — tsc cannot see inside a template literal", () => {
  test("the embedded page script parses", () => {
    // A broken quote in here is invisible to the typechecker and to every test that does not do
    // this: the server starts, the page loads, and the script silently never runs. Caught exactly
    // that way once, while adding the panel this feature needs.
    const src = readFileSync(join(import.meta.dir, "serve-org.ts"), "utf-8");
    const page = /const PAGE = `([\s\S]*?)`;/.exec(src);
    expect(page).not.toBeNull();
    // CASE-INSENSITIVE: `<SCRIPT>` is the same tag to a browser, and a filter that matches
    // only the lower-case spelling is the classic bad-tag-filter defect (CodeQL
    // `js/bad-tag-filter`, alert #935). Here it would silently extract nothing and the
    // `not.toBeNull()` below would be the only thing that noticed.
    const script = /<script>([\s\S]*)<\/script>/i.exec(page![1]!);
    expect(script).not.toBeNull();
    expect(() => new Function(script![1]!)).not.toThrow();
  });

  test("THE PAGE CONTAINS NO BACKSLASH — the template literal would eat it", () => {
    // The trap that a script-parses check CANNOT see, because the source parses fine either way.
    // `\"` inside the page's own JavaScript is valid TypeScript, and the template literal consumes
    // the backslash before the browser is served — so the browser receives a bare quote that ends
    // the string early, and the whole dashboard silently renders nothing while the server reports
    // itself healthy. Walked into twice while building this page. Nothing here needs an escape, so
    // the rule is simply that there are none.
    const src = readFileSync(join(import.meta.dir, "serve-org.ts"), "utf-8");
    const page = /const PAGE = `([\s\S]*?)`;/.exec(src);
    expect(page).not.toBeNull();
    expect(page![1]!).not.toContain(String.fromCharCode(92));
  });

  test("...and it renders the section a stopped organization depends on", () => {
    const src = readFileSync(join(import.meta.dir, "serve-org.ts"), "utf-8");
    expect(src).toContain("awaitingPeople");
    expect(src).toContain("answer_blocker");
  });
});
