#!/usr/bin/env bun
/**
 * Falsifiers for `audit-dotnet-runtime-band-unity.ts`.
 *
 * The audit's whole value is that it FAILS on the drift that was live in the
 * tree on 2026-09-09, so the tests are written around that measured case rather
 * than around invented input: `net8.0` in a project file and `dotnet/aspnet:8.0`
 * in a Dockerfile, against a `10.0.400` pin.
 *
 * Two CONTROLS that must SURVIVE, because without them every assertion below is
 * satisfiable by a parser that returns nothing and an audit that always reports a
 * finding:
 *
 *   - the in-band inputs produce ZERO findings;
 *   - the parsers actually extract something from realistic text.
 */
import { describe, expect, test } from "bun:test";
import {
  isDockerfile,
  isProjectFile,
  majorMinor,
  parseDotnetImages,
  parseTargetFrameworks,
} from "./audit-dotnet-runtime-band-unity.ts";

describe("dotnet band unity", () => {
  test("majorMinor reduces the pin to the band consumers must sit in", () => {
    expect(majorMinor("10.0.400")).toBe("10.0");
    expect(majorMinor("8.0.100")).toBe("8.0");
    expect(majorMinor("nonsense")).toBeNull();
  });

  test("CONTROL: parseTargetFrameworks extracts from realistic project text", () => {
    const single = "<Project><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>";
    expect(parseTargetFrameworks(single)).toEqual(["net10.0"]);
    const multi = "<TargetFrameworks>net10.0;netstandard2.0</TargetFrameworks>";
    expect(parseTargetFrameworks(multi)).toEqual(["net10.0", "netstandard2.0"]);
  });

  test("CONTROL: parseDotnetImages reads repo and tag through a digest pin", () => {
    const line = "FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble@sha256:abc AS runtime";
    expect(parseDotnetImages(line)).toEqual([["aspnet", "10.0-noble"]]);
  });

  test("THE MEASURED DRIFT: an out-of-band tag is still parsed, so it can be judged", () => {
    const line = "FROM mcr.microsoft.com/dotnet/sdk:8.0@sha256:5ef8 AS build";
    const parsed = parseDotnetImages(line);
    expect(parsed).toEqual([["sdk", "8.0"]]);
    expect(parsed[0]?.[1].startsWith("10.0")).toBe(false);
  });

  test("file predicates cover the spellings the tree actually uses", () => {
    expect(isProjectFile("Zeta.Core.fsproj")).toBe(true);
    expect(isProjectFile("Directory.Build.props")).toBe(true);
    expect(isProjectFile("README.md")).toBe(false);
    expect(isDockerfile("Dockerfile")).toBe(true);
    expect(isDockerfile("silo.Dockerfile")).toBe(true);
    expect(isDockerfile("compose.yaml")).toBe(false);
  });
});
