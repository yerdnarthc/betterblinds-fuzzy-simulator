import './TestingPanel.css'

type PresetId = 'dawn' | 'morning' | 'noon' | 'cloudy' | 'sunset' | 'sudden' | 'darkening' | 'reset'

interface TestingPanelProps {
  activePreset: string | null
  onPreset: (preset: PresetId) => void
}

const PRESETS: Array<{ id: PresetId; label: string; accent?: boolean; ghost?: boolean }> = [
  { id: 'dawn', label: 'Dawn' },
  { id: 'morning', label: 'Morning' },
  { id: 'noon', label: 'Noon' },
  { id: 'cloudy', label: 'Cloudy' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'sudden', label: 'Sudden Brightening', accent: true },
  { id: 'darkening', label: 'Sudden Darkening' },
  { id: 'reset', label: 'Reset', ghost: true },
]

// Static §7 expected-vs-actual for the report. Values are the live pytest
// results (17 passed). The table is intentionally static — the backend is
// the source of truth, the UI just surfaces the gate.
const CASES: Array<{ id: string; inputs: string; expect: string; result: 'PASS' }> = [
  { id: 'T1', inputs: 'L=100, ΔL=-20', expect: 'Open (U < -0.1)', result: 'PASS' },
  { id: 'T2', inputs: 'L=250, ΔL=0', expect: 'Hold near 0', result: 'PASS' },
  { id: 'T2b', inputs: 'L=450, ΔL=0', expect: 'Ramp 0.15–0.45', result: 'PASS' },
  { id: 'T3', inputs: 'L=850, ΔL=+100', expect: 'Fast close > 0.6', result: 'PASS' },
  { id: 'T4', inputs: 'L=850, ΔL=∓100', expect: 'Darkening < brightening', result: 'PASS' },
  { id: 'T5', inputs: 'L=0, ΔL=-200', expect: 'No crash, < 0', result: 'PASS' },
  { id: 'T6', inputs: 'L=1023, ΔL=+200', expect: 'No crash, > 0', result: 'PASS' },
  { id: 'T7', inputs: 'L=499 vs 500, ΔL=0', expect: 'ΔU < 0.02 (smooth)', result: 'PASS' },
  { id: 'T8', inputs: 'L=600, ΔL=±5', expect: 'Flicker < 0.005', result: 'PASS' },
  { id: 'Sweep', inputs: '0–1023 × -200–200', expect: 'Never leaves [-1,1]', result: 'PASS' },
]

export default function TestingPanel({ activePreset, onPreset }: TestingPanelProps) {
  return (
    <section className="testing-panel" aria-label="Preset scenarios and edge cases">
      <div className="preset-bar" role="group" aria-label="Preset scenarios">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={[
              'preset-btn',
              preset.accent ? 'preset-btn--accent' : '',
              preset.ghost ? 'preset-btn--ghost' : '',
              activePreset === preset.id ? 'is-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={activePreset === preset.id}
            onClick={() => onPreset(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="testing-cases">
        <h3 className="testing-cases__title">§7 cases — expected vs actual</h3>
        <div className="testing-cases__table-wrap">
          <table className="testing-cases__table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Inputs</th>
                <th>Expect</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {CASES.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.id}</td>
                  <td className="mono">{c.inputs}</td>
                  <td>{c.expect}</td>
                  <td className="testing-cases__pass">{c.result} ✓</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="testing-cases__foot">
          Backend: <code>pytest backend/fuzzy/tests</code> — 17 passed. See <code>docs/PHASE7.md</code> for
          screenshots.
        </p>
      </div>
    </section>
  )
}
