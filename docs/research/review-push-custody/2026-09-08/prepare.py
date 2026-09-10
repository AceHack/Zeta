"""Retain completed review-push logs and one fresh read-only remote response."""

import datetime
import gzip
import hashlib
import json
import pathlib
import subprocess
import zlib

ROOT = pathlib.Path(__file__).resolve().parents[4]
OUT = pathlib.Path(__file__).resolve().parent
REF = "refs/heads/codex/compiled-runtime-admission-review-20260907"
EXPECTED = "a7747a8540f4f5640edb24abc1f61bdd9be32a6a"
LOGS = (
    ("decorrelation-review-push-1.log", "477413c08d898147a57d1f1d9952ee48be9a6f81"),
    ("scalar-projection-review-push-1.log", "ef41bb7fbc6da626c466210360260977bddb2d2d"),
    ("oracle-selection-review-push-1.log", EXPECTED),
)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def encode(value):
    return (json.dumps(value, indent=2, ensure_ascii=True) + "\n").encode()


records = []


def retain(name, raw, **metadata):
    stored = gzip.compress(raw, mtime=0)
    with (OUT / (name + ".gz")).open("xb") as stream:
        stream.write(stored)
    decoder = zlib.decompressobj(31)
    restored = decoder.decompress(stored) + decoder.flush()
    assert restored == raw and decoder.eof and not decoder.unused_data
    records.append({
        "File": name + ".gz",
        "OriginalBytes": len(raw),
        "OriginalSha256": sha(raw),
        "StoredBytes": len(stored),
        "StoredSha256": sha(stored),
        **metadata,
    })


for name, commit in LOGS:
    raw = (ROOT / ".git" / name).read_bytes()
    assert b"preflight: all 16 executed check(s) passed." in raw
    assert commit[:9].encode() in raw
    assert b"HEAD -> codex/compiled-runtime-admission-review-20260907" in raw
    retain(name, raw, SourceCommit=commit, OriginalLocalFile=str(ROOT / ".git" / name))

argv = ["git", "ls-remote", "--heads", "origin", REF]
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
completed = subprocess.run(argv, cwd=ROOT, capture_output=True, timeout=30, check=False)
finished = datetime.datetime.now(datetime.timezone.utc).isoformat()
retain("remote.stdout", completed.stdout)
retain("remote.stderr", completed.stderr)
retain("remote.invocation.json", encode({
    "Argv": argv,
    "WorkingDirectory": str(ROOT),
    "StartedAtUtc": started,
    "FinishedAtUtc": finished,
    "ReturnCode": completed.returncode,
    "ExpectedHead": EXPECTED,
    "ExpectedRef": REF,
    "Scope": "One fresh read-only observation after the three completed pushes",
}))
assert completed.returncode == 0
assert completed.stdout == f"{EXPECTED}\t{REF}\n".encode()
assert completed.stderr == b""

source = pathlib.Path(__file__).read_bytes()
manifest = {
    "OperationalStatus": "research-grade",
    "Records": records,
    "OriginalBytes": sum(row["OriginalBytes"] for row in records),
    "StoredBytes": sum(row["StoredBytes"] for row in records),
    "Source": {"File": "prepare.py", "Bytes": len(source), "Sha256": sha(source)},
    "Limits": "These logs do not establish execution of the reviewed scientific artifacts.",
}
with (OUT / "manifest.json").open("xb") as stream:
    stream.write(encode(manifest))
print(json.dumps({"Records": len(records), "OriginalBytes": manifest["OriginalBytes"],
                  "StoredBytes": manifest["StoredBytes"], "RemoteHead": EXPECTED}))
