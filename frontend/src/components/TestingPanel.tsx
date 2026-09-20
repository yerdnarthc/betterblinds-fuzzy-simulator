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

export default function TestingPanel({ activePreset, onPreset }: TestingPanelProps) {
  return (
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
  )
}
