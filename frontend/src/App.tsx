import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { evaluateFuzzy } from './api'
import ClassroomScene from './components/ClassroomScene'
import FuzzyPanel from './components/FuzzyPanel'
import type { FuzzyEvaluateResponse } from './types'

// Plotly (with 3D/gl3d support for the control surface) is a multi-MB
// dependency — lazy-loaded so it doesn't block first paint of the scene,
// which is what a viewer sees first and what the animations run on.
const MembershipChart = lazy(() => import('./components/MembershipChart'))
const ControlSurface = lazy(() => import('./components/ControlSurface'))
import './App.css'

function clampDelta(value: number): number {
  return Math.min(200, Math.max(-200, Math.round(value)))
}

function App() {
  // Measured so the fuzzy panel can lock its own height to match the scene
  // exactly (CSS alone can't do this: two grid columns with independent
  // intrinsic heights can't reference each other without JS). Mirrors the
  // ResizeObserver pattern ClassroomScene's LightingLayer already uses.
  const sceneWrapRef = useRef<HTMLDivElement>(null)
  const [sceneHeight, setSceneHeight] = useState(0)

  useEffect(() => {
    const el = sceneWrapRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSceneHeight(entry.contentRect.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const [lightIntensity, setLightIntensity] = useState(742)
  // Manual ΔL (used only when auto-derive is off — e.g. hand-probing the
  // rule matrix for Q&A without moving the Light slider).
  const [manualDelta, setManualDelta] = useState(38)
  // Auto-derive (default ON): ΔL is measured from Light-slider movement like
  // the real LDR would (ΔL = L_t − L_{t−1}), then decays back to Stable.
  const [autoDeltaOn, setAutoDeltaOn] = useState(true)
  const [autoDelta, setAutoDelta] = useState(0)
  const lastLight = useRef(742)
  // Sun angle is a pure presentation parameter (not a fuzzy input): it steers
  // the directional light vector the floor bands project along. -30..55 keeps
  // rays pointing downward. Debug overlay is dev-only, hidden for demos.
  const [sunAngle, setSunAngle] = useState(25)
  const [debugRays, setDebugRays] = useState(false)
  const [result, setResult] = useState<FuzzyEvaluateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Kick: every Light move measures its own delta, clamped to the ΔL domain.
  useEffect(() => {
    const d = lightIntensity - lastLight.current
    lastLight.current = lightIntensity
    if (d !== 0) setAutoDelta(clampDelta(d))
  }, [lightIntensity])

  // Decay: with no movement the trend relaxes back to Stable (~1s).
  useEffect(() => {
    if (!autoDeltaOn || autoDelta === 0) return
    const id = setTimeout(() => {
      setAutoDelta((v) => (Math.abs(v) < 2 ? 0 : v * 0.55))
    }, 180)
    return () => clearTimeout(id)
  }, [autoDeltaOn, autoDelta])

  // Effective ΔL: measured by default, hand-asserted on override.
  const lightChange = autoDeltaOn ? Math.round(autoDelta) : manualDelta

  // This effect ONLY refreshes the motor command (blinds live in the scene
  // as persistent tilt state). Changing inputs updates velocity, never a
  // finite animation.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      evaluateFuzzy({ lightIntensity, lightChange })
        .then((response) => {
          setResult(response)
          setError(null)
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Unknown error')
        })
    }, 150) // debounce so dragging a slider doesn't spam the API

    return () => clearTimeout(timeoutId)
  }, [lightIntensity, lightChange])

  return (
    <div id="app-shell">
      <h1>BetterBlinds Fuzzy Simulator</h1>

      <section
        id="main-panels"
        style={{ '--scene-h': sceneHeight ? `${sceneHeight}px` : '640px' } as CSSProperties}
      >
        <div className="scene-wrap" ref={sceneWrapRef}>
          <ClassroomScene
            lightIntensity={lightIntensity}
            lightChange={lightChange}
            motorCommand={result?.motorCommand ?? 0}
            direction={result?.direction ?? 'stop'}
            sunAngle={sunAngle}
            debugRays={debugRays}
          />
        </div>
        <FuzzyPanel result={result} error={error} />
      </section>

      <section id="controls">
        <label>
          Light Intensity: {lightIntensity}
          <input
            type="range"
            min={0}
            max={1023}
            value={lightIntensity}
            onChange={(e) => setLightIntensity(Number(e.target.value))}
          />
        </label>
        <label className="debug-toggle">
          <input
            type="checkbox"
            checked={autoDeltaOn}
            onChange={(e) => setAutoDeltaOn(e.target.checked)}
          />
          Auto ΔL from Light movement
        </label>
        <label style={{ opacity: autoDeltaOn ? 0.35 : 1 }}>
          Rate of Change: {lightChange}
          {autoDeltaOn ? ' (auto)' : ''}
          <input
            type="range"
            min={-200}
            max={200}
            value={manualDelta}
            disabled={autoDeltaOn}
            title={autoDeltaOn ? 'Measured automatically — uncheck Auto ΔL to drive it by hand' : undefined}
            onChange={(e) => setManualDelta(Number(e.target.value))}
          />
        </label>
        <label>
          Sun Angle: {sunAngle}°
          <input
            type="range"
            min={5}
            max={55}
            value={sunAngle}
            onChange={(e) => setSunAngle(Number(e.target.value))}
          />
        </label>
        <label className="debug-toggle">
          <input
            type="checkbox"
            checked={debugRays}
            onChange={(e) => setDebugRays(e.target.checked)}
          />
          Show light rays (debug)
        </label>
      </section>

      <section id="charts">
        <Suspense fallback={<div className="chart-fallback">Loading charts...</div>}>
          <MembershipChart currentLight={lightIntensity} currentDelta={lightChange} />
          <ControlSurface
            currentLight={lightIntensity}
            currentDelta={lightChange}
            currentMotorCommand={result?.motorCommand ?? 0}
          />
        </Suspense>
      </section>
    </div>
  )
}

export default App
