import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api, type NeedsMeItemVM } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonaAvatar } from "@/components/bits";

export function NeedsMe({ items, onChange }: { items: NeedsMeItemVM[]; onChange: () => void }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Needs me</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Agents <b>proposed</b> these; only a human <b>authorizes</b> a gated action — source ≠ authorization.
        </p>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <ShieldCheck className="mb-3 size-8 text-success/70" />
          <p className="text-sm text-muted-foreground">Nothing waiting on you. Agents are operating within standing authority.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((it) => <ApprovalCard key={`${it.resource}/${it.requestId}`} item={it} onChange={onChange} />)}
        </div>
      )}
    </div>
  );
}

function ApprovalCard({ item, onChange }: { item: NeedsMeItemVM; onChange: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const decide = async (granted: boolean) => {
    setBusy(true);
    await api.grant(item.resource, item.requestId, "you", granted, note || undefined);
    onChange();
  };
  return (
    <Card className="border-l-2 border-l-warning p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{item.resource}</span>
        {item.gated && <Badge variant="warning">gated: {item.gated}</Badge>}
      </div>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between"><span className="text-muted-foreground">Proposed by</span><PersonaAvatar id={item.proposedBy} kind="persona" /></div>
        <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">Action</span><span className="text-right font-medium">{item.summary}</span></div>
      </div>
      <Input className="mt-3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)…" />
      <div className="mt-3 flex gap-2">
        <Button variant="success" className="flex-1" disabled={busy} onClick={() => decide(true)}>Approve</Button>
        <Button variant="destructive" className="flex-1" disabled={busy} onClick={() => decide(false)}>Deny</Button>
      </div>
    </Card>
  );
}
