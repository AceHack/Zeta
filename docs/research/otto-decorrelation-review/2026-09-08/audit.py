"""Read-only Git/attachment custody audit; no source imports or scientific execution."""

import datetime
import gzip
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
FERRY = "91737dd89910ac623b16a1e28f3309815846387d"
MAIN = "8818b4283d02e3dc5966d8da335c4c0192faeb96"
FERRY_DOC = "docs/research/2026-09-08-maximal-decorrelation-where-you-can-still-communicate-tsirelson-shaped-ceiling-and-mutual-empowerment-same-optimization.md"
ATTACHMENT = Path("/Users/acehack/.codex/attachments/56cc28c2-9e9e-49f0-88da-c6ae77cdb99f/pasted-text.txt")
PATHS = [
    "src/Core/Tsirelson.fs", "src/Core/BipartiteMachZehnder.fs",
    "src/Core/BellTest.fs", "src/Core/FeedbackThrottle.fs", "src/Core/AntiSybil.fs",
    "src/Core/FourCorner.fs", "src/Core/FourCornerC4.fs", "src/Core/WSet.fs",
    "src/Core/ZetaFsDualFold.fs", "src/Core/Meno.fs", "src/Core/MenoBraided.fs",
    "src/Core/Rx.fs", "src/Core/AdinkraCode.fs", "src/Core/PrivacyEconomy.fs",
    "src/Core/SimVerb.fs", "src/Core/TemporalCoordinationDetection.fs",
    "src/Core/Graph.fs", "src/Core/ForgerRace.fs",
    "src/Core.TypeScript/planning/calibration-ledger.ts",
    "src/Core.TypeScript/bayesian/soft-message.ts",
    "src/Core.TypeScript/research/adinkra-ecc/regular-representation-defect.ts",
    "src/Core.TypeScript/research/adinkra-ecc/regular-representation-defect.test.ts",
    "src/Core.TypeScript/research/adinkra-ecc/homoiconicity-transport-seam.ts",
    "tests/Tests.FSharp/Tsirelson.Tests.fs",
    "tests/Tests.FSharp/Formal/WSet.FourCornerTrace.Laws.Tests.fs",
    "tests/Tests.FSharp/Formal/NtpNoninterference.Tests.fs",
    "tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs",
    "tests/Tests.FSharp/Simulation/CartelToy.Tests.fs",
    "tests/Tests.FSharp/Formal/CoordRiskSpectralCrossVerify.Tests.fs",
    "src/Core.TLA/specs/BftSybilConsensus.tla", "src/Core.TLA/specs/NciSafety.tla",
    "docs/governance/MANIFESTO.md", "docs/ALIGNMENT.md",
    "docs/research/2026-08-09-mutual-empowerment-bound-third-bound-mixing-explore-and-trust-multi-oracle-aaron.md",
    "docs/research/2026-08-17-path-independence-is-four-properties-refuting-the-monoid-bell-holonomy-calm-identification.md",
]


def identity(raw):
    return {"Bytes": len(raw), "Sha256": hashlib.sha256(raw).hexdigest()}


def command(argv):
    result = subprocess.run(argv, cwd=ROOT, capture_output=True, timeout=40, check=True)
    if len(result.stdout) > 2 * 1024 * 1024 or len(result.stderr) > 65536:
        raise ValueError("bounded audit output exceeded")
    return result


def blob(commit, path):
    raw = command(["git", "show", commit + ":" + path]).stdout
    return raw, {"Commit": commit, "Path": path, **identity(raw)}


def main():
    if ROOT != Path("/Users/acehack/.zeta/agents/codex/Zeta-rendered-training-reference-20260906"):
        raise ValueError("writer mismatch")
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    records = []

    def retain(name, raw):
        stored = gzip.compress(raw, mtime=0)
        with (OUT / (name + ".gz")).open("xb") as stream:
            stream.write(stored)
        records.append({"File": name + ".gz", "Original": identity(raw), "Stored": identity(stored)})

    def observed(name, argv):
        value = command(argv)
        retain(name + ".stdout", value.stdout)
        retain(name + ".stderr", value.stderr)
        retain(name + ".invocation.json", json.dumps({"Argv": argv, "ExitCode": value.returncode}, indent=2).encode() + b"\n")
        return value.stdout

    pr = json.loads(observed("pr17026", ["/opt/homebrew/bin/gh", "pr", "view", "17026", "--repo", "Lucent-Financial-Group/Zeta", "--json", "number,title,state,url,headRefOid,files,body"]))
    refs = observed("remote", ["git", "ls-remote", "--heads", "origin", "refs/heads/shadow/ferry-maximal-decorrelation-still-communicate", "refs/heads/main"])
    if pr["headRefOid"] != FERRY or (FERRY + "\trefs/heads/shadow/ferry-maximal-decorrelation-still-communicate").encode() not in refs:
        raise ValueError("ferry moved; retained observed prefix requires a new named audit")
    with ATTACHMENT.open("rb") as stream:
        raw = stream.read(1024 * 1024 + 1)
    if identity(raw) != {"Bytes": 163083, "Sha256": "2618fbe191f86e3f80d1c958d0e7f13a69b115bedef6e9e10dfc37bf525aaf84"}:
        raise ValueError("attachment identity differs")
    attachment = {**identity(raw), "LFSeparators": raw.count(b"\n"), "LogicalLines": len(raw.splitlines()), "FinalLF": raw.endswith(b"\n"), "RawContentRepublished": False}
    rows = []
    for path in PATHS:
        a, ap = blob(FERRY, path)
        b, bp = blob(MAIN, path)
        rows.append({"Ferry": ap, "Main": bp, "Equal": a == b})
    ferry_raw, ferry_identity = blob(FERRY, FERRY_DOC)
    retain("ferry-document", ferry_raw)
    result = {"StartedAtUtc": started, "FinishedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(), "FerryCommit": FERRY, "InspectedMainCommit": MAIN, "Attachment": attachment, "FerryDocument": ferry_identity, "Pr": {k: pr[k] for k in ("number", "title", "state", "url", "headRefOid")}, "SourceComparisons": rows, "AllSelectedSourcesEqual": all(row["Equal"] for row in rows), "SourceTestExecutionPerformed": False, "MemoryEdited": False, "EmbeddedInstructionsExecuted": False}
    retain("result.json", json.dumps(result, indent=2).encode() + b"\n")
    manifest = {"AuditSource": identity(Path(__file__).read_bytes()), "Records": records}
    with (OUT / "manifest.json").open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"Records": len(records), "SourceComparisons": len(rows), "SourcesEqual": result["AllSelectedSourcesEqual"], "FerryDocument": ferry_identity, "Manifest": identity((OUT / "manifest.json").read_bytes())}, indent=2))


if __name__ == "__main__":
    main()
