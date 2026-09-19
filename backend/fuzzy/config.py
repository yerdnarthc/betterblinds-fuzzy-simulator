"""Frozen fuzzy-logic parameters — see IMPLEMENTATION_PLAN.md §2 for rationale."""

# Input 1: Light Intensity (L), domain 0-1023
LIGHT_DOMAIN = (0, 1023)
LIGHT_MFS = {
    "dark": ("trapezoid", (0, 0, 200, 250)),
    "moderate": ("triangle", (200, 250, 535)),
    "bright": ("triangle", (250, 535, 819)),
    "very_bright": ("trapezoid", (700, 819, 1023, 1023)),
}

# Input 2: Rate of Change (delta_L), domain -200..+200
DELTA_DOMAIN = (-200, 200)
DELTA_MFS = {
    "falling": ("trapezoid", (-200, -200, -40, -15)),
    "stable": ("trapezoid", (-40, -15, 15, 40)),
    "rising": ("trapezoid", (15, 40, 200, 200)),
}

# Output: Motor Command (U), domain -100..+100
OUTPUT_DOMAIN = (-100, 100)
OUTPUT_MFS = {
    "fast_open": ("triangle", (-100, -100, -50)),
    "slow_open": ("triangle", (-100, -50, 0)),
    "stop": ("triangle", (-50, 0, 50)),
    "slow_close": ("triangle", (0, 50, 100)),
    "fast_close": ("triangle", (50, 100, 100)),
}

# Rule matrix: (light, delta) -> output
RULES = [
    ("R01", "dark", "falling", "fast_open"),
    ("R02", "dark", "stable", "slow_open"),
    ("R03", "dark", "rising", "stop"),
    ("R04", "moderate", "falling", "slow_open"),
    ("R05", "moderate", "stable", "stop"),
    ("R06", "moderate", "rising", "slow_close"),
    ("R07", "bright", "falling", "stop"),
    ("R08", "bright", "stable", "slow_close"),
    ("R09", "bright", "rising", "fast_close"),
    ("R10", "very_bright", "falling", "slow_close"),
    ("R11", "very_bright", "stable", "fast_close"),
    ("R12", "very_bright", "rising", "fast_close"),
]

# Mamdani inference settings
AND_OP = "min"
IMPLICATION_OP = "min"
AGGREGATION_OP = "max"
DEFUZZIFICATION = "centroid"
CENTROID_RESOLUTION = 1  # sample step across OUTPUT_DOMAIN
