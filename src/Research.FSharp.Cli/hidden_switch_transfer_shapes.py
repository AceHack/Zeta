"""Pure finite AArch64 word shapes; no memory access, execution or closure admission.

Encoding guidance: llvmorg-23.1.0 AArch64InstrFormats.td, BaseBranchReg,
BranchCond, BaseCmpBranch, BaseTestBranch, BImm, LoadLiteral and
ExceptionGeneration. Unsupported rows remain explicit and do not stop a
caller's word accounting. Malformed caller metadata is a structural error.
"""

import hashlib
import re

from inspect_hidden_switch_calls import indirect_cell

MAX64 = (1 << 64) - 1
CONDITIONS = ("eq", "ne", "hs", "lo", "mi", "pl", "vs", "vc", "hi", "ls", "ge", "lt", "gt", "le")
ORDINARY_NAMES = frozenset([
    "add", "and", "asr", "bics", "ccmp", "cmn", "cmp", "csel", "cset", "eor", "eor.16b",
    "fadd", "fcmp", "fdiv", "fmax", "fmov", "fmul", "fsub", "ldapr", "ldp", "ldr", "ldrb", "ldrh", "ldrsb",
    "ldur", "lsl", "mov", "mov.d", "movi.16b", "movi.4s", "movk", "neg", "orr", "orr.16b", "stp", "str",
    "strb", "strh", "stur", "sub", "tst", "umaxp.4s", "uxtb", "uxth",
])


def unsigned(value, bits):
    return type(bits) is int and 1 <= bits <= 64 and type(value) is int and 0 <= value < (1 << bits)


def signed(value, bits):
    if not unsigned(value, bits):
        raise ValueError("signed-field input differs from its finite unsigned width")
    return value - (1 << bits) if value & (1 << (bits - 1)) else value


def address(value, instruction=True):
    if not unsigned(value, 64) or value == 0 or (instruction and (value % 4 or value > MAX64 - 3)):
        raise ValueError("computed address is outside its declared uint64/alignment scope")
    return f"{value:016X}"


def ranges_admitted(ranges):
    """Validate finite code ranges independently of a prospective data address."""
    seen = set()
    previous_end = None
    for item in sorted(ranges, key=lambda item: item["Start"]):
        start, size, role = item["Start"], item["Bytes"], item["Role"]
        address(start)
        if type(size) is not int or size <= 0 or size % 4 or start + size > 1 << 64:
            raise ValueError("code range has invalid size or end")
        if not isinstance(role, str) or not role or role in seen or (previous_end is not None and start < previous_end):
            raise ValueError("code ranges overlap or repeat an identity")
        seen.add(role); previous_end = start + size
    return ranges


def control_location(target, ranges):
    text = address(target)
    matches = [item for item in ranges if item["Start"] <= target and target + 4 <= item["Start"] + item["Bytes"]]
    if len(matches) > 1:
        raise ValueError("control target has ambiguous recorded range membership")
    if not matches:
        return {"Address": text, "Membership": "outside-retained-code", "Role": None, "Offset": None}
    item = matches[0]; offset = target - item["Start"]
    return {"Address": text, "Membership": "entry" if offset == 0 else "interior", "Role": item["Role"], "Offset": offset}


def known_cells_admitted(rows, ranges):
    """Corroborate preserved eight-byte cell identity; does not read a cell."""
    roles = {item["Role"]: item for item in ranges_admitted(ranges)}
    result = {}
    for item in rows:
        cell, target, role = item["Address"], item["Target"], item["Role"]
        address(cell, instruction=False); address(target)
        if cell % 8 or cell > MAX64 - 7 or cell in result or type(item["Bytes"]) is not int or item["Bytes"] != 8:
            raise ValueError("known cell has invalid width/address or duplicate identity")
        if role not in roles or roles[role]["Start"] != target:
            raise ValueError("known cell target differs from the same role's current body")
        expected = hashlib.sha256(target.to_bytes(8, "little")).hexdigest().upper()
        if item["Sha256"] != expected:
            raise ValueError("known cell hash differs from the recorded little-endian target")
        result[cell] = {"Role": role, "Target": target, "Sha256": expected, "Bytes": 8}
    return result


def classify_word(words, index, pc, llvm_instruction, compiler_operands, literals, ranges, known_cells):
    """Return a shape row, including every unsupported/missing-evidence reason.

    Caller binds these values to the immutable decoded/compiler/physical
    records and admits ranges/cells once. No printed target address is used.
    """
    if type(index) is not int or not 0 <= index < len(words) or any(not unsigned(word, 32) for word in words):
        raise ValueError("word roster or selected index is malformed")
    address(pc)
    if not isinstance(llvm_instruction, str) or not llvm_instruction or len(llvm_instruction) > 512:
        raise ValueError("decoded instruction text is malformed")
    if not isinstance(compiler_operands, str) or len(compiler_operands) > 4096:
        raise ValueError("compiler operand text is malformed")
    tokens = llvm_instruction.split()
    if not tokens:
        raise ValueError("decoded instruction text has no token")
    word = words[index]; name = tokens[0]
    row = {"Word": f"{word:08X}", "Address": address(pc), "Kind": "unsupported",
           "Targets": [], "Continuation": None, "Register": None, "Condition": None, "Bit": None,
           "StaticCell": None, "Literal": None, "AttemptedTargetIntegers": [], "Unresolved": [], "ObservedExecution": False,
           "RuntimeAdmitted": False, "BodyResolved": False, "ClosureAdmitted": False}

    def require_name(expected):
        if name != expected:
            raise ValueError("word opcode and decoded mnemonic disagree")

    def destination(delta):
        row["AttemptedTargetIntegers"].append(pc + delta)
        result = control_location(pc + delta, ranges)
        if result["Membership"] == "outside-retained-code":
            row["Unresolved"].append("control-target-outside-retained-code")
        return result

    # A mismatch within trusted input correspondence is structural and stops
    # the caller. Supported opcode shapes with absent evidence remain rows.
    try:
        if word & 0x7C000000 == 0x14000000:
            linked = bool(word & 0x80000000); require_name("bl" if linked else "b")
            row["Kind"] = "call-direct" if linked else "jump-direct"
            row["Targets"] = [destination(signed(word & 0x03FFFFFF, 26) * 4)]
            if linked:
                row["Continuation"] = control_location(pc + 4, ranges)
                row["Unresolved"].append("call-return-and-callee-effects-not-established")
        elif word & 0xFF000010 == 0x54000000:
            condition = word & 15
            if condition >= len(CONDITIONS):
                row["Unresolved"].append("unsupported-conditional-code")
            else:
                require_name("b." + CONDITIONS[condition]); row["Kind"] = "conditional-branch"
                row["Condition"] = CONDITIONS[condition]
                row["Targets"] = [destination(signed((word >> 5) & 0x7FFFF, 19) * 4), destination(4)]
                row["Unresolved"].append("condition-feasibility-not-established")
        elif word & 0x7E000000 in (0x34000000, 0x36000000):
            test_bit = word & 0x7E000000 == 0x36000000
            nonzero = bool(word & 0x01000000)
            require_name(("tbnz" if nonzero else "tbz") if test_bit else ("cbnz" if nonzero else "cbz"))
            row["Kind"] = "test-bit-branch" if test_bit else "compare-zero-branch"
            row["Register"] = ("x" if word & 0x80000000 else "w") + ("zr" if word & 31 == 31 else str(word & 31))
            bits = 14 if test_bit else 19
            if test_bit:
                row["Bit"] = ((word >> 19) & 31) | ((word >> 26) & 32)
            row["Condition"] = "nonzero" if nonzero else "zero"
            row["Targets"] = [destination(signed((word >> 5) & ((1 << bits) - 1), bits) * 4), destination(4)]
            row["Unresolved"].append("condition-feasibility-not-established")
        elif word & 0xFFFFFC1F in (0xD61F0000, 0xD63F0000, 0xD65F0000):
            opcode = word & 0xFFFFFC1F
            require_name({0xD61F0000: "br", 0xD63F0000: "blr", 0xD65F0000: "ret"}[opcode])
            register = (word >> 5) & 31
            row["Register"] = "xzr" if register == 31 else "x" + str(register)
            if register == 31:
                row["Unresolved"].append("unsupported-indirect-or-return-register-31")
                return row
            row["Kind"] = {0xD61F0000: "jump-indirect", 0xD63F0000: "call-indirect", 0xD65F0000: "return"}[opcode]
            if opcode == 0xD65F0000:
                row["Unresolved"].append("return-register-and-caller-not-observed")
            else:
                cell = indirect_cell(words, index)
                if cell is None:
                    row["Unresolved"].append("unsupported-indirect-dependency")
                else:
                    row["StaticCell"] = {**cell, "Address": address(cell["Address"], instruction=False),
                                         "Words": [f"{item:08X}" for item in words[cell["StartIndex"]:index + 1]],
                                         "PhysicalValueReused": cell["Address"] in known_cells}
                    if cell["Address"] in known_cells:
                        observed = known_cells[cell["Address"]]
                        row["StaticCell"]["RecordedCell"] = observed
                        row["Targets"] = [control_location(observed["Target"], ranges)]
                    else:
                        row["Unresolved"].append("static-cell-value-not-observed")
                row["Unresolved"].append("indirect-execution-and-target-set-not-established")
            if opcode == 0xD63F0000:
                row["Continuation"] = control_location(pc + 4, ranges)
                row["Unresolved"].append("call-return-and-callee-effects-not-established")
        elif word & 0xFFE0001F == 0xD4200000 or word >> 16 == 0:
            require_name("udf" if word >> 16 == 0 else "brk")
            row["Kind"] = "trap"; row["Unresolved"].append("trap-and-exception-path-not-established")
        elif word & 0x3B000000 == 0x18000000:
            width = {0x5C000000: 8, 0x9C000000: 16}.get(word & 0xFF000000)
            labels = re.findall(r"\[@(RWD\d+)\]", compiler_operands)
            location = pc + signed((word >> 5) & 0x7FFFF, 19) * 4
            row["Kind"] = "literal-load"
            row["AttemptedTargetIntegers"].append(location)
            row["Literal"] = {"Address": address(location, instruction=False), "Bytes": width,
                              "ExpectedHex": None, "Label": None, "PhysicalBinding": False}
            if width is None or len(labels) != 1 or labels[0] not in literals:
                row["Unresolved"].append("unsupported-literal-width-or-label")
            else:
                require_name("ldr")
                expected = literals[labels[0]]
                if not isinstance(expected, str) or re.fullmatch(r"[0-9A-F]{" + str(width * 2) + r"}", expected) is None:
                    row["Unresolved"].append("literal-declaration-width-or-value-invalid")
                elif location > MAX64 - width + 1:
                    row["Unresolved"].append("literal-range-overflow")
                else:
                    row["Literal"].update(ExpectedHex=expected, Label=labels[0])
            row["Unresolved"].append("physical-literal-binding-not-observed")
        elif "[@RWD" in compiler_operands:
            row["Unresolved"].append("compiler-literal-label-without-literal-opcode")
        elif word & 0x1C000000 == 0x14000000 or word & 0x1F000000 == 0x10000000:
            row["Unresolved"].append("unsupported-control-system-or-pc-relative-opcode")
        elif name in ORDINARY_NAMES:
            row["Kind"] = "ordinary-instruction-effects-uninspected"
            row["Unresolved"].append("ordinary-instruction-effects-not-inspected")
        else:
            row["Unresolved"].append("unsupported-opcode-mnemonic-combination")
    except ValueError as error:
        # Preserve the selected word and any computed locator. The outer
        # collector treats this as a structural refusal, not a skipped row.
        row["StructuralFailure"] = str(error)
    return row
