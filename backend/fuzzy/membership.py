from .config import DELTA_LIGHT_MFS, LIGHT_MFS


def triangular(x, a, b, c):
    if x < a or x > c:
        return 0.0
    if x == b:
        return 1.0
    if x < b:
        return (x - a) / (b - a)
    return (c - x) / (c - b)


def trapezoidal(x, a, b, c, d):
    if x < a or x > d:
        return 0.0
    if b <= x <= c:
        return 1.0
    if x < b:
        return (x - a) / (b - a)
    return (d - x) / (d - c)


def evaluate_mf(x, mf):
    """mf is one of config.py's {"kind": "tri"|"trap", "points": (...)} dicts."""
    if mf["kind"] == "tri":
        return triangular(x, *mf["points"])
    return trapezoidal(x, *mf["points"])


def fuzzify_light(value):
    """value -> {"Dark": deg, "Moderate": deg, "Bright": deg, "VeryBright": deg}"""
    return {name: evaluate_mf(value, mf) for name, mf in LIGHT_MFS.items()}


def fuzzify_delta(value):
    """value -> {"Falling": deg, "Stable": deg, "Rising": deg}"""
    return {name: evaluate_mf(value, mf) for name, mf in DELTA_LIGHT_MFS.items()}
