// MeshPongGame — the mesh-pong world (integer-grid lockstep pong). C# parity oracle; mirrors
// src/Core/MeshPong.fs (the F# oracle that LOCKED the game-state treaty), and the TS/Rust siblings.
// GAME-STATE TREATY: Step + ToLine must replay the shared session
// (src/Core.TypeScript/mesh-pong/golden-vectors.lines) to byte-identical checkpoint lines.

using System;
using System.Globalization;

namespace Zeta.Core.CSharp;

/// <summary>The whole pong world — small, integer, byte-stable across oracles.</summary>
public sealed record MeshPongGame(
    int BallX,
    int BallY,
    int VX,
    int VY,
    int PaddleA,
    int PaddleB,
    int ScoreA,
    int ScoreB)
{
    /// <summary>Board width (columns).</summary>
    public const int Width = 16;

    /// <summary>Board height (rows).</summary>
    public const int Height = 9;

    /// <summary>Paddle length (rows).</summary>
    public const int PaddleLen = 3;

    /// <summary>Center serve, heading right-down.</summary>
    public static MeshPongGame Create() =>
        new(Width / 2, Height / 2, 1, 1, (Height / 2) - 1, (Height / 2) - 1, 0, 0);

    private static int ClampPaddle(int p) => Math.Max(0, Math.Min(Height - PaddleLen, p));

    private MeshPongGame Serve(int vx) =>
        this with { BallX = Width / 2, BallY = Height / 2, VX = vx, VY = 1 };

    /// <summary>One lockstep tick — the pure physics fold (parity with MeshPong.step).</summary>
    public MeshPongGame Step(int inputA, int inputB)
    {
        var g = this with
        {
            PaddleA = ClampPaddle(PaddleA + Math.Max(-1, Math.Min(1, inputA))),
            PaddleB = ClampPaddle(PaddleB + Math.Max(-1, Math.Min(1, inputB))),
        };

        var nx = g.BallX + g.VX;
        var nyRaw = g.BallY + g.VY;
        var bounced = nyRaw < 0 || nyRaw >= Height;
        var vy = bounced ? -g.VY : g.VY;
        var ny = bounced ? g.BallY - g.VY : nyRaw;

        if (nx <= 0)
        {
            return ny >= g.PaddleA && ny < g.PaddleA + PaddleLen
                ? g with { BallX = 1, BallY = ny, VX = 1, VY = vy }
                : (g with { ScoreB = g.ScoreB + 1 }).Serve(-1);
        }

        if (nx >= Width - 1)
        {
            return ny >= g.PaddleB && ny < g.PaddleB + PaddleLen
                ? g with { BallX = Width - 2, BallY = ny, VX = -1, VY = vy }
                : (g with { ScoreA = g.ScoreA + 1 }).Serve(1);
        }

        return g with { BallX = nx, BallY = ny, VY = vy };
    }

    /// <summary>Parse a crossing payload ("pong:a,b"); null = not a pong input (honest refusal).</summary>
    public static (int A, int B)? ParseInputs(string payload)
    {
        if (!payload.StartsWith("pong:", StringComparison.Ordinal)) return null;
        var parts = payload[5..].Split(',');
        if (parts.Length != 2) return null;
        if (!int.TryParse(parts[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out var a) || !int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var b)) return null;
        return (a, b);
    }

    /// <summary>Serialize to the canonical treaty line (byte-identical to the F# oracle).</summary>
    public string ToLine() =>
        $"ponggame1\t{BallX}\t{BallY}\t{VX}\t{VY}\t{PaddleA}\t{PaddleB}\t{ScoreA}\t{ScoreB}";

    /// <summary>Parse a canonical game-state line; null on malformed (honest refusal).</summary>
    public static MeshPongGame? OfLine(string line)
    {
        var parts = line.Split('\t');
        if (parts.Length != 9 || !string.Equals(parts[0], "ponggame1", StringComparison.Ordinal)) return null;
        var vals = new int[8];
        for (var i = 0; i < 8; i++)
        {
            if (!int.TryParse(parts[i + 1], NumberStyles.Integer, CultureInfo.InvariantCulture, out vals[i])) return null;
        }

        return new MeshPongGame(vals[0], vals[1], vals[2], vals[3], vals[4], vals[5], vals[6], vals[7]);
    }
}
