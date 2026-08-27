import { describe, expect, it } from "bun:test";
import {
  buildSwarmGraph,
  coauthorPersona,
  foldBusEdges,
  foldCommitEdges,
  foldWorkItemEdges,
  personaOf,
  type PersonaMeta,
} from "./swarm-graph.ts";

const ROSTER: PersonaMeta[] = [
  { id: "aaron", role: "HumanMaintainer" },
  { id: "otto", role: "Operator" },
  { id: "alexa", role: "Builder" },
  { id: "riven", role: "Builder" },
  { id: "vera", role: "Builder" },
  { id: "lior", role: "Compiler" },
  { id: "soraya", role: "Verifier" },
  { id: "addison", role: "Designer" },
];

describe("personaOf", () => {
  it("normalises surface composites and canonical grammar to a persona", () => {
    expect(personaOf("otto-cli")).toBe("otto");
    expect(personaOf("riven/cursor")).toBe("riven");
    expect(personaOf("Riven")).toBe("riven"); // capitalised AgencySignature value
    expect(personaOf("vera-codex")).toBe("vera");
  });
  it("returns null for broadcast, society, empty, and unknown actors", () => {
    expect(personaOf("*")).toBeNull();
    expect(personaOf("society")).toBeNull();
    expect(personaOf("")).toBeNull();
    expect(personaOf(undefined)).toBeNull();
    expect(personaOf("nobody-real")).toBeNull();
  });
});

describe("coauthorPersona", () => {
  it("maps harness Co-Authored-By identities to personas", () => {
    expect(coauthorPersona("Claude <noreply@anthropic.com>")).toBe("otto");
    expect(coauthorPersona("Codex <noreply@openai.com>")).toBe("vera");
    expect(coauthorPersona("Grok <noreply@x.ai>")).toBe("riven");
    expect(coauthorPersona("Gemini <noreply@google.com>")).toBe("lior");
    expect(coauthorPersona("Kiro <noreply@kiro.dev>")).toBe("alexa");
  });
});

describe("foldBusEdges", () => {
  it("makes directed edges for specific recipients and counts broadcast as activity only", () => {
    const r = foldBusEdges([
      { from: "otto", to: "soraya", topic: "review-request", timestamp: "2026-08-01T00:00:00Z" },
      { from: "otto", to: "*", topic: "heartbeat", timestamp: "2026-08-02T00:00:00Z" },
      { from: "soraya", to: "otto", topic: "formal-verification-result", timestamp: "2026-08-03T00:00:00Z" },
    ]);
    expect(r.edges.length).toBe(2); // otto→soraya, soraya→otto (broadcast excluded)
    expect(r.activity.get("otto")).toBe(2); // one directed + one broadcast
    expect(r.directedPairs).toContainEqual({ from: "otto", to: "soraya" });
    const e = r.edges.find((x) => x.source === "otto" && x.target === "soraya")!;
    expect(e.directed).toBe(true);
    expect(e.channel).toBe("bus");
    expect(e.lastAt).toBe("2026-08-01T00:00:00Z");
  });
});

describe("foldWorkItemEdges", () => {
  it("links two personas that touched the same work item (undirected)", () => {
    const r = foldWorkItemEdges([
      { by: "otto", at: "2026-08-01T00:00:00Z", payload: { workItemId: "W1" } },
      { by: "riven", at: "2026-08-02T00:00:00Z", payload: { workItemId: "W1" } },
      { by: "riven", at: "2026-08-03T00:00:00Z", payload: { workItemId: "W2" } },
    ]);
    expect(r.edges.length).toBe(1); // only W1 was co-touched
    const e = r.edges[0]!;
    expect(new Set([e.source, e.target])).toEqual(new Set(["otto", "riven"]));
    expect(e.directed).toBe(false);
    expect(e.channel).toBe("workitem");
    expect(e.lastAt).toBe("2026-08-02T00:00:00Z"); // max of the two touches on W1
  });
  it("skips events with no workItemId or unknown actor", () => {
    const r = foldWorkItemEdges([
      { by: "society", at: "x", payload: { workItemId: "W1" } },
      { by: "otto", at: "x" },
    ]);
    expect(r.edges.length).toBe(0);
    expect(r.skipped).toBe(2);
  });
});

describe("foldCommitEdges", () => {
  it("links distinct personas co-occurring on one commit", () => {
    const r = foldCommitEdges([
      { personas: ["Riven", "Grok <noreply@x.ai>"], at: "2026-08-01T00:00:00Z" }, // both → riven, no edge
      { personas: ["otto", "vera"], at: "2026-08-02T00:00:00Z" }, // shared-branch weave
    ]);
    expect(r.edges.length).toBe(1);
    const e = r.edges[0]!;
    expect(new Set([e.source, e.target])).toEqual(new Set(["otto", "vera"]));
    expect(e.channel).toBe("commit");
  });
});

describe("buildSwarmGraph", () => {
  it("assembles nodes (full roster), multi-channel edges, metrics, and coverage", () => {
    const graph = buildSwarmGraph({
      personas: ROSTER,
      bus: [{ from: "otto", to: "soraya", topic: "review-request", timestamp: "2026-08-01T00:00:00Z" }],
      workItems: [
        { by: "otto", at: "2026-08-01T00:00:00Z", payload: { workItemId: "W1" } },
        { by: "riven", at: "2026-08-02T00:00:00Z", payload: { workItemId: "W1" } },
      ],
      commits: [{ personas: ["otto", "vera"], at: "2026-08-02T00:00:00Z" }],
      windowDays: 30,
      now: new Date("2026-08-27T00:00:00Z"),
    });
    // full roster present as nodes even if isolated (addison never appears)
    expect(graph.nodes.map((n) => n.id)).toContain("addison");
    expect(graph.nodes.find((n) => n.id === "addison")!.degree).toBe(0);
    // three distinct edges, one per channel
    expect(graph.edges.map((e) => e.channel).sort()).toEqual(["bus", "commit", "workitem"]);
    // otto touched all three channels: soraya (bus) + riven (workitem) + vera (commit)
    expect(graph.nodes.find((n) => n.id === "otto")!.degree).toBe(3);
    expect(graph.metrics.nodeCount).toBe(graph.nodes.length);
    expect(graph.coverage.bus.edges).toBe(1);
    expect(graph.coverage.workitem.edges).toBe(1);
    expect(graph.coverage.commit.edges).toBe(1);
    // node colour + role wired from roster
    expect(graph.nodes.find((n) => n.id === "soraya")!.role).toBe("Verifier");
  });
});
