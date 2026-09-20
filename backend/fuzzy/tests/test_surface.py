"""Tests for the Phase 6 control-surface sweep (fuzzy/surface.py)."""

from fuzzy.defuzzification import centroid
from fuzzy.inference import aggregate
from fuzzy.membership import fuzzify_delta, fuzzify_light
from fuzzy.rules import active_rules
from fuzzy.surface import SURFACE_CENTROID_SAMPLES, compute_surface, linspace


def test_linspace_endpoints_and_count():
    xs = linspace(0, 1023, 5)
    assert len(xs) == 5
    assert xs[0] == 0
    assert xs[-1] == 1023


def test_linspace_single_step_returns_start_only():
    assert linspace(-200, 200, 1) == [-200]


def test_compute_surface_shape():
    light_axis, delta_axis, grid = compute_surface(light_steps=7, delta_steps=5)
    assert len(light_axis) == 7
    assert len(delta_axis) == 5
    assert len(grid) == 7
    assert all(len(row) == 5 for row in grid)


def test_compute_surface_axes_cover_the_frozen_domains():
    light_axis, delta_axis, _grid = compute_surface(light_steps=3, delta_steps=3)
    assert light_axis[0] == 0 and light_axis[-1] == 1023
    assert delta_axis[0] == -200 and delta_axis[-1] == 200


def test_compute_surface_stays_within_normalized_range():
    _light_axis, _delta_axis, grid = compute_surface(light_steps=13, delta_steps=9)
    assert all(-1 <= u <= 1 for row in grid for u in row)


def test_surface_centroid_samples_are_a_negligible_trade_off():
    """compute_surface() uses fewer centroid samples than /api/fuzzy/evaluate
    for speed (SURFACE_CENTROID_SAMPLES). Confirm that trade-off is
    genuinely negligible at the same worked example NOTES.md verifies
    against the live API (L=742, dL=+38 -> motorCommand ~0.679).
    """
    fired = active_rules(fuzzify_light(742), fuzzify_delta(38))

    xs, ys, _peak = aggregate(fired)
    full_resolution = centroid(xs, ys) / 100

    xs_low, ys_low, _peak_low = aggregate(fired, samples=SURFACE_CENTROID_SAMPLES)
    surface_resolution = centroid(xs_low, ys_low) / 100

    assert abs(full_resolution - surface_resolution) < 0.01


def test_compute_surface_default_resolution():
    light_axis, delta_axis, grid = compute_surface()
    assert len(light_axis) == 61
    assert len(delta_axis) == 41
    assert len(grid) == 61 and len(grid[0]) == 41
