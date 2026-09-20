"""Control-surface grid for Phase 6's 3D plot: sweep L x ΔL -> motorCommand.

Reuses the exact same fuzzify -> rules -> aggregate -> centroid pipeline as
POST /api/fuzzy/evaluate (app.py) -- this is a sweep over that pipeline, not
a second implementation of the fuzzy math.
"""

from .config import DELTA_LIGHT_RANGE, LIGHT_RANGE
from .defuzzification import centroid
from .inference import aggregate
from .membership import fuzzify_delta, fuzzify_light
from .rules import active_rules

# A grid point re-runs the full centroid, so this is (light_steps *
# delta_steps) centroid evaluations per request. Each request only needs
# smooth-looking spatial resolution from the GRID (61x41 points already
# gives that); the per-point centroid doesn't need /evaluate's full 1001-
# sample precision on top of that. 201 keeps a default 61x41 sweep well
# under a second instead of tens of seconds, with no visible accuracy loss.
SURFACE_CENTROID_SAMPLES = 201


def linspace(lo, hi, n):
    """n evenly spaced values from lo to hi inclusive (n=1 -> just [lo])."""
    if n <= 1:
        return [lo]
    step = (hi - lo) / (n - 1)
    return [lo + i * step for i in range(n)]


def compute_surface(light_steps=61, delta_steps=41):
    """Returns (light_axis, delta_axis, motor_grid).

    motor_grid[i][j] is the normalized motorCommand ([-1, 1], same
    boundary normalization as /api/fuzzy/evaluate) for
    (light_axis[i], delta_axis[j]).
    """
    light_axis = linspace(*LIGHT_RANGE, light_steps)
    delta_axis = linspace(*DELTA_LIGHT_RANGE, delta_steps)

    grid = []
    for light in light_axis:
        light_memberships = fuzzify_light(light)
        row = []
        for delta in delta_axis:
            delta_memberships = fuzzify_delta(delta)
            fired = active_rules(light_memberships, delta_memberships)
            xs, ys, _peak_by_output = aggregate(fired, samples=SURFACE_CENTROID_SAMPLES)
            row.append(round(centroid(xs, ys) / 100, 4))
        grid.append(row)

    return light_axis, delta_axis, grid
