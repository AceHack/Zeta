// Chip9Machine — the CHIP-9 (Zeta color-extension dialect) C# conformer oracle. Mirrors
// src/Core/Chip8Cow.fs (the F# oracle that LOCKED the treaty) and the TS sibling: Fn01 plane select
// (3 bits = RGB), per-selected-plane XOR draw with VF collision, selective CLS; plane 0 (mono) in
// Display, higher planes in Extra (canonical: zero => absent). Opcode subset sufficient for the
// treaty ROM. TREATY: replaying src/Core.TypeScript/chip9/golden-vectors.lines' rom must reproduce
// its 32x64 hex color grid byte-for-byte.

using System.Collections.Generic;

namespace Zeta.Core.CSharp;

/// <summary>The CHIP-9 machine state + stepper (treaty-conformance subset).</summary>
public sealed class Chip9Machine
{
    /// <summary>Display width in pixels.</summary>
    public const int Width = 64;

    /// <summary>Display height in pixels.</summary>
    public const int Height = 32;

    private const int ProgramStart = 0x200;

    /// <summary>Memory (sparse; absent ⇒ 0).</summary>
    public IDictionary<int, byte> Mem { get; } = new Dictionary<int, byte>();

    /// <summary>The V registers.</summary>
    public byte[] V { get; } = new byte[16];

    /// <summary>The index register.</summary>
    public int I { get; private set; }

    /// <summary>The program counter.</summary>
    public int Pc { get; private set; } = ProgramStart;

    /// <summary>The CHIP-9 selected-plane mask (bit0=R/mono, bit1=G, bit2=B); default 1.</summary>
    public byte Plane { get; private set; } = 1;

    /// <summary>The mono plane (plane 0) — the untouched CHIP-8 display.</summary>
    public ISet<int> Display { get; } = new HashSet<int>();

    /// <summary>The higher planes' per-pixel bitmask (bits 1-2; zero ⇒ absent).</summary>
    public IDictionary<int, byte> Extra { get; } = new Dictionary<int, byte>();

    /// <summary>The call stack (FAULT TREATY 2026-06-12: classic 16-frame cap).</summary>
    public IList<int> CallStack { get; } = new List<int>();

    /// <summary>The fault register — recorded, never fatal; the first fault wins.</summary>
    public string? Fault { get; private set; }

    /// <summary>Load a ROM at 0x200.</summary>
    public void LoadRom(IReadOnlyList<byte> rom)
    {
        for (var i = 0; i < rom.Count; i++)
        {
            Mem[ProgramStart + i] = rom[i];
        }
    }

    /// <summary>The full color mask at a pixel — bit0 from Display, bits 1-2 from Extra.</summary>
    public byte ColorAt(int x, int y)
    {
        var idx = ((y % Height) * Width) + (x % Width);
        var mono = Display.Contains(idx) ? (byte)1 : (byte)0;
        return (byte)(mono | (Extra.TryGetValue(idx, out var hi) ? hi : (byte)0));
    }

    /// <summary>Execute one instruction (treaty subset: 00E0, 00EE, 2NNN, 6XNN, ANNN, DXYN, Fn01).</summary>
    public void Step()
    {
        var op = ((Mem.TryGetValue(Pc, out var hiB) ? hiB : 0) << 8)
                 | (Mem.TryGetValue(Pc + 1, out var loB) ? loB : 0);
        var x = (op & 0x0F00) >> 8;
        var n = op & 0x000F;
        var nn = (byte)(op & 0x00FF);
        var nnn = op & 0x0FFF;
        Pc += 2;

        switch (op & 0xF000)
        {
            case 0x0000 when op == 0x00E0:
                ClearSelected();
                break;
            case 0x0000 when op == 0x00EE:
                // FAULT TREATY: RET — pop, or record underflow (never fatal; first fault wins)
                if (CallStack.Count > 0)
                {
                    Pc = CallStack[^1];
                    CallStack.RemoveAt(CallStack.Count - 1);
                }
                else
                {
                    Fault ??= "stack underflow: 00EE (RET) on empty stack";
                }

                break;
            case 0x2000:
                // FAULT TREATY: CALL — at depth 16 the CALL is REFUSED (fall through)
                if (CallStack.Count >= 16)
                {
                    Fault ??= "stack overflow: CALL (2NNN) at depth 16 refused";
                }
                else
                {
                    CallStack.Add(Pc);
                    Pc = nnn;
                }

                break;
            case 0x6000:
                V[x] = nn;
                break;
            case 0xA000:
                I = nnn;
                break;
            case 0xD000:
                Draw(x, (op & 0x00F0) >> 4, n);
                break;
            case 0xF000 when nn == 0x01:
                Plane = (byte)(x & 0b111);
                break;
            default:
                break;
        }
    }

    private void ClearSelected()
    {
        if ((Plane & 1) != 0)
        {
            Display.Clear();
        }

        var keep = (byte)(~Plane & 0b110);
        if (keep == 0b110)
        {
            return;
        }

        foreach (var key in new List<int>(Extra.Keys))
        {
            var m2 = (byte)(Extra[key] & keep);
            if (m2 == 0)
            {
                Extra.Remove(key);
            }
            else
            {
                Extra[key] = m2;
            }
        }
    }

    private void Draw(int xReg, int yReg, int n)
    {
        var ox = V[xReg] % Width;
        var oy = V[yReg] % Height;
        var hiSel = (byte)(Plane & 0b110);
        byte collision = 0;

        for (var row = 0; row < n; row++)
        {
            var sprite = Mem.TryGetValue(I + row, out var s) ? s : (byte)0;
            for (var col = 0; col < 8; col++)
            {
                if (((sprite >> (7 - col)) & 1) != 1)
                {
                    continue;
                }

                // COSMAC VIP (B-1031): origin wraps (ox/oy), pixels CLIP at right/bottom — not wrapped
                var px = ox + col;
                var py = oy + row;
                if (px >= Width || py >= Height)
                {
                    continue;
                }

                var idx = (py * Width) + px;
                if ((Plane & 1) != 0)
                {
                    if (!Display.Add(idx))
                    {
                        Display.Remove(idx);
                        collision = 1;
                    }
                }

                if (hiSel != 0)
                {
                    var cur = Extra.TryGetValue(idx, out var c) ? c : (byte)0;
                    if ((cur & hiSel) != 0)
                    {
                        collision = 1;
                    }

                    var nxt = (byte)(cur ^ hiSel);
                    if (nxt == 0)
                    {
                        Extra.Remove(idx);
                    }
                    else
                    {
                        Extra[idx] = nxt;
                    }
                }
            }
        }

        V[0xF] = collision;
    }
}
