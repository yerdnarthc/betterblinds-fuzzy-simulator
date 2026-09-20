// blindGeometry.ts — pure venetian-blind tilt math. No React, no DOM.
// This file exists so the projection + integrator can be verified in node
// instead of only by eyeballing pixels.
//
// Physical model (front elevation view):
// - Each slat is a flat strip of chord W and edge thickness T, tilted by
//   angle φ about its LONG horizontal (X) axis — into/out of the screen.
// - Front-projected vertical extent:  h(φ) = W·sinφ + T·cosφ.
// - OPEN  = edge-on (thin slivers, gaps, light passes).  CLOSED = face-on
//   (wide overlap, sealed). Semantic rule: open admits, closed blocks.
// - All slats share one tilt. Y centers never move during pure tilt.
//
// Actuation model (persistent signal, not one-shot animation):
// - The fuzzy backend outputs a NORMALIZED motor command u in [-1, 1]:
//   negative = opening, 0 = stop, positive = closing, |u| = actuator speed.
// - The scene owns a persistent tilt state and integrates the LATEST
//   command every frame:  tilt += (u / FULL_SWEEP_S) * dt, clamped to
//   [0, 1]. Changing fuzzy inputs updates u; the blinds keep traveling
//   until a limit is reached. MFs never touch duration or position.

export const OPEN_PHI_DEG = 3 // slats near edge-on: a visible sliver, never gone
export const CLOSED_PHI_DEG = 80 // near face-on: overlap without degenerate flat
export const SLAT_CHORD = 29 // physical slat width: wide enough that faces start
// overlapping around half-tilt (so sealing reads early), still thin edge-on
export const SLAT_EDGE = 2.5 // edge thickness seen at fully open (thin but present)

// Canonical blind state, shared by every slat (mechanically linked).
// 0 = fully open, 1 = fully closed. Always clamped — see tiltOf.
export function tiltOf(progress: number): number {
  const t = Math.min(1, Math.max(0, progress))
  const phiDeg = OPEN_PHI_DEG + (CLOSED_PHI_DEG - OPEN_PHI_DEG) * t
  return (phiDeg * Math.PI) / 180
}

// Projected vertical extent h(φ). Monotonic in tilt: gaps seal as it grows.
export function projectedHeight(phiRad: number): number {
  return SLAT_CHORD * Math.sin(phiRad) + SLAT_EDGE * Math.cos(phiRad)
}

// 0 at open → 1 at closed. Drives face shading, gap shadows, overlap.
export function faceLight(phiRad: number): number {
  const openPhi = (OPEN_PHI_DEG * Math.PI) / 180
  const closedPhi = (CLOSED_PHI_DEG * Math.PI) / 180
  return (Math.sin(phiRad) - Math.sin(openPhi)) / (Math.sin(closedPhi) - Math.sin(openPhi))
}

// --- persistent actuator integration (mirrors backend/app.py) ---

// Commands at or below this magnitude count as stop. Must match the
// backend's MOTOR_STOP_BAND or the two sides disagree on stillness.
export const TILT_DEADBAND = 0.05

// Seconds for a full 0→1 sweep at |u| = 1. Real tilt motors take several
// seconds for their ~75° of travel, so 6s: at typical fast-close u≈0.68 a
// half sweep takes ~4.4s (deliberate, physical), while slow commands
// (|u|≈0.2) visibly creep — magnitude IS speed, the core of the model.
export const FULL_SWEEP_S = 6.0

// Largest dt the integrator believes: tab-switch gaps don't teleport blinds.
export const MAX_DT_S = 0.1

// One integration step. Pure + clamped: tilt never leaves [0, 1] no matter
// how long a command persists (limit stall), and reversing just works
// because only the sign of u matters, never animation history.
export function integrateTilt(tilt: number, command: number, dtSeconds: number): number {
  if (Math.abs(command) <= TILT_DEADBAND) return tilt
  const dt = Math.min(Math.max(0, dtSeconds), MAX_DT_S)
  const next = tilt + (command / FULL_SWEEP_S) * dt
  return Math.min(1, Math.max(0, next))
}

// True while the motor is physically driving (commanded AND not stalled
// against a limit). The spoke spins on this — never on a tween timer.
export function isDriving(tilt: number, command: number): boolean {
  if (Math.abs(command) <= TILT_DEADBAND) return false
  if (command > 0 && tilt >= 1) return false
  if (command < 0 && tilt <= 0) return false
  return true
}
