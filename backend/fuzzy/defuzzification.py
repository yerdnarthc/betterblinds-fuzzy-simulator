"""Centroid defuzzification — the "center of mass" of the aggregated shape."""


def centroid(xs, ys):
    """sum(x*y) / sum(y) over the sampled (xs, ys) curve from inference.aggregate().

    Returns 0.0 (Stop) if nothing fired at all
    """
    total_weight = sum(ys)
    if total_weight == 0:
        return 0.0
    return sum(x * y for x, y in zip(xs, ys)) / total_weight
