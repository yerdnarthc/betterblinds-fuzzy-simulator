// sunlight.ts — WebGL sunlight shader + uniform plumbing. No React.
// The fragment shader evaluates per-pixel directional light with analytic
// slat occlusion; this module owns the GLSL source and the uniform mapping
// from simulation state (tilt / sun / intensity / window geometry).
//
// Model (§9-§11): for each room pixel OUTSIDE the window rect, march
// backwards along -sunDir to the WINDOW RECTANGLE (slab test — every window
// column is an emitter, not just the right edge). If the crossing lands on a
// slat face -> blocked; in a gap -> transmitted. Coverage uses smoothstep
// (analytic penumbra, §14) over the SAME shared half-height every slat has,
// so tilt changes reshape light continuously (§5, §21). Falloff with travel
// distance (§15); small ambient lift so shut rooms never go black (§16).

// ViewBox the shader maps to. MUST match the SVG viewBox in ClassroomScene.
export const VIEW_W = 640
export const VIEW_H = 420

// Window + slat layout. MUST match WIN / SLAT_COUNT in ClassroomScene.
export const WIN_X = 36
export const WIN_Y = 56
export const WIN_W = 250
export const WIN_H = 250
export const SLAT_COUNT = 10

export interface SunlightUniformState {
  sunDirX: number // unit vector, pointing INTO the room (down-right)
  sunDirY: number
  sunLevel: number // 0..1 intensity (how much light exists)
  slatHalfH: number // projected half-height, viewBox units (shared by all slats)
  ambient: number // 0..1 secondary room lift (from admitted light)
}

// Bloom strength: how much scattered light bleeds around bright patches.
// Tuned const, deliberately NOT a UI slider — glow is presentation polish,
// not a simulation input. 0.65 = bold airbrush glow under Screen blending.
export const GLOW_STRENGTH = 0.65

// Fullscreen-triangle vertex: pixi-independent, plain NDC passthrough.
export const SUNLIGHT_VERTEX = /* glsl */ `
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

export const SUNLIGHT_FRAGMENT = /* glsl */ `
precision mediump float;
in vec2 vUv;
out vec4 finalColor;

uniform vec2 uSunDir;
uniform float uSunLevel;
uniform float uSlatHalfH;
uniform vec4 uWinRect;   // x, y, w, h (viewBox units)
uniform float uSlatGap;
uniform float uSlatCount;
uniform vec2 uViewBox;   // 640, 420
uniform float uAmbient;
uniform vec3 uSunColor;
uniform float uGlow;     // bloom strength (tuned const, not a slider)

// Coverage of point y by the slat whose center is nearest: 1 = fully
// blocked, 0 = clear gap. Two factors multiply:
//   edge    — smoothstep penumbra around the slat face (soft shadow edge);
//   openness — the row's actual aperture scaled to penumbra width.
// openness is the key: penumbra cannot outlive the aperture feeding it, so
// a hairline seal reads sealed instead of leaking a soft glow everywhere.
// Returns 1 (blocked) when the row is sealed shut.
//
// Penumbra is deliberately WIDE (±5): sunrays cast soft, airy edges rather
// than hard theatrical stripes. Aperture-scaling keeps sealed rows sealed.
float slatCover(float y) {
  float firstCenter = uWinRect.y + uSlatGap * 0.5;
  float rel = (y - firstCenter) / uSlatGap;
  float nearest = floor(rel + 0.5);
  // Edge rows govern the frame lines: a crossing exactly on the sill/top
  // glass edge belongs to the nearest slat row (light under the bottom slat
  // is controlled by it), so clamp instead of special-casing. Sealing still
  // holds because the openness factor (below) zeroes sealed rows.
  nearest = clamp(nearest, 0.0, uSlatCount - 1.0);
  float center = firstCenter + nearest * uSlatGap;
  float d = abs(y - center);
  float edge = 1.0 - smoothstep(uSlatHalfH - 5.0, uSlatHalfH + 5.0, d);
  float aperture = uSlatGap - 2.0 * uSlatHalfH;
  float openness = clamp(aperture / 10.0, 0.0, 1.0);
  return 1.0 - (1.0 - edge) * openness;
}

// Direct light at one room point: march backwards along -sunDir and
// intersect the WINDOW RECTANGLE (slab test), so every window column emits —
// this is the full-width directional field, not a single-plane fan. Blocked
// by slats at the crossing Y, else falloff with travel distance.
// Returns 0 outside the window's light path (never negative, never NaN:
// the slab comparisons stay finite; a zero direction component yields
// infinities that safely fail the enter<exit test).
float directLight(vec2 p) {
  vec2 b = -uSunDir;
  vec2 t0 = (vec2(uWinRect.x, uWinRect.y) - p) / b;
  vec2 t1 = (vec2(uWinRect.x + uWinRect.z, uWinRect.y + uWinRect.w) - p) / b;
  vec2 tmin = min(t0, t1);
  vec2 tmax = max(t0, t1);
  float tenter = max(max(tmin.x, tmin.y), 0.0);
  float texit = min(tmax.x, tmax.y);
  if (!(tenter < texit)) return 0.0;
  vec2 cross = p + b * tenter;
  float transmission = 1.0 - slatCover(cross.y);
  return transmission * exp(-tenter / 1000.0);
}

void main() {
  // Canvas pixel (0,0) is top-left; vUv.y flips to viewBox coords.
  vec2 p = vec2(vUv.x * uViewBox.x, (1.0 - vUv.y) * uViewBox.y);

  // Inside the window rect the SVG glass owns the pixels: emit nothing.
  if (p.x > uWinRect.x && p.x < uWinRect.x + uWinRect.z &&
      p.y > uWinRect.y && p.y < uWinRect.y + uWinRect.w) {
    finalColor = vec4(0.0);
    return;
  }

  // Bloom: sample the SAME occluded field at 8 neighbors in a cross.
  // Because taps read directLight (not a separate glow texture), scattered
  // light hugs open bands, vanishes with closed blinds, and steers with
  // sun angle — all automatically, all deterministic (fixed offsets).
  float glow = 0.0;
  glow += directLight(p + vec2(6.0, 0.0));
  glow += directLight(p + vec2(-6.0, 0.0));
  glow += directLight(p + vec2(0.0, 6.0));
  glow += directLight(p + vec2(0.0, -6.0));
  glow += directLight(p + vec2(12.0, 0.0));
  glow += directLight(p + vec2(-12.0, 0.0));
  glow += directLight(p + vec2(0.0, 12.0));
  glow += directLight(p + vec2(0.0, -12.0));
  glow *= 0.125;

  float direct = uSunLevel * directLight(p);

  // Gate: scattered light radiates FROM bright pixels. Without this, bloom
  // would lift fully-dark regions (e.g. a shut room's hairline slat leaks)
  // into a visible glow. Gated bloom hugs real patches and dies in darkness.
  float gate = smoothstep(0.0, 0.3, direct);
  float scattered = uGlow * glow * uSunLevel * gate;

  // Baseline ambient so a shut room stays readable. Secondary only —
  // kept low so closed blinds still read dark against lit states.
  float amb = uAmbient * 0.15;
  float strength = clamp(direct + scattered + amb * uSunLevel, 0.0, 1.0);
  finalColor = vec4(uSunColor * strength, strength);
}
`
