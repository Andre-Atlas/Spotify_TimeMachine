import { useMemo, useState } from 'react'
import { useMachine } from '@/store/useMachine'
import { DECADE_MAP } from '@/data/decades'
import { DEMO_TASTE, tracksOfDecade } from '@/data/tracks'

/* ══════════════════════════════════════════════════════════════════
 * COMPARAÇÃO DE PERFIL — gráfico de bala (bullet), não duas séries.
 *
 * O que interessa aqui é o DESVIO entre o seu perfil e a média da
 * época, não a identidade de duas categorias. Então a barra carrega o
 * seu valor e a média entra como marca de referência sobre a mesma
 * pista. Dois papéis, duas formas de marca — a identidade não depende
 * de cor, e não há par categórico para separar sob daltonismo.
 * ══════════════════════════════════════════════════════════════════ */

const AXES = [
  { key: 'energy', label: 'Energia', help: 'Intensidade e densidade percebidas da faixa.' },
  { key: 'valence', label: 'Valência', help: 'O quanto a faixa soa alegre ou sombria.' },
  { key: 'danceability', label: 'Dançabilidade', help: 'Regularidade e força da pulsação rítmica.' },
  { key: 'acousticness', label: 'Acústico', help: 'Presença de timbres não amplificados.' },
] as const

export function AffinitySection() {
  const decade = useMachine((s) => s.decade)
  const d = DECADE_MAP[decade]
  const [hover, setHover] = useState<string | null>(null)

  const avg = useMemo(() => {
    const list = tracksOfDecade(decade)
    const sum = { energy: 0, valence: 0, danceability: 0, acousticness: 0 }
    for (const t of list) {
      sum.energy += t.features.energy
      sum.valence += t.features.valence
      sum.danceability += t.features.danceability
      sum.acousticness += t.features.acousticness
    }
    const n = list.length || 1
    return {
      energy: sum.energy / n,
      valence: sum.valence / n,
      danceability: sum.danceability / n,
      acousticness: sum.acousticness / n,
    }
  }, [decade])

  return (
    <section id="afinidade" className="relative z-10 scroll-mt-16 border-y border-rule bg-paper-raised">
      <div className="mx-auto grid max-w-[1180px] gap-12 px-5 py-20 sm:px-8 md:grid-cols-[1fr_1.1fr] md:gap-20">
        <div>
          <span className="tag">Como a máquina escolhe</span>
          <h2 className="mt-3 font-display text-[32px] leading-[1.06] sm:text-[42px]">
            Não é a lista de mais tocadas.{' '}
            <em style={{ color: d.ink }}>É o que se parece com você.</em>
          </h2>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-ink-2">
            O catálogo histórico é descrito por atributos acústicos reais. O seu gosto atual
            é descrito por gêneros e tags, porque a maior parte do que você ouve hoje é
            recente demais para estar nas bases acústicas abertas. As duas descrições se
            encontram num score combinado — e é ele que ordena o catálogo ao lado.
          </p>
          <p className="mt-4 max-w-[46ch] text-[13px] leading-relaxed text-ink-3">
            A assimetria não é preguiça: os <em>audio features</em> do Spotify deixaram de
            existir para aplicações novas em novembro de 2024, e o que restou foi construir
            a inteligência dentro do produto.
          </p>
        </div>

        <figure className="m-0">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-display text-[19px] text-ink">
              Seu perfil sonoro contra a média dos {d.label.toLowerCase()}
            </h3>
          </figcaption>

          {/* legenda: forma da marca carrega a identidade, não a cor */}
          <div className="mt-3 flex items-center gap-5">
            <span className="flex items-center gap-2">
              <span className="h-[9px] w-7 rounded-full" style={{ background: d.ink }} />
              <span className="tag !text-ink-2">Seu perfil</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="relative h-4 w-[2px] bg-ink" />
              <span className="tag !text-ink-2">Média da década</span>
            </span>
          </div>

          <ul className="mt-7 space-y-6">
            {AXES.map((ax) => {
              const mine = DEMO_TASTE[ax.key]
              const era = avg[ax.key]
              const gap = Math.round((mine - era) * 100)
              return (
                <li
                  key={ax.key}
                  onMouseEnter={() => setHover(ax.key)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(ax.key)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  className="rounded-md outline-offset-4"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-medium text-ink">{ax.label}</span>
                    <span className="font-data text-[11px] tabular-nums text-ink-3">
                      {Math.round(mine * 100)}% <span className="text-ink-4">·</span>{' '}
                      época {Math.round(era * 100)}%
                    </span>
                  </div>

                  <div className="relative mt-2 h-[10px] rounded-full bg-paper-sunk">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                      style={{ width: `${mine * 100}%`, background: d.ink }}
                    />
                    {/* marca de referência: 2 px, com anel na superfície para
                        continuar visível quando cai sobre a barra */}
                    <div
                      className="absolute -top-[5px] h-[20px] w-[2px] bg-ink transition-[left] duration-500"
                      style={{
                        left: `calc(${era * 100}% - 1px)`,
                        boxShadow: '0 0 0 2px #F5F6F2',
                      }}
                    />
                  </div>

                  <p className="mt-1.5 h-4 text-[12px] text-ink-3">
                    {hover === ax.key
                      ? ax.help
                      : gap === 0
                        ? 'Exatamente na média da época.'
                        : `${Math.abs(gap)} ${Math.abs(gap) === 1 ? 'ponto' : 'pontos'} ${gap > 0 ? 'acima' : 'abaixo'} da média da época.`}
                  </p>
                </li>
              )
            })}
          </ul>
        </figure>
      </div>
    </section>
  )
}
