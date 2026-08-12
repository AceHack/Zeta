import { describe, expect, test } from "bun:test";
import { SOCIETY_HEARTBEAT_WORKFLOW, dispatchSocietyHeartbeat, type DispatchFetch } from "./society-heartbeat-dispatch";

function response(status: number): Response {
  return new Response(null, { status });
}

describe("SocietyHeartbeatDispatch", () => {
  test("SHD-1: trusted dispatch posts only the typed repository event", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fakeFetch: DispatchFetch = async (input, init) => {
      calls.push({ input, init });
      return response(204);
    };
    await dispatchSocietyHeartbeat({ token: "token-not-logged", owner: "Lucent-Financial-Group", repo: "Zeta" }, fakeFetch);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe(`https://api.github.com/repos/Lucent-Financial-Group/Zeta/actions/workflows/${SOCIETY_HEARTBEAT_WORKFLOW}/dispatches`);
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.body).toBe(JSON.stringify({ ref: "main" }));
    // The credential belongs only in Authorization; it must never enter the
    // observable dispatch payload or a reason that could be committed/logged.
    expect(String(calls[0]?.init.body)).not.toContain("token-not-logged");
  });

  test("SHD-2 FAULT INJECTION: empty token is rejected before a network request", async () => {
    let called = false;
    const fakeFetch: DispatchFetch = async () => {
      called = true;
      return response(204);
    };
    await expect(dispatchSocietyHeartbeat({ token: "", owner: "Lucent-Financial-Group", repo: "Zeta" }, fakeFetch)).rejects.toThrow("teaching error");
    expect(called).toBeFalse();
  });

  test("SHD-3 FAULT INJECTION: GitHub denial becomes a credential teaching error", async () => {
    const fakeFetch: DispatchFetch = async () => response(403);
    await expect(dispatchSocietyHeartbeat({ token: "trusted", owner: "Lucent-Financial-Group", repo: "Zeta" }, fakeFetch)).rejects.toThrow("Actions: write");
  });
});
