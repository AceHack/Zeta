#!/usr/bin/env python3
"""Apply a computed DORA frame into the pages repo's data files.

Usage: apply-frame.py <frame.json> <metrics-history.json> <metrics.json>

Reads the JSON emitted by compute-dora-frame.mjs and updates, in place:
  - metrics-history.json : append the frame (dedup by date), set provenance.mock=false
  - metrics.json         : refresh the snapshot metrics + roster, set provenance.mock=false

Append-only on the history; the file IS the ledger. Deterministic — no clock beyond the
frame's own last_merge timestamp.
"""
import json
import sys

frame_path, hist_path, snap_path = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.load(open(frame_path))
frame, snap, personas = data["frame"], data["snapshot"], data["personas"]
gen = snap["last_merge"] or frame["t"] + "T00:00:00Z"

hist = json.load(open(hist_path))
hist["frames"] = [f for f in hist["frames"] if f["t"] != frame["t"]] + [frame]
hist["updated"] = gen
hist["provenance"]["mock"] = False
hist["provenance"]["note"] = (
    "Real frames written by tools/dora/compute-dora-frame.mjs (Zeta repo git+PR data). "
    "Frames <=2026-05-26 are the original design seed; 2026-07-03+ are live. "
    "Append-only; the file IS the ledger."
)
with open(hist_path, "w") as f:
    json.dump(hist, f, indent=2)
    f.write("\n")

harness = {"otto": "Claude Code", "shadow": "Claude Code (shadow)", "soraya": "formal-verification"}
m = json.load(open(snap_path))
m["generated"] = gen
m["provenance"]["mock"] = False
m["provenance"]["note"] = (
    "Live frame from tools/dora/compute-dora-frame.mjs (Zeta git+PR). active_agents = distinct "
    "AgencySignature persona: trailers in the 24h window (an attributable floor). "
    "Page reads this raw over https."
)
m["metrics"] = snap
m["agents"] = [
    {"name": p.capitalize(), "harness": harness.get(p, "agent"), "status": "active"} for p in personas
]
with open(snap_path, "w") as f:
    json.dump(m, f, indent=2)
    f.write("\n")

print(f"applied frame {frame['t']}: {json.dumps(frame)}")
