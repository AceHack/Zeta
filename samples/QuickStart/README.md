# QuickStart

Minimal C# consumer sample for a first Zeta circuit.

## How to run

```bash
dotnet run --project samples/QuickStart -c Release
```

Expected output:

```text
20 => 1
30 => 1
```

## What it demonstrates

The sample creates an in-memory circuit, sends one Z-set batch, filters
out values less than or equal to `1`, maps the remaining rows by `x * 10`,
steps the circuit once, and reads the current output weights.

It is intentionally small: no database, no web server, no new operators.
The point is to give a C# developer a runnable first contact with the
fluent circuit surface before they read the full operator catalogue.
