"""Post hoc descriptive rendering of three exact, already archived receipts.

No simulator, policy, source generator or statistical test is invoked.
The output directory must not contain this script's generated artifacts.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import platform
import statistics
import sys
from decimal import Decimal
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.font_manager as fm
import matplotlib.ft2font as ft
import matplotlib.pyplot as plt
import numpy as np
import PIL
from matplotlib.patches import Patch

INPUTS = {
    "behavior-attempt-1.json": (
        78026027,
        "f15ca0d41b1437b5e05a6ca402a8a8609f85d8b0e1c6218c316460257f450c2e",
    ),
    "cost-attempt-1.json": (
        6868985,
        "6af9cf36f4cfc1c5e38f236e8922025cd845481d9e2e18daff58e5be191b9df3",
    ),
    "verdict-attempt-1.json": (
        11871,
        "d0fbffe371155002a204bae3959b788a4e1b54d1ad83761d0e5933cb9cb67222",
    ),
}
ARMS = (
    "belief-depth3",
    "belief-myopic",
    "belief-myopic-padded",
    "latest-cue-depth3",
)
LABELS = (
    "Belief: depth 3",
    "Belief: myopic",
    "Belief: myopic + padding",
    "Latest cue: depth 3",
)
PANELS = ("dot-switch", "bar-switch", "palette-switch", "dot-null")
COLORS = ("#0072B2", "#E69F00", "#009E73", "#CC79A7")
HATCHES = ("", "", "///", "..")
ARTIFACTS = (
    "hidden-switch-descriptive.svg",
    "hidden-switch-descriptive.png",
    "plotted-values.json",
    "manifest.json",
)
PACKAGES = (
    "contourpy",
    "cycler",
    "fonttools",
    "kiwisolver",
    "matplotlib",
    "numpy",
    "packaging",
    "pillow",
    "pyparsing",
    "python-dateutil",
    "six",
)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def identity(path: Path) -> dict:
    data = path.read_bytes()
    return {"Bytes": len(data), "Sha256": digest(data)}


def load(receipts: Path) -> tuple[dict, dict, dict]:
    documents = []
    for name, (size, expected) in INPUTS.items():
        data = (receipts / name).read_bytes()
        if len(data) != size or digest(data) != expected:
            raise ValueError(f"Original input bytes do not match: {name}")
        document = json.loads(data)
        if document["Complete"] is not True or document["Failure"] is not None:
            raise ValueError(f"Incomplete original input: {name}")
        documents.append(document)
    return tuple(documents)


def values(behavior: dict, cost: dict, verdict: dict) -> dict:
    assert (
        verdict["InputBehaviorSha256"].lower() == INPUTS["behavior-attempt-1.json"][1]
    )
    assert verdict["InputCostSha256"].lower() == INPUTS["cost-attempt-1.json"][1]
    assert cost["InputBehaviorSha256"].lower() == INPUTS["behavior-attempt-1.json"][1]
    assert behavior["Config"] == cost["Config"] == verdict["Config"]
    config = behavior["Config"]
    assert config["Horizon"] == 16 and config["ReturnScale"] == 64
    assert tuple(config["Arms"]) == ARMS
    assert tuple(p["Config"]["Name"] for p in behavior["Panels"]) == PANELS
    assert config["Cost"]["SourceEpisodes"] == 72
    assert config["Cost"]["TimedEpisodes"] == 64
    assert config["Cost"]["WarmupEpisodes"] == 8
    returns = []
    for panel_index, panel in enumerate(behavior["Panels"]):
        name = panel["Config"]["Name"]
        assert panel["Config"]["Episodes"] == 1024
        assert tuple(a["Name"] for a in panel["Arms"]) == ARMS
        for arm in panel["Arms"]:
            episodes = arm["Episodes"]
            assert len(episodes) == 1024
            assert [e["Index"] for e in episodes] == list(range(1024))
            assert all(e["TotalReward4"] == sum(e["Reward4"]) for e in episodes)
            total = sum(e["TotalReward4"] for e in episodes)
            denominator = len(episodes) * config["ReturnScale"]
            mean = total / denominator
            recorded = verdict["PanelReturns"][panel_index]
            assert recorded["Panel"] == name
            assert mean == recorded["MeanNormalizedReturns"][arm["Name"]]
            returns.append(
                {
                    "Panel": name,
                    "Arm": arm["Name"],
                    "Episodes": len(episodes),
                    "Reward4Sum": total,
                    "NormalizationDenominator": denominator,
                    "MeanNormalizedReturn": mean,
                }
            )
    assert len(cost["Rows"]) == 20
    wall_rows = []
    for index, row in enumerate(cost["Rows"]):
        replicate, order = divmod(index, 4)
        assert (row["Replicate"], row["Order"]) == (replicate, order)
        assert row["Name"] == ARMS[(replicate + order) % 4]
        assert [e["Index"] for e in row["WarmupEpisodes"]] == list(range(8))
        assert [e["Index"] for e in row["TimedEpisodes"]] == list(range(8, 72))
        mean = row["WallMsTotal"] / len(row["TimedEpisodes"])
        assert mean > 0 and np.isfinite(mean)
        wall_rows.append(
            {
                "ExecutionRow": index + 1,
                "Replicate": replicate,
                "OrderWithinReplicate": order,
                "Arm": row["Name"],
                "WallMsTotal": row["WallMsTotal"],
                "TimedEpisodes": len(row["TimedEpisodes"]),
                "WallMsPerWholeEpisode": mean,
                "DecimalQuotientOfRecordedWallTotal": str(
                    Decimal(str(row["WallMsTotal"])) / Decimal(64)
                ),
            }
        )
    for arm in ARMS:
        observed = [r["WallMsPerWholeEpisode"] for r in wall_rows if r["Arm"] == arm]
        assert len(observed) == 5
        assert (
            statistics.median(observed)
            == verdict["CostMediansPerEpisode"][arm]["WallMsTotal"]
        )
    assert wall_rows[0]["WallMsTotal"] == 61.477042
    return {
        "Scope": "Post hoc descriptive visualization; no new sampling, test, policy execution or timing.",
        "ReturnRows": returns,
        "CostRowsInOriginalOrder": wall_rows,
        "Checks": {
            "InputByteBindings": True,
            "MeansRecomputedFromOriginalReward4": 16,
            "MeansEqualOriginalVerdict": True,
            "CostRowsRetained": 20,
            "CostArmMediansEqualOriginalVerdict": True,
            "DroppedRows": 0,
        },
    }


def render(data: dict, output: Path) -> None:
    plt.rcParams.update(
        {
            "font.family": "DejaVu Sans",
            "font.size": 10,
            "axes.titlesize": 12,
            "axes.labelsize": 10,
            "svg.fonttype": "path",
            "svg.hashsalt": "hidden-switch-descriptive-20260907-v1",
            "savefig.facecolor": "white",
        }
    )
    fig, (returns_ax, cost_ax) = plt.subplots(
        2, 1, figsize=(12.8, 9.6), gridspec_kw={"height_ratios": [1, 1.15]}
    )
    fig.subplots_adjust(left=0.085, right=0.985, top=0.785, bottom=0.105, hspace=0.53)
    fig.suptitle(
        "Hidden-switch: returns and original wall-time rows",
        x=0.085,
        y=0.965,
        ha="left",
        fontsize=19,
        fontweight="bold",
    )
    fig.text(
        0.085,
        0.925,
        "Supplied correct model + fixed decoder | archived study, 7 September 2026",
        fontsize=11,
        color="#444444",
    )
    legend = [
        Patch(facecolor=c, edgecolor="#333333", linewidth=0.4, hatch=h, label=l)
        for c, h, l in zip(COLORS, HATCHES, LABELS)
    ]
    fig.legend(
        handles=legend,
        loc="upper left",
        bbox_to_anchor=(0.079, 0.900),
        ncol=2,
        frameon=False,
        fontsize=10,
        columnspacing=2.2,
        handlelength=2.2,
    )

    width = 0.19
    locations = np.arange(4)
    for arm_index, arm in enumerate(ARMS):
        ys = [
            row["MeanNormalizedReturn"]
            for row in data["ReturnRows"]
            if row["Arm"] == arm
        ]
        bars = returns_ax.bar(
            locations + (arm_index - 1.5) * width,
            ys,
            width=width,
            color=COLORS[arm_index],
            hatch=HATCHES[arm_index],
            edgecolor="#333333",
            linewidth=0.4,
            zorder=3,
        )
        returns_ax.bar_label(
            bars, labels=[f"{y:.3f}" for y in ys], padding=4, fontsize=8
        )
    returns_ax.set_xticks(
        locations, ["Dot switch", "Bar switch", "Palette switch", "Dot null"]
    )
    returns_ax.set_ylim(0, 0.75)
    returns_ax.set_yticks(np.arange(0, 0.76, 0.15))
    returns_ax.set_ylabel("Mean net reward per step")
    returns_ax.set_title(
        "A   Observed returns | 1,024 sixteen-step episodes per arm in each panel",
        loc="left",
        pad=14,
        fontweight="bold",
    )

    rows = data["CostRowsInOriginalOrder"]
    for row in rows:
        arm_index = ARMS.index(row["Arm"])
        cost_ax.bar(
            row["ExecutionRow"],
            row["WallMsPerWholeEpisode"],
            width=0.7,
            color=COLORS[arm_index],
            hatch=HATCHES[arm_index],
            edgecolor="#333333",
            linewidth=0.4,
            zorder=3,
        )
    for boundary in (4.5, 8.5, 12.5, 16.5):
        cost_ax.axvline(boundary, color="#dddddd", linewidth=0.8, zorder=1)
    cost_ax.set_xlim(0.35, 20.65)
    cost_ax.set_ylim(0, 1.22)
    cost_ax.set_yticks(np.arange(0, 1.01, 0.2))
    cost_ax.set_xticks(range(1, 21))
    cost_ax.set_ylabel("Wall time / whole 16-step episode (ms)")
    cost_ax.set_xlabel(
        "Cost row in original execution order (separators mark the five replicates)",
        labelpad=9,
    )
    cost_ax.set_title(
        "B   Every original cost row | same 72-tape corpus reused",
        loc="left",
        pad=28,
        fontweight="bold",
    )
    cost_ax.text(
        0,
        1.035,
        "Each row: 8 warmup, then 64 timed episodes. Setup/warmup excluded from bars; no rows omitted.",
        transform=cost_ax.transAxes,
        fontsize=9.5,
        color="#444444",
    )
    first = rows[0]["WallMsPerWholeEpisode"]
    cost_ax.annotate(
        "First planner row retained\n0.960579 ms/episode = 61.477042 ms / 64",
        xy=(1, first),
        xytext=(4, 1.085),
        ha="left",
        va="center",
        fontsize=9,
        color="#333333",
        arrowprops={"arrowstyle": "->", "color": "#555555", "linewidth": 0.8},
    )
    for ax in (returns_ax, cost_ax):
        ax.spines[["top", "right"]].set_visible(False)
        ax.spines[["bottom", "left"]].set_color("#999999")
        ax.tick_params(length=0, pad=7)
        ax.set_axisbelow(True)
        ax.grid(axis="y", color="#e7e7e7", linewidth=0.7)
    fig.text(
        0.085,
        0.032,
        "Post hoc visualization of original values; no new inference or timing. Repeated cost rows are not independent task samples.",
        fontsize=9,
        color="#444444",
    )
    fig.savefig(
        output / ARTIFACTS[0],
        metadata={"Date": None, "Creator": "Zeta descriptive figure v1"},
    )
    svg = output / ARTIFACTS[0]
    svg.write_text(
        "\n".join(line.rstrip() for line in svg.read_text().splitlines()) + "\n"
    )
    fig.savefig(
        output / ARTIFACTS[1],
        dpi=180,
        metadata={"Software": "Zeta descriptive figure v1"},
    )
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receipts", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    if any((args.output / name).exists() for name in ARTIFACTS):
        raise FileExistsError("Refusing to replace a generated figure artifact")
    data = values(*load(args.receipts))
    render(data, args.output)
    (args.output / ARTIFACTS[2]).write_text(json.dumps(data, indent=2) + "\n")
    font = Path(fm.findfont("DejaVu Sans"))
    manifest = {
        "StudyTask": "081M1XK02XM087G0R00043EW05",
        "ArtifactKind": "post-hoc-descriptive-figure",
        "MeasuredSourceCommit": "4fc82b611012bd2620a26e02afe6baba491fe553",
        "InputFiles": {
            name: {"Bytes": size, "Sha256": sha} for name, (size, sha) in INPUTS.items()
        },
        "PlotScript": identity(Path(__file__)),
        "PlotRequirements": identity(Path(__file__).with_name("requirements.txt")),
        "PlotRuntime": {
            "Python": platform.python_version(),
            "PythonExecutable": identity(Path(sys.executable)),
            "Matplotlib": matplotlib.__version__,
            "NumPy": np.__version__,
            "Pillow": PIL.__version__,
            "FreeType": ft.__freetype_version__,
            "Font": {"Name": "DejaVu Sans", **identity(font)},
            "Packages": {name: importlib.metadata.version(name) for name in PACKAGES},
        },
        "Outputs": {name: identity(args.output / name) for name in ARTIFACTS[:3]},
        "Checks": data["Checks"],
        "Scope": "Rendering only. No experiment source, policy call, statistical test, timing rerun or receipt replacement.",
    }
    (args.output / ARTIFACTS[3]).write_text(json.dumps(manifest, indent=2) + "\n")
    print(
        json.dumps({"Checks": data["Checks"], "Outputs": manifest["Outputs"]}, indent=2)
    )


if __name__ == "__main__":
    main()
