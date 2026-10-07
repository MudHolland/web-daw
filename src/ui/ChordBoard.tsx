import { CHORD_TONES, KEYS, nameChord } from '../model/harmony.ts'

type ChordBoardProps = {
  root: string
  tones: number[]
  editing: boolean
  onRoot: (root: string) => void
  onToggle: (semi: number) => void
  onNext: () => void
}

const CORE = CHORD_TONES.filter((tone) => tone.semi <= 11)
const COLOR = CHORD_TONES.filter((tone) => tone.semi > 11)

export function ChordBoard({ root, tones, editing, onRoot, onToggle, onNext }: ChordBoardProps) {
  const selected = [0, ...tones]
  const symbol = nameChord(root, selected)

  return (
    <div className="chord-board" role="group" aria-label="Chord">
      <div className="chord-pick-group">
        <div className="chord-pick-row">
          <span>Root</span>
          {KEYS.map((note) => (
            <button
              key={note}
              type="button"
              className={root === note ? 'chord-key is-on' : 'chord-key'}
              aria-pressed={root === note}
              aria-label={`Root ${note}`}
              onClick={() => onRoot(note)}
            >
              {note}
            </button>
          ))}
        </div>
        <div className="chord-pick-row">
          <span>Tones</span>
          {CORE.map((tone) => {
            const on = tone.semi === 0 || tones.includes(tone.semi)
            return (
              <button
                key={tone.label}
                type="button"
                className={on ? 'chord-key is-on' : 'chord-key'}
                aria-pressed={on}
                aria-label={`Tone ${tone.label}`}
                onClick={() => {
                  if (tone.semi !== 0) onToggle(tone.semi)
                }}
              >
                {tone.label}
              </button>
            )
          })}
        </div>
        <div className="chord-pick-row">
          <span>Color</span>
          {COLOR.map((tone) => {
            const on = tones.includes(tone.semi)
            return (
              <button
                key={tone.label}
                type="button"
                className={on ? 'chord-key is-on' : 'chord-key'}
                aria-pressed={on}
                aria-label={`Tone ${tone.label}`}
                onClick={() => onToggle(tone.semi)}
              >
                {tone.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="chord-commit">
        <p className="chord-symbol" aria-live="polite">
          {symbol}
        </p>
        <button type="button" className="chord-next" disabled={!editing} onClick={onNext}>
          Next
        </button>
        <p className="chord-hint">This chord stays editable until you press Next. The one after that is new.</p>
      </div>
    </div>
  )
}
