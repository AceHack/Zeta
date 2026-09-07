"""Candidate managed spans from observed stubs and compiler-sized byte matches.

This is inspection evidence, never a runtime/closure certificate. The caller
owns the stopped process and exclusive artifact writer. Unknown mappings refuse.
"""

from __future__ import annotations

import hashlib
import re


def parse_blocks(text):
    blocks = []
    for part in text.split("; Assembly listing for method ")[1:]:
        lines = part.splitlines()
        name = lines[0]
        instructions = []
        literals = {}
        ended = False
        initial_offset = False
        for line in lines[1:]:
            end = re.fullmatch(r"; Total bytes of code (\d+)\s*", line)
            if end:
                size = int(end[1])
                if not initial_offset or size != 4 * len(instructions) or not 0 < size <= 1048576:
                    raise ValueError("compiler instruction count differs from declared span")
                ended = True
                break
            offset = re.search(r";; offset=0x([0-9A-Fa-f]+)", line)
            if offset:
                if int(offset[1], 16) != 4 * len(instructions):
                    raise ValueError("compiler block offsets are not contiguous")
                if not instructions:
                    initial_offset = True
            word = re.fullmatch(r"        ([0-9A-F]{8})\s+(\S+)(?:\s+(.*))?", line)
            if word:
                if not initial_offset:
                    raise ValueError("compiler block lacks explicit initial offset zero")
                instructions.append({"Offset": 4 * len(instructions), "Word": word[1], "Mnemonic": word[2], "Operands": word[3] or ""})
            elif re.match(r"^        [0-9A-F]", line):
                raise ValueError("malformed compiler instruction-looking line")
            literal = re.fullmatch(r"(RWD\d+)\s+dq\s+([0-9A-F]{16}h(?:,\s*[0-9A-F]{16}h)?)\s*(?:;.*)?", line)
            if literal:
                if literal[1] in literals:
                    raise ValueError("duplicate compiler literal label")
                literals[literal[1]] = b"".join(int(word.strip()[:-1], 16).to_bytes(8, "little") for word in literal[2].split(",")).hex().upper()
            elif line.startswith("RWD"):
                raise ValueError("unrecognized compiler literal declaration")
        if not ended:
            raise ValueError("compiler block has no complete declared end")
        raw = b"".join(int(row["Word"], 16).to_bytes(4, "little") for row in instructions)
        blocks.append({"Name": name, "Bytes": len(raw), "Hex": raw.hex().upper(), "Instructions": instructions, "Literals": literals})
    if not blocks:
        raise ValueError("no compiler blocks")
    return blocks


def literal_address(word, pc):
    immediate = (word >> 5) & 0x7FFFF
    if immediate & 0x40000:
        immediate -= 0x80000
    return pc + immediate * 4


def stub_cell(raw, address):
    if len(raw) != 8:
        raise ValueError("stub requires exact eight bytes")
    first, second = (int.from_bytes(raw[i:i + 4], "little") for i in (0, 4))
    if first & 0xFF00001F != 0x5800000B or second != 0xD61F0160:
        raise ValueError("unrecognized callable stub; expected literal x11 load and branch")
    return literal_address(first, address)


def _hex(value):
    return f"{value:016X}"


def _read(lldb, process, address, size, executable=False):
    region = lldb.SBMemoryRegionInfo()
    error = process.GetMemoryRegionInfo(address, region)
    if not error.Success() or not region.IsReadable() or (executable and not region.IsExecutable()):
        raise ValueError("candidate memory region lacks admitted read/execute permission")
    if not 0 < size <= 1048576 or address < region.GetRegionBase() or address + size > region.GetRegionEnd():
        raise ValueError("candidate read crosses the admitted region or size bound")
    error = lldb.SBError()
    raw = process.ReadMemory(address, size, error)
    if not error.Success() or len(raw) != size:
        raise ValueError("candidate memory read was incomplete")
    return bytes(raw)


def _decode(lldb, target, address, raw):
    if address % 4 or len(raw) % 4:
        raise ValueError("candidate span is not ARM64 aligned")
    instructions = target.ReadInstructions(lldb.SBAddress(address, target), len(raw) // 4)
    if instructions.GetSize() != len(raw) // 4:
        raise ValueError("candidate independent decoder truncated the span")
    rows = []
    for offset, instruction in enumerate(instructions):
        if not instruction.IsValid() or instruction.GetAddress().GetLoadAddress(target) != address + 4 * offset or instruction.GetByteSize() != 4:
            raise ValueError("candidate independent decoder has invalid address/width")
        data = instruction.GetData(target)
        observed = []
        for i in range(4):
            error = lldb.SBError()
            observed.append(data.GetUnsignedInt8(error, i))
            if not error.Success():
                raise ValueError("candidate decoder byte retrieval failed")
        if bytes(observed) != raw[4 * offset:4 * offset + 4]:
            raise ValueError("candidate independent bytes differ")
        rows.append({"Address": _hex(address + 4 * offset), "Bytes": bytes(observed).hex().upper(), "Mnemonic": instruction.GetMnemonic(target), "Operands": instruction.GetOperands(target), "Comment": instruction.GetComment(target)})
    return rows


def capture(lldb, target, process, report, blocks, write):
    rows = []
    for index, method in enumerate(report["Methods"]):
        if not method["Prepared"]:
            continue  # explicit generic refusals remain in the prefix roster
        candidates = [block for block in blocks if block["Name"].startswith(method["Type"] + ":" + method["Name"] + "(")]
        if len(candidates) != 1:
            raise ValueError("prepared method has no unique complete compiler block")
        block = candidates[0]
        callable_address = int(method["Callable"], 16)
        stub = _read(lldb, process, callable_address, 8, True)
        cell = stub_cell(stub, callable_address)
        pointer = _read(lldb, process, cell, 8)
        address = int.from_bytes(pointer, "little")
        witness = {"Method": method, "Callable": _hex(callable_address), "StubHex": stub.hex().upper(), "Cell": _hex(cell), "CellHex": pointer.hex().upper(), "Target": _hex(address), "CompilerBlock": block, "RuntimeAdmitted": False, "ClosureAdmitted": False}
        write(f"body-{index:04d}-mapping.json", witness)
        if address % 4:
            raise ValueError("stub target is not aligned")
        raw = _read(lldb, process, address, block["Bytes"], True)
        write(f"body-{index:04d}-raw.json", {"Address": _hex(address), "Bytes": len(raw), "Hex": raw.hex().upper(), "Sha256": hashlib.sha256(raw).hexdigest().upper()})
        if raw.hex().upper() != block["Hex"]:
            raise ValueError("actual target bytes differ from the complete compiler candidate")
        decoded = _decode(lldb, target, address, raw)
        write(f"body-{index:04d}-decoded.json", {"Address": _hex(address), "Instructions": decoded})
        literals = []
        used = set()
        for instruction in block["Instructions"]:
            word = int(instruction["Word"], 16)
            is_literal = word & 0x3B000000 == 0x18000000
            match = re.search(r"\[@(RWD\d+)\]", instruction["Operands"])
            if not is_literal and not match:
                continue
            if not is_literal or not match:
                raise ValueError("unresolved PC-relative data: opcode and literal annotation must agree")
            label = match[1]
            width = {0x5C000000: 8, 0x9C000000: 16}.get(word & 0xFF000000)
            if label not in block["Literals"] or width is None or len(block["Literals"][label]) != width * 2:
                raise ValueError("unknown referenced literal form; requires exact double/Q LDR and matching declared width")
            location = literal_address(word, address + instruction["Offset"])
            value = _read(lldb, process, location, width)
            item = {"Label": label, "InstructionOffset": instruction["Offset"], "Address": _hex(location), "Bytes": width, "Hex": value.hex().upper(), "CompilerHex": block["Literals"][label]}
            literals.append(item)
            write(f"body-{index:04d}-literal-{len(literals):04d}.json", item)
            if value.hex().upper() != block["Literals"][label]:
                raise ValueError("actual referenced constant differs from compiler literal")
            used.add(label)
        if used != set(block["Literals"]):
            raise ValueError("unbound compiler literal data")
        # A stopped-process repeat is an observation, not a global atomicity claim.
        if _read(lldb, process, cell, 8) != pointer or _read(lldb, process, address, len(raw), True) != raw:
            raise ValueError("pointer/body observation changed during capture")
        branch_kinds = ("bl", "blr", "br", "b", "beq", "bne", "bhs", "blo", "bmi", "bpl", "bvs", "bvc", "bhi", "bls", "bge", "blt", "bgt", "ble", "bal", "bnv", "cbz", "cbnz", "tbz", "tbnz", "ret")
        transfers = [{"Offset": item["Offset"], "CompilerMnemonic": item["Mnemonic"], "CompilerOperands": item["Operands"], "Independent": decoded[item["Offset"] // 4], "Classified": False} for item in block["Instructions"] if item["Mnemonic"] in branch_kinds]
        row = {"Method": method, "CandidateStart": _hex(address), "CandidateEnd": _hex(address + len(raw)), "Bytes": len(raw), "Sha256": hashlib.sha256(raw).hexdigest().upper(), "CandidateMatchesCompilerBytes": True, "IndependentDecodedInstructions": len(decoded), "Literals": literals, "Transfers": transfers, "TransferKinds": branch_kinds, "BodyResolved": False, "ClosureAdmitted": False, "RuntimeAdmitted": False, "Limit": "complete compiler-declared candidate bytes inspected through observed stub; listed transfer kinds only, not a complete CFG; no independent method-extent metadata or classified call closure yet"}
        write(f"body-{index:04d}-candidate.json", row)
        rows.append(row)
    return rows
