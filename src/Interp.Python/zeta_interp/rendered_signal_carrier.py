"""Independent restricted CHIP-8 beacon interpreter and rendered observations.

This is a reference for the registered opcode subset, not a general emulator.
Generated source symbols never replace observations from executed display cells.
"""

from __future__ import annotations

import hashlib
from collections.abc import Callable

import numpy as np

from zeta_interp.mess3_replay import Stream, domain

RENDERERS = ("train-dot", "heldout-bar", "nuisance")


def sample(stream, length, probability=0.75, start=128, duration=0):
    if (
        not 2 <= length <= 256
        or not np.isfinite(probability)
        or not 0 <= probability <= 1
        or start < 2
        or duration < 0
        or (duration and (start >= length or duration > length - start))
    ):
        raise ValueError("invalid source bounds")
    tokens = np.zeros(length, dtype=np.uint8)
    for t in range(length):
        draw = stream.next()
        if t < 2:
            tokens[t] = int(2 * draw)
        else:
            p = probability if start <= t < start + duration else 0.75
            tokens[t] = tokens[t - 2] if draw < p else 1 - tokens[t - 2]
    return tokens


def compile_rom(renderer, tokens):
    values = np.asarray(tokens)
    if (
        renderer not in RENDERERS
        or values.ndim != 1
        or not 1 <= len(values) <= 256
        or not np.isin(values, [0, 1]).all()
    ):
        raise ValueError("invalid carrier or binary symbols")
    group_bytes = 12 if renderer == "nuisance" else 8
    sprite = 0x204 + group_bytes * len(values)
    opcodes = [0x6100 | (20 if renderer == "heldout-bar" else 8), 0xA000 | sprite]
    for t, token in enumerate(values):
        bar = renderer == "heldout-bar" or (renderer == "nuisance" and t % 2 == 1)
        if renderer == "nuisance":
            opcodes.extend([0x6100 | (20 if bar else 8), 0xA000 | (sprite + int(bar))])
        next_address = 0x204 + group_bytes * (t + 1)
        if t == len(values) - 1:
            next_address -= 2
        opcodes.extend(
            [
                0x00E0,
                0x6000 | ((14 if bar else 16) + 32 * int(token)),
                0xD011,
                0x1000 | next_address,
            ]
        )
    result = b"".join(value.to_bytes(2, "big") for value in opcodes)
    result += {"train-dot": b"\x80", "heldout-bar": b"\xe0", "nuisance": b"\x80\xe0"}[
        renderer
    ]
    if len(result) > 3584:
        raise ValueError("ROM budget exceeded")
    return result


def validate_rom(renderer, count, rom):
    if renderer not in RENDERERS or not 1 <= count <= 256 or not isinstance(rom, bytes):
        raise ValueError("invalid ROM boundary")
    group = 12 if renderer == "nuisance" else 8
    expected_size = 4 + count * group + (2 if renderer == "nuisance" else 1)
    if len(rom) != expected_size or len(rom) > 3584:
        raise ValueError("ROM shape or budget mismatch")
    tokens = []
    for t in range(count):
        bar = renderer == "heldout-bar" or (renderer == "nuisance" and t % 2 == 1)
        offset = 4 + t * group + (4 if renderer == "nuisance" else 0) + 3
        x = rom[offset] - (14 if bar else 16)
        if x not in (0, 32):
            raise ValueError("noncanonical beacon location")
        tokens.append(x // 32)
    if compile_rom(renderer, tokens) != rom:
        raise ValueError("noncanonical opcode or sprite")


def describe_frame(cells):
    frame = np.asarray(cells)
    if frame.shape != (32, 64) or not np.isin(frame, [0, 1]).all():
        raise ValueError("requires a 64x32 binary frame")
    # Core chooses the lower palette index when occupancy ties.
    background = int(np.count_nonzero(frame) > frame.size // 2)
    points = set(zip(*np.nonzero(frame != background), strict=True))
    if not points:
        raise ValueError("missing beacon")
    first = next(iter(points))
    component, pending = {first}, [first]
    while pending:
        y, x = pending.pop()
        for point in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if point in points and point not in component:
                component.add(point)
                pending.append(point)
    if component != points:
        raise ValueError("ambiguous beacon")
    ys, xs = zip(*points, strict=True)
    x0, y0 = min(xs), min(ys)
    if x0 // 32 != max(xs) // 32:
        raise ValueError("beacon crosses midpoint")
    shape = tuple(sorted((int(x - x0), int(y - y0)) for y, x in points))
    return {
        "Token": (sum(int(x) for x in xs) // len(xs)) // 32,
        "Shape": shape,
        "Colour": 1 - background,
        "Origin": (int(x0), int(y0)),
    }


def interpret(renderer, count, rom, on_frame: Callable[[bytes], object] | None = None):
    validate_rom(renderer, count, rom)
    memory = bytearray(4096)
    memory[0x200 : 0x200 + len(rom)] = rom
    registers = [0] * 16
    display = np.zeros((32, 64), dtype=np.uint8)
    pc, index = 0x200, 0

    def step():
        nonlocal pc, index
        if not 0x200 <= pc < 0x200 + len(rom) - 1:
            raise ValueError("PC outside admitted ROM")
        opcode = int.from_bytes(memory[pc : pc + 2], "big")
        pc += 2
        if opcode == 0x00E0:
            display.fill(0)
        elif opcode >> 12 == 6:
            registers[(opcode >> 8) & 15] = opcode & 255
        elif opcode >> 12 == 10:
            index = opcode & 4095
        elif opcode == 0xD011:
            if not 0 <= index < len(memory):
                raise ValueError("sprite outside memory")
            for bit in range(8):
                if memory[index] & (128 >> bit):
                    display[registers[1] % 32, (registers[0] + bit) % 64] ^= 1
        elif opcode >> 12 == 1:
            pc = opcode & 4095
        else:
            raise ValueError("unregistered opcode")

    step()
    step()
    previous = None
    diagnostics = {
        "Comparisons": 0,
        "StructureChanges": 0,
        "PaletteChanges": 0,
        "PlacementChanges": 0,
    }
    tokens = []
    for t in range(count):
        for _ in range(6 if renderer == "nuisance" else 4):
            step()
        frame = display ^ int(renderer == "nuisance" and t % 2 == 1)
        description = describe_frame(frame)
        tokens.append(description["Token"])
        if previous is not None:
            diagnostics["Comparisons"] += 1
            for column, key in (
                ("StructureChanges", "Shape"),
                ("PaletteChanges", "Colour"),
                ("PlacementChanges", "Origin"),
            ):
                diagnostics[column] += int(previous[key] != description[key])
        previous = description
        if on_frame is not None:
            on_frame(frame.tobytes())
    return np.asarray(tokens, dtype=np.uint8), diagnostics


def corpus(renderer, count, length, seed, tag, probability=0.75, start=128, duration=0):
    if not 1 <= count <= 65536:
        raise ValueError("corpus count outside bounded reference")
    stream = Stream(domain(seed, tag))
    rom_hash, frame_hash, token_hash = (hashlib.sha256() for _ in range(3))
    rows = []
    diagnostics = {
        "Comparisons": 0,
        "StructureChanges": 0,
        "PaletteChanges": 0,
        "PlacementChanges": 0,
    }
    for _ in range(count):
        truth = sample(stream, length, probability, start, duration)
        rom = compile_rom(renderer, truth)
        tokens, row_diagnostics = interpret(renderer, length, rom, frame_hash.update)
        if not np.array_equal(tokens, truth):
            raise ValueError("extraction differs from source; no fallback allowed")
        rom_hash.update(rom)
        token_hash.update(tokens.tobytes())
        rows.append(tokens)
        for key in diagnostics:
            diagnostics[key] += row_diagnostics[key]
    return (
        np.asarray(rows),
        {
            "RomSha256": rom_hash.hexdigest().upper(),
            "FrameSha256": frame_hash.hexdigest().upper(),
            "TokenSha256": token_hash.hexdigest().upper(),
            "Sequences": count,
            "Frames": count * length,
        },
        diagnostics,
    )
