"""BetterBlinds fuzzy-simulator backend (Phase 0: minimal Flask shell).

The real fuzzy engine lands in Phase 2 under `fuzzy/`.
Run from the `backend/` folder with:  flask run
"""

from flask import Flask, jsonify
from flask_cors import CORS

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
            "evaluate": "/api/fuzzy/evaluate (lands in Phase 2)",
        }
    )


@app.get("/api/health")
def health():
    """Quick check that the backend is up. Returns {"status": "ok"}."""
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True)
