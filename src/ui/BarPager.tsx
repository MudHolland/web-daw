import { DockWhen } from './editorDock.tsx'

type BarPagerProps = {
  bars: number
  page: number
  playingBar?: number
  open: boolean
  onToggle: () => void
  follow: boolean
  /** A bar the user pinned. Follow hides Copy to because no bar is pinned. */
  selected: boolean
  onFollow: () => void
  onPage: (bar: number) => void
  onCopyTo: (bars: number[]) => void
}

export function BarPager({
  bars,
  page,
  playingBar = -1,
  open,
  onToggle,
  follow,
  selected,
  onFollow,
  onPage,
  onCopyTo,
}: BarPagerProps) {
  if (bars < 2) return null
  const others = Array.from({ length: bars }, (_, index) => index).filter((index) => index !== page)
  const chevron = (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.2 4.2 L6 8 L9.8 4.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
  return (
    <DockWhen collapsed={!open}>
      <nav
        className={['bars-stack', open ? '' : 'is-collapsed'].filter(Boolean).join(' ')}
        data-testid="bar-pager"
        aria-label="Bars"
      >
        {open ? (
          <div className="strip-fold bar-pager-fold">
            <button
              type="button"
              className="strip-fold-toggle"
              aria-expanded={true}
              aria-label="Minimize Bars"
              data-testid="bars-toggle"
              onClick={onToggle}
            >
              {chevron}
            </button>
            <span className="bar-pager-label">Bars</span>
            <div className="bar-pager-body">
              <div className="bar-pager-main">
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
                    const current = selected && index === page
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
                <button
                  type="button"
                  className={follow ? 'bar-follow is-idle' : 'bar-follow'}
                  data-testid="live"
                  aria-pressed={follow}
                  aria-label={follow ? 'Following the playing section' : 'Follow the playing section'}
                  onClick={onFollow}
                >
                  Follow
                </button>
              </div>
              {selected ? (
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
              ) : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="strip-fold bar-pager-fold"
            aria-expanded={false}
            aria-label="Show Bars"
            data-testid="bars-toggle"
            onClick={onToggle}
          >
            <span className="bar-pager-label">Bars</span>
            {chevron}
          </button>
        )}
      </nav>
    </DockWhen>
  )
}
