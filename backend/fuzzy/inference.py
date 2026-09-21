"""Mamdani implication + aggregation.

For each fired rule: clip its output MF at the rule's activation level
(implication = min). Then union all the clipped shapes by taking the
pointwise max across them (aggregation = max). The result is one sampled
curve over MOTOR_RANGE, ready for centroid defuzzification.
"""

from .config import MAMDANI, MOTOR_MFS, MOTOR_RANGE
from .membership import evaluate_mf


def sample_points(samples=None):
    """`samples` evenly spaced x-values across MOTOR_RANGE."""
    
    lo, hi = MOTOR_RANGE
    n = samples if samples is not None else MAMDANI["samples"]
    step = (hi - lo) / (n - 1)
    return [lo + i * step for i in range(n)]


def aggregate(fired_rules, samples=None):
    """fired_rules: output of rules.active_rules().

    Returns (xs, ys, peak_by_output):
      xs, ys        -- the aggregated curve, for centroid() and for plotting.
      peak_by_output -- {"FastClose": 0.71, ...} strongest activation per
                         output set, useful for the "aggregated output" bars
                         in the UI (Phase 5) without re-walking the rules.
    """
    xs = sample_points(samples)
    ys = [0.0] * len(xs)
    peak_by_output = {name: 0.0 for name in MOTOR_MFS}

    for rule in fired_rules:
        activation = rule["activation"]
        output_name = rule["output"]
        peak_by_output[output_name] = max(peak_by_output[output_name], activation)

        output_mf = MOTOR_MFS[output_name]
        for i, x in enumerate(xs):
            clipped = min(activation, evaluate_mf(x, output_mf))
            if clipped > ys[i]:
                ys[i] = clipped

    return xs, ys, peak_by_output
