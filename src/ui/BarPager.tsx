type BarPagerProps = {
  bars: number
  page: number
  playingBar?: number
  onPage: (bar: number) => void
  onCopyTo: (bars: number[]) => void
}

export function BarPager({ bars, page, playingBar = -1, onPage, onCopyTo }: BarPagerProps) {
  if (bars <= 1) return null
  const others = Array.from({ length: bars }, (_, index) => index).filter((index) => index !== page)
  return (
    <nav className="bar-pager" data-testid="bar-pager" aria-label="Bars">
      <div className="bar-pager-pages">
        <button
          type="button"
          className="bar-pager-arrow"
          aria-label="Previous bar"
          disabled={page <= 0}
          onClick={() => onPage(page - 1)}
        >
          ‹
        </button>
        {Array.from({ length: bars }, (_, index) => {
          const current = index === page
          const playing = index === playingBar && playingBar >= 0
          return (
            <button
              key={index}
              type="button"
              className={[current ? 'is-on' : '', playing && !current ? 'is-play' : ''].filter(Boolean).join(' ')}
              aria-label={playing ? `Bar ${index + 1}, playing` : `Bar ${index + 1}`}
              aria-current={current ? 'page' : undefined}
              data-testid={`bar-page-${index + 1}`}
              onClick={() => onPage(index)}
            >
              {index + 1}
            </button>
          )
        })}
        <button
          type="button"
          className="bar-pager-arrow"
          aria-label="Next bar"
          disabled={page >= bars - 1}
          onClick={() => onPage(page + 1)}
        >
          ›
        </button>
      </div>
      <div className="bar-pager-copy">
        <span>Copy to</span>
        {others.map((index) => (
          <button
            key={index}
            type="button"
            aria-label={`Copy this bar to bar ${index + 1}`}
            data-testid={`copy-bar-${index + 1}`}
            onClick={() => onCopyTo([index])}
          >
            {index + 1}
          </button>
        ))}
        {others.length > 1 ? (
          <button type="button" aria-label="Copy this bar to all other bars" data-testid="copy-bar-all" onClick={() => onCopyTo(others)}>
            All
          </button>
        ) : null}
      </div>
    </nav>
  )
}
