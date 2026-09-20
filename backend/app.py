"""BetterBlinds fuzzy-simulator backend.

Fuzzy math lives under `fuzzy/`; this file only wires it to HTTP.
Run from the `backend/` folder with:  flask run
"""

from flask import Flask, jsonify, request
from flask_cors import CORS

from fuzzy import config
from fuzzy.defuzzification import centroid
from fuzzy.inference import aggregate
from fuzzy.membership import evaluate_mf, fuzzify_delta, fuzzify_light
from fuzzy.rules import active_rules
from fuzzy.surface import compute_surface, linspace

# Normalized actuator signal. The centroid itself lives in MOTOR_RANGE
# (-100..100, signed percent effort), but the HTTP contract exposes it in
# [-1, 1]: negative = opening, 0 = stop, positive = closing, magnitude =
# actuator speed. The frontend integrates this per animation frame, so one
# evaluation commands a PERSISTENT velocity — not a one-shot position nudge.
MOTOR_STOP_BAND = 0.05

app = Flask(__name__)

# Lets the Vite dev server (http://localhost:5173) call this API
# while you develop. Safe here: local demo, no real user data.
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})


@app.get("/")
def index():
    """Landing page so the base URL explains itself instead of 404ing."""
    return jsonify(
        {
            "service": "betterblinds-fuzzy-simulator backend",
            "health": "/api/health",
            "evaluate": "/api/fuzzy/evaluate",
            "surface": "/api/fuzzy/surface",
            "membershipCurves": "/api/fuzzy/membership-curves",
        }
    )


@app.get("/api/health")
def health():
    """Quick check that the backend is up. Returns {"status": "ok"}."""
    return jsonify({"status": "ok"})


def _clamp(value, domain):
    lo, hi = domain
    return max(lo, min(hi, value))


def _clamp_int(value, default, lo, hi):
    """Parse a query-string int, falling back to `default` on anything bad,
    then clamp to [lo, hi] -- keeps /surface and /membership-curves from
    being asked to compute an unreasonably large grid."""
    try:
        n = int(value) if value is not None else default
    except (TypeError, ValueError):
        n = default
    return max(lo, min(hi, n))


def _lower_first(name):
    """"VeryBright" -> "veryBright" — matches the frozen API contract's casing."""
    return name[0].lower() + name[1:]


def _direction(motor_command):
    """Direction from the NORMALIZED command. |u| <= deadband counts as stop,
    matching the frontend's TILT_DEADBAND so both sides agree on stillness."""
    if motor_command > MOTOR_STOP_BAND:
        return "close"
    if motor_command < -MOTOR_STOP_BAND:
        return "open"
    return "stop"


@app.post("/api/fuzzy/evaluate")
def evaluate():
    """The one endpoint. Runs the full Mamdani pipeline for a single (L, ΔL)
    reading: fuzzify -> rule activation (min) -> implication (min) ->
    aggregation (max) -> centroid, normalized to [-1, 1].
    See IMPLEMENTATION_PLAN.md §2.4.
    """
    body = request.get_json(silent=True) or {}
    light = _clamp(float(body.get("lightIntensity", 0)), config.LIGHT_RANGE)
    delta = _clamp(float(body.get("lightChange", 0)), config.DELTA_LIGHT_RANGE)

    light_memberships = fuzzify_light(light)
    delta_memberships = fuzzify_delta(delta)
    fired = active_rules(light_memberships, delta_memberships)
    xs, ys, _peak_by_output = aggregate(fired)
    # Boundary-only normalization: fuzzy core stays in percent (MFs, rules,
    # and report prose all reason in -100..100); only the wire format is
    # normalized. Changing MOTOR_MFS instead would force recalibration.
    motor_command = round(centroid(xs, ys) / 100, 3)

    memberships = {
        _lower_first(name): round(degree, 4)
        for name, degree in {**light_memberships, **delta_memberships}.items()
    }

    return jsonify(
        {
            "memberships": memberships,
            "rules": [
                {
                    "id": rule["id"],
                    "light": rule["light"],
                    "change": rule["delta"],
                    "output": rule["output"],
                    "activation": round(rule["activation"], 4),
                }
                for rule in fired
            ],
            "motorCommand": motor_command,
            "direction": _direction(motor_command),
        }
    )


@app.get("/api/fuzzy/surface")
def surface():
    """Phase 6's 3D control surface: a grid sweep of L x ΔL -> motorCommand,
    reusing the exact /api/fuzzy/evaluate pipeline (see fuzzy/surface.py) --
    no separate math. Optional ?lightSteps=&deltaSteps= (default 61x41,
    clamped) trade resolution for response time.
    """
    light_steps = _clamp_int(request.args.get("lightSteps"), default=61, lo=5, hi=121)
    delta_steps = _clamp_int(request.args.get("deltaSteps"), default=41, lo=5, hi=121)
    light_axis, delta_axis, grid = compute_surface(light_steps, delta_steps)
    return jsonify({"light": light_axis, "delta": delta_axis, "motorCommand": grid})


@app.get("/api/fuzzy/membership-curves")
def membership_curves():
    """Phase 6's 2D MF plots: each linguistic set's membership degree sampled
    across its domain. Pure function of config.py -- no fuzzy evaluation,
    just membership.evaluate_mf() walked across the axis. Optional ?steps=
    (default 121, clamped) controls curve smoothness.
    """
    steps = _clamp_int(request.args.get("steps"), default=121, lo=10, hi=501)
    light_axis = linspace(*config.LIGHT_RANGE, steps)
    delta_axis = linspace(*config.DELTA_LIGHT_RANGE, steps)

    return jsonify(
        {
            "light": {
                "domain": list(config.LIGHT_RANGE),
                "x": light_axis,
                "sets": {
                    name: [round(evaluate_mf(x, mf), 4) for x in light_axis]
                    for name, mf in config.LIGHT_MFS.items()
                },
            },
            "delta": {
                "domain": list(config.DELTA_LIGHT_RANGE),
                "x": delta_axis,
                "sets": {
                    name: [round(evaluate_mf(x, mf), 4) for x in delta_axis]
                    for name, mf in config.DELTA_LIGHT_MFS.items()
                },
            },
        }
    )


if __name__ == "__main__":
    app.run(debug=True)
