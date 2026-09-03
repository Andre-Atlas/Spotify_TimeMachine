import { useEffect } from 'react'
import { useMachine } from '@/store/useMachine'
import { DECADE_MAP } from '@/data/decades'

export function TopBar() {
  const decade = useMachine((s) => s.decade)
  const connected = useMachine((s) => s.connected)
  const connect = useMachine((s) => s.connect)
  const spotifyUser = useMachine((s) => s.spotifyUser)
  const d = DECADE_MAP[decade]

  useEffect(() => {
    const hash = window.location.hash
    let token = localStorage.getItem('spotify_token')
    
    if (hash.includes('error=')) {
      localStorage.removeItem('spotify_token')
      useMachine.getState().disconnect('spotify')
      window.history.replaceState(null, '', window.location.pathname)
      alert('Erro ao conectar com Spotify: Você provavelmente não está na whitelist do Developer Dashboard.')
    } else if (hash.includes('token=')) {
      const hashToken = new URLSearchParams(hash.substring(1)).get('token')
      if (hashToken) {
        token = hashToken
        localStorage.setItem('spotify_token', token)
        window.history.replaceState(null, '', window.location.pathname)
      }
    }
    
    if (token) {
      if (!connected.spotify) connect('spotify')
      
      const user = useMachine.getState().spotifyUser
      if (!user) {
        fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => res.json()).then(data => {
          if (data.error) {
            localStorage.removeItem('spotify_token')
            useMachine.getState().disconnect('spotify')
          } else {
            useMachine.getState().setSpotifyUser({
              name: data.display_name,
              imageUrl: data.images?.[0]?.url
            })
          }
        }).catch(() => {})
      }
    }
  }, [connected.spotify, connect])

  const handleConnect = () => {
    const apiBase = import.meta.env.VITE_API_BASE_URL
    if (connected.spotify) {
      localStorage.removeItem('spotify_token')
      useMachine.getState().disconnect('spotify')
    } else if (apiBase) {
      window.location.href = `${apiBase}/auth/spotify/login`
    } else {
      connect('spotify')
    }
  }

  return (
    <div className="sticky top-0 z-40 border-b border-rule bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-5 py-2.5 sm:px-8">
        <a href="#topo" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-full border border-ink/20"
            style={{ background: `color-mix(in srgb, ${d.ink} 18%, transparent)` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.ink }} />
          </span>
          <span className="whitespace-nowrap font-display text-[11px] font-bold uppercase tracking-[.14em] text-ink sm:text-[13px] sm:tracking-[.2em]">
            The Time Machine
          </span>
        </a>

        <nav className="ml-auto hidden items-center gap-6 md:flex">
          {[
            ['#catalogo', 'Catálogo'],
            ['#afinidade', 'Afinidade'],
            ['#curador', 'Curador'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="tag transition hover:!text-ink">
              {label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          onClick={handleConnect}
          className="ml-auto shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[.1em] text-paper-raised transition hover:opacity-90 sm:px-3.5 sm:text-[11px] sm:tracking-[.12em] md:ml-0 flex items-center gap-2"
          style={{ background: d.ink }}
        >
          {connected.spotify ? (
            <>
              {spotifyUser?.imageUrl && (
                <img src={spotifyUser.imageUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
              )}
              {spotifyUser?.name || 'CONTA CONECTADA'}
            </>
          ) : (
            'CONECTAR CONTA'
          )}
        </button>
      </div>
    </div>
  )
}
