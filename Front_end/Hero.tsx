import { useMachine } from '@/store/useMachine'
import { DECADE_MAP, DECADES } from '@/data/decades'
import { TRACKS } from '@/data/tracks'
import { ArcCarousel } from './ArcCarousel'
import { NixieClock } from './NixieClock'

export function Hero() {
  const decade = useMachine((s) => s.decade)
  const d = DECADE_MAP[decade]

  return (
    <header className="relative">
      {/* lombada: o texto vertical que segura a margem esquerda */}
      <p
        className="tag pointer-events-none absolute left-3 top-[190px] hidden !text-ink-4 lg:block"
        style={{ writingMode: 'vertical-rl' }}
      >
        Arraste o arco · escolha a época · ouça como ela soava
      </p>

      <ArcCarousel />

      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="relative z-10 flex justify-center">
          <NixieClock className="-mt-10 sm:-mt-12" />
        </div>

        {/* régua superior */}
        <div className="mt-11 flex items-center gap-4">
          <span className="tag whitespace-nowrap">Uma máquina do tempo musical</span>
          <span className="hair h-px flex-1" />
          <span className="tag hidden whitespace-nowrap sm:inline">Est. 1950 — 2019</span>
        </div>

        {/* wordmark + ficha da época lado a lado: o vazio à direita do
            título é grande demais para ficar vazio */}
        <div className="mt-3 grid items-end gap-8 md:grid-cols-[minmax(0,1fr)_300px] md:gap-12">
          <h1
            className="font-display font-black uppercase leading-[.84] tracking-[-.026em]"
            style={{ fontSize: 'clamp(44px, 8.6vw, 118px)' }}
          >
            <span className="block text-ink">
              The <em style={{ color: d.ink, transition: 'color .5s ease' }}>Time</em>
            </span>
            <span className="block text-ink">Machine</span>
          </h1>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:pb-3">
            <div>
              <dt className="tag">Época em foco</dt>
              <dd
                className="mt-1 font-display text-[26px] leading-none"
                style={{ color: d.ink, transition: 'color .5s ease' }}
              >
                {d.label}
              </dd>
            </div>
            <div>
              <dt className="tag">Tecnologia</dt>
              <dd className="mt-1 font-display text-[26px] leading-none text-ink">{d.era}</dd>
            </div>
            <div className="col-span-2">
              <dt className="tag">Gêneros do recorte</dt>
              <dd className="mt-2 flex flex-wrap gap-1.5">
                {d.genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-full border px-2.5 py-1 text-[11px] text-ink-2"
                    style={{ borderColor: `color-mix(in srgb, ${d.ink} 32%, transparent)` }}
                  >
                    {g}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </div>

        {/* régua inferior */}
        <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="tag whitespace-nowrap">{DECADES.length} décadas</span>
          <span className="hair hidden h-px flex-1 sm:block" />
          <span className="tag whitespace-nowrap">{TRACKS.length} faixas catalogadas</span>
          <span className="hair hidden h-px flex-1 sm:block" />
          <span className="tag whitespace-nowrap">Curadoria por IA</span>
        </div>

        <p className="mt-8 max-w-[52ch] pb-14 text-[19px] leading-[1.55] text-ink-2">
          Conecte o que você ouve hoje. A máquina cruza o seu perfil sonoro com o catálogo de
          cada época e devolve as faixas daquela década que combinam com{' '}
          <span style={{ color: d.ink }}>a sua identidade musical</span> — não com a lista de
          mais tocadas.
        </p>
      </div>
    </header>
  )
}
