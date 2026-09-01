import { useMachine } from '@/store/useMachine'
import { DECADE_MAP } from '@/data/decades'

export function TopBar() {
  const decade = useMachine((s) => s.decade)
  const connected = useMachine((s) => s.connected)
  const connect = useMachine((s) => s.connect)
  const d = DECADE_MAP[decade]

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
          onClick={() => connect('spotify')}
          className="ml-auto shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[.1em] text-paper-raised transition hover:opacity-90 sm:px-3.5 sm:text-[11px] sm:tracking-[.12em] md:ml-0"
          style={{ background: d.ink }}
        >
          {connected.spotify ? 'Conta conectada' : 'Conectar conta'}
        </button>
      </div>
    </div>
  )
}
