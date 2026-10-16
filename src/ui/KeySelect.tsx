import { formatKeyShift, KEY_SHIFTS } from '../model/harmony.ts'

type KeySelectProps = {
  songKey: string
  offset: number
  onChange: (offset: number) => void
  testId?: string
  ariaLabel: string
  className?: string
}

export function KeySelect({ songKey, offset, onChange, testId, ariaLabel, className }: KeySelectProps) {
  return (
    <select
      aria-label={ariaLabel}
      data-testid={testId}
      className={className}
      value={String(offset)}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {KEY_SHIFTS.map((shift) => (
        <option key={shift} value={shift}>
          {formatKeyShift(songKey, shift)}
        </option>
      ))}
    </select>
  )
}
