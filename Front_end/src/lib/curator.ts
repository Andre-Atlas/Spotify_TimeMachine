import type { DecadeId, Track } from '@/types'
import { DECADE_MAP } from '@/data/decades'
import { DEMO_TASTE, tracksOfDecade } from '@/data/tracks'

/**
 * ————————————————————————————————————————————————————————————
 * SEAM DE INTEGRAÇÃO
 * Este módulo simula a resposta em streaming do curador.
 * Na versão real, troque `streamCuratorReply` por um consumidor de SSE:
 *
 *   const res = await fetch(`${API}/curator/generate`, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
 *     body: JSON.stringify({ prompt, decade, useTasteProfile: true }),
 *   })
 *   const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
 *   // ...parse `data: {...}\n\n` → yield chunk.delta
 *
 * O contrato de resposta está em musical-time-machine-spec.md §6.
 * ————————————————————————————————————————————————————————————
 */

export interface CuratorResult {
  text: string
  tracks: Track[]
}

const MOODS: Array<{ test: RegExp; label: string; pick: (t: Track) => number }> = [
  { test: /noite|madrugada|dirigir|escuro|night/i, label: 'noturna', pick: (t) => 1 - t.features.valence + t.features.energy * 0.4 },
  { test: /dan[çc]ar|festa|balada|dance|party/i, label: 'dançante', pick: (t) => t.features.danceability },
  { test: /calma|relax|tranquil|chill|acústic/i, label: 'introspectiva', pick: (t) => t.features.acousticness + (1 - t.features.energy) },
  { test: /treino|academia|correr|energia|workout/i, label: 'energética', pick: (t) => t.features.energy + t.features.tempo / 400 },
  { test: /feliz|alegre|verão|happy|sol/i, label: 'solar', pick: (t) => t.features.valence },
]

export function selectTracks(prompt: string, decade: DecadeId, limit = 5): { tracks: Track[]; mood: string } {
  const mood = MOODS.find((m) => m.test.test(prompt))
  const pool = tracksOfDecade(decade)
  const scored = pool
    .map((t) => ({
      t,
      score: (mood ? mood.pick(t) : t.affinity / 100) * 0.6 + (t.affinity / 100) * 0.4,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ t }) => ({
      ...t,
      reason: reasonFor(t, mood?.label),
    }))
  return { tracks: scored, mood: mood?.label ?? 'equilibrada' }
}

function reasonFor(t: Track, mood?: string): string {
  const bits: string[] = []
  if (t.features.energy > 0.8) bits.push('alta energia')
  else if (t.features.energy < 0.5) bits.push('andamento contido')
  if (t.features.danceability > 0.75) bits.push('groove marcado')
  if (t.features.acousticness > 0.3) bits.push('textura acústica')
  if (Math.abs(t.features.energy - DEMO_TASTE.energy) < 0.12) bits.push('bate com sua média de energia')
  const why = bits.slice(0, 2).join(' e ') || 'perfil sonoro compatível'
  return `${why}${mood ? ` — encaixa na pegada ${mood}` : ''}. Afinidade ${t.affinity}%.`
}

export function buildReply(prompt: string, decade: DecadeId): CuratorResult {
  const d = DECADE_MAP[decade]
  const { tracks, mood } = selectTracks(prompt, decade)
  const text = [
    `Montei uma seleção ${mood} dos ${d.label.toLowerCase()} cruzando o catálogo da época com o seu perfil atual `,
    `(energia ${Math.round(DEMO_TASTE.energy * 100)}%, dançabilidade ${Math.round(DEMO_TASTE.danceability * 100)}%, quase nada de acústico).\n\n`,
    ...tracks.map((t, i) => `${i + 1}. **${t.title}** — ${t.artist} (${t.year})\n   ${t.reason}\n`),
    `\nO fio condutor são os ${d.genres.slice(0, 2).join(' e ').toLowerCase()} com produção densa, que é onde o seu gosto atual encontra a sonoridade da década. `,
    `Quer que eu puxe mais fundo no ${d.genres[2] ?? 'catálogo alternativo'} ou que eu suba isso como playlist na sua conta?`,
  ].join('')
  return { text, tracks }
}

/** Simula o streaming token-a-token do Gemini. */
export async function* streamText(text: string, signal?: AbortSignal): AsyncGenerator<string> {
  const chunks = text.match(/\S+\s*/g) ?? []
  await delay(420, signal)
  for (const chunk of chunks) {
    if (signal?.aborted) return
    await delay(12 + Math.random() * 26, signal)
    yield chunk
  }
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(id)
      resolve()
    })
  })
}

export const SUGGESTIONS = [
  'Rock progressivo dos anos 70 para dirigir à noite',
  'Algo dançante que combine com o meu gosto atual',
  'Faixas calmas para trabalhar sem perder a estética da década',
  'O lado mais pesado dessa época, por favor',
]
