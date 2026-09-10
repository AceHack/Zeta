"""Independent byte-memory CHIP-8 execution for the registered catch fixture.

The interpreter executes one path, independently of both native adapter and
native shadow. Digests compare its observed instructions against the native
shadow transcript; it does not claim to observe the native adapter internals.
"""

from __future__ import annotations

import copy
import hashlib
import math
import struct
from dataclasses import dataclass

from zeta_interp.mess3_replay import Stream, domain

ARMS = ("order-two", "bigram", "last-beacon", "fair-independent", "known-lag-two")
MODEL_SHA = "C59468575B140DA146265182EE40B03D6F6B5103FAAC9A0137CE8A288DF357B3"
COUNTS_SHA = "8BEFD54B878D600A31A75BB5FA159588D2FDA4A849CAFB1410F03D6BC9B5B2A5"
FONT = bytes.fromhex(
    "f0909090f0 2060202070 f010f080f0 f010f010f0 9090f01010 "
    "f080f010f0 f080f090f0 f010204040 f090f090f0 f090f010f0 "
    "f090f09090 e090e090e0 f0808080f0 e0909090e0 f080f080f0 f080f08080"
)
INVERT = bytes.maketrans(bytes((0, 1)), bytes((1, 0)))


def sha(raw):
    return hashlib.sha256(raw).hexdigest().upper()


def binary(values):
    return "".join(str(value) for value in values)


def count_hash(counts):
    if not isinstance(counts, dict) or set(counts) != {"Unigram", "Bigram", "OrderTwo"}:
        raise ValueError("count fields")
    values = []

    def visit(node, dimensions):
        if not isinstance(node, list) or len(node) != 2:
            raise ValueError("count shape")
        if dimensions > 1:
            for child in node:
                visit(child, dimensions - 1)
        else:
            if any(
                type(x) is not float or not math.isfinite(x) or not 0 < x < 1
                for x in node
            ):
                raise ValueError("count probability")
            if abs(sum(node) - 1) > 1e-12:
                raise ValueError("count normalization")
            values.extend(node)

    for name, depth in (("Unigram", 1), ("Bigram", 2), ("OrderTwo", 3)):
        visit(counts[name], depth)
    return sha(struct.pack("<14d", *values))


def source_rows(seed, tag, count, probability):
    if type(count) is not int or count < 1 or probability not in (0.5, 0.75):
        raise ValueError("source configuration")
    rng = Stream(domain(seed, tag))
    rows = []
    for _ in range(count):
        row = []
        for position in range(66):
            draw = rng.next()
            row.append(
                int(2 * draw) if position < 2 else row[-2] ^ int(draw >= probability)
            )
        rows.append(bytes(row))
    return rows


def compile_rom(symbols, geometry):
    if (
        geometry not in ("dot", "bar")
        or len(symbols) != 66
        or any(type(x) is not int or x not in (0, 1) for x in symbols)
    ):
        raise ValueError("ROM source or geometry")
    words = [
        0x00E0,
        0x6118,
        0x6314 if geometry == "bar" else 0x6308,
        0x6404,
        0x651A,
        0x6210 + 32 * symbols[0],
        0xAAC6,
        0xD231,
    ]
    words += [0x6E00] * 9
    for symbol in symbols[1:]:
        words += (
            [0xF00A]
            + [0x800E] * 5
            + [
                0x7010,
                0x00E0,
                0xAAC6,
                0xD011,
                0x6210 + 32 * symbol,
                0xD211,
                0x86F0,
                0xD211,
                0xD231,
                0xF629,
                0xD455,
            ]
        )
    words.append(0x1AC4)
    return struct.pack(">1123H", *words) + bytes((0xE0 if geometry == "bar" else 0x80,))


def admit_rom(rom, geometry):
    if type(rom) is not bytes or len(rom) != 2247:
        raise ValueError("ROM size")
    offsets = [11] + [34 * group + 21 for group in range(1, 66)]
    if any(rom[offset] not in (16, 48) for offset in offsets):
        raise ValueError("ROM coordinate")
    symbols = bytes((rom[offset] - 16) // 32 for offset in offsets)
    if compile_rom(symbols, geometry) != rom:
        raise ValueError("ROM opcode, operand or sprite")
    return symbols


@dataclass(frozen=True)
class Frame:
    cells: bytes
    width: int = 64
    height: int = 32
    palette: int = 2


def background(frame):
    cells = frame.cells
    if (
        any(
            type(value) is not int
            for value in (frame.width, frame.height, frame.palette)
        )
        or (frame.width, frame.height, frame.palette) != (64, 32, 2)
        or type(cells) is not bytes
        or len(cells) != 2048
        or cells.count(0) + cells.count(1) != 2048
    ):
        raise ValueError("complete binary frame required")
    # Only upper-band pixels contribute to this count; lower-band validation
    # checks the declared binary domain but never determines the background.
    ones = cells[:1536].count(1)
    if ones == 768:
        raise ValueError("top-band background tie")
    return int(ones > 768)


def project(frame):
    value = background(frame)
    return Frame(frame.cells[:1536] + bytes((value,)) * 512)


def decode(frame):
    value = background(frame)
    if frame.cells[1536:] != bytes((value,)) * 512:
        raise ValueError("projection contains lower-band information")
    foreground = set()
    start = 0
    while (start := frame.cells.find(bytes((1 - value,)), start)) >= 0:
        foreground.add(start)
        start += 1
    if not foreground:
        raise ValueError("no component")
    pending = [min(foreground)]
    visited = set(pending)
    while pending:
        point = pending.pop()
        y, x = divmod(point, 64)
        neighbors = []
        if x > 0:
            neighbors.append(point - 1)
        if x < 63:
            neighbors.append(point + 1)
        if y > 0:
            neighbors.append(point - 64)
        if y < 31:
            neighbors.append(point + 64)
        for neighbor in neighbors:
            if neighbor in foreground and neighbor not in visited:
                visited.add(neighbor)
                pending.append(neighbor)
    halves = {point % 64 // 32 for point in foreground}
    if visited != foreground or len(halves) != 1:
        raise ValueError("multiple components or component crosses halves")
    return halves.pop()


def reward(frame):
    value = background(frame)
    glyph = bytes(
        frame.cells[(26 + y) * 64 + 4 + x] ^ value for y in range(5) for x in range(4)
    )
    matches = [
        digit
        for digit in (0, 1)
        if glyph
        == bytes(
            (FONT[5 * digit + y] >> (7 - x)) & 1 for y in range(5) for x in range(4)
        )
    ]
    if len(matches) != 1:
        raise ValueError("rendered feedback glyph")
    return matches[0]


class Machine:
    """Dense byte-memory interpreter; no native imports or token-to-frame path."""

    def __init__(self, rom, geometry):
        admit_rom(rom, geometry)
        self.rom = rom
        self.mem = bytearray(4096)
        self.mem[0x50:0xA0] = FONT
        self.mem[0x200 : 0x200 + len(rom)] = rom
        self.v = bytearray(16)
        self.pc = 0x200
        self.i = 0
        self.display = bytearray(2048)
        self.calls = 0

    def step(self, key):
        before = self.pc
        if not 0 <= before < 4095:
            raise ValueError("PC outside memory")
        opcode = self.mem[before] * 256 + self.mem[before + 1]
        group, x, y, low = (
            opcode >> 12,
            (opcode >> 8) & 15,
            (opcode >> 4) & 15,
            opcode & 15,
        )
        self.pc += 2
        if opcode == 0x00E0:
            self.display[:] = bytes(2048)
        elif group == 6:
            self.v[x] = opcode & 255
        elif group == 7:
            self.v[x] = (self.v[x] + (opcode & 255)) & 255
        elif group == 8 and low == 0:
            self.v[x] = self.v[y]
        elif group == 8 and low == 14:
            old = self.v[x]
            self.v[x] = (old * 2) & 255
            self.v[15] = old >> 7
        elif group == 10:
            self.i = opcode & 4095
        elif group == 13:
            origin_x, origin_y = self.v[x] % 64, self.v[y] % 32
            collision = 0
            for dy in range(low):
                if self.i + dy >= 4096:
                    raise ValueError("sprite outside memory")
                for dx in range(8):
                    if (
                        origin_x + dx < 64
                        and origin_y + dy < 32
                        and self.mem[self.i + dy] & (128 >> dx)
                    ):
                        offset = (origin_y + dy) * 64 + origin_x + dx
                        collision |= self.display[offset]
                        self.display[offset] ^= 1
            self.v[15] = collision
        elif group == 15 and opcode & 255 == 10:
            if key is None:
                self.pc = before
            elif type(key) is int and key in (0, 1):
                self.v[x] = key
            else:
                raise ValueError("unadmitted key")
        elif group == 15 and opcode & 255 == 41:
            if self.v[x] > 15:
                raise ValueError("font digit")
            self.i = 0x50 + 5 * self.v[x]
        else:
            raise ValueError("unadmitted opcode")
        return struct.pack("<HHH", before, opcode, self.pc)

    def advance(self, key, inverted=False):
        index = self.calls
        if index >= 66 or self.pc != 0x200 + index * 34:
            raise ValueError("group boundary")
        if (index == 0 and key is not None) or (
            index > 0 and (type(key) is not int or key not in (0, 1))
        ):
            raise ValueError("chronological key boundary")
        traces = bytearray()
        for offset in range(17):
            expected = 0x200 + index * 34 + 2 * offset
            if (
                self.pc != expected
                or self.mem[expected : expected + 2]
                != self.rom[expected - 0x200 : expected - 0x200 + 2]
            ):
                raise ValueError("observed PC/opcode")
            traces.extend(self.step(key))
            if self.pc != expected + 2:
                raise ValueError("nonadvancing instruction")
        self.calls += 1
        pixels = bytes(self.display)
        return Frame(pixels.translate(INVERT) if inverted else pixels), bytes(traces)


class Policy:
    def __init__(self, name, counts, rng=None):
        if name not in ARMS or count_hash(counts) != COUNTS_SHA:
            raise ValueError("policy or frozen count hash")
        if name == "fair-independent" and rng is None:
            raise ValueError("missing independent stream")
        self.name, self.counts, self.rng = name, copy.deepcopy(counts), rng
        self.history = []
        self.observed = 0
        self.draws = 0

    def observe(self, frame):
        token = decode(frame)
        self.observed += 1
        self.history = (self.history + [token])[-2:]
        return token

    def choose(self):
        if not 2 <= self.observed <= 65:
            raise ValueError("choice chronology")
        previous_previous, previous = self.history
        if self.name == "order-two":
            return int(self.counts["OrderTwo"][previous_previous][previous][1] > 0.5)
        if self.name == "bigram":
            return int(self.counts["Bigram"][previous][1] > 0.5)
        if self.name == "last-beacon":
            return previous
        if self.name == "known-lag-two":
            return previous_previous
        self.draws += 1
        return int(2 * self.rng.next())

    def fork(self):
        return copy.deepcopy(self)


def counters(episodes):
    return {
        key: value * episodes
        for key, value in {
            "Episodes": 1,
            "EnvironmentCalls": 66,
            "KeyActions": 65,
            "ScoredChoices": 64,
            "PrimaryInstructions": 1122,
            "ShadowInstructions": 1122,
            "TotalTransitions": 2244,
            "PrimaryTimerTicks": 66,
            "ShadowTimerTicks": 66,
            "AdapterGroupsChecked": 66,
        }.items()
    }


def run_episode(rom, geometry, palette, policy, index, aggregate=None):
    if palette not in ("fixed", "odd-complement"):
        raise ValueError("palette")
    truth = admit_rom(rom, geometry)
    machine = Machine(rom, geometry)
    hashes = [hashlib.sha256() for _ in range(3)]
    actions, hits, observations = [], [], []
    warmup_hit = None
    for position in range(66):
        key = None if position == 0 else 0 if position == 1 else policy.choose()
        if position >= 2:
            actions.append(key)  # Commit before execution reveals the next frame.
        frame, trace = machine.advance(
            key, palette == "odd-complement" and position % 2 == 1
        )
        projection = project(frame)
        token = policy.observe(projection)
        observations.append(token)
        if token != truth[position]:
            raise ValueError("private observed/source conformance")
        if position > 0:
            hit = reward(frame)
            if hit != int(key == truth[position]) or hit != machine.v[6]:
                raise ValueError("private reward/collision conformance")
            if position == 1:
                warmup_hit = hit
            else:
                hits.append(hit)
        for h, raw in zip(hashes, (frame.cells, projection.cells, trace), strict=True):
            h.update(raw)
        if aggregate is not None:
            for h, raw in zip(
                aggregate, (frame.cells, projection.cells, trace), strict=True
            ):
                h.update(raw)
    return {
        "Index": index,
        "Complete": True,
        "Failure": None,
        "Actions": binary(actions),
        "Hits": binary(hits),
        "Observations": binary(observations),
        "WarmupHit": warmup_hit,
        "Return": sum(hits),
        "Counters": counters(1),
        **dict(
            zip(
                ("FrameSha256", "ProjectionSha256", "ShadowTraceSha256"),
                (h.hexdigest().upper() for h in hashes),
                strict=True,
            )
        ),
    }


class EpisodeExecutionError(ValueError):
    def __init__(self, episode, cause):
        self.episode = episode
        super().__init__(f"episode {episode}: {cause}")


def run_batch(rows, geometry, palette, name, counts, rng=None, start_index=0):
    if not rows:
        raise ValueError("empty replay batch")
    hashes = [hashlib.sha256() for _ in range(3)]
    episodes = []
    draws = 0
    for index, row in enumerate(rows, start=start_index):
        try:
            policy = Policy(name, counts, rng)
            episodes.append(
                run_episode(
                    compile_rom(row, geometry), geometry, palette, policy, index, hashes
                )
            )
        except ValueError as error:
            raise EpisodeExecutionError(index, error) from error
        draws += policy.draws
    total = sum(episode["Return"] for episode in episodes)
    return {
        "Complete": True,
        "Failure": None,
        "ActionDraws": draws,
        "TotalHits": total,
        "MeanHitFraction": total / (64 * len(rows)),
        "Counters": counters(len(rows)),
        "Episodes": episodes,
        **dict(
            zip(
                ("FrameSha256", "ProjectionSha256", "ShadowTraceSha256"),
                (h.hexdigest().upper() for h in hashes),
                strict=True,
            )
        ),
    }
