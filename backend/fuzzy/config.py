"""
config.py — single source of truth for the fuzzy math

Terminology:
- Light L: 0–1023 from Arduino analogRead (10-bit ADC, 2^10 = 1024 steps).
- Delta ΔL = L_t − L_{t-1}: how fast light is changing per tick.
  ±200 is ~20% of the 0–1023 span — big enough for "sudden brightening"
  (e.g. +150) without forcing an unlikely ±500 jump.
- Motor U: −100…+100 signed percent. −100 fast open, 0 stop, +100 fast close.

Shapes:
- "tri"  = triangular: (a, b, c) where b is the peak (membership = 1).
- "trap" = trapezoidal: (a, b, c, d) flat top b→c at 1, ramps a→b and c→d.
  Edges use traps so values beyond the range still belong fully to one set.
"""

# ---------------------------------------------------------------------------
# Domains — the outer limits.
# ---------------------------------------------------------------------------
LIGHT_RANGE = (0, 1023)             # L
DELTA_LIGHT_RANGE = (-200, 200)     # ΔL
MOTOR_RANGE = (-100, 100)           # U

# ---------------------------------------------------------------------------
# Light MFs (Membership Functions) — 4 sets.  
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
#
# RULE MATRIX TABLE
#
#  Light          | Falling    | Stable     | Rising
#  ---------------+------------+------------+--------------------------------
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
# Mamdani knobs:
# and = how to combine Light AND Delta; min is the textbook choice.
# implication = clip each output MF at the rule's activation; also min.
# aggregation = merge all clipped outputs; max (take the envelope).
# samples = how finely to sample U (−100…+100) for centroid. 1001 steps - gives 0.2-unit resolution
# ---------------------------------------------------------------------------
MAMDANI = {
    "and": "min",
    "implication": "min",
    "aggregation": "max",
    "samples": 1001,
}
