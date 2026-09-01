import { useMemo } from 'react'
import { useMachine } from '@/store/useMachine'
import { DECADE_MAP } from '@/data/decades'
import { tracksOfDecade } from '@/data/tracks'
import { vinylDataUrl } from '@/lib/covers'
import { fmt } from '@/lib/format'
import { useRaf } from '@/hooks/useRaf'

/** Relógio de reprodução: escreve no store a ~10 Hz, não a 60 —
 *  re-renderizar a página inteira por quadro é desperdício puro. */
function PlaybackClock() {
  let acc = 0
  useRaf((dt) => {
    acc += dt
    if (acc >= 0.1) {
      useMachine.getState().tick(acc)
      acc = 0
    }
  })
  return null
}

export function PlayerBar() {
  const decade = useMachine((s) => s.decade)
  const focused = useMachine((s) => s.focused)
  const isPlaying = useMachine((s) => s.isPlaying)
  const progress = useMachine((s) => s.progress)
  const volume = useMachine((s) => s.volume)

  const d = DECADE_MAP[decade]
  const track = useMemo(() => tracksOfDecade(decade)[focused], [decade, focused])
  const disc = useMemo(() => (track ? vinylDataUrl(track, d.cover, 220) : null), [track, d.cover])

  if (!track) return null

  return (
    <>
      <PlaybackClock />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-8">
          {/* prato: o disco gira só enquanto toca */}
          <div className="relative h-11 w-11 shrink-0 sm:h-12 sm:w-12">
            {disc && (
              <img
                src={disc}
                alt=""
                className={`h-full w-full rounded-full ${isPlaying ? 'animate-spinDisc' : ''}`}
                style={{ animationDuration: '1.8s' }}
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-ink">{track.title}</p>
            <p className="truncate text-[11px] text-ink-3">
              {track.artist} · {track.year}
            </p>
          </div>

          <div className="hidden flex-[1.6] items-center gap-2.5 md:flex">
            <span className="font-data text-[10px] tabular-nums text-ink-3">
              {fmt(progress * track.durationMs)}
            </span>
            <label className="relative flex-1">
              <span className="sr-only">Posição na faixa</span>
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(progress * 1000)}
                onChange={(e) => useMachine.getState().seek(Number(e.target.value) / 1000)}
                className="h-4 w-full cursor-pointer appearance-none bg-transparent"
              />
              <span className="pointer-events-none absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-paper-sunk" />
              <span
                className="pointer-events-none absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full"
                style={{ width: `${progress * 100}%`, background: d.ink }}
              />
            </label>
            <span className="font-data text-[10px] tabular-nums text-ink-3">
              {fmt(track.durationMs)}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => useMachine.getState().prev()}
              aria-label="Faixa anterior"
              className="grid h-8 w-8 place-items-center rounded-full text-ink-3 transition hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                <path d="M7 6h2v12H7zm11 0v12l-9-6z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => useMachine.getState().toggle()}
              aria-label={isPlaying ? 'Pausar' : 'Tocar'}
              className="grid h-10 w-10 place-items-center rounded-full text-paper-raised transition hover:opacity-90"
              style={{ background: d.ink }}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => useMachine.getState().next()}
              aria-label="Próxima faixa"
              className="grid h-8 w-8 place-items-center rounded-full text-ink-3 transition hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                <path d="M15 6h2v12h-2zM6 6l9 6-9 6z" />
              </svg>
            </button>
          </div>

          <label className="hidden items-center gap-2 lg:flex">
            <span className="tag">Vol</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => useMachine.getState().setVolume(Number(e.target.value) / 100)}
              aria-label="Volume"
              className="h-1 w-20 cursor-pointer"
              style={{ accentColor: d.ink }}
            />
          </label>
        </div>
      </div>
    </>
  )
}
