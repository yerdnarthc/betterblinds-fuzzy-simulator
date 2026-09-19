# betterblinds-fuzzy-simulator

Browser-based Mamdani fuzzy-logic simulator of sunlight-responsive blinds — a UI-only redesign of the BetterBlinds research prototype (IMRAD, UC Lapu-Lapu & Mandaue, April 2024).

Instead of crisp thresholds (close at LDR ≥ 819, open at ≤ 250), this app uses a **2-input fuzzy controller (Light Intensity + Rate of Change → Motor Command)** so blinds respond gradually across the vague middle zone (251–818).

> Pair workflow, shared codebase map, and full build phases: see [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md). No fixed Dev A / Dev B zones — both of you work the fuzzy backend so both can defend it in Q&A.

## Features

- Interactive classroom scene (SVG): window, animated blinds, sun rays, LDR sensor, DC motor.
- Live fuzzy dashboard: membership degrees, active rules, aggregated output, defuzzified motor command.
- Sliders for Light Intensity (0–1023) and Rate of Change (−200…+200) + preset scenarios (Dawn, Noon, Cloudy, Sudden Brightening/Darkening…).
- Membership-function plots + 3D control surface (Plotly.js) for the technical report.
- Testing panel: normal, boundary (499 vs 500), extreme, and noise cases.
- Transparent fuzzy engine: hand-written Mamdani min → max → centroid in pure Python.

## Tech stack

**Frontend:** React + TypeScript + Vite + Tailwind/CSS + SVG + Plotly.js
**Backend:** Python Flask + pure-Python fuzzy engine · **Comms:** REST/JSON · **DB/Auth/Docker:** none (intentional).

## Quickstart

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS:
# source venv/bin/activate
pip install -r requirements.txt
flask run  # serves POST /api/fuzzy/evaluate
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL, move the sliders — the scene, fuzzy panel, and motor should update live.

## API contract

```text
POST /api/fuzzy/evaluate
{ "lightIntensity": 742, "lightChange": 38 }
→ { "memberships": {...}, "rules": [...], "motorCommand": 67, "direction": "close" }
```

> Frozen contract — changes need both devs + sync `backend/fuzzy/config.py` with `frontend/src/types.ts`. See Implementation Plan §5.

## Repo structure

```text
backend/fuzzy/   → membership, rules, inference, defuzzification + tests (both devs)
backend/app.py   → Flask routes
frontend/src/    → SVG scene, fuzzy panel, charts, testing
IMPLEMENTATION_PLAN.md → phases, task board, demo script, conflict-avoidance rules
```

## Team workflow (TL;DR)

- `main` always demoable; feature branches per task; small PRs; rebase before merge.
- No fixed zones: claim a task in the plan's tracking table first so you don't edit the same files simultaneously; both review everything.
- Both contribute to `backend/fuzzy/` so both can explain it in Q&A. Shared files need both approvals. Checklist in `IMPLEMENTATION_PLAN.md` §5.3.
- Step-by-step Git loop (branches, rebasing, conflicts): [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Rubric mapping

Problem/suitability → report intro · MFs/rules/inference → backend + plots · Live demo/edges/Q&A → simulator + Explain panel · Report/visuals → MF + surface PNG exports.

## License

Course activity — no license yet. Add one if publishing.
