# 10-Minute Report / Demo Script

Extends the 5-minute version in `IMPLEMENTATION_PLAN.md` §8 to fill a full
10-minute reporting slot while hitting every rubric line in §1. Two
presenters, split roughly 50/50 — swap on each numbered beat so both voices
are heard before Q&A.

Run both servers before you start (`backend: flask run`, `frontend: npm run
dev`) and have these tabs/sections pre-loaded: Controls, Charts (Membership +
Surface), Explain panel expanded, Testing panel visible.

| # | Time | Cum. | Beat | What's on screen | Talking points | Rubric line |
|---|---|---|---|---|---|---|
| 1 | 0:00–0:45 | 0:45 | Problem statement | Title slide / README intro | Original hardware used crisp thresholds (close ≥819, open ≤250 LDR). Everything between 251–818 is genuinely ambiguous — a threshold controller chatters near the boundary. Fuzzy logic is a better fit because sunlight is continuous, not binary. | 1. Problem + fuzzy suitability (15) |
| 2 | 0:45–1:15 | 2:00 | System overview | Repo structure / architecture diagram (React+TS+Vite frontend ↔ Flask+pure-Python fuzzy engine, JSON over REST, no DB/auth/Docker by design) | 2 inputs (Light Intensity, Rate of Change ΔL) → Mamdani inference → 1 output (Motor Command). Stack is intentionally minimal — nothing here serves the rubric less than a real backend fuzzy engine would. | 1 |
| 3 | 1:15–2:30 | 3:15 | Membership functions | Charts tab → Membership curve plots (`MembershipChart.tsx`) for both inputs | Light: Dark / Moderate / Bright / VeryBright — trapezoidal/triangular, overlapping, anchored around the 250–819 paper averages. ΔL: Falling / Stable / Rising. Point at the smooth overlap — no gaps, no dead zones. | 2a. Membership functions (10) |
| 4 | 2:30–3:45 | 4:45 | Rule base | Fuzzy panel → rule matrix (12 rules, `R01`–`R12`) | Walk one row: e.g. R09 "Bright + Rising → FastClose". Explain the matrix is a complete 4×3 cross of Light × ΔL sets, each mapped to a Motor Command linguistic output (FastOpen…Stop…FastClose). Built and reviewed by both devs. | 2b. Rule base (10) |
| 5 | 3:45–5:00 | 6:00 | Inference mechanics | Fuzzy panel → active rules + aggregated output, or Explain panel | Live values → fuzzified memberships → rules fire in parallel (min for AND) → outputs aggregated (max) → centroid defuzzification → single crisp `motorCommand` in [-1, 1]. This is the actual Mamdani min→max→centroid pipeline, not a lookup table. | 2c. Inference mechanics (10) |
| 6 | 5:00–6:30 | 7:30 | **Live demo** | Controls tab, drag sliders | Drag Light 100→450→850, toggle ΔL −/+. Narrate the scene: blinds animate, motor command updates live, active rules re-highlight in real time. This is the core "it actually works" moment — don't rush it. | 3a. Live demo (20) |
| 7 | 6:30–7:15 | 8:15 | Preset scenarios (ΔL payoff) | Testing panel presets: **Sudden Brightening** vs **Sudden Darkening** (or Bright-but-darkening) | Same-ish light level, opposite trend → opposite/attenuated motor response. This is the concrete proof that ΔL (not just L) matters — a crisp threshold controller can't do this. | 3a / 1 (fuzzy suitability payoff) |
| 8 | 7:15–7:45 | 8:45 | Control surface + anti-threshold | Charts tab → 3D control surface (Plotly) | Smooth continuous surface, no cliff/step at the old 499↔500 boundary — visually proves the "no chatter" claim from beat 1. | 4b. Visualizations (10) |
| 9 | 7:45–8:20 | 9:20 | Edge / robustness testing | Testing panel: extremes (0, 1023) + noise preset if available, or narrate T5–T8 from plan §7 | Extremes don't crash or spike; small jitter (±5) around a stable point doesn't flicker the output. 17 pytest cases pass (`docs/PHASE7.md`). | 3b. Edge testing (5) |
| 10 | 8:20–9:20 | 10:00 | Explain panel → Q&A bridge | Fuzzy panel → "Explain Current Output" expanded | For the current slider position, read off: fuzzified membership degrees → which rules fired and their activation strength → aggregated fuzzy output → centroid math → final crisp command. This panel *is* your Q&A defense — invite questions here. | 3c. Q&A defense (10), 4a. Documentation (10) |

**Total: 10:00.** Beats 1–5 (setup/theory) run ~4:45; beats 6–10 (proof/demo)
run ~5:15 — keep the balance tilted toward the live system, since that's
worth the most points (3a = 20).

## Presenter prep checklist

- [ ] Both servers running (`flask run` on :5000, `npm run dev` on :5173) —
      confirm with a slider drag before presenting, not during.
- [ ] Browser zoomed so charts + rule matrix are readable from the back of
      the room.
- [ ] Both presenters can explain every MF breakpoint, every rule, and the
      centroid formula cold — quiz each other once before presenting
      (IMPLEMENTATION_PLAN.md §5.3 / §10 risk: "Q&A stumble").
- [ ] Know the answer to "why not just use if/else thresholds" without
      reading it off a slide (it's the whole point of beat 1 + beat 7).
- [ ] If Wi-Fi/projector is unreliable, have `docs/figures/mf-*.png`,
      `phase7-boundary.png`, `phase7-fast-close.png` as static fallback
      slides — you can present from the PNGs alone if the live app fails.

## If a question runs long

Beats 6 (live demo) and 10 (Explain panel) are the only two that can safely
absorb overflow time — everyone will remember the demo, not the intro. Trim
beat 2 (system overview) first if you're behind; it's the lowest-rubric-value
beat on the list.
