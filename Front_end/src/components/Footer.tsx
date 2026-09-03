import { useMachine } from '@/store/useMachine'
import { DECADE_MAP } from '@/data/decades'

export function Footer() {
  const decade = useMachine((s) => s.decade)
  const connected = useMachine((s) => s.connected)
  const connect = useMachine((s) => s.connect)
  const spotifyUser = useMachine((s) => s.spotifyUser)
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
                onClick={() => {
                  const apiBase = import.meta.env.VITE_API_BASE_URL
                  if (connected.spotify) {
                    localStorage.removeItem('spotify_token')
                    useMachine.getState().disconnect('spotify')
                  } else if (apiBase) {
                    window.location.href = `${apiBase}/auth/spotify/login`
                  } else {
                    connect('spotify')
                  }
                }}
                className="rounded-full px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[.14em] text-paper-raised transition hover:opacity-90 flex items-center gap-2"
                style={{ background: d.ink }}
              >
                {connected.spotify ? (
                  <>
                    {spotifyUser?.imageUrl && (
                      <img src={spotifyUser.imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                    )}
                    {spotifyUser?.name ? `${spotifyUser.name} CONECTADO(A)` : 'SPOTIFY CONECTADO'}
                  </>
                ) : (
                  'Conectar com Spotify'
                )}
              </button>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-6 self-start border-t border-rule pt-6 md:border-t-0 md:pt-1">
            {([
              ['Leitura do gosto', 'top artists, top tracks e histórico recente'],
              ['Exportação', 'playlist + capa na sua biblioteca'],
              ['Privacidade', 'Nenhuma música é salva em nossos servidores'],
              ['Protótipo', 'Integrado com seu Spotify'],
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
