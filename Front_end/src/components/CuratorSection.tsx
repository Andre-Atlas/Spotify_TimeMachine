import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useMachine } from '@/store/useMachine'
import { DECADE_MAP } from '@/data/decades'
import { SUGGESTIONS, buildReply, streamText } from '@/lib/curator'
import { coverDataUrl } from '@/lib/covers'
import { TRACK_MAP } from '@/data/tracks'

function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

export function CuratorSection() {
  const decade = useMachine((s) => s.decade)
  const messages = useMachine((s) => s.messages)
  const saved = useMachine((s) => s.savedPlaylists)
  const d = DECADE_MAP[decade]

  const [input, setInput] = useState('')
  const [size, setSize] = useState<number>(15)
  const [busy, setBusy] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages])
  useEffect(() => () => abort.current?.abort(), [])

  async function send(prompt: string) {
    if (!prompt.trim() || busy) return
    const { pushMessage, appendToLast, finishLast, savePlaylist } = useMachine.getState()
    setInput('')
    setBusy(true)
    pushMessage({ id: String(Date.now() + Math.random()), role: 'user', content: prompt })
    pushMessage({ id: String(Date.now() + Math.random() + 1), role: 'curator', content: '', streaming: true })

    abort.current = new AbortController()
    
    const apiBase = import.meta.env.VITE_API_BASE_URL
    if (apiBase) {
      try {
        const res = await fetch(`${apiBase}/curate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, decade, size }),
          signal: abort.current.signal
        })
        
        if (res.ok && res.body) {
          const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            
            const lines = value.split('\n')
            let currentEvent = ''
            
            for (const line of lines) {
              if (line.startsWith('event:')) {
                currentEvent = line.substring(6).trim()
              } else if (line.startsWith('data:')) {
                const dataStr = line.substring(5).trim()
                if (dataStr) {
                  try {
                    const data = JSON.parse(dataStr)
                    if (currentEvent === 'chunk' && data.text) {
                      appendToLast(data.text)
                    } else if (currentEvent === 'done' && data.trackIds) {
                      finishLast(data.trackIds)
                      savePlaylist(`${d.label} — ${prompt.slice(0, 38)}`, data.trackIds)
                    }
                  } catch (e) {
                    // ignore json parse errors
                  }
                }
              }
            }
          }
        } else {
          throw new Error('Backend HTTP error')
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          appendToLast('\n[Erro ao contactar curador...]')
          finishLast([])
        }
      }
    } else {
      // Mock fallback
      const result = buildReply(prompt, decade)
      for await (const chunk of streamText(result.text, abort.current.signal)) appendToLast(chunk)

      const ids = result.tracks.map((t) => t.id)
      finishLast(ids)
      savePlaylist(`${d.label} — ${prompt.slice(0, 38)}`, ids)
    }

    setBusy(false)
  }

  const playlist = saved[0]

  return (
    <section id="curador" className="relative z-10 scroll-mt-16 mx-auto max-w-[1180px] px-5 py-20 sm:px-8">
      <div className="flex items-center gap-4">
        <span className="tag whitespace-nowrap">Curadoria por linguagem natural</span>
        <span className="hair h-px flex-1" />
      </div>

      <h2 className="mt-4 max-w-[18ch] font-display text-[34px] leading-[1.04] sm:text-[52px]">
        Peça a playlist <em style={{ color: d.ink }}>como você falaria</em> com um vendedor
        de disco.
      </h2>

      <div className="mt-10 grid gap-8 md:grid-cols-[1.25fr_1fr] md:gap-14">
        <div>
          <div className="rounded-xl border border-rule bg-paper-raised">
            <div ref={scroller} className="max-h-[380px] min-h-[210px] overflow-y-auto p-5">
              {messages.length === 0 ? (
                <div>
                  <p className="max-w-[54ch] text-[14px] leading-relaxed text-ink-2">
                    O curador recebe os candidatos que o motor de correlação já filtrou e só
                    reordena e justifica. Ele nunca cita faixa de memória — é isso que impede
                    playlist com música que não existe.
                  </p>
                  <div className="mt-5 grid gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void send(s)}
                        className="rounded-lg border border-rule bg-paper px-3.5 py-2.5 text-left text-[13px] text-ink-2 transition hover:border-ink-3 hover:text-ink"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((m) => (
                    <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
                      <div
                        className={
                          m.role === 'user'
                            ? 'max-w-[85%] rounded-xl px-3.5 py-2 text-[13.5px] text-paper-raised'
                            : 'max-w-[95%] whitespace-pre-wrap text-[14px] leading-relaxed text-ink-2'
                        }
                        style={m.role === 'user' ? { background: d.ink } : undefined}
                      >
                        <RichText text={m.content} />
                        {m.streaming && (
                          <motion.span
                            animate={{ opacity: [1, 0.15, 1] }}
                            transition={{ duration: 0.85, repeat: Infinity }}
                            className="ml-0.5 inline-block h-[15px] w-[7px] translate-y-[2px]"
                            style={{ background: d.ink }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form
              className="border-t border-rule p-3"
              onSubmit={(e) => {
                e.preventDefault()
                void send(input)
              }}
            >
              <div className="mb-3 flex items-center gap-3 px-1">
                <span className="tag !normal-case">Tamanho da playlist:</span>
                <label className="flex items-center gap-1.5 text-[13px] text-ink-2">
                  <input type="radio" name="playlistSize" value="10" checked={size === 10} onChange={() => setSize(10)} className="accent-ink" /> 10
                </label>
                <label className="flex items-center gap-1.5 text-[13px] text-ink-2">
                  <input type="radio" name="playlistSize" value="15" checked={size === 15} onChange={() => setSize(15)} className="accent-ink" /> 15
                </label>
                <label className="flex items-center gap-1.5 text-[13px] text-ink-2">
                  <input type="radio" name="playlistSize" value="30" checked={size === 30} onChange={() => setSize(30)} className="accent-ink" /> 30
                </label>
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void send(input)
                    }
                  }}
                  rows={2}
                  aria-label="Descreva a playlist que você quer"
                  placeholder={`Ex.: algo dos ${d.id} para dirigir à noite…`}
                  className="max-h-28 min-h-[46px] flex-1 resize-none rounded-lg border border-rule bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-4 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Enviar"
                  className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-lg text-paper-raised transition disabled:opacity-25"
                  style={{ background: d.ink }}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
                  </svg>
                </button>
              </div>
              <p className="tag mt-2 !text-[9px]">
                protótipo local · trocar por SSE em POST /v1/curate
              </p>
            </form>
          </div>
        </div>

        <aside>
          <h3 className="tag">Playlist montada</h3>
          {playlist ? (
            <div className="mt-3">
              <p className="font-display text-[20px] leading-tight text-ink">{playlist.title}</p>
              <ul className="mt-4 space-y-2.5">
                {playlist.trackIds.map((id, i) => {
                  const t = TRACK_MAP[id]
                  if (!t) return null
                  return (
                    <li key={id} className="flex items-center gap-3">
                      <span className="tag w-4 shrink-0 tabular-nums">{i + 1}</span>
                      <img
                        src={coverDataUrl(t, d.cover, 96)}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-[4px] object-cover"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] text-ink">{t.title}</span>
                        <span className="block truncate text-[11px] text-ink-3">{t.artist}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
              <button
                type="button"
                onClick={async (e) => {
                  const btn = e.currentTarget
                  btn.disabled = true
                  const origText = btn.innerText
                  btn.innerText = 'Exportando...'
                  try {
                    const token = localStorage.getItem('spotify_token')
                    const apiBase = import.meta.env.VITE_API_BASE_URL
                    if (apiBase && token) {
                      const res = await fetch(`${apiBase}/playlists/export`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ title: playlist.title, trackIds: playlist.trackIds })
                      })
                      if (res.ok) {
                        const data = await res.json()
                        if (data.url) window.open(data.url, '_blank')
                        btn.innerText = 'Exportado!'
                        return
                      }
                    }
                    btn.innerText = 'Erro ao exportar'
                  } catch (e) {
                    btn.innerText = 'Erro ao exportar'
                  }
                  setTimeout(() => { btn.disabled = false; btn.innerText = origText }, 2000)
                }}
                className="mt-5 w-full rounded-lg py-2.5 text-[12px] font-semibold uppercase tracking-[.14em] text-paper-raised disabled:opacity-50"
                style={{ background: d.ink }}
              >
                Exportar para o Spotify
              </button>
              <p className="tag mt-2 !text-[9px] !normal-case">
                Capa oficial (ou gerada no estilo <em>{d.cover}</em>).
              </p>
            </div>
          ) : (
            <p className="mt-3 max-w-[34ch] text-[14px] leading-relaxed text-ink-3">
              Nada montado ainda. Escreva um pedido ao lado — a playlist aparece aqui com a
              capa gerada no estilo visual da época.
            </p>
          )}
        </aside>
      </div>
    </section>
  )
}
