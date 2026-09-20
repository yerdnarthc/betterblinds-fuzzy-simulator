// lighting.ts — pure 2D raycast-style sunlight math. No React, no DOM.
// exist so band geometry can be verified in node instead of by eyeballing.
//
// Model (§36 aperture projection, SVG-compatible):
// - The sun is DIRECTIONAL: all rays share one vector derived from a single
//   configurable angle. Nothing is hard-coded per element.
// - Each slat ROW is an emitter: its open aperture is the gap the projected
//   slat face does NOT cover. Tilt seals apertures; sealed rows emit nothing.
// - Each open aperture projects a quad from the window plane onto the floor
//   along the light vector. Bands narrow/vanish with tilt — never a global
//   opacity fade. floor + wall base tints stay as SECONDARY ambient only.
// - Deterministic: fixed rows, no randomness, clamped outputs (no NaN).

export interface Vec {
  x: number
  y: number
}

export interface FloorBand {
  // aperture edge at the window plane
  ax: number
  topY: number
  botY: number
  // floor hits of the top/bottom rays
  hitTopX: number
  hitBotX: number
  floorY: number
  // 0..1 openness of this row (drives per-band alpha)
  openness: number
}

export const DEFAULT_SUN_ANGLE_DEG = 25 // sun upper-left, rays lean down-right
export const MIN_SUN_ANGLE_DEG = -30
export const MAX_SUN_ANGLE_DEG = 55 // cos stays safely positive: rays always point down

function clampAngle(angleDeg: number): number {
  return Math.min(MAX_SUN_ANGLE_DEG, Math.max(MIN_SUN_ANGLE_DEG, angleDeg))
}

// Unit vector pointing INTO the room. angle 0 = straight down,
// positive = sun to the left (rays lean right). dy > 0 always.
export function sunDirection(angleDeg: number): Vec {
  const a = (clampAngle(angleDeg) * Math.PI) / 180
  return { x: Math.sin(a), y: Math.cos(a) }
}

// Open height of one slat row at the window plane: the gap minus what the
// projected slat face covers. Driven by the SAME slatH the renderer draws
// (§20: single source of truth, no parallel fake geometry).
export function rowAperture(slatH: number, gap: number): number {
  return Math.max(0, gap - slatH)
}

// March a ray from (x, y) along dir until it reaches floorY.
// Returns null only if the ray never descends (impossible for our angles,
// but keeps every caller NaN-proof).
export function rayFloorHit(x: number, y: number, dir: Vec, floorY: number): Vec | null {
  if (!(dir.y > 0)) return null
  const t = (floorY - y) / dir.y
  if (!(t >= 0) || !Number.isFinite(t)) return null
  return { x: x + dir.x * t, y: floorY }
}

// Project one row aperture onto the floor. Returns null when sealed
// (aperture < minOpen) or degenerate. maxX clamps runaway bands to the room.
export function projectBand(
  winX: number,
  centerY: number,
  aperture: number,
  dir: Vec,
  floorY: number,
  maxX: number,
  minOpen = 0.5,
): FloorBand | null {
  if (!(aperture >= minOpen)) return null
  const topY = centerY - aperture / 2
  const botY = centerY + aperture / 2
  const hitTop = rayFloorHit(winX, topY, dir, floorY)
  const hitBot = rayFloorHit(winX, botY, dir, floorY)
  if (!hitTop || !hitBot) return null
  const hx0 = Math.min(maxX, Math.max(0, hitTop.x))
  const hx1 = Math.min(maxX, Math.max(0, hitBot.x))
  // Either ordering is a valid quad (top ray lands further along the lean);
  // only a degenerate sliver is discarded. All four corners share the floor
  // line or the window plane, so the polygon can never self-intersect.
  if (Math.abs(hx1 - hx0) < 0.5) return null
  return { ax: winX, topY, botY, hitTopX: hx0, hitBotX: hx1, floorY, openness: 1 }
}
