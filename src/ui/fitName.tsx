export function FitName({ name, className }: { name: string; className?: string }) {
  const trimmed = name.trim()
  const tokens = trimmed.split(/[\s_]+/).filter(Boolean)
  const last = tokens.length > 1 ? tokens[tokens.length - 1]! : ''
  const classes = ['name-fit', className].filter(Boolean).join(' ')
  if (!last) return <span className={classes}>{trimmed}</span>
  const head = trimmed.slice(0, trimmed.length - last.length).trimEnd()
  return (
    <span className={classes}>
      <span className="name-fit-head">{head}</span>
      <span className="name-fit-tail">{last}</span>
    </span>
  )
}

export function fitNameText(name: string, max = 18): string {
  const trimmed = name.trim()
  if (trimmed.length <= max) return trimmed
  const tokens = trimmed.split(/[\s_]+/).filter(Boolean)
  const last = tokens.length > 1 ? tokens[tokens.length - 1]! : ''
  if (!last) return `${trimmed.slice(0, Math.max(1, max - 1))}…`
  const room = max - last.length - 1
  const head = trimmed.slice(0, trimmed.length - last.length).trimEnd()
  if (room <= 0) return `…${last.slice(-(max - 1))}`
  if (head.length <= room) return `${head}…${last}`
  return `${head.slice(0, room)}…${last}`
}
