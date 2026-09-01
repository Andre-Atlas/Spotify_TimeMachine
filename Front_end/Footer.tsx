import { useMachine } from '@/store/useMachine'
import { DECADE_MAP } from '@/data/decades'

export function Footer() {
  const decade = useMachine((s) => s.decade)
  const connected = useMachine((s) => s.connected)
  const connect = useMachine((s) => s.connect)
  const d = DECADE_MAP[decade]

  return (
    <footer className="relative z-10 border-t border-rule bg-paper-raised pb-28">
      <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:gap-16">
          <div>
            <h2 className="max-w-[16ch] font-display text-[30px] leading-[1.06] sm:text-[40px]">
              Ligue a máquina à <em style={{ color: d.ink }}>sua conta</em>.
            </h2>
            <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-ink-2">
              Com o seu histórico conectado, a ordem do catálogo deixa de ser um exemplo e
              passa a ser sobre você. As playlists voltam para a sua biblioteca com capa
              gerada no estilo da época.
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => connect('spotify')}
                className="rounded-full px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[.14em] text-paper-raised transition hover:opacity-90"
                style={{ background: d.ink }}
              >
                {connected.spotify ? 'Spotify conectado' : 'Conectar com Spotify'}
              </button>
              <button
                type="button"
                onClick={() => connect('youtube')}
                className="rounded-full border border-ink/25 px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[.14em] text-ink transition hover:bg-paper"
              >
                {connected.youtube ? 'YouTube conectado' : 'Conectar YouTube Music'}
              </button>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-6 self-start border-t border-rule pt-6 md:border-t-0 md:pt-1">
            {([
              ['Leitura do gosto', 'top artists, top tracks e histórico recente'],
              ['Exportação', 'playlist + capa na sua biblioteca'],
              ['YouTube Music', 'só exportação — a API oficial não expõe histórico'],
              ['Protótipo', 'nenhuma conta real é acessada aqui'],
            ] as const).map(([k, v]) => (
              <div key={k}>
                <dt className="tag">{k}</dt>
                <dd className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-5">
          <span className="tag">The Time Machine · protótipo 2026</span>
          <span className="tag">Sete décadas · 56 faixas · áudio sintetizado no navegador</span>
        </div>
      </div>
    </footer>
  )
}
