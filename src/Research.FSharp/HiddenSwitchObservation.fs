namespace Zeta.Research

open System
open System.Security.Cryptography
open Zeta.Core

/// Supplied representation: the policy admission module has no environment/tape/reward dependency.
[<RequireQualifiedAccess>]
module HiddenSwitchObservation =
    let sha256 (bytes: byte[]) = SHA256.HashData bytes |> Convert.ToHexString
    let private fail code detail = Error(HiddenSwitchReceipt.failure "observation" code detail)
    let geometry name = if name = "dot" || name = "bar" then Ok name else fail "geometry" "requires dot or bar geometry"
    let private validate (frame: GameEnvironment.Frame) =
        if frame.W <> 64 || frame.H <> 32 || frame.Palette <> 2 || isNull frame.Cells || frame.Cells.Length <> 2048 then
            fail "frame-shape" "requires 64x32 binary-palette frame with 2048 cells"
        elif Array.exists (fun value -> value > 1uy) frame.Cells then fail "frame-palette" "all frame cells must be binary"
        else Ok()
    let private background (frame: GameEnvironment.Frame) =
        let mutable ones = 0
        for index in 0 .. 1535 do ones <- ones + int frame.Cells.[index]
        if ones = 768 then fail "background-tie" "top-band majority must be unique"
        else Ok(if ones > 768 then 1uy else 0uy)
    /// Valid binary lower-band substitutions preserve successful bytes or the refusal code.
    let project frame =
        result {
            do! validate frame
            let! bg = background frame
            let cells = Array.copy frame.Cells
            Array.fill cells 1536 512 bg
            return { frame with Cells = cells }
        }
    let decode geometryName frame =
        result {
            let! _ = geometry geometryName
            do! validate frame
            let! bg = background frame
            let y, width = if geometryName = "dot" then 8, 1 else 20, 3
            let matches bit =
                let x = if bit = 0 then 16 else 48
                let mutable valid = true
                for index in 0 .. 2047 do
                    let expected = if index / 64 = y && index % 64 >= x && index % 64 < x + width then 1uy - bg else bg
                    if frame.Cells.[index] <> expected then valid <- false
                valid
            if matches 0 then return 0
            elif matches 1 then return 1
            else return! fail "cue-shape" "projection must contain exactly one declared cue mark and no other foreground cells"
        }
