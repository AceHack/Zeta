"""Pure proposal of fixed data ranges from accepted retained transfer rows; no memory API."""
import re
from types import MappingProxyType

from hidden_switch_transfer_inputs import (
    FLAGS,
    canonical_address,
    full_flags_false,
    require,
)
from hidden_switch_transfer_shapes import signed
from inspect_hidden_switch_calls import indirect_cell

EXPECTED = MappingProxyType({"Methods": 130, "Words": 8665, "CellSites": 134, "Cells": 43, "Literals": 10, "Bytes": 496})


def derive_ranges(methods, expected=EXPECTED):
    """The production caller fixes EXPECTED; smaller explicit rosters are synthetic fixtures only."""
    require(len(methods) == expected["Methods"], "method count differs from the admitted inventory")
    cells = {}; literals = {}; words = 0; cell_sites = 0; seen_roles = set(); previous_method = -1
    for method_index, method in enumerate(methods):
        full_flags_false(method)
        require(method.get("Complete") is True and method.get("ObservedExecution") is False, "method collection/admission scope differs")
        role = method["Role"]; descriptor = method["Method"]
        require(isinstance(role, str) and re.fullmatch(r"method-[0-9]{3}", role) is not None and role not in seen_roles
                and descriptor["Role"] == role, "method identity is malformed or repeated")
        ordinal = int(role[-3:])
        require(ordinal > previous_method, "methods are not in the original numeric role order")
        previous_method = ordinal
        seen_roles.add(role)
        require(type(descriptor["Bytes"]) is int and descriptor["Bytes"] > 0 and descriptor["Bytes"] == 4 * len(method["Words"])
                and type(descriptor["Address"]) is int and descriptor["Address"] > 0 and descriptor["Address"] % 4 == 0
                and descriptor["Address"] + descriptor["Bytes"] <= 1 << 64, "method word/byte/address bounds differ")
        method_words = [int(row["Compiler"]["Word"], 16) for row in method["Words"]]
        for index, word in enumerate(method["Words"]):
            shape = word["Shape"]; decoded = word["Decoded"]; compiled = word["Compiler"]
            full_flags_false(shape)
            require(shape.get("ObservedExecution") is False and "StructuralFailure" not in shape, "word observation/structural scope differs")
            address = descriptor["Address"] + 4 * index
            require(word["Role"] == role and type(word["Offset"]) is int and word["Offset"] == 4 * index
                    and decoded["Offset"] == compiled["Offset"] == word["Offset"]
                    and canonical_address(shape["Address"]) == canonical_address(decoded["Address"]) == address
                    and re.fullmatch(r"[0-9A-F]{8}", shape["Word"]) is not None
                    and shape["Word"] == compiled["Word"]
                    and int(shape["Word"], 16).to_bytes(4, "little").hex().upper() == decoded["Hex"],
                    "word role/order/address/byte association differs")
            words += 1
            site = {"MethodOrder": method_index, "Role": role, "Offset": word["Offset"], "Word": shape["Word"],
                    "Decoded": decoded, "Compiler": compiled}
            cell = shape["StaticCell"]
            if cell is not None and cell.get("PhysicalValueReused") is False:
                require(shape["Kind"] in ["call-indirect", "jump-indirect"] and shape["Targets"] == [], "unknown cell has unexpected transfer or target evidence")
                target = canonical_address(cell["Address"])
                require(target > 0 and target % 8 == 0 and target + 8 <= 1 << 64, "unknown cell range is invalid")
                reconstructed = indirect_cell(method_words, index)
                require(reconstructed is not None and reconstructed["Address"] == target
                        and all(reconstructed[key] == cell[key] for key in ["StartIndex", "BaseRegister", "TargetRegister"]),
                        "static cell address/register dependency differs from its original words")
                require(type(cell["StartIndex"]) is int and 0 <= cell["StartIndex"] < index
                        and cell["Words"] == [item["Shape"]["Word"] for item in method["Words"][cell["StartIndex"]:index + 1]],
                        "static cell construction word prefix differs")
                site["Construction"] = cell
                row = cells.setdefault(target, {"Kind": "cell", "Address": f"{target:016X}", "Bytes": 8, "ExpectedHex": None, "Uses": []})
                row["Uses"].append(site); cell_sites += 1
            literal = shape["Literal"]
            if literal is not None:
                target = canonical_address(literal["Address"]); width = literal["Bytes"]
                instruction = int(shape["Word"], 16)
                require(instruction & 0x3B000000 == 0x18000000
                        and {0x5C000000: 8, 0x9C000000: 16}.get(instruction & 0xFF000000) == width
                        and address + signed((instruction >> 5) & 0x7FFFF, 19) * 4 == target
                        and re.findall(r"\[@(RWD\d+)\]", compiled["Operands"]) == [literal["Label"]],
                        "literal address/width/label differs from its original word and compiler operand")
                require(shape["Kind"] == "literal-load" and literal.get("PhysicalBinding") is False
                        and type(width) is int and width in [8, 16] and target > 0 and target % 4 == 0 and target + width <= 1 << 64
                        and isinstance(literal["Label"], str) and re.fullmatch(r"RWD[0-9]+", literal["Label"]) is not None
                        and isinstance(literal["ExpectedHex"], str) and re.fullmatch(r"[0-9A-F]{" + str(width * 2) + r"}", literal["ExpectedHex"]) is not None,
                        "literal range lacks the exact supported declared expectation")
                require(target not in literals, "literal address is repeated; fixed inventory requires ten unique literal sites")
                site["Label"] = literal["Label"]
                literals[target] = {"Kind": "literal", "Address": f"{target:016X}", "Bytes": width,
                                    "ExpectedHex": literal["ExpectedHex"], "Uses": [site]}
    rows = [cells[key] for key in sorted(cells)] + [literals[key] for key in sorted(literals)]
    previous_end = 0
    for row in sorted(rows, key=lambda row: int(row["Address"], 16)):
        start = int(row["Address"], 16)
        require(start >= previous_end, "selected data ranges overlap, including within one kind")
        previous_end = start + row["Bytes"]
    require(words == expected["Words"] and cell_sites == expected["CellSites"] and len(cells) == expected["Cells"]
            and len(literals) == expected["Literals"] and sum(row["Bytes"] for row in rows) == expected["Bytes"],
            "derived word/site/range/byte counts differ from the fixed proposal")
    return {"Kind": "finite-data-range-proposal", "Complete": True, "Methods": len(methods), "Words": words,
            "CellSites": cell_sites, "Cells": len(cells), "Literals": len(literals), "Bytes": sum(row["Bytes"] for row in rows),
            "Ranges": rows, "ProposalOnly": True, "NewMemoryQueries": 0, "ObservedExecution": False, **FLAGS}
