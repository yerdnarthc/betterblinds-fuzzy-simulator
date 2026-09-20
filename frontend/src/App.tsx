import { useEffect, useState } from 'react'
import { evaluateFuzzy } from './api'
import type { FuzzyEvaluateResponse } from './types'
import './App.css'

function App() {
  const [lightIntensity, setLightIntensity] = useState(742)
  const [lightChange, setLightChange] = useState(38)
  const [result, setResult] = useState<FuzzyEvaluateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        <div id="scene-placeholder">Classroom scene lands in Phase 4</div>
        <div id="fuzzy-panel-placeholder">
          <h2>Fuzzy Panel (Phase 5 will style this)</h2>
          {error && <p className="error">{error}</p>}
          <pre>{result ? JSON.stringify(result, null, 2) : 'Loading...'}</pre>
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
      </section>
    </div>
  )
}

export default App
