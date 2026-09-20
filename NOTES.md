# Phase 2 + Phase 3 — What Changed & How It Works

> Written for: both of you (jacy-sangre & yerdnarthc), as a change log and
> a Q&A rehearsal aid. The rubric's "Technical Q&A Defense" (10 points)
> asks you to explain *why* a given output happened — this doc is built
> around that, not just a list of files.

## 1. What was built

**Phase 2 (backend fuzzy engine + API):**

| File | What it does |
|---|---|
| `backend/fuzzy/membership.py` | `triangular()` / `trapezoidal()` — pure linear-interpolation math. `fuzzify_light()` / `fuzzify_delta()` read `config.py`'s MF definitions and return `{"Dark": 0.0, "Moderate": 1.0, ...}`-style dicts. |
| `backend/fuzzy/rules.py` | `evaluate_rules()` runs all 12 rules from `config.RULES`, computing each rule's activation as `min(light_degree, delta_degree)` — Mamdani AND. `active_rules()` filters out the ones that scored 0. |
| `backend/fuzzy/inference.py` | `aggregate()` — Mamdani implication (clip each fired rule's output MF at its activation) then aggregation (pointwise max across all clipped shapes), sampled at `MAMDANI["samples"]` points across `MOTOR_RANGE`. |
| `backend/fuzzy/defuzzification.py` | `centroid()` — weighted average `sum(x*y)/sum(y)` over the aggregated curve. This is the "center of mass" of the fuzzy output shape, converted back to one crisp number. |
| `backend/app.py` | Added `POST /api/fuzzy/evaluate`. Clamps inputs to the config domains, runs the four steps above in order, and returns the frozen JSON contract (§2.4 of the plan). |
| `backend/fuzzy/tests/test_fuzzy.py` | 10 tests: the plan's §7 cases T1–T8, plus a full-domain sweep. All passing. |

**Phase 3 (frontend shell):**

| File | What it does |
|---|---|
| `frontend/src/types.ts` | TypeScript mirror of the API contract — `FuzzyEvaluateRequest`, `FuzzyMemberships`, `FuzzyRule`, `FuzzyEvaluateResponse`. |
| `frontend/src/api.ts` | `evaluateFuzzy()` — a `fetch` wrapper that POSTs to the backend and throws a readable error on a non-OK response. |
| `frontend/src/App.tsx` | Replaced the Vite starter template. Two sliders (Light Intensity, Rate of Change), a 150ms-debounced effect that calls `evaluateFuzzy()` on every change, and a raw-JSON dump in a placeholder "Fuzzy Panel" box. Scene/panel styling is intentionally not done yet — that's Phase 4/5. |

## 2. The pipeline, end to end

```
lightIntensity, lightChange   (from sliders, or curl/Postman)
        |
        v
fuzzify_light() / fuzzify_delta()      -- membership.py
        |  {"Bright": 0.27, "VeryBright": 0.35, ...}
        v
active_rules()                          -- rules.py
        |  each rule's activation = min(light_degree, delta_degree)
        v
aggregate()                             -- inference.py
        |  clip each fired rule's output MF at its activation (implication)
        |  then take the pointwise max across all of them (aggregation)
        v
centroid()                              -- defuzzification.py
        |  weighted average of the aggregated shape
        v
motorCommand (crisp number, -100..+100), direction ("open"/"stop"/"close")
```

### Worked example (verified against the live API)

`POST /api/fuzzy/evaluate {"lightIntensity": 742, "lightChange": 38}` returns:

```json
{
  "memberships": {"bright": 0.2711, "veryBright": 0.3529, "rising": 0.92, "stable": 0.08, ...},
  "rules": [
    {"id": "R08", "light": "Bright", "change": "Stable", "output": "SlowClose", "activation": 0.08},
    {"id": "R09", "light": "Bright", "change": "Rising", "output": "FastClose", "activation": 0.2711},
    {"id": "R11", "light": "VeryBright", "change": "Stable", "output": "FastClose", "activation": 0.08},
    {"id": "R12", "light": "VeryBright", "change": "Rising", "output": "FastClose", "activation": 0.3529}
  ],
  "motorCommand": 67.9,
  "direction": "close"
}
```

**How to explain this in Q&A:** L=742 sits on the falling edge of `Bright` (0.271) and the rising edge of `VeryBright` (0.353) — it's genuinely between the two, which is the entire point of fuzzy sets. ΔL=+38 is mostly `Rising` (0.92) with a sliver of `Stable` (0.08). Four rules fire because two light sets × two delta sets are simultaneously nonzero (2×2=4 nonzero combinations out of 12 total rules). Three of those four rules point to `FastClose`; Mamdani aggregation takes the *strongest* of them (max), so `FastClose`'s effective activation is 0.3529 (not the sum — fuzzy aggregation doesn't double-count). `SlowClose` only got 0.08. The centroid pulls the final number toward `FastClose`'s peak (100) but not all the way, because `SlowClose`'s small contribution still tugs the weighted average down a bit — hence 67.9, not 100.

## 3. A real finding: the "Stop" zone is narrower than the plan's prose assumed

Test `test_t2b_moderate_to_bright_blend_ramps_smoothly` documents this. Running the numbers (not guessing) at `ΔL=0` (perfectly `Stable`):

| L | Moderate | Bright | motorCommand |
|---|---|---|---|
| 250 | 1.00 | 0.00 | **0.0** |
| 300 | 0.82 | 0.18 | 10.8 |
| 400 | 0.47 | 0.53 | 26.1 |
| 450 | 0.30 | 0.70 | 33.3 |
| 535 | 0.00 | 1.00 | 50.0 |

The original plan's test case T2 (`L=450, ΔL=0 → "Stop / near 0"`) was written before any real numbers existed. In the actual frozen MFs, `Bright`'s triangle peaks at 535 with a wide base (250→819), so it already outweighs `Moderate` past L≈392 (the exact crossover point). By L=450, the system is 70% `Bright`/30% `Moderate`, and rule `Bright+Stable→SlowClose` starts pulling the output toward gentle closing well before the room feels subjectively "not moderate anymore."

**Is this a bug?** No — the code is doing exactly what the frozen `config.py` rules say. It's arguably *correct* fuzzy behavior (a smooth anticipatory ramp instead of a flat dead zone), and it's a good story for the "why fuzzy over crisp" argument. But it is a genuine calibration choice your pair should know about, since it means "Stop" is a single point (L=250) rather than a plateau. If you want a wider hold-still zone, the fix would be narrowing `Bright`'s rising edge or shifting its peak — a `config.py` change, which per `CONTRIBUTING.md` needs both of your sign-off since it's a frozen contract file. I did not change `config.py`.

## 4. Test results

```
10 passed in 0.07s
```

Covers: T1 (low light opens), T2 + T2b (moderate/stable — see finding above), T3 (sudden brightening closes fast), T4 (darkening closes less than brightening — proves ΔL matters), T5/T6 (extremes don't crash), T7 (499 vs 500 boundary is smooth, unlike the old crisp controller), T8 (±5 jitter doesn't flicker), plus a full-domain sweep asserting output always stays within ±100.

## 5. How to run it yourself

```bash
# Backend
cd backend
source venv/bin/activate      # venv already created + populated
pytest                        # 10 passed
flask --app app run           # serves http://127.0.0.1:5000

# Frontend (separate terminal)
cd frontend
npm run dev                   # serves the Vite dev URL, usually :5173
```

Open the Vite URL, drag a slider — the JSON box should update after ~150ms.

## 6. What's NOT done yet

Phases 4–8 are untouched: the actual SVG classroom scene, the styled fuzzy dashboard (membership bars, active-rule list, "Explain Current Output"), the MF/control-surface Plotly charts, the preset/testing panel UI, and final polish. Right now the frontend shows raw JSON in a box — that's expected per Phase 3's own "done" criteria ("ugly is fine").

## 7. Rehearsal questions for Q&A

- *"Why did R08 and R11 only contribute 0.08?"* — because `ΔL=38` has only 0.08 membership in `Stable` (it's mostly `Rising` at 0.92); a rule's activation is capped by its weakest antecedent (`min`).
- *"Why isn't `motorCommand` just the average of the rule outputs?"* — because Mamdani aggregation is `max` per output category first (so multiple rules agreeing on `FastClose` don't stack), and centroid is a weighted average over the *shape*, not over the rule list.
- *"What happens exactly at L=499 vs L=500?"* — a ~0.2-unit difference in `motorCommand` (see `test_t7`), because both values sit deep inside `Bright`'s smooth slope, nowhere near a hard edge. Contrast with the original hardware's crisp cutoff, which would have flipped `open`/`close` right there.
