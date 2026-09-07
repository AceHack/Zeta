"""One read-only audit of retained mapped records; never opens a core dump."""

import collections
import gzip
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys


def digest(raw):
    return hashlib.sha256(raw).hexdigest().upper()


def read(path):
    path = Path(path)
    assert path.name != "graph.core" and path.suffix != ".core"
    assert path.stat().st_size <= 32 * 1024**2
    return path.read_bytes()


def pin(row):
    raw = read(row["File"])
    assert len(raw) == row["Bytes"] and digest(raw) == row["Sha256"].upper()


root = Path(sys.argv[1])
relative = Path("docs/research/hidden-switch-compiled-validation/2026-09-07/clrmd-mapped-attempt-1")
base = root / relative
rawbase = root / ".git/hidden-switch-compiled-clrmd-mapped-attempt-1"
evidence = "b672cd5b3c40423982ff7bdaed9439562f6f6e48"
changed = subprocess.check_output(["git", "-C", str(root), "diff", "--name-only", evidence, "--", str(relative)])
assert changed == b""
manifest_raw = read(base / "manifest.json")
manifest = json.loads(manifest_raw)
assert manifest["ImplementationSource"] == "af90bfc9e95fbdb8246c438da26e30a727bcbb5f"
assert manifest["ExecutionSource"] == "5a0ff905e947f2d7aa7ead394183098c2060f009"
assert len(manifest["Records"]) == 700
total_raw = total_stored = 0
for record in manifest["Records"]:
    stored = read(base / record["File"])
    assert len(stored) == record["StoredBytes"] and digest(stored) == record["StoredSha256"]
    original = gzip.decompress(stored)
    assert len(original) == record["Bytes"] and digest(original) == record["Sha256"]
    assert original == read(root / record["OriginalLocalFile"])
    total_raw += len(original)
    total_stored += len(stored)


def obj(name):
    return json.loads(read(rawbase / name))


inputs = obj("inputs.json")
for item in inputs["CaptureMetadata"] + inputs["HelperSourcesModulesAndHost"]:
    pin(item)
for custody in [inputs["ModuleCustody"], *inputs["HelperCustody"]]:
    pin(custody["Original"])
    pin(custody["Copy"])
    assert read(custody["Original"]["File"]) == read(custody["Copy"]["File"])

expected = obj("helper-input.json")
pin(expected["Mapping"])
pin(expected["Dac"])
pin(expected["Runtime"]["Image"])
mapping = json.loads(read(expected["Mapping"]["File"]))
capture = json.loads(read(root / ".git/hidden-switch-compiled-dump-attempt-2/inputs.json"))
ready = json.loads(read(root / ".git/hidden-switch-compiled-dump-attempt-2/ready-observed.json"))["Ready"]
jit = read(root / ".git/hidden-switch-compiled-dump-attempt-2/jit.log").decode("utf-8")

# Separate parser of the retained compiler listing; no production module import.
blocks = []
for part in jit.split("; Assembly listing for method ")[1:]:
    name, _, rest = part.partition("\n")
    end = re.search(r"^; Total bytes of code (\d+)\s*$", rest, re.M)
    assert end is not None
    body = rest[:end.start()]
    words = re.findall(r"^\s{8}([0-9A-F]{8})\s+\S.*$", body, re.M)
    code = b"".join(int(word, 16).to_bytes(4, "little") for word in words)
    assert len(code) == int(end.group(1))
    blocks.append((name, code))

actual_raw = read(rawbase / "helper-output.json")
actual = json.loads(actual_raw)
outcome = obj("outcome.json")
journal_raw = read(rawbase / "helper-output.json.jsonl")
journal = [json.loads(line) for line in journal_raw.splitlines()]
assert len(journal) == 787
assert actual["Complete"] is True and actual["Failure"] is None
assert actual["Cleanup"] == [] and actual["LocatorRequests"] == 0
assert actual["RequestedMethods"] == actual["AvailableMethods"] == len(actual["Methods"]) == 130
assert outcome["Complete"] is True and outcome["Failure"] is None
assert outcome["CleanupFailures"] == [] and outcome["HelperProcess"] == {"ProcessId": 24347, "ExitCode": 0}
for record in [actual, outcome, mapping]:
    assert all(record[key] is False for key in ["BodyResolved", "RuntimeAdmitted", "ClosureAdmitted"])
assert journal[-1] == {"Data": actual, "Kind": "metadata-finished"}
definitions = [row for row in journal if row["Kind"] == "copied-method-definition"]
prefixes = [row["Data"] for row in journal if row["Kind"] == "method-extent-prefix"]
methods = [row["Data"] for row in journal if row["Kind"] == "method-metadata"]
assert methods == actual["Methods"] and len(definitions) == len(prefixes) == 130
mapped = [row for row in mapping["Rows"] if row["Outcome"]["Kind"] == "mapped-candidate"]
assert len(mapped) == 130 and len(mapping["Rows"]) == 139
assert [row["Input"] for row in mapping["Rows"]] == ready["Methods"]
total = 0
for row, request, method, definition, prefix in zip(mapped, expected["Methods"], methods, definitions, prefixes, strict=True):
    index = row["Index"]
    role = f"method-{index:03d}"
    source = row["Input"]
    compiler = row["Outcome"]
    physical = obj(f"physical-{role}.json")
    assert request == obj(f"method-input-{index:03d}.json")
    assert request["Role"] == method["Role"] == definition["Role"] == prefix["Role"] == role
    assert physical["Method"] == source
    for kind in ["Stub", "Cell", "Body"]:
        single = obj(f"physical-{role}-{kind.lower()}.json")
        assert single[kind] == physical[kind] and single["Method"] == source
        assert physical[kind]["PhysicalFileBacking"] is True
    assert physical["CompilerMatchesPhysical"] is True and physical["BodyResolved"] is False
    name, code = blocks[compiler["CompilerBlockIndex"]]
    assert name == compiler["CompilerName"] == request["CompilerName"]
    assert len(code) == compiler["Bytes"] == request["Bytes"] == physical["Body"]["Bytes"] == method["HotSize"]
    assert digest(code) == compiler["Sha256"] == request["BodySha256"] == physical["Body"]["Sha256"]
    address = int(physical["Body"]["Address"], 16)
    assert address == request["Address"] == method["Query"] == method["NativeCode"] == method["HotStart"]
    assert method["ColdStart"] == method["ColdSize"] == 0
    assert method["Token"] == request["Token"] == source["Token"] == definition["Token"]
    assert method["Name"] == source["Name"] == definition["Name"]
    assert method["DeclaringType"] == source["Type"] == definition["DeclaringType"]
    assert method["ModuleName"] == expected["Module"]["Original"]["File"]
    assert source["Mvid"] == expected["Module"]["Mvid"]
    assert source["IlHex"] == definition["IlHex"] == request["IlHex"]
    assert source["Signature"] == definition["ReflectionSignature"] == request["ReflectionSignature"]
    assert all(prefix[key] == method[key] for key in prefix)
    cell = obj(f"physical-{role}-cell.json")
    assert int(cell["DecodedTarget"], 16) == address and cell["TargetNonzeroAligned"] is True
    assert cell["NextRequestedBodyBytes"] == len(code)
    assert physical["Cell"]["Sha256"] == digest(address.to_bytes(8, "little"))
    assert physical["Stub"]["Bytes"] == physical["Cell"]["Bytes"] == 8
    assert int(physical["Stub"]["Address"], 16) == int(source["Callable"], 16)
    total += len(code)
assert total == 34660 and max(row["HotSize"] for row in methods) == 1664
assert outcome["PhysicalCandidateBytes"] == total and outcome["ComparedCurrentHotExtents"] == 130
counts = dict(collections.Counter(row["Kind"] for row in journal))
runtime = next(row["Observed"] for row in journal if row["Kind"] == "dump-runtime")
assert runtime["Base"] == expected["Runtime"]["ImageBase"]
assert runtime["Version"] == expected["Runtime"]["Version"]
assert runtime["BuildId"] == expected["Runtime"]["BuildId"]
assert runtime["File"] == expected["Runtime"]["Image"]["File"]
assert next(row for row in journal if row["Kind"] == "dac-request")["IgnoreMismatch"] is False
assert next(row for row in journal if row["Kind"] == "target-settings")["ForceCompleteRuntimeEnumeration"] is True
assert next(row for row in journal if row["Kind"] == "loaded-dac-path-file")["Identity"] == expected["Dac"]
assert next(row for row in journal if row["Kind"] == "held-dump-identity")["Identity"] == expected["Dump"]

print(json.dumps({"EvidenceCommit": evidence, "ManifestSha256": digest(manifest_raw), "Records": 700,
    "OriginalBytes": total_raw, "StoredBytes": total_stored, "CurrentHelperPins": len(inputs["HelperSourcesModulesAndHost"]),
    "CurrentHelperCopies": len(inputs["HelperCustody"]), "CaptureMetadataPins": len(inputs["CaptureMetadata"]),
    "CompilerBlocksReconstructed": len(blocks), "CurrentExtents": len(methods), "BodyBytes": total,
    "CodeWords": total // 4, "MaximumBodyBytes": 1664, "JournalRows": len(journal), "JournalKinds": counts,
    "OutputBytes": len(actual_raw), "OutputSha256": digest(actual_raw), "JournalBytes": len(journal_raw),
    "JournalSha256": digest(journal_raw), "Outcome": outcome,
    "PhysicalRangeAudit": "Compared retained addresses/lengths/hashes and driver comparison receipts; no physical dump bytes re-read",
    "NoDumpOpened": True, "NoNativeOrPolicyExecution": True}, indent=2))
