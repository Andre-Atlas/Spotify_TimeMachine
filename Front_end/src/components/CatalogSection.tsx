import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMachine } from '@/store/useMachine'
import { DECADE_MAP } from '@/data/decades'
import { coverDataUrl } from '@/lib/covers'
import { fmt } from '@/lib/format'
import { DecadeDial } from './DecadeDial'

const CHAIN: Record<string, string> = {
  am: 'bandpass 1.6 kHz → saturação → chiado',
  vinyl: 'lowshelf 120 Hz → crackle → wow & flutter',
  mp3: 'compressor 8:1 → corte 15.5 kHz → pré-eco',
  clean: 'highshelf 12 kHz',
}
const FILTER_LABEL: Record<string, string> = {
  am: 'rádio AM valvulado',
  vinyl: 'vinil com agulha',
  mp3: 'compressão MP3 de 128 kbps',
  clean: 'sem coloração',
}

/** Uma série, uma cor: o cabeçalho da coluna já nomeia o que a barra mede. */
function AffinityBar({ value, color }: { value: number; color: string }) {
  return (
    <span className="flex items-center gap-2" title={`Afinidade com o seu perfil: ${value}%`}>
      <span className="relative hidden h-[6px] w-16 overflow-hidden rounded-full bg-paper-sunk sm:block">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${value}%`, background: color }}
        />
      </span>
      <span className="w-9 text-right font-data text-[11px] tabular-nums text-ink-2">{value}%</span>
    </span>
  )
}

export function CatalogSection() {
  const decade = useMachine((s) => s.decade)
  const focused = useMachine((s) => s.focused)
  const isPlaying = useMachine((s) => s.isPlaying)
  const filtersOn = useMachine((s) => s.filtersOn)
  const [sortType, setSortType] = useState<'affinity' | 'popularity'>('affinity')

  const d = DECADE_MAP[decade]
  const tracks = useMachine((s) => s.tracks())
  const loading = useMachine((s) => s.loadingTracks)
  
  const ranked = useMemo(() => {
    const list = [...tracks]
    if (sortType === 'affinity') {
      list.sort((a, b) => b.affinity - a.affinity)
    } else {
      list.sort((a, b) => (a.popularity || 0) - (b.popularity || 0))
    }
    return list.slice(0, 15)
  }, [tracks, sortType])

  return (
    <section id="catalogo" className="relative z-10 scroll-mt-16 mx-auto max-w-[1180px] px-5 pb-24 sm:px-8">
      <DecadeDial />

      <div className="mt-14 grid gap-10 md:grid-cols-[minmax(0,1fr)_300px] md:gap-14">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2
              className="font-display text-[34px] leading-none sm:text-[46px]"
              style={{ color: d.ink, transition: 'color .5s ease' }}
            >
              {d.label}
            </h2>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setSortType('affinity')} className={sortType === 'affinity' ? "tag !text-ink" : "tag"}>
                Catálogo — mais afins
              </button>
              <button onClick={() => setSortType('popularity')} className={sortType === 'popularity' ? "tag !text-ink" : "tag"}>
                Menos populares
              </button>
            </div>
          </div>
          <p className="mt-2.5 max-w-[54ch] text-[15px] text-ink-2">
            {d.tagline}. A ordem abaixo não é a das paradas da época — é a do quanto cada
            faixa se aproxima do seu perfil sonoro, ou as pérolas escondidas menos populares.
          </p>

          <div className="mt-8">
            <div className="hair" />
            {loading && ranked.length === 0 && (
              <p className="py-6 text-center font-data text-[12px] uppercase tracking-wide text-ink-2">
                Carregando faixas…
              </p>
            )}
            <AnimatePresence mode="wait">
              <motion.ul
                key={decade}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.26 }}
              >
                {ranked.map((t, i) => {
                  const idx = tracks.indexOf(t)
                  const active = idx === focused
                  return (
                    <li key={t.id} className="border-b border-rule-soft">
                      <button
                        type="button"
                        onClick={() => useMachine.getState().playTrack(idx)}
                        className="group flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-paper-raised sm:gap-4 sm:px-2"
                      >
                        <span className="tag w-6 shrink-0 tabular-nums">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <img
                          src={coverDataUrl(t, d.cover, 128)}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-[5px] object-cover sm:h-12 sm:w-12"
                          style={{ boxShadow: active ? `0 0 0 2px ${d.ink}` : undefined }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[15px] font-medium text-ink">{t.title}</span>
                            {active && isPlaying && (
                              <span aria-label="Tocando agora" className="flex h-3 shrink-0 items-end gap-[2px]">
                                {[0, 1, 2].map((b) => (
                                  <motion.span
                                    key={b}
                                    className="w-[2px] rounded-sm"
                                    style={{ background: d.ink }}
                                    animate={{ height: ['30%', '100%', '45%'] }}
                                    transition={{ duration: 0.6 + b * 0.15, repeat: Infinity, repeatType: 'mirror' }}
                                  />
                                ))}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-[13px] text-ink-3">
                            {t.artist} · {t.album}
                          </span>
                        </span>
                        <span className="tag hidden w-11 shrink-0 tabular-nums md:block">{t.year}</span>
                        <span className="tag hidden w-11 shrink-0 tabular-nums sm:block">
                          {fmt(t.durationMs)}
                        </span>
                        <AffinityBar value={t.affinity} color={d.ink} />
                        <span
                          aria-hidden
                          className="ml-1 hidden h-8 w-8 shrink-0 place-items-center rounded-full border transition group-hover:bg-paper sm:grid"
                          style={{
                            borderColor: `color-mix(in srgb, ${d.ink} 40%, transparent)`,
                            color: d.ink,
                          }}
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                            <path d="M8 5.5v13l11-6.5z" />
                          </svg>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </motion.ul>
            </AnimatePresence>
          </div>
        </div>

        <aside className="md:pt-2">
          <div className="md:sticky md:top-20">
            <h3 className="tag">A agulha desta época</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
              As prévias passam por uma cadeia de filtros que reproduz a coloração de
              gravação e reprodução da década:{' '}
              <span className="text-ink">{FILTER_LABEL[d.audio]}</span>.
            </p>

            <button
              type="button"
              onClick={() => useMachine.getState().toggleFilters()}
              aria-pressed={filtersOn}
              className="mt-4 flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition"
              style={{
                borderColor: filtersOn ? d.ink : '#C6C9C1',
                background: filtersOn ? `color-mix(in srgb, ${d.ink} 8%, transparent)` : undefined,
              }}
            >
              <span className="text-[13px] text-ink">Filtro de época</span>
              <span
                className="font-data text-[11px] uppercase tracking-wider"
                style={{ color: filtersOn ? d.ink : '#7C8285' }}
              >
                {filtersOn ? 'ligado' : 'desligado'}
              </span>
            </button>

            <dl className="mt-6 space-y-3 border-t border-rule pt-5">
              {([
                ['Cadeia', CHAIN[d.audio]],
                ['Arte das capas', d.cover],
                ['Faixas no recorte', String(ranked.length)],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="tag w-24 shrink-0">{k}</dt>
                  <dd className="font-data text-[11px] leading-relaxed text-ink-2">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
    </section>
  )
}
