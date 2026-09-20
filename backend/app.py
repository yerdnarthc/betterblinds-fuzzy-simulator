"""BetterBlinds fuzzy-simulator backend.

Fuzzy math lives under `fuzzy/`; this file only wires it to HTTP.
Run from the `backend/` folder with:  flask run
"""

from flask import Flask, jsonify, request
from flask_cors import CORS

from fuzzy import config
from fuzzy.defuzzification import centroid
from fuzzy.inference import aggregate
from fuzzy.membership import fuzzify_delta, fuzzify_light
from fuzzy.rules import active_rules

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
        }
    )


@app.get("/api/health")
def health():
    """Quick check that the backend is up. Returns {"status": "ok"}."""
    return jsonify({"status": "ok"})


def _clamp(value, domain):
    lo, hi = domain
    return max(lo, min(hi, value))


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


if __name__ == "__main__":
    app.run(debug=True)
