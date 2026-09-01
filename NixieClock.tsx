import { useEffect, useRef, useState } from 'react'
import { useMachine } from '@/store/useMachine'
import { DECADE_MAP } from '@/data/decades'

/**
 * Relógio de tubos Nixie.
 *
 * O que faz um tubo parecer um tubo, e não um número laranja:
 *  · o cátodo ACESO fica na frente e os apagados atrás, levemente
 *    deslocados — é a profundidade real de um tubo com dez algarismos
 *    empilhados que dá a leitura de objeto físico;
 *  · a malha de fios vertical na frente do dígito;
 *  · o flicker irregular do gás ionizado, nunca um pulso limpo;
 *  · o reacendimento escalonado de 40 ms entre tubos na troca.
 */

const GHOSTS = ['3', '7', '2', '8']

function Tube({ digit, index, accent }: { digit: string; index: number; accent: string }) {
  const [lit, setLit] = useState(digit)
  const [igniting, setIgniting] = useState(false)
  const timer = useRef<number>()

  useEffect(() => {
    if (digit === lit) return
    window.clearTimeout(timer.current)
    // cada tubo acende 40 ms depois do anterior
    timer.current = window.setTimeout(() => {
      setLit(digit)
      setIgniting(true)
      window.setTimeout(() => setIgniting(false), 320)
    }, index * 40)
    return () => window.clearTimeout(timer.current)
  }, [digit, lit, index])

  return (
    <div className="relative h-[74px] w-[46px] sm:h-[92px] sm:w-[58px]">
      {/* envoltório de vidro */}
      <div
        className="absolute inset-0 rounded-[10px] border border-white/10"
        style={{
          background:
            'linear-gradient(105deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,.02) 22%, rgba(255,255,255,0) 46%, rgba(255,255,255,.05) 78%, rgba(255,255,255,.12) 100%)',
          boxShadow: 'inset 0 0 22px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.14)',
        }}
      />
      {/* cátodo apagado, atrás e deslocado */}
      <span
        aria-hidden
        className="absolute inset-0 grid select-none place-items-center font-display text-[34px] leading-none text-white/[.07] sm:text-[44px]"
        style={{ transform: 'translate(2px, 2px)' }}
      >
        {GHOSTS[index % GHOSTS.length]}
      </span>
      {/* cátodo aceso */}
      <span
        className="absolute inset-0 grid select-none place-items-center font-display text-[34px] leading-none animate-tubeFlicker sm:text-[44px]"
        style={{
          color: '#FFD79B',
          textShadow: `0 0 6px ${accent}, 0 0 16px ${accent}, 0 0 34px ${accent}aa`,
          transform: igniting ? 'translateY(-2px) scale(1.06)' : 'none',
          filter: igniting ? 'brightness(1.7)' : 'none',
          transition: 'transform .32s cubic-bezier(.16,1,.3,1), filter .32s ease-out',
        }}
      >
        {lit}
      </span>
      {/* malha de fios na frente */}
      <div
        aria-hidden
        className="absolute inset-x-[6px] inset-y-[9px] rounded-[6px] opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,215,155,.22) 0 1px, transparent 1px 7px)',
        }}
      />
      {/* base metálica */}
      <div className="absolute inset-x-[3px] -bottom-[7px] h-[9px] rounded-b-[4px] bg-gradient-to-b from-[#3a3b42] to-[#17181c]" />
    </div>
  )
}

export function NixieClock({ className = '' }: { className?: string }) {
  const decade = useMachine((s) => s.decade)
  const d = DECADE_MAP[decade]
  const digits = d.nixie.split('')

  return (
    <div className={className}>
      <div
        className="relative inline-flex items-end gap-2 rounded-2xl border border-white/10 bg-night px-4 pb-4 pt-3.5 sm:gap-2.5 sm:px-5"
        style={{ boxShadow: '0 24px 60px -28px rgba(12,13,16,.85), inset 0 1px 0 rgba(255,255,255,.06)' }}
        role="img"
        aria-label={`Década selecionada: ${d.years}`}
      >
        {digits.map((n, i) => (
          <Tube key={i} digit={n} index={i} accent="#FF9C1A" />
        ))}
        {/* brilho difuso do gás sobre o painel */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ background: 'radial-gradient(120% 70% at 50% 42%, rgba(255,156,26,.16), transparent 70%)' }}
        />
      </div>
      <p className="tag mt-2.5 text-center !text-ink-3">
        Década selecionada · {d.era}
      </p>
    </div>
  )
}
