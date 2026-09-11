import { describe, expect, test } from "bun:test";
import { acceptedDecisions, answersOwed, correlateFeedback, followUpOrder, type FeedbackDelivery } from "./change-followup";
import { foldActionItems, openActionItems, type ActionItem, type HandedOffChange } from "./org-fold";
import type { OrgEvent } from "./org-event";

const handed = new Map<string, HandedOffChange>([
  ["task-24", { workId: "task-24", changeId: "c1", branch: "defect/AIAGENT-1660", url: "https://git.example/p/-/merge_requests/162", base: "master" }],
  ["task-32", { workId: "task-32", changeId: "c2", branch: "defect/AIAGENT-1661", url: "https://git.example/p/-/merge_requests/163" }],
]);
const d = (over: Partial<FeedbackDelivery>): FeedbackDelivery => ({ deliveryId: "1", source: "gitlab", itemKind: "comment", summary: "s", ...over });

describe("AN EVENT FINDS THE WORK IT CONCERNS, OR SAYS IT CONCERNS NONE", () => {
  test("by branch, or by a review address the change's own is a prefix of - a comment's anchor still finds its request", () => {
    const c = correlateFeedback(
      [d({ deliveryId: "n1", branch: "refs/heads/defect/AIAGENT-1660" }), d({ deliveryId: "n2", changeUrl: "https://git.example/p/-/merge_requests/163#note_99" })],
      handed,
      "master",
    );
    expect(c.aboutChange.map((m) => [m.workId, m.actionItemId])).toEqual([["task-24", "gitlab:n1"], ["task-32", "gitlab:n2"]]);
    expect(c.unmatched).toEqual([]);
  });

  test("a request with a similar number is NOT a match, in either direction - 16 and 162 never catch each other", () => {
    const c = correlateFeedback([d({ changeUrl: "https://git.example/p/-/merge_requests/16" })], handed, "master");
    expect(c.aboutChange).toEqual([]);
    expect(c.unmatched.length).toBe(1);
    const short = new Map([["task-1", { workId: "task-1", changeId: "c", branch: "b", url: "https://git.example/p/-/merge_requests/16" }]]);
    expect(correlateFeedback([d({ changeUrl: "https://git.example/p/-/merge_requests/162#note_1" })], short, "master").aboutChange).toEqual([]);
    expect(correlateFeedback([d({ changeUrl: "https://git.example/p/-/merge_requests/16/diffs" })], short, "master").aboutChange.length).toBe(1);
  });

  test("a target that moved reaches EVERY change proposed against it, each with its own item id; one recorded without a base uses the default", () => {
    const c = correlateFeedback([d({ deliveryId: "target-abc", itemKind: "target_moved", target: "refs/heads/master" })], handed, "master");
    expect(c.targetMoved.map((m) => m.actionItemId).sort()).toEqual(["gitlab:target-abc@task-24", "gitlab:target-abc@task-32"]);
  });
});

describe("ACTION ITEMS FOLD IDEMPOTENTLY FROM THE LOG", () => {
  const raised = (id: string, atMs: number): OrgEvent =>
    ({ id: `e-${id}-${String(atMs)}`, kind: "change_projected", subjectId: "task-24", decision: "", atMs, supervisorChain: [], fact: { kind: "action_item_raised", workId: "task-24", actionItemId: id, source: "gitlab", itemKind: "comment", summary: "please rename" } }) as unknown as OrgEvent;
  const settled = (id: string): OrgEvent =>
    ({ id: `s-${id}`, kind: "change_projected", subjectId: "task-24", decision: "", atMs: 50, supervisorChain: [], fact: { kind: "action_item_settled", workId: "task-24", actionItemId: id, outcome: "addressed", how: "renamed" } }) as unknown as OrgEvent;

  test("A DEFERRAL KEEPS THE ITEM OPEN AND KEEPS ITS REASON - 'left open' never reads like 'never looked at'", () => {
    const deferred = { id: "d-1", kind: "change_projected", subjectId: "task-24", decision: "", atMs: 40, supervisorChain: [], fact: { kind: "action_item_deferred", workId: "task-24", actionItemId: "gitlab:n2", why: "a backfill is a product decision", byHatId: "tech_lead" } } as unknown as OrgEvent;
    const open = openActionItems([raised("gitlab:n2", 30), deferred]).get("task-24") ?? [];
    expect(open.map((i) => i.actionItemId)).toEqual(["gitlab:n2"]);
    expect(open[0]?.deferred).toMatchObject({ why: "a backfill is a product decision", byHatId: "tech_lead" });
    // A deferral arriving after a settlement does not reopen or relabel it.
    const late = { ...deferred, id: "d-2", atMs: 60, fact: { ...(deferred as unknown as { fact: object }).fact, actionItemId: "gitlab:n1" } } as unknown as OrgEvent;
    expect(openActionItems([raised("gitlab:n1", 10), settled("gitlab:n1"), late]).get("task-24")).toBeUndefined();
  });

  test("the same event delivered twice is one item; a settle closes it; a settle for an unknown id invents nothing", () => {
    const events = [raised("gitlab:n1", 10), raised("gitlab:n1", 20), raised("gitlab:n2", 30), settled("gitlab:n1"), settled("gitlab:nope")];
    expect(foldActionItems(events).get("task-24")?.length).toBe(2);
    expect(openActionItems(events).get("task-24")?.map((i) => i.actionItemId)).toEqual(["gitlab:n2"]);
  });
});

describe("THE ORGANIZATION'S DECISIONS ARE CHECKED, NOT TAKEN ON TRUST", () => {
  const items = [{ actionItemId: "a" }, { actionItemId: "b" }] as unknown as readonly ActionItem[];
  test("an unknown item, a repeat, an invented outcome, or no account are refused; silence leaves an item open", () => {
    const r = acceptedDecisions(items, [
      { actionItemId: "a", outcome: "addressed", how: "renamed it" },
      { actionItemId: "a", outcome: "declined", how: "x" },
      { actionItemId: "zzz", outcome: "addressed", how: "x" },
      { actionItemId: "b", outcome: "closed" as never, how: "x" },
    ]);
    expect(r.accepted.map((x) => x.actionItemId)).toEqual(["a"]);
    expect(r.refused.length).toBe(3);
    expect(acceptedDecisions(items, [{ actionItemId: "b", outcome: "declined", how: " " }]).accepted).toEqual([]);
  });
});

test("the work whose oldest open item has waited longest is followed up first", () => {
  const item = (workId: string, raisedAtMs: number) => ({ workId, actionItemId: `${workId}-${String(raisedAtMs)}`, raisedAtMs }) as unknown as ActionItem;
  const open = new Map([["task-32", [item("task-32", 50)]], ["task-24", [item("task-24", 90), item("task-24", 10)]]]);
  expect(followUpOrder(open)).toEqual(["task-24", "task-32"]);
});

describe("A SETTLED ITEM IS OWED AN ANSWER WHERE IT WAS RAISED", () => {
  const base = { workId: "task-40", source: "gitlab", itemKind: "diff_comment", summary: "s", url: "https://git.example/p/-/merge_requests/164#note_1", raisedAtMs: 1 };
  const settled = (actionItemId: string, s: Partial<NonNullable<ActionItem["settled"]>>, answered?: ActionItem["answered"]): ActionItem => ({
    ...base,
    actionItemId,
    settled: { outcome: "addressed", how: "capped it", atMs: 2, ...s },
    ...(answered === undefined ? {} : { answered }),
  });

  test("addressed and declined are both owed, with the account and the pushed commit; open, deferred and answered items are not", () => {
    const items: ActionItem[] = [
      settled("fixed", { respond: true, commit: "abc123" }),
      settled("refused", { respond: true, outcome: "declined", how: "the problem cannot happen: the filter runs first" }),
      { ...base, actionItemId: "open" },
      { ...base, actionItemId: "later", deferred: { why: "not now", atMs: 3 } },
      settled("done", { respond: true }, { replyId: "note-9", resolved: true, atMs: 4 }),
    ];
    const { owed, unanswered } = answersOwed(items);
    expect(owed.map((o) => [o.actionItemId, o.outcome, o.commit, o.when])).toEqual([
      ["fixed", "addressed", "abc123", "always"],
      ["refused", "declined", undefined, "always"],
    ]);
    expect(owed[1]?.how).toBe("the problem cannot happen: the filter runs first");
    expect(unanswered).toEqual([]);
  });

  test("an item the organization decided needed no answer is recorded as unanswered, never posted", () => {
    const { owed, unanswered } = answersOwed([settled("trigger", { respond: false, outcome: "declined", how: "the review trigger keyword" })]);
    expect(owed).toEqual([]);
    expect(unanswered.map((u) => u.actionItemId)).toEqual(["trigger"]);
  });

  test("MEASURED on MR !162: an account naming a place on this machine is never posted to a reviewer", () => {
    const leaky = [
      "Rollout drafted at C:\\Users\\Max.Chadaev\\.agent-org\\stores\\agentic-team\\runs\\x\\evidence\\review.md for the reviewer",
      "see C:/Users/someone/AppData/Local/Temp/verify.log",
      "written to /home/ci/.agent-org/stores/x",
      "copied to /Users/max/work/evidence.png",
    ];
    for (const how of leaky) {
      const { owed, unanswered, withheld } = answersOwed([settled("x", { respond: true, how })]);
      expect(owed).toEqual([]);
      expect(unanswered).toEqual([]);
      // WITHHELD IS NOT A DEAD END: the item goes back to be decided, told why.
      expect(withheld[0]?.why).toContain("which they cannot open");
    }
    // An item recorded as skipped for this reason before reopening existed is reopened too.
    const legacy = settled("old", { how: leaky[0] as string }, { resolved: false, skipped: "its account names a place the reviewer cannot open (C:\\Users\\x) - not posted", atMs: 5 });
    expect(answersOwed([legacy]).withheld.map((w) => w.actionItemId)).toEqual(["old"]);
    // ...but an item answered for any other reason is left alone.
    const fine = settled("done", { how: "server/src/a.ts" }, { replyId: "note-1", resolved: true, atMs: 5 });
    expect(answersOwed([fine]).withheld).toEqual([]);
    // Repository paths, URLs and code are what a reviewer can open - those are posted.
    for (const how of [
      "server/src/routes/oversight.ts:176 caps the limit; test in server/src/__tests__/routes/x.test.ts",
      "see https://tgcsgitlab.example/p/-/merge_requests/164 and `readCap = limit * 4`",
    ]) {
      expect(answersOwed([settled("y", { respond: true, how })]).owed).toHaveLength(1);
    }
  });

  test("an item settled BEFORE answering existed is answered only if it is a thread - nobody decided, so the answerer checks", () => {
    const { owed } = answersOwed([settled("legacy", {})]);
    expect(owed[0]?.when).toBe("if_thread");
  });
});

describe("THE ANSWER IS FOLDED ONTO ITS ITEM, SO IT IS NEVER GIVEN TWICE", () => {
  test("answered records the reply id and whether it was resolved; a skip is recorded too", () => {
    const ev = (atMs: number, fact: unknown) => ({ id: `e${String(atMs)}`, kind: "change_projected", subjectId: "task-40", decision: "", atMs, evidenceRefs: [], supervisorChain: [], fact }) as unknown as OrgEvent;
    const folded = foldActionItems([
      ev(1, { kind: "action_item_raised", workId: "task-40", actionItemId: "gitlab:note-1", source: "gitlab", itemKind: "comment", summary: "s" }),
      ev(2, { kind: "action_item_settled", workId: "task-40", actionItemId: "gitlab:note-1", outcome: "addressed", how: "h", respond: true, commit: "abc" }),
      ev(3, { kind: "action_item_answered", workId: "task-40", actionItemId: "gitlab:note-1", replyId: "note-7", resolved: true }),
    ]).get("task-40")?.[0];
    expect(folded?.settled).toMatchObject({ respond: true, commit: "abc" });
    expect(folded?.answered).toMatchObject({ replyId: "note-7", resolved: true });
    expect(answersOwed(folded === undefined ? [] : [folded]).owed).toEqual([]);
  });
});

describe("A SETTLEMENT THAT DID NOT STAND IS REOPENED, NOT DROPPED", () => {
  test("reopening clears the settlement and its answer, keeps why, and the item is open again", () => {
    const ev = (atMs: number, fact: unknown) => ({ id: `e${String(atMs)}`, kind: "change_projected", subjectId: "task-24", decision: "", atMs, evidenceRefs: [], supervisorChain: [], fact }) as unknown as OrgEvent;
    const log = [
      ev(1, { kind: "action_item_raised", workId: "task-24", actionItemId: "gitlab:note-1975496", source: "gitlab", itemKind: "diff_comment", summary: "no backfill" }),
      ev(2, { kind: "action_item_settled", workId: "task-24", actionItemId: "gitlab:note-1975496", outcome: "addressed", how: "runbook drafted at C:\\Users\\x\\.agent-org\\y" }),
      ev(3, { kind: "action_item_answered", workId: "task-24", actionItemId: "gitlab:note-1975496", resolved: false, skipped: "its account names a place" }),
      ev(4, { kind: "action_item_reopened", workId: "task-24", actionItemId: "gitlab:note-1975496", why: "the runbook is only in the evidence directory" }),
    ];
    const item = foldActionItems(log).get("task-24")?.[0];
    expect(item?.settled).toBeUndefined();
    expect(item?.answered).toBeUndefined();
    expect(item?.reopened?.why).toContain("only in the evidence directory");
    expect(openActionItems(log).get("task-24")?.map((i) => i.actionItemId)).toEqual(["gitlab:note-1975496"]);
    // Settled again after reopening, it is closed again - and owed a fresh answer.
    const again = [...log, ev(5, { kind: "action_item_settled", workId: "task-24", actionItemId: "gitlab:note-1975496", outcome: "addressed", how: "the rollout note is now in the request's Resolution section", respond: true })];
    const settledAgain = foldActionItems(again).get("task-24") ?? [];
    expect(openActionItems(again).get("task-24")).toBeUndefined();
    expect(answersOwed(settledAgain).owed.map((o) => o.actionItemId)).toEqual(["gitlab:note-1975496"]);
  });
});
