import { describe, expect, test } from "bun:test";
import { acceptedDecisions, correlateFeedback, followUpOrder, type FeedbackDelivery } from "./change-followup";
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
