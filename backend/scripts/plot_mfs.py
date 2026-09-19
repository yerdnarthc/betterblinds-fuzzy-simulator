"""Generate MF diagram PNGs directly from backend/fuzzy/config.py.

Why this file exists: so the diagrams in docs/figures never drift from the
code. Change breakpoints in config.py, re-run this script, commit the new PNGs.

Usage (from repo root):
  .venv\\Scripts\\activate        # or source .venv/bin/activate on macOS
  pip install -r backend/requirements.txt
  python -m backend.scripts.plot_mfs          # writes to docs/figures/
  python -m backend.scripts.plot_mfs --out docs/figures

matplotlib here: Python's standard 2D plotting library — you give it
x and y arrays, it draws lines/fills and saves to PNG. No server needed.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np


def _load_config():
    """Import config.py whether run as module or as script file."""
    try:
        from backend.fuzzy import config  # when run as `python -m ...`
        return config
    except ImportError:
        # fallback: direct file run — add project root to sys.path
        project_root = Path(__file__).resolve().parents[2]
        if str(project_root) not in sys.path:
            sys.path.insert(0, str(project_root))
        from backend.fuzzy import config
        return config


def _tri(x: np.ndarray, a: float, b: float, c: float) -> np.ndarray:
    """Triangular MF: 0 at a, 1 at b, 0 at c. Outside [a,c] is 0."""
    y = np.zeros_like(x, dtype=float)
    # rising edge a -> b
    rising = (x > a) & (x < b)
    if b != a:
        y[rising] = (x[rising] - a) / (b - a)
    elif b == a:
        y[x == a] = 1.0
    y[x == b] = 1.0
    # falling edge b -> c
    falling = (x > b) & (x < c)
    if c != b:
        y[falling] = (c - x[falling]) / (c - b)
    return np.clip(y, 0, 1)


def _trap(x: np.ndarray, a: float, b: float, c: float, d: float) -> np.ndarray:
    """Trapezoidal MF: 0 at a, ramp to 1 at b, flat b->c, ramp down c->d."""
    y = np.zeros_like(x, dtype=float)
    y[(x >= b) & (x <= c)] = 1.0
    rising = (x > a) & (x < b)
    if b != a:
        y[rising] = (x[rising] - a) / (b - a)
    falling = (x > c) & (x < d)
    if d != c:
        y[falling] = (d - x[falling]) / (d - c)
    y[x == b] = 1.0
    y[x == c] = 1.0
    return np.clip(y, 0, 1)


def _eval_mf(x: np.ndarray, mf: dict) -> np.ndarray:
    kind = mf["kind"]
    pts = mf["points"]
    if kind == "tri":
        return _tri(x, *pts)
    if kind == "trap":
        return _trap(x, *pts)
    raise ValueError(f"Unknown MF kind: {kind}")


def _plot_group(
    title: str,
    xlabel: str,
    x_range: tuple[float, float],
    mfs: dict[str, dict],
    out_path: Path,
) -> None:
    x = np.linspace(x_range[0], x_range[1], 1200)

    fig, ax = plt.subplots(figsize=(9, 3.6))

    for name, mf in mfs.items():
        y = _eval_mf(x, mf)
        ax.plot(x, y, linewidth=2, label=name)
        ax.fill_between(x, y, alpha=0.12)

    ax.set_title(title, fontsize=13, pad=10)
    ax.set_xlabel(xlabel)
    ax.set_ylabel("Membership degree")
    ax.set_xlim(x_range)
    ax.set_ylim(-0.05, 1.08)
    ax.grid(alpha=0.25, linestyle="--")
    ax.legend(ncols=len(mfs), loc="upper center", bbox_to_anchor=(0.5, -0.18), fontsize=9)

    fig.tight_layout()
    fig.savefig(out_path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    print(f"wrote {out_path.relative_to(Path.cwd()) if out_path.is_absolute() else out_path}")


def _resolve_mfs(cfg, *candidates: str) -> dict:
    for name in candidates:
        if hasattr(cfg, name):
            return getattr(cfg, name)
    raise AttributeError(f"None of {candidates} found in config.py")


def main() -> None:
    parser = argparse.ArgumentParser(description="Plot MF diagrams from config.py")
    parser.add_argument("--out", type=Path, default=Path("docs/figures"), help="output directory")
    args = parser.parse_args()

    cfg = _load_config()
    out_dir: Path = args.out
    # if relative, make it relative to project root (parent of backend/)
    if not out_dir.is_absolute():
        project_root = Path(__file__).resolve().parents[2]
        out_dir = project_root / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    # Names in config.py shifted during edits (DELTA_MFS vs DELTA_LIGHT_MFS) —
    # accept either so the script keeps working. (using a tiny helper here;
    # helper just tries names in order until one exists.)
    light_mfs = _resolve_mfs(cfg, "LIGHT_MFS")
    delta_mfs = _resolve_mfs(cfg, "DELTA_LIGHT_MFS", "DELTA_MFS")
    motor_mfs = _resolve_mfs(cfg, "MOTOR_MFS")

    light_range = getattr(cfg, "LIGHT_RANGE", (0, 1023))
    delta_range = getattr(cfg, "DELTA_LIGHT_RANGE", getattr(cfg, "DELTA_RANGE", (-200, 200)))
    motor_range = getattr(cfg, "MOTOR_RANGE", (-100, 100))

    _plot_group(
        "Light Intensity — Membership Functions",
        "Light Intensity L  (0–1023, Arduino ADC; harsh 700–900 avg 819.2, normal 200–300 avg 249.8)",
        light_range,
        light_mfs,
        out_dir / "mf-light.png",
    )
    _plot_group(
        "Rate of Change — Membership Functions",
        "Delta Light ΔL  (−200…+200, ΔL = L_t − L_{t-1})",
        delta_range,
        delta_mfs,
        out_dir / "delta-light.png" if False else out_dir / "mf-delta.png",
    )
    _plot_group(
        "Motor Command — Membership Functions",
        "Motor Command U  (−100…+100, −100 fast open, 0 stop, +100 fast close)",
        motor_range,
        motor_mfs,
        out_dir / "mf-motor.png",
    )

    # Friendly check: any x with zero total membership? Warn once.
    for label, rng, mfs in [
        ("Light", light_range, light_mfs),
        ("Delta", delta_range, delta_mfs),
        ("Motor", motor_range, motor_mfs),
    ]:
        xs = np.linspace(rng[0], rng[1], 600)
        total = np.zeros_like(xs)
        for mf in mfs.values():
            total += _eval_mf(xs, mf)
        # overlap check: we want coverage, not gaps
        gap = np.sum(total < 0.01)
        if gap > 0:
            print(f"warning: {label} has {gap} sample points with near-zero total membership — check for gaps")
        else:
            print(f"ok: {label} has no gaps")


if __name__ == "__main__":
    main()
