# 10-Minute Report / Demo Script

Extends the 5-minute version in `IMPLEMENTATION_PLAN.md` §8 to fill a full
10-minute reporting slot while hitting every rubric line in §1. Two
presenters, split roughly 50/50 — swap on each numbered beat so both voices
are heard before Q&A.

Run both servers before you start (`backend: flask run`, `frontend: npm run
dev`) and have these tabs/sections pre-loaded: Controls, Charts (Membership +
Surface), Explain panel expanded, Testing panel visible.

## Introduction script (read/paraphrase for Beat 1)

This is the full text for the opening beat — the "why and how" of using
fuzzy logic for this kind of system. Read it close to verbatim the first few
times you rehearse, then paraphrase in your own words once it's internalized.
At a conversational pace (~150 wpm) it runs about 80–85 seconds.

> Picture a classroom on a bright afternoon — sunlight glares off the
> whiteboard and starts heating up the room. The original BetterBlinds
> prototype handled this with one sensor and a hard rule: close the blinds
> at an LDR reading of 819, open them at 250, and do nothing in between.
> Right at that boundary, a single-unit change in the reading could flip
> the blinds open and closed — and the entire 251-to-818 zone, where most
> real afternoons actually live, got no graceful response at all.
>
> That's the core problem: sunlight isn't binary. There's no hard line
> between "bright" and "not bright" — there's *somewhat* bright, *quite*
> bright, *blindingly* bright, and how fast it's getting that way. A person
> adjusting blinds by hand reasons in exactly those vague, graded terms —
> and reacts as much to the trend as to the current level. Fuzzy logic lets
> us encode that same human reasoning in software, instead of a single
> yes/no threshold.
>
> Here's how: we take two inputs — light intensity and its rate of change —
> and fuzzify each into linguistic degrees, like "Bright" or "Rising." A
> bank of expert IF-THEN rules — *if Bright and Rising, close fast* — fires
> in parallel, and Mamdani inference blends every rule's vote into one
> smooth, continuous motor command. No boundary, no flicker. Over the next
> few minutes we'll walk through exactly how each of those pieces works,
> then show you the live system doing it in real time.

**Why fuzzy logic fits this problem, in one line, if you get cut off:**
sunlight intensity and its trend are continuous and vague, not binary — a
crisp if/else controller either overreacts at a threshold or ignores
context (rising vs. falling) that a human would obviously use.

| # | Time | Cum. | Beat | What's on screen | Talking points | Rubric line |
|---|---|---|---|---|---|---|
| 1 | 0:00–1:25 | 1:25 | **Introduction: why + how fuzzy logic** | Title slide / README intro | Full script above — problem (crisp thresholds chatter at 251–818), why fuzzy fits (vague, continuous, trend-aware), how it works here (2 inputs → fuzzify → rules → Mamdani inference → 1 crisp output). This is the roadmap for the rest of the talk. | 1. Problem + fuzzy suitability (15) |
| 2 | 1:25–1:55 | 1:55 | System overview | Repo structure / architecture diagram (React+TS+Vite frontend ↔ Flask+pure-Python fuzzy engine, JSON over REST, no DB/auth/Docker by design) | Stack is intentionally minimal — nothing here serves the rubric less than a real backend fuzzy engine would. One sentence, move on. | 1 |
| 3 | 1:55–3:05 | 3:05 | Membership functions | Charts tab → Membership curve plots (`MembershipChart.tsx`) for both inputs | Light: Dark / Moderate / Bright / VeryBright — trapezoidal/triangular, overlapping, anchored around the 250–819 paper averages. ΔL: Falling / Stable / Rising. Point at the smooth overlap — no gaps, no dead zones. This is the "fuzzify" step from the intro script, made concrete. | 2a. Membership functions (10) |
| 4 | 3:05–4:15 | 4:15 | Rule base | Fuzzy panel → rule matrix (12 rules, `R01`–`R12`) | Walk one row: e.g. R09 "Bright + Rising → FastClose" — the exact example from the intro script. Explain the matrix is a complete 4×3 cross of Light × ΔL sets, each mapped to a Motor Command linguistic output (FastOpen…Stop…FastClose). Built and reviewed by both devs. | 2b. Rule base (10) |
| 5 | 4:15–5:25 | 5:25 | Inference mechanics | Fuzzy panel → active rules + aggregated output, or Explain panel | Live values → fuzzified memberships → rules fire in parallel (min for AND) → outputs aggregated (max) → centroid defuzzification → single crisp `motorCommand` in [-1, 1]. This is the actual Mamdani min→max→centroid pipeline, not a lookup table. | 2c. Inference mechanics (10) |
| 6 | 5:25–6:50 | 6:50 | **Live demo** | Controls tab, drag sliders | Drag Light 100→450→850, toggle ΔL −/+. Narrate the scene: blinds animate, motor command updates live, active rules re-highlight in real time. This is the core "it actually works" moment — don't rush it. | 3a. Live demo (20) |
| 7 | 6:50–7:30 | 7:30 | Preset scenarios (ΔL payoff) | Testing panel presets: **Sudden Brightening** vs **Sudden Darkening** | Same-ish light level, opposite trend → opposite/attenuated motor response. This is the concrete proof that ΔL (not just L) matters — the "trend-aware" claim from the intro script, live. | 3a / 1 (fuzzy suitability payoff) |
| 8 | 7:30–8:00 | 8:00 | Control surface + anti-threshold | Charts tab → 3D control surface (Plotly) | Smooth continuous surface, no cliff/step at the old 499↔500 boundary — visually proves the "no chatter" claim from the intro. | 4b. Visualizations (10) |
| 9 | 8:00–8:35 | 8:35 | Edge / robustness testing | Testing panel: extremes (0, 1023) + noise preset if available, or narrate T5–T8 from plan §7 | Extremes don't crash or spike; small jitter (±5) around a stable point doesn't flicker the output. 17 pytest cases pass (`docs/PHASE7.md`). | 3b. Edge testing (5) |
| 10 | 8:35–10:00 | 10:00 | Explain panel → Q&A bridge | Fuzzy panel → "Explain Current Output" expanded | For the current slider position, read off: fuzzified membership degrees → which rules fired and their activation strength → aggregated fuzzy output → centroid math → final crisp command. This panel *is* your Q&A defense — invite questions here. | 3c. Q&A defense (10), 4a. Documentation (10) |

**Total: 10:00.** Beats 1–5 (intro/setup/theory) run ~5:25; beats 6–10
(proof/demo) run ~4:35 — the intro now carries real weight since it argues
the *why*, but the live system (beat 6, worth 20 points) still gets the
single largest block of time.

## Presenter prep checklist

- [ ] Rehearse the intro script (above) enough to say it without reading —
      it's the only beat scored purely on how well you *argue* the idea,
      not on what's on screen.
- [ ] Both servers running (`flask run` on :5000, `npm run dev` on :5173) —
      confirm with a slider drag before presenting, not during.
- [ ] Browser zoomed so charts + rule matrix are readable from the back of
      the room.
- [ ] Both presenters can explain every MF breakpoint, every rule, and the
      centroid formula cold — quiz each other once before presenting
      (IMPLEMENTATION_PLAN.md §5.3 / §10 risk: "Q&A stumble").
- [ ] Know the answer to "why not just use if/else thresholds" without
      reading it off a slide — it's the whole point of the intro script and
      beat 7.
- [ ] If Wi-Fi/projector is unreliable, have `docs/figures/mf-*.png`,
      `phase7-boundary.png`, `phase7-fast-close.png` as static fallback
      slides — you can present from the PNGs alone if the live app fails.

## If a question runs long

Beats 6 (live demo) and 10 (Explain panel) are the only two that can safely
absorb overflow time — everyone will remember the demo, not the intro. Trim
beat 2 (system overview) first if you're behind; it's the lowest-rubric-value
beat on the list. Never cut the intro script short — it's what makes beat 7
(the ΔL payoff) land later.
