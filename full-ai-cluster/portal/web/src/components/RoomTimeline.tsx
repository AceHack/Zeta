import { useEffect, useRef, useState } from "react";
import { Activity, CircleAlert, GitPullRequestArrow, Lock, MessageSquare, SendHorizonal, ShieldCheck, Undo2 } from "lucide-react";
import { api, type RoomVM } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonaAvatar } from "@/components/bits";
import { cn } from "@/lib/utils";

const icon = (type: string) => {
  switch (type) {
    case "message": return MessageSquare;
    case "state-change": return Activity;
    case "action": return ShieldCheck;
    case "authorization-request": return GitPullRequestArrow;
    case "authorization-grant": return ShieldCheck;
    case "retraction": return Undo2;
    default: return CircleAlert;
  }
};

function summarize(body: Record<string, unknown> & { type: string }): string {
  switch (body.type) {
    case "message": return String(body.text ?? "");
    case "state-change": return `→ ${body.phase}${body.detail ? ` · ${body.detail}` : ""}`;
    case "action": return `acted: ${(body.action as { summary?: string })?.summary ?? ""}${body.result ? ` (${body.result})` : ""}`;
    case "authorization-request": return `requested: ${(body.action as { summary?: string })?.summary ?? ""}`;
    case "authorization-grant": return body.granted ? "approved" : "denied";
    case "retraction": return `retracted ${body.retracts}`;
    default: return body.type;
  }
}

export function RoomTimeline({ resource, admin = "otto" }: { resource: string; admin?: string }) {
  const [room, setRoom] = useState<RoomVM | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = () => api.room(resource).then(setRoom).catch((e) => setErr(e.message));
  useEffect(() => {
    setErr(null);
    setRoom(null);
    setMsg("");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [room?.events.length]);

  const decide = async (requestId: string, granted: boolean) => {
    await api.grant(resource, requestId, "you", granted);
    load();
  };
  const send = async () => {
    const text = msg.trim();
    if (!text || sending) return;
    setMsg("");
    setSending(true);
    try {
      const updated = await api.chat(resource, text);
      setRoom(updated);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const pending = room ? new Set(room.pending.map((p) => p.requestId)) : new Set<string>();

  return (
    <div className="flex h-[560px] flex-col overflow-hidden rounded-xl border border-border bg-card/40">
      {/* sandbox banner */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5 text-xs">
        <Lock className="size-3.5 text-primary" />
        <span className="text-muted-foreground">
          <PersonaAvatar id={admin} kind="persona" />{" "}
          <span className="align-middle">operates <span className="font-medium text-foreground">{resource}</span> only — sandboxed to this resource, acting within its Policy.</span>
        </span>
      </div>

      {/* timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {err ? (
          <div className="rounded-lg border border-border bg-muted/30 p-6 text-sm text-muted-foreground">No collaboration room yet for this resource. Start by sending a message below.</div>
        ) : !room ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />)}</div>
        ) : room.events.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <MessageSquare className="mb-2 size-7 opacity-50" />
            Ask {admin} to operate this resource — “restart it”, “scale to 3”, “give it more memory”.
          </div>
        ) : (
          <div className="space-y-1">
            {room.events.map((e, i) => {
              const Icon = icon(e.body.type);
              const isPending = e.body.type === "authorization-request" && pending.has(e.id);
              const isHuman = e.proposedBy.kind === "human";
              return (
                <div key={e.id} className="relative flex gap-3 pl-1">
                  <div className="flex flex-col items-center">
                    <div className={cn("flex size-7 items-center justify-center rounded-full border", isPending ? "border-warning/50 bg-warning/10 text-warning" : isHuman ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted/50 text-muted-foreground")}>
                      <Icon className="size-3.5" />
                    </div>
                    {i < room.events.length - 1 && <div className="w-px flex-1 bg-border" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2">
                      <PersonaAvatar id={e.proposedBy.id} kind={e.proposedBy.kind} />
                      {isHuman && <span className="text-[11px] text-muted-foreground">you</span>}
                      {e.body.type === "authorization-request" && (e.body as { gated?: string }).gated && (
                        <Badge variant="warning">gated: {(e.body as { gated?: string }).gated}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-foreground/90">{summarize(e.body)}</p>
                    {isPending && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="success" onClick={() => decide(e.id, true)}>Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => decide(e.id, false)}>Deny</Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* chat composer */}
      <div className="border-t border-border bg-background/40 p-3">
        <div className="flex items-end gap-2">
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            placeholder={`Ask ${admin} to do something…`}
            className="flex-1 rounded-lg border border-input bg-background/60 px-3.5 py-2.5 text-sm shadow-sm outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button onClick={send} disabled={sending || !msg.trim()} size="icon" className="size-10 shrink-0">
            <SendHorizonal className="size-4" />
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
          {admin} acts on standing authority for routine ops; spend & content changes need your approval; data deletion is human-only.
        </p>
      </div>
    </div>
  );
}
