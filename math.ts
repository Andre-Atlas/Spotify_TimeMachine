/* ────────────────────────────────────────────────────────────────
 * Suavização independente de framerate.
 *
 * `x += (alvo - x) * 0.1` dentro do useFrame parece suavização mas
 * depende da taxa de quadros: a 144 Hz chega em menos da metade do
 * tempo que a 60 Hz. λ tem unidade s⁻¹ e é o único número a ajustar.
 * Tempo para fechar 90% da distância: t₉₀ = ln(10)/λ ≈ 2.303/λ
 * ──────────────────────────────────────────────────────────────── */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt)
}

/** Mola criticamente amortecida (integrador semi-implícito). Estável em qualquer dt. */
export interface SpringState {
  pos: number
  vel: number
}
export function spring(s: SpringState, target: number, period: number, dt: number): number {
  const omega = (2 * Math.PI) / period
  const x = s.pos - target
  const exp = Math.exp(-omega * dt)
  const temp = (s.vel + omega * x) * dt
  s.pos = target + (x + temp) * exp
  s.vel = (s.vel - omega * temp) * exp
  return s.pos
}

/** Menor diferença angular, sempre em (−π, π]. O +3π cobre o módulo negativo do JS. */
export function shortestAngle(from: number, to: number): number {
  return ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const inv = (a: number, b: number, v: number) => (b === a ? 0 : (v - a) / (b - a))

/* ── Easings usados nos voos de câmera ─────────────────────────── */
export const ease = {
  linear: (t: number) => t,
  power2Out: (t: number) => 1 - Math.pow(1 - t, 2),
  power3InOut: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  power4In: (t: number) => t * t * t * t,
  expoInOut: (t: number) =>
    t === 0 ? 0 : t === 1 ? 1
      : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2,
  backOut: (t: number) => {
    const c = 1.34
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
  },
}
export type EaseName = keyof typeof ease

/** Ruído determinístico a partir de um id — mesma faixa, mesma arte, mesmo som. */
export function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

/** PRNG semeado (mulberry32) — reprodutível entre sessões. */
export function rng(seed: number): () => number {
  let a = Math.floor(seed * 4294967295) || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
