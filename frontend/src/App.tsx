import { useEffect, useState } from 'react'
import { evaluateFuzzy } from './api'
import ClassroomScene from './components/ClassroomScene'
import type { FuzzyEvaluateResponse } from './types'
import './App.css'

function App() {
  const [lightIntensity, setLightIntensity] = useState(742)
  const [lightChange, setLightChange] = useState(38)
  // Sun angle is a pure presentation parameter (not a fuzzy input): it steers
  // the directional light vector the floor bands project along. -30..55 keeps
  // rays pointing downward. Debug overlay is dev-only, hidden for demos.
  const [sunAngle, setSunAngle] = useState(25)
  const [debugRays, setDebugRays] = useState(false)
  const [result, setResult] = useState<FuzzyEvaluateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // This effect ONLY refreshes the motor command. The blinds themselves live
  // inside ClassroomScene as persistent tilt state, integrated per animation
  // frame — so holding the sliders still never freezes a nonzero command,
  // and changing inputs updates velocity, never a finite animation.

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

      <section id="main-panels">
        <ClassroomScene
          lightIntensity={lightIntensity}
          lightChange={lightChange}
          motorCommand={result?.motorCommand ?? 0}
          direction={result?.direction ?? 'stop'}
          sunAngle={sunAngle}
          debugRays={debugRays}
        />
        <div id="fuzzy-panel-placeholder">
          <h2>Fuzzy Panel (Phase 5 will style this)</h2>
          {error && (
            <p className="error" role="alert">
              {error}
              <br />
              <small>
                Tip: you need two terminals — backend on :5000 and frontend on :5173. See README Quickstart.
              </small>
            </p>
          )}
          <pre>{result ? JSON.stringify(result, null, 2) : error ? '—' : 'Loading...'}</pre>
        </div>
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
        <label>
          Rate of Change: {lightChange}
          <input
            type="range"
            min={-200}
            max={200}
            value={lightChange}
            onChange={(e) => setLightChange(Number(e.target.value))}
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
    </div>
  )
}

export default App
