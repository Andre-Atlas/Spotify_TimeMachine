import { useEffect } from 'react'
import { TopBar } from '@/components/TopBar'
import { Hero } from '@/components/Hero'
import { CatalogSection } from '@/components/CatalogSection'
import { AffinitySection } from '@/components/AffinitySection'
import { CuratorSection } from '@/components/CuratorSection'
import { PlayerBar } from '@/components/PlayerBar'
import { Footer } from '@/components/Footer'
import { useMachine } from '@/store/useMachine'
import { DECADE_MAP } from '@/data/decades'
import { audio } from '@/lib/audioEngine'

export default function App() {
  const decade = useMachine((s) => s.decade)
  const d = DECADE_MAP[decade]

  /* Uma fonte, dois consumidores: os tokens de cor da década alimentam
     tanto o CSS quanto a arte gerada das capas. */
  useEffect(() => {
    const r = document.documentElement.style
    r.setProperty('--ink-decade', d.ink)
    r.setProperty('--accent', d.accent)
    r.setProperty('--accent-alt', d.accentAlt)
  }, [d])

  /* O AudioContext só pode nascer dentro de um gesto do usuário. */
  useEffect(() => {
    const unlock = () => void audio.init()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => () => audio.dispose(), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && ['INPUT', 'TEXTAREA'].includes(el.tagName)) return
      const s = useMachine.getState()
      if (e.code === 'Space') {
        e.preventDefault()
        s.toggle()
      }
      if (e.code === 'ArrowRight') s.stepDecade(1)
      if (e.code === 'ArrowLeft') s.stepDecade(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div id="topo" className="relative">
      <TopBar />
      <main className="relative z-10">
        <Hero />
        <CatalogSection />
        <AffinitySection />
        <CuratorSection />
      </main>
      <Footer />
      <PlayerBar />
    </div>
  )
}
