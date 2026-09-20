# BetterBlinds Fuzzy Simulator — Implementation Plan

> Source context: `betterblinds-fuzzy-project-chat-context.md` (full chat history + IMRAD paper summary).
> Goal: UI-only Mamdani fuzzy-logic simulator of sunlight-responsive blinds, built by 2 developers without PR conflicts.
> Stack (locked): React + TypeScript + Vite + Tailwind/CSS + SVG + Plotly.js → JSON → Python Flask + pure-Python fuzzy engine. No DB, no auth, no Docker, no Next.js.

---

## 1. Project snapshot

**Title:** BetterBlinds: Fuzzy-Logic-Based Sunlight-Responsive Blinds Simulator
**Repo name:** `betterblinds-fuzzy-simulator`
**Nature:** Browser-based interactive engineering simulator (no Arduino hardware in this activity).
**Core story:** Replace the original crisp threshold controller (close at ≥819, open at ≤250) with a genuine 2-input Mamdani fuzzy controller that handles the vague middle zone (251–818) with gradual motor responses.

**Original research anchors (keep citing these in report/demo):**

- Harsh light LDR readings: ~700–900, avg **819.2** → roll down / close.
- Normal light LDR readings: ~200–300, avg **249.8** → roll up / open.
- Timing: ~**4.17s** down, ~**4.89s** up (variable retraction — don't assume exact repeatability).
- Hardware chain (background only): LDR → Arduino → L293D → DC motor → blinds (+ relay/capacitor in original).

**Rubric coverage map:**

| Rubric (points) | Where we prove it |
|---|---|
| 1. Problem + fuzzy suitability (15) | README + report intro: continuous/vague sunlight, why thresholds chatter at 499/500, ΔL adds trend info |
| 2a. Membership functions (10) | `backend/fuzzy/membership.py` + MF plots in UI |
| 2b. Rule base (10) | `backend/fuzzy/rules.py` + rule-matrix table + active-rule display |
| 2c. Inference mechanics (10) | `backend/fuzzy/inference.py` + `defuzzification.py`, Mamdani min→max→centroid pipeline visible in UI |
| 3a. Live demo (20) | Sliders → sunlight/LDR/motor/blinds update live; preset scenarios |
| 3b. Edge testing (5) | Testing tab: extremes, boundaries, rapid change, noise |
| 3c. Q&A defense (10) | "Explain Current Output" panel: memberships + fired rules + centroid math |
| 4a. Documentation (10) | Variable tables, rule matrix, commented code |
| 4b. Visualizations (10) | MF plots + 3D control surface (Light × ΔLight → Motor) + time-series |

---

## 2. Frozen fuzzy math spec (Phase 1 must confirm, not reinvent)

> Rule: don't start coding until both devs agree on these numbers. Put final numbers in `backend/fuzzy/config.py`.

### 2.1 Inputs

**Input 1 — Light Intensity `L`**

- Domain: `0–1023` (Arduino ADC).
- Linguistic sets (triangular/trapezoidal, smooth overlap, no gaps):
  - `Dark`, `Moderate`, `Bright`, `VeryBright`
- Calibration hint: anchor `Moderate/Bright` transition around the 250–819 middle zone; `VeryBright` should cover the 700–900 harsh band. Exact breakpoints are a Phase-1 decision — justify from paper averages.

**Input 2 — Rate of Change `ΔL = L_t − L_(t−1)`**

- Domain: `-200 … +200` (tune after testing).
- Sets: `Falling`, `Stable`, `Rising` (trapezoidal or triangular; `Stable` centered at 0 with overlap).
- Why: distinguishes "bright but darkening, hold off" vs "bright and getting brighter, close fast".

### 2.2 Output — Motor Command `U`

- Domain: `-100 … +100`.
- Meaning: `-100` = fast open, `-40` ≈ slow open, `0` = stop, `+40` ≈ slow close, `+100` = fast close.
- Sets: `FastOpen, SlowOpen, Stop, SlowClose, FastClose` (triangular, symmetric).
- Simulation mapping (frontend or backend helper): `blind_position = clamp(blind_position + k * U, 0, 100)`. Keep `k` small so blinds move gradually — no exact hardware timing needed.

### 2.3 Rule matrix (12 rules — starting point, calibrate in Phase 1)

| Light \ ΔL | Falling | Stable | Rising |
|---|---|---|---|
| **Dark** | FastOpen | SlowOpen | Stop |
| **Moderate** | SlowOpen | Stop | SlowClose |
| **Bright** | Stop | SlowClose | FastClose |
| **VeryBright** | SlowClose | FastClose | FastClose |

Name rules `R01…R12` for demo traceability.

### 2.4 Inference (Mamdani + Centroid)

```text
crisp L, ΔL
  → fuzzify (membership degrees)
  → rule activation = min(μ_light, μ_delta)   [AND = min]
  → implication = clip output MF at activation [Mamdani min]
  → aggregation = max over all clipped outputs [max]
  → centroid defuzzification → crisp U
```

API contract (frozen — changing this requires both devs):

```json
// POST /api/fuzzy/evaluate
// request:
{ "lightIntensity": 742, "lightChange": 38 }
// response:
{
  "memberships": { "dark": 0, "moderate": 0.21, "bright": 0.71, "veryBright": 0.24, "falling": 0, "stable": 0.18, "rising": 0.82 },
  "rules": [{ "id": "R08", "light": "Bright", "change": "Rising", "output": "FastClose", "activation": 0.71 }],
  "motorCommand": 0.67,
  "direction": "close"
}
```

`motorCommand` is a NORMALIZED actuator velocity in [-1, 1] (negative =
opening, 0 = stop, positive = closing, |u| = speed). The fuzzy core still
reasons in percent internally; only the wire format is normalized. The scene
integrates it per frame until a limit — one evaluation commands persistent
motion, not a one-shot nudge.

---

## 3. Tech stack (do not expand without discussion)

| Layer | Choice | Why (one line) |
|---|---|---|
| UI | React + TypeScript + Vite | Component simulator, no SSR needed (Next.js rejected) |
| Styling | Tailwind or plain CSS | Fast, partner-friendly |
| Scene graphics | SVG | Window/blinds/LDR/motor/sun rays without image assets |
| Charts | Plotly.js | MF plots + 3D control surface + time series |
| Backend | Python Flask | One tiny endpoint; works on macOS without Visual Studio |
| Fuzzy engine | Pure Python (hand-written) | Must be explainable in Q&A — no black-box lib |
| Comms | REST/JSON | Simplest contract |
| DB/Auth/Docker/Cloud | None | Out of scope — fuzzy demo, not production |

Run locally: `flask run` + `npm run dev`. That's it.

---

## 4. Repo structure (shared map — both devs work from the same codebase)

> No fixed Dev A / Dev B zones. Both of you contribute to the backend fuzzy engine so both can defend it in Q&A. Claim tasks openly (see §5.4) instead of assuming a folder belongs to one person.

```text
betterblinds-fuzzy-simulator/
├── IMPLEMENTATION_PLAN.md   # this file (SHARED — edit only via PR + both approve)
├── README.md                # (SHARED — same rule)
├── .gitignore
├── backend/
│   ├── app.py               # Flask routes only
│   ├── requirements.txt
│   └── fuzzy/               # fuzzy engine — BOTH devs contribute (required for Q&A)
│       ├── __init__.py
│       ├── config.py        # MF breakpoints + rule matrix (agree together before changing)
│       ├── membership.py
│       ├── rules.py
│       ├── inference.py
│       ├── defuzzification.py
│       └── tests/           # test_fuzzy.py — deterministic cases
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── types.ts         # TS mirror of API contract (keep in sync with config.py)
│       ├── api.ts           # fetch wrapper
│       └── components/
│           ├── ClassroomScene.tsx  # room + window + sun + LDR + motor + blinds (SVG)
│           ├── FuzzyPanel.tsx      # memberships + active rules + output
│           ├── MembershipChart.tsx # Plotly MF graphs
│           ├── ControlSurface.tsx  # Plotly 3D surface
│           └── TestingPanel.tsx    # presets + edge cases
```

**Working rule:** the tree above is a shared guide, not a division of people. Either of you may pick up any task in §5.4 — just claim it first so you don't both edit the same files at the same time. Contract files (`config.py`, `types.ts`, `api.ts`, `app.py` route shape, this plan) need **both approvals** before merging.

---

## 5. Pair workflow (how you avoid PR conflicts)

### 5.1 How you share the work (no fixed roles)

There are no locked Dev A / Dev B assignments. Either of you may claim any task in §5.4.

Two agreements you already made — kept here so they stick:

1. **Both contribute to the backend fuzzy engine.** The whole point is that both of you can explain fuzzification → rules → aggregation → centroid in Q&A. Don't let one person become the only one who understands `backend/fuzzy/`.
2. **Both must be able to explain:** every MF breakpoint + every rule + the centroid step, AND the UI flow (slider → API → animation). If you built only one side, pair/review on the other side before the demo.

Practical pattern: pair on Phase 1 (math) and Phase 2 (fuzzy engine) together, then split-and-claim remaining phases openly and review each other's PRs.

### 5.2 Branch + PR rules (keep it simple)

1. `main` is always demoable. Never push directly to `main`.
2. Short-lived feature branches, one task per branch:
   - `backend/membership-functions`, `backend/rule-engine`, `frontend/classroom-scene`, `frontend/fuzzy-panel`, etc.
3. One PR = one task from §6. Small PRs (<300 lines) merge fast, conflict rarely.
4. PR template: what changed, which files, screenshot or test output, rubric item covered.
5. Merge strategy: **squash + rebase on main before merging** (`git pull --rebase origin main`). Resolve conflicts locally, never via GitHub web editor for code.
6. Suggested `CODEOWNERS` (create `.github/CODEOWNERS` in Phase 0) — both of you review everything, since there are no fixed zones:

```text
*  @DevA @DevB
```

### 5.3 Conflict-avoidance checklist (paste into every PR description)

- [ ] I claimed this task first / no one else is editing the same files right now.
- [ ] I rebased on latest `main`.
- [ ] Contract unchanged? If changed, partner approved + both `config.py` and `types.ts` updated together.
- [ ] Backend: `pytest` passes. Frontend: `npm run build` passes.
- [ ] No unrelated reformatting.

### 5.4 Task tracking (single source of truth)

Use GitHub Projects or this table (copy into a `TRACKING.md` or Project board). Status: `todo | in-progress | in-review | done`. Only one person `in-progress` per row. **Claimed by** is left open on purpose — fill in whoever picks it up.

| ID | Phase | Task | Claimed by | Files | Status |
|---|---|---|---|---|---|
| P0-1 | 0 | Repo + CODEOWNERS + PR template | yerdnarthc | `.github/` | done |
| P1-1 | 1 | Freeze MF breakpoints + rule matrix + MF matplotlib diagram generator | Both (pair) | `config.py` | done (yerdnarthc & jacy-sangre) |
| P2-1 | 2 | `membership.py` + unit tests | jacy-sangre (both review — Q&A coverage) | `backend/fuzzy/` | done |
| P2-2 | 2 | `rules.py` + `inference.py` + centroid | jacy-sangre (both review — Q&A coverage) | `backend/fuzzy/` | done |
| P2-3 | 2 | Flask `/api/fuzzy/evaluate` + CORS | jacy-sangre | `app.py` | done|
| P3-1 | 3 | Vite+TS scaffold + `types.ts` + `api.ts` | jacy-sangre | `frontend/src/` | done |
| P4-1 | 4 | SVG classroom scene + blinds animation | yerdnarthc | `ClassroomScene.tsx` | done |
| P5-1 | 5 | Fuzzy panel (memberships + rules + output) | jacy-sangre | `FuzzyPanel.tsx` | in-progress |
| P6-1 | 6 | MF charts + 3D control surface | jacy-sangre | `MembershipChart`, `ControlSurface` | todo |
| P7-1 | 7 | Preset scenarios + edge-case tests | Both (pair) | `TestingPanel`, `tests/` | todo |
| P8-1 | 8 | Report figures + demo script + polish | Both (pair) | `README`, report doc | todo |

Daily 10-min sync: what merged, what's in-review, did the contract change?

---

## 6. Build phases (with acceptance criteria)

### Phase 0 — Repo hygiene (30 min, both)

- Init `frontend/` (Vite React-TS), `backend/` (Flask), `.gitignore` (node_modules, venv, __pycache__), `CODEOWNERS`, PR template.
- Done when: both can run `npm run dev` and `flask run` from README instructions on Windows + macOS.

### Phase 1 — Freeze the math (both, no code yet)

- Decide exact MF breakpoints, ΔL domain, output MF shapes, Mamdani operators (min/max), centroid resolution.
- Write them in `config.py` + a rule-matrix table in this plan.
- Done when: you can hand-compute one example (e.g. L=742, ΔL=+38 → which rules fire, approx U) and both agree.

### Phase 2 — Minimal backend (both — pair here, required for Q&A)

- `membership.py`: `triangular(x,a,b,c)`, `trapezoidal(...)`, `fuzzify_light()`, `fuzzify_delta()`.
- `rules.py`: `RULES` list of 12 dicts.
- `inference.py` + `defuzzification.py`: min-implication, max-aggregation, centroid over sampled U domain.
- `app.py`: `POST /api/fuzzy/evaluate` returns the frozen JSON contract; enable CORS for Vite dev server.
- `tests/test_fuzzy.py`: ≥8 deterministic cases (see §7).
- Done when: `pytest` passes and manual `curl` returns sensible U for dark/moderate/bright/very-bright probes.

### Phase 3 — Minimal frontend shell (claim openly)

- Vite + TS + Tailwind, `types.ts` mirrors backend JSON, `api.ts` fetch wrapper with error state.
- `App.tsx` layout: left = scene placeholder, right = fuzzy panel placeholder, bottom = sliders.
- Done when: moving a slider calls the API and displays raw JSON (ugly is fine).

### Phase 4 — Simulation scene (claim openly)

- SVG: window frame, slats (angle/opacity by blind position), sun + rays (count/opacity by L), LDR dot + ADC label, motor circle + rotation speed/direction by U.
- Sliders: Light `0–1023`, ΔL `-200…+200`. Optional auto-derive ΔL from slider history.
- Done when: L=100 opens, L=850 closes, animation direction matches `direction` field.

### Phase 5 — Fuzzy visualization (claim openly; second dev validates numbers)

- Membership bars, active-rules list (dim inactive), aggregated output bars + defuzzified number + "Explain Current Output" sentence (e.g. "Bright 0.71 ∧ Rising 0.82 → FastClose, centroid = +67").
- Done when: a non-technical viewer can answer "why is it closing?" from the screen alone.

### Phase 6 — Control surface (claim openly; second dev validates numbers)

- Backend helper or frontend sampler: grid over L × ΔL → U, render Plotly 3D surface. Also 2D MF plots.
- Done when: surface shows smooth open→stop→close transition; export PNG for report.

### Phase 7 — Testing (both)

- Backend `pytest` + frontend `TestingPanel` presets: Dawn, Morning, Noon, Cloudy, Sunset, Sudden Brightening/Darkening, boundary pair (e.g. 499 vs 500 shows smooth, not flip), extremes (0, 1023, ±200), noise (±5 jitter stable).
- Done when: all §7 cases documented with expected vs actual + screenshot/PNG.

### Phase 8 — Polish + report (both)

- Preset buttons, reset, status labels ("Opening… / Holding / Closing…"), clean demo flow.
- Export: variable tables, rule matrix, MF plots, surface plot, commented code zip.
- Done when: you can run the 5-minute demo in §8 without touching code.

---

## 7. Test cases (minimum set)

| # | L | ΔL | Expect | Why it matters |
|---|---|---|---|---|
| T1 | 100 | -20 | Open (U strongly negative) | Low light |
| T2 | 450 | 0 | Stop / near 0 | Moderate-stable hold |
| T3 | 850 | +100 | Fast close (U ≈ +0.80…1.00) | Sudden brightening |
| T4 | 850 | -100 | Slow close / reduced (U small +) | Bright but darkening — proves ΔL value |
| T5 | 0 | -200 | Fast open, no crash | Lower extreme |
| T6 | 1023 | +200 | Fast close, no crash | Upper extreme |
| T7 | 499 vs 500 | 0 | Nearly same U (smooth) | Anti-threshold demo |
| T8 | 600 | ±5 jitter | Stable U (no flicker) | Noise robustness |

---

## 8. Five-minute demo script

1. (30s) Problem: manual blinds + crisp thresholds fail in the 251–818 zone.
2. (60s) Show MF plots + rule matrix (12 rules).
3. (90s) Live: drag L 100→450→850; toggle ΔL −/+; point at active rules + memberships.
4. (60s) Presets: Sudden Brightening (fast close) vs Bright-but-darkening (holds) — the ΔL payoff.
5. (30s) 3D surface: smooth, no cliff at 499/500.
6. (30s) Edge: 0 / 1023 extremes stable. Q&A: read the "Explain" panel.

---

## 9. What NOT to build

No Next.js, Node backend, DB, auth, Docker, MQTT/ESP32, weather API, ML/CV, mobile app, Three.js. If it doesn't serve the rubric, cut it.

---

## 10. Risks + mitigations

| Risk | Mitigation |
|---|---|
| MF gaps / dead zones | Phase-1 overlap review + T7 boundary test |
| Conflicting rules | Agree on `config.py` together; review matrix as a pair |
| macOS vs Windows env drift | README with `venv` + `npm` steps; no VS requirement |
| PR conflicts | Claim tasks first + small PRs + rebase + CODEOWNERS |
| Q&A stumble | Both build/review the fuzzy core + "Explain" panel; quiz each other before demo |

---

*Phases 0–4 complete: P0-1 repo hygiene, P1-1 frozen `config.py` + rule matrix + `docs/figures/mf-*.png`, P2-1 `membership.py` + tests, P2-2 `rules.py` / `inference.py` / centroid, P2-3 `POST /api/fuzzy/evaluate`, P3-1 frontend shell (`types.ts` / `api.ts` / sliders → live JSON), P4-1 SVG classroom scene + integrated blinds + directional lighting (tilt plant, WebGL, auto ΔL). Next: P5-1 Fuzzy panel — branch fresh from updated `main` and claim it in §5.4.*
