import { DECADES } from '@/data/decades'
import { useMachine } from '@/store/useMachine'

/** Dial de sintonia: as décadas como marcas numa régua, não como abas. */
export function DecadeDial() {
  const decade = useMachine((s) => s.decade)
  const shifting = useMachine((s) => s.shifting)
  const goToDecade = useMachine((s) => s.goToDecade)

  return (
    <div
      className="relative"
      role="group"
      aria-label="Seletor de década"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') useMachine.getState().stepDecade(1)
        if (e.key === 'ArrowLeft') useMachine.getState().stepDecade(-1)
      }}
    >
      <div className="hair absolute inset-x-0 top-[13px]" />
      <ul className="relative flex items-start justify-between pb-5">
        {DECADES.map((d) => {
          const active = d.id === decade
          return (
            <li key={d.id} className="flex-1">
              <button
                type="button"
                disabled={shifting}
                onClick={() => goToDecade(d.id)}
                aria-pressed={active}
                aria-label={`${d.label}, ${d.years}`}
                className="group relative flex w-full flex-col items-center gap-2 disabled:cursor-not-allowed"
              >
                <span
                  className="w-px transition-all duration-300"
                  style={{ height: active ? 26 : 13, background: active ? d.ink : '#A3A8A6' }}
                />
                <span
                  className="font-display text-[15px] font-bold leading-none transition-colors sm:text-[17px]"
                  style={{ color: active ? d.ink : '#7C8285' }}
                >
                  {d.nixie}
                </span>
                {/* fora do fluxo: com a etiqueta ocupando largura, o item
                    ativo empurrava os vizinhos e a régua ficava torta */}
                <span
                  data-on={active}
                  className="tag pointer-events-none absolute top-full mt-1 whitespace-nowrap !text-[8px] opacity-0 transition-opacity group-hover:opacity-100 data-[on=true]:opacity-100"
                >
                  {d.era}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
