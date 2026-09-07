"""Stopped guard bytes and selected call-cell shapes; never closure admission.

The supported indirect shape is consecutive MOVZ/MOVK address construction,
LDR Xt,[Xn,#unsigned-offset], then BLR/BR Xt. This binds a static data
dependency in these instruction bytes, not an observed dynamic call event.
Unknown paths remain explicit unresolved rows. No object-header offset is
inferred from a pinned data address.
"""

import hashlib


def _hex(value):
    return f"{value:016X}"


def indirect_cell(words, index):
    """Return only a fully reconstructed supported call cell, or None."""
    branch = words[index]
    if branch & 0xFFFFFC1F not in (0xD63F0000, 0xD61F0000) or index < 2:
        return None
    target_register = (branch >> 5) & 31
    load = words[index - 1]
    if load & 0xFFC00000 != 0xF9400000 or load & 31 != target_register:
        return None
    base = (load >> 5) & 31
    if base == 31 or target_register == 31:
        return None
    chunks = {}
    start = index - 2
    # At most four complete 16-bit chunks, ending at the nearest MOVZ.
    for pos in range(start, max(-1, start - 4), -1):
        word = words[pos]
        opcode = word & 0xFF800000
        if word & 31 != base or opcode not in (0xD2800000, 0xF2800000):
            return None
        shift = ((word >> 21) & 3) * 16
        if shift not in chunks:  # later MOVK wins when a chunk was rewritten
            chunks[shift] = (word >> 5) & 0xFFFF
        if opcode == 0xD2800000:
            address = sum(value << bit for bit, value in chunks.items())
            address += ((load >> 10) & 0xFFF) * 8
            if address > 0xFFFFFFFFFFFFFFFF:
                raise ValueError("static cell address overflows uint64; modular addresses are unsupported")
            return {"Address": address,
                    "StartIndex": pos, "BaseRegister": base, "TargetRegister": target_register}
    return None


def direct_target(word, pc):
    if word & 0x7C000000 != 0x14000000:
        return None
    immediate = word & 0x03FFFFFF
    if immediate & 0x02000000:
        immediate -= 0x04000000
    return pc + 4 * immediate


def capture_guards(lldb, process, report, read, write):
    observed = report["Guards"]
    if observed["SameReference"] is not True or observed["DataBytes"] != 32 or len(observed["GetterBits"]) != 4:
        raise ValueError("guard pin metadata is incomplete")
    address = int(observed["DataAddress"], 16)
    raw = read(lldb, process, address, 32)
    expected = b"".join(int(value, 16).to_bytes(8, "little") for value in observed["GetterBits"])
    row = {"NativeObservation": observed, "Address": _hex(address), "Bytes": 32,
           "Hex": raw.hex().upper(), "ExpectedGetterHex": expected.hex().upper(),
           "Sha256": hashlib.sha256(raw).hexdigest().upper(), "LayoutAdmitted": False,
           "RuntimeAdmitted": False, "Scope": "pinned object-data/getter correspondence only; selector object-register association remains pending"}
    write("guard-data-raw.json", row)
    if raw != expected:
        raise ValueError("pinned candidate data differs from ordered getter bits")
    repeat = read(lldb, process, address, 32)
    write("guard-data-repeat.json", {"Address": _hex(address), "Hex": repeat.hex().upper()})
    if repeat != raw:
        raise ValueError("pinned guard data changed during stopped capture")
    return row


def capture_transfers(lldb, process, bodies, blocks, read, write):
    rows = []
    for body_index, body in enumerate(bodies):
        method = body["Method"]
        matches = [block for block in blocks if block["Name"].startswith(method["Type"] + ":" + method["Name"] + "(")]
        if len(matches) != 1:
            raise ValueError("call collector lacks unique already-byte-checked compiler candidate")
        block = matches[0]
        words = [int(item["Word"], 16) for item in block["Instructions"]]
        start = int(body["CandidateStart"], 16)
        for index, word in enumerate(words):
            direct = direct_target(word, start + 4 * index)
            indirect = word & 0xFFFFFC1F in (0xD63F0000, 0xD61F0000)
            if direct is None and not indirect:
                continue
            row = {"Method": method, "Offset": index * 4, "InstructionWord": f"{word:08X}",
                   "Compiler": block["Instructions"][index], "Kind": "direct" if direct is not None else "indirect",
                   "ResolvedStaticShape": False, "ObservedExecution": False, "ClosureAdmitted": False,
                   "RuntimeAdmitted": False, "Failure": None}
            artifact = f"call-{body_index:04d}-{index:04d}"
            try:
                cell = indirect_cell(words, index) if indirect else None
            except ValueError as error:
                row["Failure"] = str(error)
                write(artifact + "-unresolved.json", row)
                rows.append(row)
                continue
            if indirect and cell is None:
                row["Failure"] = "unsupported indirect dependency; no register value inferred"
                write(artifact + "-unresolved.json", row)
                rows.append(row)
                continue
            try:
                if cell is not None:
                    raw = read(lldb, process, cell["Address"], 8)
                    row["Cell"] = {"Address": _hex(cell["Address"]), "Hex": raw.hex().upper(),
                                   "ShapeStartOffset": cell["StartIndex"] * 4,
                                   "ShapeWords": [f"{value:08X}" for value in words[cell["StartIndex"]:index + 1]],
                                   "BaseRegister": cell["BaseRegister"], "TargetRegister": cell["TargetRegister"]}
                    direct = int.from_bytes(raw, "little")
                row["Target"] = _hex(direct)
                row["ResolvedStaticShape"] = True
                row["CandidateRanges"] = [{"Method": other["Method"], "Offset": direct - int(other["CandidateStart"], 16)}
                                          for other in bodies if int(other["CandidateStart"], 16) <= direct < int(other["CandidateEnd"], 16)]
                write(artifact + "-mapping.json", row)
                if direct % 4:
                    raise ValueError("selected target is not ARM64 aligned")
                prefix = read(lldb, process, direct, 16, True)
                write(artifact + "-prefix.json", {"Address": _hex(direct), "Bytes": 16, "Hex": prefix.hex().upper(),
                                                 "Sha256": hashlib.sha256(prefix).hexdigest().upper(), "BodyResolved": False})
                if cell is not None:
                    repeat = read(lldb, process, cell["Address"], 8)
                    write(artifact + "-repeat.json", {"Address": _hex(cell["Address"]), "Hex": repeat.hex().upper()})
                    if repeat != raw:
                        raise ValueError("static call cell changed during stopped capture")
            except ValueError as error:
                row["Failure"] = str(error)
                write(artifact + "-refused.json", row)
            rows.append(row)
    return {"Rows": rows, "SelectedTransferKinds": ["b", "bl", "br", "blr"],
            "RuntimeAdmitted": False, "ClosureAdmitted": False,
            "Scope": "selected static transfer dependencies and observed stopped bytes; unresolved virtual/dynamic paths retained; no call execution or independent method extent asserted"}
