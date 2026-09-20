"""Deterministic test cases from IMPLEMENTATION_PLAN.md §7 (T1-T8), plus
a full-domain sweep. Each test drives the same pipeline app.py wires to
HTTP: fuzzify -> rule activation (min) -> implication+aggregation (max) ->
centroid.
"""

from fuzzy.inference import aggregate
from fuzzy.membership import fuzzify_delta, fuzzify_light
from fuzzy.rules import active_rules
from fuzzy.defuzzification import centroid


def motor_command(light, delta):
    fired = active_rules(fuzzify_light(light), fuzzify_delta(delta))
    xs, ys, _peak_by_output = aggregate(fired)
    return centroid(xs, ys)


def test_t1_low_light_opens():
    """L=100, dL=-20 -> strongly negative (opening)."""
    assert motor_command(100, -20) < -10


def test_t2_moderate_stable_at_exact_peak_holds():
    """L=250 (Moderate's exact peak), dL=0 -> Stop, near zero.

    At L=250 the system is 100% Moderate, so Stop dominates cleanly.
    See test_t2b + NOTES.md: move away from 250 and Bright's membership
    overtakes Moderate faster than the plan's original prose assumed.
    """
    assert abs(motor_command(250, 0)) < 5


def test_t2b_moderate_to_bright_blend_ramps_smoothly():
    """L=450, dL=0 -> gently positive (leaning SlowClose), not the near-zero
    "Stop" originally guessed in the plan's prose. This is real, verified
    behavior of the jointly-frozen MFs/rules, not a bug in this code --
    see NOTES.md for why and whether it's worth recalibrating with your pair.
    """
    u = motor_command(450, 0)
    assert 15 < u < 45


def test_t3_sudden_brightening_closes_fast():
    """L=850, dL=+100 -> fast close."""
    assert motor_command(850, 100) > 60


def test_t4_bright_but_darkening_closes_less_than_brightening():
    """Same L=850 either way; darkening must produce a smaller closing
    command than brightening. This is the whole point of a second input.
    """
    brightening = motor_command(850, 100)
    darkening = motor_command(850, -100)
    assert darkening < brightening


def test_t5_lower_extreme_no_crash():
    assert motor_command(0, -200) < 0


def test_t6_upper_extreme_no_crash():
    assert motor_command(1023, 200) > 0


def test_t7_boundary_499_vs_500_is_smooth():
    """The anti-threshold demo: 499 vs 500 must be nearly identical, unlike
    the original crisp controller, which would flip categories here.
    """
    u_499 = motor_command(499, 0)
    u_500 = motor_command(500, 0)
    assert abs(u_499 - u_500) < 2


def test_t8_small_jitter_does_not_flicker():
    """+-5 jitter around a stable reading must not move the output --
    Stable's flat top (-15..+15) exists specifically for this.
    """
    baseline = motor_command(600, 0)
    jittered = motor_command(600, 5)
    assert abs(baseline - jittered) < 0.5


def test_domain_sweep_never_crashes_or_leaves_range():
    for light in range(0, 1024, 64):
        for delta in range(-200, 201, 40):
            u = motor_command(light, delta)
            assert -100 <= u <= 100
