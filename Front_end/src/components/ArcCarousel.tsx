import { useEffect, useMemo, useRef } from 'react'
import { DECADES } from '@/data/decades'
import { tracksOfDecade } from '@/data/tracks'
import { coverDataUrl } from '@/lib/covers'
import { spring, type SpringState } from '@/lib/math'
import { useMachine } from '@/store/useMachine'
import { useRaf } from '@/hooks/useRaf'

/* ══════════════════════════════════════════════════════════════════
 * CARROSSEL EM ARCO
 *
 * Os cartões vivem numa circunferência de raio R cujo centro fica
 * abaixo do rodapé da seção — só a calota superior aparece, e o corte
 * nas laterais é intencional: é o que dá a sensação de que o arco
 * continua fora da tela.
 *
 * Transform de cada cartão:
 *   translate(-50%,-50%) rotate(a) translateY(-R) rotate(-a·0.45)
 *                        └ põe na circunferência ┘ └ amansa a inclinação ┘
 *
 * Sete décadas se repetem TRÊS vezes ao longo do círculo (21 cartões,
 * passo de 17,1°). Com sete só, o arco ficaria vazio entre os cartões;
 * com a repetição a rotação é contínua e a mesma década só reaparece
 * 120° depois — bem fora do campo visível.
 * ══════════════════════════════════════════════════════════════════ */

const REPEATS = 3
const COUNT = DECADES.length * REPEATS
const STEP = (Math.PI * 2) / COUNT
/** Raio base; o efetivo é recalculado por viewport (ver `radius`). */
const R_MAX = 760

const K_DRAG = 0.0019 // rad por pixel
const K_WHEEL = 0.0012
const MU = 3.4 // atrito exponencial, s⁻¹
const EPS = 0.1 // limiar de encaixe, rad/s

const norm = (a: number) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI

export function ArcCarousel() {
  const decade = useMachine((s) => s.decade)
  const goToDecade = useMachine((s) => s.goToDecade)
  const tracksMap = useMachine((s) => s.tracksMap)
  const loadDecadeTracks = useMachine((s) => s.loadDecadeTracks)

  const wrap = useRef<HTMLDivElement>(null)
  const cards = useRef<HTMLDivElement[]>([])
  const theta = useRef(0)
  const omega = useRef(0)
  const mode = useRef<'idle' | 'drag' | 'fling' | 'snap'>('idle')
  const snap = useRef<SpringState>({ pos: 0, vel: 0 })
  const lastSel = useRef(-1)
  const dragging = useRef(false)
  /** Num viewport estreito, um raio de 760 px deixa só dois cartões
   *  visíveis e a queda nas laterais fica quase vertical. */
  const radius = useRef(R_MAX)
  const ring = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fit = () => {
      radius.current = Math.max(400, Math.min(R_MAX, window.innerWidth * 0.62))
      if (ring.current) ring.current.style.transform = `translateY(${radius.current + 82}px)`
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  /** Cada repetição mostra uma faixa diferente da década — o arco fica
   *  variado em vez de exibir a mesma arte três vezes.
   *
   *  Usa as faixas reais carregadas via backend (tracksMap) quando já
   *  disponíveis; cai no mock estático só enquanto aquela década ainda não
   *  respondeu — evita o arco nascer com slots vazios e mostra dados reais
   *  assim que chegam, sem esperar o usuário girar até lá. Antes disso, o
   *  arco sempre lia de `tracksOfDecade` (mock), mesmo depois do catálogo
   *  abaixo já estar mostrando faixas reais — era a causa da desconexão
   *  entre o carrossel e o CatalogSection.
   */
  const slots = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        const d = DECADES[i % DECADES.length]
        const rep = Math.floor(i / DECADES.length)
        const list = tracksMap[d.id] ?? tracksOfDecade(d.id)
        const track = list[(rep * 3) % list.length]
        return { d, track, cover: coverDataUrl(track, d.cover, 256) }
      }),
    [tracksMap],
  )

  /** O arco mostra as 7 décadas de uma vez, não só a atual — sem isso, seis
   *  das sete ficariam presas no fallback mock até o usuário girar até lá.
   *  loadDecadeTracks já ignora décadas já carregadas, então isto é seguro
   *  de chamar de novo mesmo com o prefetch de vizinhas do goToDecade. */
  useEffect(() => {
    DECADES.forEach((d) => void loadDecadeTracks(d.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── entrada ──────────────────────────────────────────────────── */
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    let lastX = 0
    let moved = 0
    let downIdx = -1

    const down = (e: PointerEvent) => {
      dragging.current = true
      moved = 0
      lastX = e.clientX
      mode.current = 'drag'
      downIdx = Number((e.target as HTMLElement).closest('[data-idx]')?.getAttribute('data-idx') ?? -1)
      el.setPointerCapture?.(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!dragging.current) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      moved += Math.abs(dx)
      theta.current += dx * K_DRAG
      omega.current = (dx * K_DRAG) / 0.016
    }
    const up = (e: PointerEvent) => {
      if (!dragging.current) return
      dragging.current = false
      el.releasePointerCapture?.(e.pointerId)
      if (moved < 6 && downIdx >= 0) {
        // clique sem arraste: traz aquele cartão para o topo
        theta.current -= norm(theta.current + downIdx * STEP)
        mode.current = 'snap'
        snap.current = { pos: theta.current, vel: 0 }
      } else {
        mode.current = 'fling'
      }
    }
    const wheel = (e: WheelEvent) => {
      // só sequestra a roda quando o gesto é claramente horizontal ou
      // com shift — senão a página deixa de rolar e isso irrita
      if (!e.shiftKey && Math.abs(e.deltaX) < Math.abs(e.deltaY)) return
      e.preventDefault()
      omega.current += (e.deltaX || e.deltaY) * K_WHEEL * 5
      mode.current = 'fling'
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [])

  /** Quando a década muda por fora (dial, teclado), o arco vai atrás. */
  useEffect(() => {
    if (dragging.current) return
    const target = DECADES.findIndex((d) => d.id === decade)
    const cur = ((-Math.round(theta.current / STEP) % COUNT) + COUNT) % COUNT
    if (cur % DECADES.length === target) return
    // escolhe a repetição mais próxima para não dar meia volta à toa
    let best = target
    let bestDist = Infinity
    for (let r = 0; r < REPEATS; r++) {
      const idx = target + r * DECADES.length
      const dist = Math.abs(norm(theta.current + idx * STEP))
      if (dist < bestDist) {
        bestDist = dist
        best = idx
      }
    }
    theta.current -= norm(theta.current + best * STEP)
    mode.current = 'snap'
    snap.current = { pos: theta.current, vel: 0 }
    lastSel.current = best
  }, [decade])

  /* ── loop ─────────────────────────────────────────────────────── */
  useRaf((dt) => {
    if (mode.current === 'fling') {
      omega.current *= Math.exp(-MU * dt)
      theta.current += omega.current * dt
      if (Math.abs(omega.current) < EPS) {
        snap.current = { pos: theta.current, vel: omega.current }
        omega.current = 0
        mode.current = 'snap'
      }
    } else if (mode.current === 'snap') {
      const detent = Math.round(theta.current / STEP) * STEP
      theta.current = spring(snap.current, detent, 0.5, dt)
      if (Math.abs(theta.current - detent) < 0.002 && Math.abs(snap.current.vel) < 0.02) {
        theta.current = detent
        mode.current = 'idle'
      }
    }

    const sel = (((-Math.round(theta.current / STEP)) % COUNT) + COUNT) % COUNT
    if (sel !== lastSel.current) {
      lastSel.current = sel
      const target = DECADES[sel % DECADES.length].id
      if (target !== useMachine.getState().decade) goToDecade(target)
    }

    for (let i = 0; i < COUNT; i++) {
      const el = cards.current[i]
      if (!el) continue
      const a = norm(theta.current + i * STEP)
      const abs = Math.abs(a)
      if (abs > 1.35) {
        // fora da calota visível: não paga custo de layout
        el.style.visibility = 'hidden'
        continue
      }
      el.style.visibility = 'visible'
      const front = 1 - abs / 1.35
      const scale = 0.62 + 0.46 * Math.pow(front, 1.7)
      el.style.transform =
        `translate(-50%,-50%) rotate(${a}rad) translateY(${-radius.current}px) rotate(${-a * 0.45}rad) scale(${scale})`
      el.style.opacity = String(0.2 + 0.8 * Math.pow(front, 1.1))
      el.style.zIndex = String(100 + Math.round(front * 100))
    }
  })

  return (
    <div
      ref={wrap}
      className="relative h-[268px] w-full cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing sm:h-[360px]"
      // Afordância de ponteiro que duplica o dial de décadas — 21 botões
      // repetidos só poluiriam a árvore de acessibilidade. O controle
      // acessível de verdade é o <DecadeDial>.
      aria-hidden="true"
    >
      <div ref={ring} className="absolute left-1/2 top-0" style={{ transform: `translateY(${R_MAX + 82}px)` }}>
        {slots.map((s, i) => (
          <div
            key={i}
            data-idx={i}
            ref={(el) => {
              if (el) cards.current[i] = el
            }}
            className="absolute will-change-transform"
            style={{ transformOrigin: 'center' }}
          >
            <div className="w-[104px] rounded-[12px] bg-paper-raised p-1.5 pb-2 card-shadow sm:w-[146px] sm:rounded-[14px] sm:p-2 sm:pb-2.5">
              <img
                src={s.cover}
                alt=""
                draggable={false}
                className="aspect-square w-full rounded-[8px] object-cover"
              />
              <span className="mt-2 flex items-baseline justify-between px-0.5">
                <span
                  className="font-display text-[15px] font-bold leading-none"
                  style={{ color: s.d.ink }}
                >
                  {s.d.nixie}
                </span>
                <span className="tag hidden !text-[8px] sm:inline">{s.d.era}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
