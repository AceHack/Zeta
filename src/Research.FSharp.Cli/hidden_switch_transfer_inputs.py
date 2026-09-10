"""Exact retained reflection/compiler/physical/decoder associations; no new observation."""
import re

from decode_hidden_switch_methods import atomic_input, checked_word, decoded_rows
from hidden_switch_retained_artifacts import RetainedStore, check_identity, sha
from hidden_switch_transfer_shapes import known_cells_admitted, ranges_admitted
from inspect_hidden_switch_bodies import parse_blocks
from map_hidden_switch_methods import map_methods
from probe_hidden_switch_metadata import output_admission

MANIFESTS = [
    {"File": "llvm-decode-attempt-3/manifest.json", "Bytes": 108216, "Sha256": "DDBAE0C9820E8D02B221466D1E3F9677A350A5CE4F7C66BD4D5158652ACFE8E7"},
    {"File": "clrmd-mapped-attempt-1/manifest.json", "Bytes": 289614, "Sha256": "7C130526CB7981E209A5EF31AADA60194269BDE63213A1C4F91C3CCD25CBFE21"},
    {"File": "clrmd-mapping-attempt-1/manifest.json", "Bytes": 3663, "Sha256": "468239500FBFA138AF17119668E1E3DDA61176E2E14348C22DCA853D22BEDA61"},
    {"File": "dump-attempt-2/manifest.json", "Bytes": 15504, "Sha256": "52BC974361A0C47764A70C99579011E89FCFA4C4F701799519434D6669DC446E"},
]
DECODE, MAPPED, MAPPING, DUMP = (pin["File"] for pin in MANIFESTS)
FLAGS = {"RuntimeAdmitted": False, "BodyResolved": False, "ClosureAdmitted": False}


def require(value, message):
    if not value:
        raise ValueError(message)


def full_flags_false(row):
    require(all(row.get(key) is False for key in FLAGS), "retained full admission flags differ")


def exact_int(value, expected):
    return type(value) is int and value == expected


def canonical_address(value):
    require(isinstance(value, str) and re.fullmatch(r"[0-9A-F]{16}", value) is not None, "noncanonical retained address")
    return int(value, 16)


def exact_record_roster(records, prefix, roles):
    actual = [name for name in records if re.fullmatch(re.escape(prefix) + r"method-[0-9]{3}\.json\.gz", name)]
    require(actual == [prefix + role + ".json.gz" for role in roles], "retained method file roster is missing, extra or reordered")


def physical_association(method, mapping_row, block, physical, cell_prefix, dump_size, mvid):
    """Corroborate recorded physical-read metadata; does not reread its bytes."""
    source = mapping_row["Input"]; outcome = mapping_row["Outcome"]
    role = f"method-{mapping_row['Index']:03d}"
    expected = {"Index": mapping_row["Index"], "Role": role, "Address": canonical_address(physical["Body"]["Address"]),
                "Bytes": block["Bytes"], "Token": source["Token"], "DeclaringType": source["Type"], "Name": source["Name"],
                "ReflectionSignature": source["Signature"], "IlHex": source["IlHex"], "BodySha256": sha(bytes.fromhex(block["Hex"])),
                "CompilerBlockIndex": outcome["CompilerBlockIndex"], "CompilerName": block["Name"]}
    require(method == expected and source["Mvid"] == mvid, "method/reflection/compiler/MVID association differs")
    require(physical["Method"] == source and cell_prefix["Method"] == source, "physical records name another reflection row")
    require(physical.get("CompilerMatchesPhysical") is True and physical.get("BodyResolved") is False, "physical comparison scope differs")
    require(physical["Cell"] == cell_prefix["Cell"] and cell_prefix.get("TargetNonzeroAligned") is True
            and canonical_address(cell_prefix["DecodedTarget"]) == method["Address"]
            and exact_int(cell_prefix["NextRequestedBodyBytes"], method["Bytes"]), "cell/body selected locator differs")
    for kind, size in [("Stub", 8), ("Cell", 8), ("Body", method["Bytes"])]:
        row = physical[kind]; address = canonical_address(row["Address"])
        require(exact_int(row["Bytes"], size) and row.get("PhysicalFileBacking") is True
                and type(row["FileOffset"]) is int and 0 <= row["FileOffset"] <= dump_size - size
                and address > 0 and address % (4 if kind != "Cell" else 8) == 0 and address + size <= 1 << 64
                and isinstance(row["Sha256"], str) and re.fullmatch(r"[0-9A-F]{64}", row["Sha256"]) is not None,
                "physical-read metadata has invalid file/address/width/hash")
    require(physical["Stub"]["Address"] == source["Callable"] and physical["Body"]["Sha256"] == method["BodySha256"],
            "callable or recorded physical/compiler hash differs")
    return {"Role": role, "Address": canonical_address(physical["Cell"]["Address"]), "Bytes": physical["Cell"]["Bytes"],
            "Target": method["Address"], "Sha256": physical["Cell"]["Sha256"]}


def mapping_association(mapping, ready, blocks):
    require(mapping == map_methods(ready, blocks), "retained mapping differs from its complete independent reconstruction")
    full_flags_false(mapping)
    require(mapping.get("Complete") is True and mapping.get("Failures") == [] and len(mapping["UnmappedCompilerBlocks"]) == 9
            and exact_int(mapping["MappedRows"], 130) and exact_int(mapping["UnpreparedRows"], 9)
            and exact_int(mapping["MappedBytes"], 34660) and exact_int(mapping["DeclaredLiteralRecords"], 10),
            "finite prepared/unprepared/extra/byte/literal roster differs")
    return [row for row in mapping["Rows"] if row["Outcome"]["Kind"] == "mapped-candidate"]


def loaded_inputs(root, checkpoint, locator):
    """Read only fixed archived metadata names. Caller retains checkpoint pins and active locator."""
    store = RetainedStore(root, MANIFESTS, checkpoint)
    locator({"Stage": "mapping-association"})
    mapping_raw = store.raw(MAPPING, "mapping.json.gz"); mapping = store.json(MAPPING, "mapping.json.gz")
    ready_wrapper = store.json(DUMP, "ready-observed.json.gz"); ready = ready_wrapper["Ready"]
    jit = store.raw(DUMP, "jit.log.gz"); blocks = parse_blocks(jit.decode("utf-8", errors="strict"))
    selected = mapping_association(mapping, ready, blocks)
    manifest = store.json(MAPPED, "helper-input.json.gz")
    report = store.json(MAPPED, "helper-output.json.gz")
    closed = store.json(MAPPED, "outcome.json.gz")
    capture_closed = store.json(DUMP, "outcome.json.gz")
    metadata = store.json(MAPPED, "inputs.json.gz")
    require(capture_closed.get("Complete") is True and capture_closed.get("InputsUnchanged") is True
            and capture_closed.get("TargetCustodyUnchanged") is True, "fresh capture did not close unchanged")
    require(closed.get("Complete") is True and closed.get("Failure") is None and closed.get("CleanupFailures") == []
            and exact_int(closed.get("HelperProcess", {}).get("ExitCode"), 0), "mapped metadata attempt did not close")
    full_flags_false(closed)
    check_identity(mapping_raw, manifest["Mapping"]["Bytes"], manifest["Mapping"]["Sha256"])
    captured_pins = metadata["CaptureMetadata"]
    for name in ["outcome.json", "ready-observed.json", "jit.log"]:
        old_path = str(manifest["Dump"]["File"]).rsplit("/", 1)[0] + "/" + name
        candidates = [pin for pin in captured_pins if pin["File"] == old_path]
        require(len(candidates) == 1, "same-capture metadata identity is absent or ambiguous")
        check_identity(store.raw(DUMP, name + ".gz"), candidates[0]["Bytes"], candidates[0]["Sha256"])
    # These are recorded identities only; never open their dump/module paths.
    full_flags_false(capture_closed)
    require(capture_closed.get("Failure") is None and capture_closed.get("CleanupFailures") == []
            and exact_int(capture_closed.get("SourceDraws"), 0) and capture_closed.get("LocalOnlyDump") == manifest["Dump"],
            "mapped helper dump identity differs from fresh capture custody")
    custody = store.json(DUMP, "target-custody.json.gz")["Records"]
    require(sum(row == {"Original": manifest["Module"]["Original"], "Copy": manifest["Module"]["Copy"]} for row in custody) == 1,
            "mapped managed module identity differs from fresh capture custody")
    methods = manifest["Methods"]
    require(len(methods) == 130, "helper input method count differs")
    roles = [row["Role"] for row in methods]
    exact_record_roster(store.records[DECODE], "decoded-", roles)
    exact_record_roster(store.records[DECODE], "input-", roles)
    exact_record_roster(store.records[MAPPED], "physical-", roles)
    output_admission(report, methods, manifest["Module"]["Original"]["File"])
    ranges = ranges_admitted([{"Role": row["Role"], "Start": row["Address"], "Bytes": row["Bytes"]} for row in methods])
    prepared = []; known = []; words = []
    for method, mapped in zip(methods, selected, strict=True):
        role = method["Role"]; locator({"Stage": "method-input", "Role": role, "Offset": None})
        block = blocks[mapped["Outcome"]["CompilerBlockIndex"]]
        physical = store.json(MAPPED, f"physical-{role}.json.gz")
        cell = store.json(MAPPED, f"physical-{role}-cell.json.gz")
        known.append(physical_association(method, mapped, block, physical, cell, manifest["Dump"]["Bytes"], manifest["Module"]["Mvid"]))
        raw = bytes.fromhex(block["Hex"])
        method_words = [checked_word(role, method["Address"], offset, raw[offset:offset + 4]) for offset in range(0, len(raw), 4)]
        original_input = store.json(DECODE, f"input-{role}.json.gz")
        require(original_input == {"Method": method, "Words": method_words}, "decoder input order or bytes differ")
        decoded = store.json(DECODE, f"decoded-{role}.json.gz")
        full_flags_false(decoded)
        require(decoded.get("Role") == role and decoded.get("ReEncodedBytesMatch") is True, "decoded role/comparison marker differs")
        prepared.append({"Method": method, "Reflection": mapped["Input"], "Compiler": block, "Decoded": decoded["Words"],
                         "PhysicalReadIdentity": physical, "DacMetadata": report["Methods"][len(prepared)]})
        words.extend(method_words)
    require(len(words) == 8665 and sum(row["Bytes"] for row in methods) == 34660, "word/byte count differs")
    known = known_cells_admitted(known, ranges)
    locator({"Stage": "decoder-stream-association"})
    decode_closed = store.json(DECODE, "outcome.json.gz"); full_flags_false(decode_closed)
    require(decode_closed.get("Complete") is True and decode_closed.get("Failure") is None and decode_closed.get("InputsUnchanged") is True
            and decode_closed.get("CleanupFailures") == [] and decode_closed.get("DumpAccess") is False
            and decode_closed.get("NewPolicyExecution") is False and decode_closed.get("ActiveDecodedPrefix") == []
            and decode_closed.get("CompletedMethods") == [row["Role"] for row in methods]
            and all(exact_int(decode_closed.get(key), value) for key, value in [("Methods", 130), ("Words", 8665), ("Bytes", 34660)]),
            "decoder completion scope/order differs")
    require(store.raw(DECODE, "decoder.input.gz") == atomic_input(words), "atomic decoder input differs")
    process = store.json(DECODE, "process-finished.json.gz")
    require(process["ProcessId"] == decode_closed["Process"]["ProcessId"] and exact_int(process["ExitCode"], 0)
            and exact_int(decode_closed["Process"]["ExitCode"], 0), "decoder process closure differs")
    stdout = store.raw(DECODE, "helper.stdout.log.gz"); stderr = store.raw(DECODE, "helper.stderr.log.gz")
    actual_words = [word for method in prepared for word in method["Decoded"]]
    reconstructed = list(decoded_rows(stdout, stderr, process["ExitCode"], words))
    require(actual_words == reconstructed and sum(word["ImmediateComment"] is not None for word in reconstructed) == 851,
            "raw decoder word/comment/order association differs")
    for method in prepared:
        instructions = method["Compiler"]["Instructions"]
        require(len(instructions) == len(method["Decoded"]), "compiler instruction count differs")
        for compiled, decoded in zip(instructions, method["Decoded"], strict=True):
            require(compiled["Offset"] == decoded["Offset"] and int(compiled["Word"], 16).to_bytes(4, "little").hex().upper() == decoded["Hex"],
                    "compiler instruction word/offset differs")
    return {"Store": store, "Methods": prepared, "Ranges": ranges, "KnownCells": known,
            "Unprepared": [row for row in mapping["Rows"] if row["Outcome"]["Kind"] == "unprepared"],
            "ExtraCompilerBlocks": mapping["UnmappedCompilerBlocks"], "DumpIdentity": manifest["Dump"],
            "RawDumpOpened": False}
