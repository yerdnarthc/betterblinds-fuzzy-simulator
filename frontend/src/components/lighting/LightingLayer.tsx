import { Component, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Application,
  Geometry,
  GlProgram,
  Mesh,
  Shader,
} from 'pixi.js'
import {
  GLOW_STRENGTH,
  SLAT_COUNT,
  SUNLIGHT_FRAGMENT,
  SUNLIGHT_VERTEX,
  VIEW_H,
  VIEW_W,
  WIN_H,
  WIN_W,
  WIN_X,
  WIN_Y,
} from './sunlight'
import { sunDirection } from '../lighting'
import { projectedHeight, tiltOf } from '../blindGeometry'

// Transparent WebGL lighting overlay, aligned 1:1 over the SVG scene.
// Owns NO simulation state: every uniform derives from props each render,
// so lighting can never drift from the blinds. If WebGL init fails it
// renders nothing and the SVG ambient tints carry the room (graceful).
interface LightingLayerProps {
  tilt: number // 0..1 persistent plant state (single source of truth, §23)
  sunAngleDeg: number // shared light direction, degrees from vertical
  sunLevel: number // 0..1 intensity (how much light exists)
  ambient: number // 0..1 secondary room lift (from admitted light)
}

export default function LightingLayer(props: LightingLayerProps) {
  return (
    <LightingErrorBoundary>
      <LightingCanvas {...props} />
    </LightingErrorBoundary>
  )
}

// Defense in depth: this layer is an optional enhancement — it must NEVER
// blank the page. Any render/commit failure falls back to the SVG room.
class LightingErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

// One WebGL application per page lifetime, shared by every mount.
// WHY (verified 2026-09-20 via headless console): creating + destroying a
// pixi Application on every React mount/unmount (StrictMode does
// mount/unmount/remount in dev, HMR on every save) races async init against
// teardown and trips pixi-internal destroy paths (`_cancelResize`, renderer
// teardown reading `.canvas` of undefined) that throw and unmount the page.
// A singleton removes the race class entirely: init once, reuse, destroy
// only when the page itself goes away.
let sharedApp: Application | null = null
let sharedAppPromise: Promise<Application> | null = null

async function acquireLightingApp(): Promise<Application> {
  if (sharedApp) return sharedApp
  if (!sharedAppPromise) {
    sharedAppPromise = (async () => {
      const app = new Application()
      await app.init({
        backgroundAlpha: 0, // transparent overlay: SVG room shows through
        preference: 'webgl',
        antialias: false,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      })
      // Fail HERE (gracefully) if the environment has no usable GL, instead
      // of throwing later from deep inside pixi internals.
      const renderer = app.renderer as unknown as
        | { resize?: (w: number, h: number) => void }
        | null
        | undefined
      if (!renderer || typeof renderer.resize !== 'function' || !app.canvas) {
        throw new Error('WebGL renderer unavailable')
      }
      sharedApp = app
      // Page-lifetime teardown only — never on component unmount.
      window.addEventListener('pagehide', () => {
        try {
          sharedApp?.destroy(true)
        } catch {
          sharedApp?.canvas.remove()
        } finally {
          sharedApp = null
          sharedAppPromise = null
        }
      })
      return app
    })().catch((err) => {
      // Don't cache failures: a later retry (e.g. after GPU init settles)
      // gets a fresh attempt instead of a poisoned promise.
      sharedAppPromise = null
      throw err
    })
  }
  return sharedAppPromise
}

// Pixi-write boundary: pushes a full uniform snapshot into the LIVE store.
// A module function (not inline mutation) because oxlint's react(immutability)
// heuristic flags member writes on ref-held objects — but direct mutation IS
// pixi's documented uniform API (`group.uniforms.uX = v`), so the write is
// quarantined here with that justification instead of scattered inline.
function writeSunUniforms(
  u: Record<string, number | number[]>,
  s: { dirX: number; dirY: number; sunLevel: number; slatHalfH: number; ambient: number },
): void {
  u.uSunDir = [s.dirX, s.dirY]
  u.uSunLevel = s.sunLevel
  u.uSlatHalfH = s.slatHalfH
  u.uAmbient = s.ambient
}

function LightingCanvas({
  tilt,
  sunAngleDeg,
  sunLevel,
  ambient,
}: LightingLayerProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const meshRef = useRef<Mesh<Geometry, Shader> | null>(null)
  // Live pixi-owned uniform store (NOT our constructor literal — pixi
  // consumes that once at Shader construction; only this object updates
  // the GPU afterwards). See UniformGroup docs: `group.uniforms.uX = v`.
  const shaderRef = useRef<Shader | null>(null)

  // Mount: attach the shared canvas, build this mount's shader scene.
  // Unmount: detach scene + observer only. The Application (and its GL
  // context) is deliberately NOT destroyed here — see acquireLightingApp.
  // Per-mount GPU objects are removed from the stage; the program cache
  // (GlProgram.from) means recompiles don't repeat.
  const [failed, setFailed] = useState(false)
  // Flips true when mount finishes building the scene. Feeds the sync effect
  // below so first-frame uniforms are exact even if mount was slow and no
  // prop has changed since (otherwise the early return on null store would
  // leave neutral defaults parked until the next input change).
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    let observer: ResizeObserver | null = null
    let cancelled = false

    const mount = async () => {
      try {
        const app = await acquireLightingApp()
        if (cancelled || !wrapRef.current) return
        app.canvas.style.width = '100%'
        app.canvas.style.height = '100%'
        app.canvas.style.display = 'block'
        wrap.appendChild(app.canvas)

        // Neutral first-frame values (near-typical sun); the ready-triggered
        // sync effect corrects them to exact props immediately after mount,
        // so this effect stays prop-free by design (no exhaustive-deps).
        const dir0 = { x: 0.42, y: 0.91 }
        const uniforms: Record<string, { value: unknown; type: string }> = {
          uSunDir: { value: [dir0.x, dir0.y], type: 'vec2<f32>' },
          uSunLevel: { value: 1, type: 'f32' },
          uSlatHalfH: { value: 4, type: 'f32' },
          uWinRect: { value: [WIN_X, WIN_Y, WIN_W, WIN_H], type: 'vec4<f32>' },
          uSlatGap: { value: WIN_H / SLAT_COUNT, type: 'f32' },
          uSlatCount: { value: SLAT_COUNT, type: 'f32' },
          uViewBox: { value: [VIEW_W, VIEW_H], type: 'vec2<f32>' },
          uAmbient: { value: 0.5, type: 'f32' },
          uSunColor: { value: [1.0, 0.92, 0.69], type: 'vec3<f32>' },
          uGlow: { value: GLOW_STRENGTH, type: 'f32' },
        }

        const shader = new Shader({
          glProgram: GlProgram.from({
            vertex: SUNLIGHT_VERTEX,
            fragment: SUNLIGHT_FRAGMENT,
          }),
          resources: { light: uniforms },
        })
        // Fullscreen quad in NDC (two triangles, non-indexed).
        const geometry = new Geometry({
          attributes: {
            aPosition: {
              buffer: [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1],
              format: 'float32x2',
            },
          },
        })
        const mesh = new Mesh({ geometry, shader })
        // NORMAL inside the canvas: the canvas carries straight light color
        // + alpha, and the CSS `screen` blend against the SVG room happens in
        // the page compositor (see .light-layer canvas). Additive stacking
        // here would double-brighten once the page screens it again.
        mesh.blendMode = 'normal'
        app.stage.addChild(mesh)
        meshRef.current = mesh
        shaderRef.current = shader
        setReady(true)

        const fit = () => {
          const rect = wrap.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            app.renderer.resize(rect.width, rect.height)
          }
        }
        fit()
        observer = new ResizeObserver(fit)
        observer.observe(wrap)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }

    void mount()
    return () => {
      cancelled = true
      observer?.disconnect()
      shaderRef.current = null
      // Detach only. Destroying per-mount GPU objects here risks the same
      // teardown races the singleton exists to avoid; the shared context
      // is reclaimed on pagehide, and GlProgram caching avoids recompiles.
      meshRef.current?.removeFromParent()
      meshRef.current = null
    }
  }, [])

  // Push simulation state into the LIVE pixi uniform store. Runs on every
  // prop change AND when mount completes (ready), so slow mounts still sync
  // exact first-frame values. See writeSunUniforms for why the write lives
  // in a module function instead of inline.
  useEffect(() => {
    const group = shaderRef.current?.resources.light as unknown as
      | { uniforms: Record<string, number | number[]> }
      | undefined
    const u = group?.uniforms
    if (!u) return
    const dir = sunDirection(sunAngleDeg)
    writeSunUniforms(u, {
      dirX: dir.x,
      dirY: dir.y,
      sunLevel,
      slatHalfH: projectedHeight(tiltOf(tilt)) / 2,
      ambient,
    })
  }, [tilt, sunAngleDeg, sunLevel, ambient, ready])

  if (failed) return null
  return <div ref={wrapRef} className="light-layer" aria-hidden="true" />
}
