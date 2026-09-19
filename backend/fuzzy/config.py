"""
config.py — single source of truth for the fuzzy math (Phase 1).

Both devs must agree before changing numbers here.
`frontend/src/types.ts` mirrors this on the TS side.

Terminology:
- Light L: 0–1023 from Arduino analogRead (10-bit ADC, 2^10 = 1024 steps).
  Anchors IMRAD paper: normal ~200–300 avg 249.8, harsh ~700–900 avg 819.2.
- Delta ΔL = L_t − L_{t-1}: how fast light is changing per tick.
  ±200 is ~20% of the 0–1023 span — big enough for "sudden brightening"
  (e.g. +150) without forcing an unlikely ±500 jump.
- Motor U: −100…+100 signed percent. −100 fast open, 0 stop, +100 fast close.
  Simulation does:  pos = clamp(pos + k*U, 0, 100).  k is just a speed knob.

Shapes:
- "tri"  = triangular: (a, b, c) where b is the peak (membership = 1).
- "trap" = trapezoidal: (a, b, c, d) flat top b→c at 1, ramps a→b and c→d.
  Edges use traps so values beyond the range still belong fully to one set.

Calibration rule: every x must belong to ≥1 set, and at every boundary
two sets overlap 25–50%. No gaps, no dead zones. Placeholder numbers
below — tune together while checking T7 (499 vs 500 smooth) and T8 (jitter).
"""

# ---------------------------------------------------------------------------
# Domains — the outer limits. Change these only if you re-derive the paper.
# ---------------------------------------------------------------------------
LIGHT_RANGE = (0, 1023)             # L
DELTA_LIGHT_RANGE = (-200, 200)     # ΔL
MOTOR_RANGE = (-100, 100)           # U

# ---------------------------------------------------------------------------
# Light MFs (Membership Functions) — 4 sets.  
# TODO: both devs calibrate these numbers together.
# Hint: put the Moderate→Bright transition inside 251–818 (the vague middle),
# and make VeryBright cover the 700–900 harsh band from the paper averages.
# ---------------------------------------------------------------------------
LIGHT_MFS = {
    # Dark: covers normal light and below. Trap so 0–~180 is fully dark.
    "Dark":       {
                    "kind": "trap", 
                    "points": (0, 0, 200, 250)
                  },
    # Moderate: the middle-lower hump.
    "Moderate":   {
                    "kind": "tri", 
                    "points": (200, 250, 535)
                  },
    # Bright: middle-upper hump. Overlaps both neighbors.
    "Bright":     {
                    "kind": "tri", 
                    "points": (250, 535, 819)
                  },
    # VeryBright: harsh light and above. Trap so 900–1023 stays fully bright.
    "VeryBright": {
                    "kind": "trap", 
                    "points": (700, 819, 1023, 1023)
                  },
}

# ---------------------------------------------------------------------------
# Delta Light MFs (Membership Functions) — 3 sets.  
# Stable is centered at 0, traps at the edges.
# ---------------------------------------------------------------------------
DELTA_LIGHT_MFS = {
    "Falling": {
                "kind": "trap", 
                "points": (-200, -200, -40, -15)
               },
    "Stable":  {
                "kind": "trap",  
                "points": (-40, -15, 15, 40)
               },
    "Rising":  {
                "kind": "trap", 
                "points": (15, 40, 200, 200)
               },
}

# ---------------------------------------------------------------------------
# Motor MFs (Membership Functions) — 5 output sets, symmetric around 0 for clean centroid.
# ---------------------------------------------------------------------------
MOTOR_MFS = {
    "FastOpen":  {
                    "kind": "tri", 
                    "points": (-100, -100, -50)
                 },
    "SlowOpen":  {
                    "kind": "tri", 
                    "points": (-100, -50, 0)
                 },
    "Stop":      {
                    "kind": "tri", 
                    "points": (-50, 0, 50)
                 },
    "SlowClose": {
                    "kind": "tri", 
                    "points": (0, 50, 100)
                 },
    "FastClose": {
                    "kind": "tri", 
                    "points": (50, 100, 100)
                 },
}

# ---------------------------------------------------------------------------
# Rule matrix — 12 rules, R01–R12.  Light × Delta → Motor.
# Starter from the plan; row justifications: write one sentence each for
# the report (why "Bright + Falling → Stop" not "FastClose", etc.).
#
# RULE MATRIX TABLE
#
#  Light          | Falling    | Stable     | Rising
#  ---------------+------------+------------+---------------------------
#  Dark           | FastOpen   | SlowOpen   | Stop       (R01, R02, R03)
#  Moderate       | SlowOpen   | Stop       | SlowClose  (R04, R05, R06)
#  Bright         | Stop       | SlowClose  | FastClose  (R07, R08, R09)
#  VeryBright     | SlowClose  | FastClose  | FastClose  (R10, R11, R12)
#
# ---------------------------------------------------------------------------

RULES = [
    # Dark row
    {
        "id": "R01", 
        "light": "Dark",       
        "delta": "Falling", 
        "output": "FastOpen"
    },
    {
        "id": "R02", 
        "light": "Dark",       
        "delta": "Stable",  
        "output": "SlowOpen"
    },
    {
        "id": "R03", 
        "light": "Dark",       
        "delta": "Rising", 
        "output": "Stop"
    },
    # Moderate row
    {
        "id": "R04", 
        "light": "Moderate",   
        "delta": "Falling", 
        "output": "SlowOpen"
    },
    {
        "id": "R05", 
        "light": "Moderate",   
        "delta": "Stable",  
        "output": "Stop"
    },
    {
        "id": "R06", 
        "light": "Moderate",   
        "delta": "Rising",  
        "output": "SlowClose"
    },
    # Bright row
    {
        "id": "R07", 
        "light": "Bright",     
        "delta": "Falling", 
        "output": "Stop"
    },
    {
        "id": "R08", 
        "light": "Bright",     
        "delta": "Stable",  
        "output": "SlowClose"
    },
    {
        "id": "R09", 
        "light": "Bright",     
        "delta": "Rising",  
        "output": "FastClose"
    },
    # VeryBright row
    {
        "id": "R10", 
        "light": "VeryBright", 
        "delta": "Falling", 
        "output": "SlowClose"
    },
    {
        "id": "R11", 
        "light": "VeryBright", 
        "delta": "Stable",  
        "output": "FastClose"
    },
    {
        "id": "R12", 
        "light": "VeryBright", 
        "delta": "Rising",  
        "output": "FastClose"
    },
]

# ---------------------------------------------------------------------------
# Mamdani knobs — pin these so inference.py has no magic numbers.
# and = how to combine Light AND Delta; min is the textbook choice.
# implication = clip each output MF at the rule's activation; also min.
# aggregation = merge all clipped outputs; max (take the envelope).
# samples = how finely to sample U (−100…+100) for centroid. 1001 steps
#           gives 0.2-unit resolution — fine for a demo.
# ---------------------------------------------------------------------------
MAMDANI = {
    "and": "min",
    "implication": "min",
    "aggregation": "max",
    "samples": 1001,
}

# Quick check for your pair hand-test (IMPLEMENTATION_PLAN.md Phase 1 gate):
# L=742, ΔL=+38 should light up Bright + Rising and VeryBright + Rising
# and defuzzify near FastClose (~+60…+75 with the placeholders above).
