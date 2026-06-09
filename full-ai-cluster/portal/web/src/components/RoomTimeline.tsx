import { useEffect, useState } from "react";
import { Activity, CircleAlert, GitPullRequestArrow, MessageSquare, ShieldCheck, Undo2 } from "lucide-react";
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

export function RoomTimeline({ resource }: { resource: string }) {
  const [room, setRoom] = useState<RoomVM | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () => api.room(resource).then(setRoom).catch((e) => setErr(e.message));
  useEffect(() => {
    setErr(null);
    setRoom(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource]);

  const decide = async (requestId: string, granted: boolean) => {
    await api.grant(resource, requestId, "you", granted);
    load();
  };

  if (err) return <div className="rounded-lg border border-border bg-muted/30 p-6 text-sm text-muted-foreground">No collaboration room yet for this resource. Events appear here as agents operate it.</div>;
  if (!room) return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />)}</div>;

  const pending = new Set(room.pending.map((p) => p.requestId));

  return (
    <div className="space-y-1">
      {room.events.map((e, i) => {
        const Icon = icon(e.body.type);
        const isPending = e.body.type === "authorization-request" && pending.has(e.id);
        return (
          <div key={e.id} className="relative flex gap-3 pl-1">
            <div className="flex flex-col items-center">
              <div className={cn("flex size-7 items-center justify-center rounded-full border", isPending ? "border-warning/50 bg-warning/10 text-warning" : "border-border bg-muted/50 text-muted-foreground")}>
                <Icon className="size-3.5" />
              </div>
              {i < room.events.length - 1 && <div className="w-px flex-1 bg-border" />}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                <PersonaAvatar id={e.proposedBy.id} kind={e.proposedBy.kind} />
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
    </div>
  );
}
