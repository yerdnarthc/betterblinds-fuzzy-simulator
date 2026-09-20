import { useEffect, useRef, useState } from 'react'
import './ClassroomScene.css'
import {
  TILT_DEADBAND,
  faceLight,
  integrateTilt,
  isDriving,
  projectedHeight,
  tiltOf,
} from './blindGeometry'
import {
  DEFAULT_SUN_ANGLE_DEG,
  rowAperture,
  sunDirection,
} from './lighting'
import LightingLayer from './lighting/LightingLayer'
import type { MotorDirection } from '../types'

// Props are plain numbers/strings: App.tsx owns inputs + latest command,
// this file owns the persistent tilt plant and only draws it. lightChange
// is shown on the chalkboard so both fuzzy inputs are visible in the scene.
interface ClassroomSceneProps {
  lightIntensity: number // 0-1023 from the slider (drives sun + LDR even if backend is down)
  lightChange: number // -200..200 from the slider (chalkboard display only)
  motorCommand: number // -1..1 normalized actuator velocity from the API (0 when no result yet)
  direction: MotorDirection // 'open' | 'stop' | 'close'
  sunAngle: number // degrees from vertical; + = sun upper-left, rays lean right
  debugRays: boolean // dev overlay: apertures, rays, floor hits (presentation hides it)
}

// --- tiny math helpers (kept here so the drawing code reads plainly) ---

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}

// Blend between two hex colors. t=0 -> dim, t=1 -> bright.
function mixHex(dim: string, bright: string, t: number): string {
  const d = [1, 3, 5].map((i) => parseInt(dim.slice(i, i + 2), 16))
  const b = [1, 3, 5].map((i) => parseInt(bright.slice(i, i + 2), 16))
  const mixed = d.map((dv, i) => Math.round(dv + (b[i] - dv) * clamp(t, 0, 1)))
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

// --- motion language: the 7 states a viewer must identify at a glance ---
// Bands mirror the backend's stop deadband (|u| <= 0.05) and split the rest
// into slow / normal / fast so SLOW vs FAST is unmistakable.
type MotionLevel = 0 | 1 | 2 | 3

function motionLevel(motorCommand: number): MotionLevel {
  const strength = Math.abs(motorCommand)
  if (strength <= TILT_DEADBAND) return 0
  if (strength <= 0.4) return 1
  if (strength <= 0.75) return 2
  return 3
}

function motionLabel(direction: MotorDirection, level: MotionLevel): string {
  if (level === 0 || direction === 'stop') return 'STOPPED'
  const verb = direction === 'close' ? 'CLOSE' : 'OPEN'
  if (level === 1) return `SLOW ${verb}`
  if (level === 2) return verb === 'CLOSE' ? 'CLOSING' : 'OPENING'
  return `FAST ${verb}`
}

function motionGlyphs(direction: MotorDirection, level: MotionLevel): string {
  if (level === 0 || direction === 'stop') return '■'
  const arrow = direction === 'close' ? '▼' : '▲'
  return arrow.repeat(level)
}

// Persistent tilt plant: integrates the LATEST command every animation
// frame until a limit is reached. Changing fuzzy inputs only updates u —
// the blinds keep traveling on whatever u currently says. No finite
// tween, no duration derived from MFs, nothing to retarget or settle.
// (Reduced-motion users keep this integration: it is user-driven plant
// state, not decoration. The CSS rotor/chevron motion stays disabled
// for them via prefers-reduced-motion.)
function useIntegratedTilt(command: number): number {
  const [tilt, setTilt] = useState(0.5) // start half-closed
  const tiltRef = useRef(0.5)
  const cmdRef = useRef(command)
  // Latest-command handoff lives in an effect, never in render: the rAF
  // loop below reads cmdRef each frame, so it always sees fresh input.
  useEffect(() => {
    cmdRef.current = command
  })

  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const next = integrateTilt(tiltRef.current, cmdRef.current, dt)
      // setTilt only on real change: parked loop costs one compare/frame.
      if (next !== tiltRef.current) {
        tiltRef.current = next
        setTilt(next)
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [])

  return tilt
}

// Sun brightness glides toward its target (~0.8s) instead of teleporting:
// jumping the Light slider reads as fast-moving cloudbreak, and it settles
// exactly. Reduced-motion users get the jump-free truth instantly.
function useGlide(target: number): number {
  const [value, setValue] = useState(target)
  const shown = useRef(target)
  const [reduceMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (reduceMotion) {
      shown.current = target
      return
    }
    const from = shown.current
    if (from === target) return
    let frame = 0
    const start = performance.now()
    const duration = 800
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration)
      const eased = k < 0.5 ? 4 * k * k * k : 1 - ((-2 * k + 2) ** 3) / 2
      const v = from + (target - from) * eased
      shown.current = v
      setValue(v)
      if (k < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, reduceMotion])

  return reduceMotion ? target : value
}

// Window geometry, shared by glass / slats / frame so they always line up.
const WIN = { x: 36, y: 56, w: 250, h: 250 }
const SLAT_COUNT = 10

export default function ClassroomScene({
  lightIntensity,
  lightChange,
  motorCommand,
  direction,
  sunAngle = DEFAULT_SUN_ANGLE_DEG,
  debugRays = false,
}: ClassroomSceneProps) {
  // Persistent plant state: survives renders, integrates per frame.
  const tilt = useIntegratedTilt(motorCommand)

  // How bright the sun looks: 0 (night) -> 1 (harsh noon). EASED — every
  // visual use below (glass, sun, bands, halo, ambient, shader uniform)
  // follows this; exact readings (LDR text, aria) keep the raw slider value.
  const sunLevel = useGlide(clamp(lightIntensity / 1023, 0, 1))
  // Front projection of the shared tilt about the long horizontal axis:
  // open = edge-on thin slivers, closed = face-on overlap. Y centers frozen.
  const slatPhi = tiltOf(tilt)
  const slatH = projectedHeight(slatPhi)
  const face = faceLight(slatPhi)
  // Light actually entering the room: bright sun means nothing if blinds shut.
  // Driven by the integrated tilt, so room and slats tell one physical story.
  const admitted = sunLevel * (1 - tilt)

  const level = motionLevel(motorCommand)
  const driving = isDriving(tilt, motorCommand)
  // Stalled = commanded but parked at a limit (motor straining, blinds still).
  const stalled =
    Math.abs(motorCommand) > TILT_DEADBAND && !driving && direction !== 'stop'
  const stateLabel = motionLabel(direction, level) + (stalled ? ' · AT LIMIT' : '')
  const stateGlyphs = motionGlyphs(direction, level)

  // No-sun baseline runs DARK on purpose: deep dim ends give the
  // screen-blended sunlight real contrast to pop against. Bright ends stay
  // warm so a sunlit room still glows; secondary to the geometric bands.
  // Sky kept BLUE-GREY even at low sun (overcast day, not night).
  const skyFill = mixHex('#6c8496', '#c2e5ff', sunLevel)
  const glassFill = mixHex('#1a2a36', '#fff3c4', sunLevel)
  const wallFill = mixHex('#121a1f', '#e8dcc0', 0.15 + 0.85 * admitted)

  // Slat layout: frozen Y centers, even spacing. Only extent + shading move.
  const slatGap = WIN.h / SLAT_COUNT

  // ===== shared light direction (§7): ONE vector drives the WebGL shader
  // (via LightingLayer uniforms) AND the SVG debug arrow below. The shader
  // owns all direct-light pixels; the SVG keeps only debug geometry.
  const sunDir = sunDirection(sunAngle)
  // Sun disc drifts slightly with angle around the window CENTER (same sky,
  // viewed through glass). Centered travel so the decor stops testifying
  // for a point source — direction comes from the shared vector, not the icon.
  const sunCx = clamp(WIN.x + 125 + (sunAngle - DEFAULT_SUN_ANGLE_DEG) * 1.5, WIN.x + 40, WIN.x + WIN.w - 40)

  // Spoke follows the PHYSICAL drive: spins while integrating, speed from
  // command magnitude (|u| IS actuator speed), direction from command sign.
  // Paused in the deadband AND when stalled at a limit.
  const spinDuration = `${(1.6 - 1.4 * clamp(Math.abs(motorCommand), 0, 1)).toFixed(2)}s`
  const spinDirection = motorCommand >= 0 ? 'normal' : 'reverse'

  // Chevron march speed follows the same level: 1 slow pulse .. 3 fast march.
  const chevronDuration = level === 1 ? '0.9s' : level === 2 ? '0.55s' : '0.32s'

  const summary =
    `Sun ${lightIntensity}/1023, blinds ${Math.round(tilt * 100)}% closed, ` +
    `motor ${stateLabel} (${motorCommand}).`

  return (
    <figure className="scene">
      {/* stage: SVG defines the box; the WebGL layer overlays it 1:1.
          Canvas is pointer-events:none so UI stays SVG-driven (§32). */}
      <div className="scene-stage">
      <svg
        viewBox="0 0 640 420"
        role="img"
        aria-label={`Classroom simulation. ${summary}`}
      >
        <title>Classroom blinds simulation</title>

        {/* room shell */}
        <rect x="0" y="0" width="640" height="300" fill={wallFill} className="px" />
        <rect x="0" y="300" width="640" height="120" fill="#222a2e" className="px" />
        <rect x="0" y="296" width="640" height="6" fill="#121a1f" className="px" />
        {/* floor planks */}
        <line x1="0" y1="356" x2="640" y2="356" stroke="#161d20" strokeWidth="2" />
        <line x1="0" y1="390" x2="640" y2="390" stroke="#161d20" strokeWidth="2" />

        {/* wall clock */}
        <circle cx="610" cy="34" r="20" fill="#e8e4da" stroke="#1c2b30" strokeWidth="4" className="px" />
        <line x1="610" y1="34" x2="610" y2="22" stroke="#1c2b30" strokeWidth="3" />
        <line x1="610" y1="34" x2="619" y2="38" stroke="#1c2b30" strokeWidth="3" />

        {/* ===== HERO: window with venetian blinds ===== */}
        {/* sky behind the glass: blue-grey even when dim (overcast day, not
            night). Glass sits on top as a warm tint, so slats stay legible. */}
        <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} fill={skyFill} className="px" />
        {/* sky glass tint over the sky */}
        <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} fill={glassFill} opacity={0.45} className="px" />
        {/* sun disc inside the window: faint but never gone — "where's the
            light coming from" stays readable even on an overcast day. */}
        <g opacity={0.06 + 0.52 * sunLevel}>
          <circle cx={sunCx} cy={WIN.y + 44} r="22" fill="#ffcf4d" />
          {Array.from({ length: 6 }, (_, i) => {
            const angle = (i * Math.PI) / 3 + 0.3
            return (
              <line
                key={i}
                x1={sunCx + Math.cos(angle) * 28}
                y1={WIN.y + 44 + Math.sin(angle) * 28}
                x2={sunCx + Math.cos(angle) * 38}
                y2={WIN.y + 44 + Math.sin(angle) * 38}
                stroke="#ffcf4d"
                strokeWidth="4"
                strokeLinecap="round"
              />
            )
          })}
        </g>
        {/* glare halo around the sun: grows with intensity, independent of
            blinds — also faint at low sun, but never zero. */}
        <circle cx={sunCx} cy={WIN.y + 44} r="70" fill="url(#sunGlow)" opacity={0.12 + 0.52 * sunLevel} />
        {/* trend glyph: makes the ΔL input VISIBLE — rising ▲ / falling ▼ /
            stable (hidden). Opacity follows magnitude; matches Stable's ±15
            flat top so glyph and fuzzy input never disagree. */}
        {Math.abs(lightChange) > 15 && (
          <text
            x={sunCx + 34}
            y={WIN.y + 52}
            className="px-text"
            fontSize="20"
            fill="#fec837"
            opacity={clamp(Math.abs(lightChange) / 80, 0.3, 1)}
          >
            {lightChange > 0 ? '▲' : '▼'}
          </text>
        )}
        {/* venetian slats: one shared tilt, frozen Y centers, projected face.
            NO screen-plane rotation: in this front view the tilt axis IS the
            horizontal slat axis, so tilt shows as growing vertical extent +
            face shading, not as spinning cards. Painted top-first so lower
            slats overlap upper ones consistently (no z-fighting). */}
        {Array.from({ length: SLAT_COUNT }, (_, i) => {
          const cy = WIN.y + slatGap * i + slatGap / 2
          const top = cy - slatH / 2
          const highlightH = Math.max(2, slatH * 0.32)
          return (
            <g key={i}>
              {/* contact shadow under the slat face */}
              <rect
                x={WIN.x + 5}
                y={top + 2}
                width={WIN.w - 10}
                height={slatH}
                fill="#1c2b30"
                opacity={0.12 + 0.3 * face}
              />
              {/* slat face: brightens as it turns toward the viewer */}
              <rect
                x={WIN.x + 5}
                y={top}
                width={WIN.w - 10}
                height={slatH}
                fill={mixHex('#cfc9ba', '#f4efe2', face)}
                stroke="#8d8574"
                strokeWidth="1.5"
              />
              {/* upper-surface highlight: the visible face catching light.
                  Scales with BOTH tilt-face and sun level — slats go dark
                  at night instead of glowing on their own. */}
              <rect
                x={WIN.x + 5}
                y={top}
                width={WIN.w - 10}
                height={highlightH}
                fill="#fff7e0"
                opacity={(0.15 + 0.55 * face) * (0.3 + 0.7 * sunLevel)}
              />
            </g>
          )
        })}
        {/* ladder cords: STATIC framing lines. Tilt happens between them;
            pure tilt never moves cords, rails, or slat centers. */}
        {[WIN.x + 46, WIN.x + WIN.w - 46].map((cx) => (
          <line
            key={cx}
            x1={cx}
            y1={WIN.y + 4}
            x2={cx}
            y2={WIN.y + WIN.h - 4}
            stroke="#8d8574"
            strokeWidth="2.5"
          />
        ))}
        {/* bottom rail: FIXED on the sill. Tilt is not lift — the stack
            never travels, only slat orientation changes. */}
        <rect
          x={WIN.x - 6}
          y={WIN.y + WIN.h - 4}
          width={WIN.w + 12}
          height="12"
          fill="#c98f2e"
          stroke="#1c2b30"
          strokeWidth="3"
          className="px"
        />
        {/* sun wash across the WHOLE slat stack: sunlight landing ON the
            blinds, not just passing through. Clipped to glass, sheared along
            the shared sun vector, and gated by live openness — as slats seal,
            the wash dies with the gaps (same rowAperture the debug ticks and
            shader occlusion derive from). */}
        <g clipPath="url(#winClip)">
          <rect
            x={WIN.x - 120}
            y={WIN.y - 40}
            width={WIN.w + 240}
            height={WIN.h + 80}
            fill="url(#sunWash)"
            opacity={
              0.55 * sunLevel * clamp(rowAperture(slatH, slatGap) / 10, 0, 1)
            }
          />
        </g>
        {/* chunky window frame on top of everything */}
        <rect
          x={WIN.x - 8}
          y={WIN.y - 8}
          width={WIN.w + 16}
          height={WIN.h + 16}
          fill="none"
          stroke="#1c2b30"
          strokeWidth="10"
          className="px"
        />

        {/* ===== motion chevrons: direction + speed at a glance ===== */}
        {/* closing = march down, opening = march up, stopped = hidden */}
        {level > 0 && (
          <g
            fill={direction === 'close' ? '#fd9978' : '#2dd4bf'}
            className={direction === 'close' ? 'chev-down' : 'chev-up'}
            style={{ animationDuration: chevronDuration }}
          >
            {Array.from({ length: level }, (_, i) => {
              const cy = 150 + i * 26 - ((level - 1) * 26) / 2
              const points =
                direction === 'close'
                  ? `296,${cy} 316,${cy} 306,${cy + 12}`
                  : `296,${cy + 12} 316,${cy + 12} 306,${cy}`
              return <polygon key={i} points={points} className="px" />
            })}
          </g>
        )}

        {/* ===== blackboard lab readout (diegetic chalk) ===== */}
        <rect x="336" y="56" width="268" height="150" fill="#2f4f4a" stroke="#1c2b30" strokeWidth="8" className="px" />
        <text x="350" y="84" className="px-text chalk-title">FUZZY LAB</text>
        <text x="350" y="106" className="px-text chalk">{`LDR L=${lightIntensity}`}</text>
        <text x="350" y="128" className="px-text chalk">{`dL=${lightChange >= 0 ? '+' : ''}${lightChange}`}</text>
        <text x="350" y="150" className="px-text chalk">{`U=${motorCommand.toFixed(2)}`}</text>
        <text x="350" y="172" className="px-text chalk">{`SUN ${sunAngle}°`}</text>
        <text x="350" y="194" className="px-text chalk-state">
          {`${stateGlyphs} ${stateLabel}`}
        </text>

        {/* ===== light-source defs (SVG-owned) ===== */}
        {/* Direct floor light now lives in the WebGL layer (LightingLayer):
            per-pixel occlusion, penumbra, and falloff in-shader. The SVG
            keeps only the sun glare that belongs to the SOURCE itself. */}
        <defs>
          {/* sun halo: glare that grows with intensity, not with blinds */}
          <radialGradient id="sunGlow" gradientUnits="userSpaceOnUse" cx={sunCx} cy={WIN.y + 44} r="70">
            <stop offset="0" stopColor="#fff6d8" stopOpacity="0.9" />
            <stop offset="1" stopColor="#fff6d8" stopOpacity="0" />
          </radialGradient>
          {/* window clip: the sun wash below never leaves the glass area */}
          <clipPath id="winClip">
            <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} />
          </clipPath>
          {/* wash gradient runs ALONG the shared sun vector (steers with angle) */}
          <linearGradient
            id="sunWash"
            gradientUnits="userSpaceOnUse"
            x1={WIN.x}
            y1={WIN.y}
            x2={WIN.x + sunDir.x * 320}
            y2={WIN.y + sunDir.y * 320}
          >
            <stop offset="0" stopColor="#fff3c4" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ffedb0" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ===== debug overlay (§39/§41): full-window directional ray grid ===== */}
        {/* Hidden in presentation. Origins sample the WHOLE aperture (not one
            corner): shared sunDir, X marks where slats block. Row openness
            comes from the SAME slatH the slats draw and the shader marches. */}
        {debugRays && (
          <g>
            {[70, 120, 170, 220, 260].flatMap((ox) =>
              [100, 150, 200, 250].map((oy) => {
                const blocked = rowAperture(slatH, slatGap) < 3
                const ex = ox + sunDir.x * 110
                const ey = oy + sunDir.y * 110
                return blocked ? (
                  <g
                    key={`${ox}-${oy}`}
                    stroke="#c0392b"
                    strokeWidth="3"
                    strokeLinecap="round"
                  >
                    <line x1={ox - 5} y1={oy - 5} x2={ox + 5} y2={oy + 5} />
                    <line x1={ox + 5} y1={oy - 5} x2={ox - 5} y2={oy + 5} />
                    <line
                      x1={ox}
                      y1={oy}
                      x2={ox + sunDir.x * 22}
                      y2={oy + sunDir.y * 22}
                      opacity="0.6"
                    />
                  </g>
                ) : (
                  <line
                    key={`${ox}-${oy}`}
                    x1={ox}
                    y1={oy}
                    x2={ex}
                    y2={ey}
                    stroke="#ffedb0"
                    strokeWidth="2"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                )
              }),
            )}
            <line
              x1={560}
              y1={40}
              x2={560 + sunDir.x * 34}
              y2={40 + sunDir.y * 34}
              stroke="#fec837"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <text x={560} y={24} className="px-text scene-tag">
              {`SUN ${sunAngle}°`}
            </text>
          </g>
        )}

        {/* teacher desk + globe */}
        <rect x="352" y="300" width="150" height="60" fill="#6b4f2e" stroke="#1c2b30" strokeWidth="4" className="px" />
        <circle cx="392" cy="282" r="20" fill="#3f8fbf" stroke="#1c2b30" strokeWidth="4" className="px" />
        <path d="M 374 282 A 20 20 0 0 1 410 282" fill="none" stroke="#7ec850" strokeWidth="7" />
        {/* student desk foreground */}
        <rect x="70" y="348" width="150" height="16" fill="#6b4f2e" stroke="#1c2b30" strokeWidth="4" className="px" />
        <rect x="82" y="364" width="10" height="56" fill="#6b4f2e" className="px" />
        <rect x="198" y="364" width="10" height="56" fill="#6b4f2e" className="px" />
        <rect x="96" y="336" width="52" height="12" fill="#e8e4da" stroke="#1c2b30" strokeWidth="3" className="px" />

        {/* LDR sensor dot on the window frame + reading */}
        <circle cx={WIN.x + WIN.w - 14} cy={WIN.y + WIN.h + 22} r="9" fill="#c0392b" stroke="#e8e4da" strokeWidth="3" />
        <text x={WIN.x + WIN.w - 60} y={WIN.y + WIN.h + 50} className="px-text scene-tag">
          {`LDR ${lightIntensity}`}
        </text>

        {/* DC motor above the roller: spoke follows the PHYSICAL drive —
            spins while tilt integrates, speed from |u|, direction from sign.
            Paused in the deadband AND when stalled at a limit. */}
        <g>
          <rect x={WIN.x + 58} y={WIN.y - 48} width="110" height="34" fill="#446668" stroke="#1c2b30" strokeWidth="4" className="px" />
          <circle cx={WIN.x + 113} cy={WIN.y - 31} r="12" fill="#b9cbc9" stroke="#1c2b30" strokeWidth="3" />
          <line
            x1={WIN.x + 113}
            y1={WIN.y - 31}
            x2={WIN.x + 113}
            y2={WIN.y - 40}
            stroke="#c0392b"
            strokeWidth="4"
            strokeLinecap="round"
            className="rotor"
            style={{
              transformOrigin: `${WIN.x + 113}px ${WIN.y - 31}px`,
              animationDuration: spinDuration,
              animationDirection: spinDirection,
              animationPlayState: driving ? 'running' : 'paused',
            }}
          />
          <text x={WIN.x + 40} y={WIN.y - 26} className="px-text scene-tag">MOTOR</text>
        </g>
      </svg>
      {/* GPU light: same tilt/sun/level the SVG just drew with (§23). */}
      <LightingLayer
        tilt={tilt}
        sunAngleDeg={sunAngle}
        sunLevel={sunLevel}
        ambient={admitted}
      />
      </div>

      <figcaption className="scene-readout">
        <span className={`state-badge ${direction === 'stop' || level === 0 ? 'is-stop' : direction === 'close' ? 'is-close' : 'is-open'}`}>
          {`${stateGlyphs} ${stateLabel}`}
        </span>
        <div className="readout-grid">
          <div className="readout-item">
            <span className="readout-k">Blinds</span>
            <span className="readout-v">{Math.round(tilt * 100)}% closed</span>
          </div>
          <div className="readout-item">
            <span className="readout-k">Motor</span>
            <span className="readout-v">U {motorCommand.toFixed(2)}</span>
          </div>
          <div className="readout-item">
            <span className="readout-k">Sensor</span>
            <span className="readout-v">LDR {lightIntensity}/1023</span>
          </div>
        </div>
      </figcaption>
    </figure>
  )
}
