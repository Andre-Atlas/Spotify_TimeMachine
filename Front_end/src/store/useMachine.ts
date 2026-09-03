import { create } from 'zustand'
import type { CuratorMessage, DecadeId, Track } from '@/types'
import { DECADES, DECADE_MAP } from '@/data/decades'
import { audio } from '@/lib/audioEngine'

interface MachineState {
  decade: DecadeId
  /** Índice da faixa em foco dentro da década. */
  focused: number
  /** Bloqueia o carrossel durante a troca de década. */
  shifting: boolean

  isPlaying: boolean
  progress: number
  volume: number
  filtersOn: boolean

  connected: { spotify: boolean; youtube: boolean }
  spotifyUser: { name: string; imageUrl?: string } | null
  messages: CuratorMessage[]
  savedPlaylists: Array<{ id: string; title: string; decade: DecadeId; trackIds: string[] }>

  tracksMap: Partial<Record<DecadeId, Track[]>>
  loadingTracks: boolean
  loadDecadeTracks: (decade: DecadeId) => Promise<void>

  tracks: () => Track[]
  current: () => Track | undefined

  goToDecade: (d: DecadeId) => void
  stepDecade: (dir: 1 | -1) => void
  setFocused: (i: number) => void
  playTrack: (i: number) => void
  toggle: () => void
  next: () => void
  prev: () => void
  seek: (p: number) => void
  tick: (dt: number) => void
  setVolume: (v: number) => void
  toggleFilters: () => void

  connect: (p: 'spotify' | 'youtube') => void
  disconnect: (p: 'spotify' | 'youtube') => void
  setSpotifyUser: (user: { name: string; imageUrl?: string } | null) => void
  pushMessage: (m: CuratorMessage) => void
  appendToLast: (chunk: string) => void
  finishLast: (trackIds?: string[]) => void
  savePlaylist: (title: string, trackIds: string[]) => void
}

/** Profile de áudio efetivo: os filtros de época podem estar desligados. */
function profileOf(decade: DecadeId, filtersOn: boolean) {
  return filtersOn ? DECADE_MAP[decade].audio : 'clean'
}

export const useMachine = create<MachineState>((set, get) => ({
  decade: '80s',
  focused: 0,
  shifting: false,

  isPlaying: false,
  progress: 0,
  volume: 0.5,
  filtersOn: true,

  connected: { spotify: false, youtube: false },
  spotifyUser: null,
  messages: [],
  savedPlaylists: [],

  tracksMap: {},
  loadingTracks: false,

  loadDecadeTracks: async (decade) => {
    const s = get()
    if (s.tracksMap[decade]) return // ja carregou
    set({ loadingTracks: true })
    try {
      const token = localStorage.getItem('spotify_token') || ''
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1'
      // Passa o token no header para que o backend faca o Taste Alignment se possivel
      const res = await fetch(`${apiBase}/decades/${decade}/tracks?taste=1`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (!res.ok) throw new Error('Falha ao carregar')
      const data = await res.json()
      set((prev) => ({ tracksMap: { ...prev.tracksMap, [decade]: data }, loadingTracks: false }))
    } catch (e) {
      console.error(e)
      set({ loadingTracks: false })
    }
  },

  tracks: () => get().tracksMap[get().decade] || [],
  current: () => (get().tracksMap[get().decade] || [])[get().focused],

  /**
   * A troca de década é uma sequência, não um set: os dígitos do Nixie
   * rolam com 40 ms de defasagem entre tubos (420 ms no total) e só então
   * o catálogo troca. Sem isso o relógio parece um label, não um mecanismo.
   */
  goToDecade: (decade) => {
    const s = get()
    if (decade === s.decade || s.shifting) return
    set({ shifting: true })
    void get().loadDecadeTracks(decade)

    window.setTimeout(() => {
      set({ decade, focused: 0, progress: 0 })
      const t = get().tracksMap[decade]?.[0]
      if (t && get().isPlaying) void audio.playTrack(t, profileOf(decade, get().filtersOn), 650)
      else audio.setProfile(profileOf(decade, get().filtersOn))

      // Pré-carrega as décadas vizinhas: quando a pessoa continuar girando o
      // arco/dial, a próxima parada já está (ou está a caminho de estar)
      // pronta — loadDecadeTracks já ignora décadas que já carregaram, então
      // isso não duplica chamadas.
      const idx = DECADES.findIndex((d) => d.id === decade)
      const nextId = DECADES[(idx + 1) % DECADES.length].id
      const prevId = DECADES[(idx - 1 + DECADES.length) % DECADES.length].id
      void get().loadDecadeTracks(nextId)
      void get().loadDecadeTracks(prevId)
    }, 180)
    window.setTimeout(() => set({ shifting: false }), 620)
  },

  stepDecade: (dir) => {
    const i = DECADES.findIndex((d) => d.id === get().decade)
    get().goToDecade(DECADES[(i + dir + DECADES.length) % DECADES.length].id)
  },

  setFocused: (focused) => {
    if (focused === get().focused) return
    set({ focused, progress: 0 })
    const s = get()
    const t = (s.tracksMap[s.decade] || [])[focused]
    // prévia com fade-in ao focar, como agulha encostando no sulco
    if (t && s.isPlaying) void audio.playTrack(t, profileOf(s.decade, s.filtersOn), 450)
  },

  playTrack: (i) => {
    const s = get()
    const t = (s.tracksMap[s.decade] || [])[i]
    if (!t) return
    void audio.playTrack(t, profileOf(s.decade, s.filtersOn), 500)
    set({ focused: i, isPlaying: true, progress: i === s.focused ? s.progress : 0 })
  },

  toggle: () => {
    const s = get()
    const on = !s.isPlaying
    const t = s.current()
    if (on && t) void audio.playTrack(t, profileOf(s.decade, s.filtersOn), 450)
    else audio.fadeOut(320)
    set({ isPlaying: on })
  },

  next: () => get().setFocused((get().focused + 1) % get().tracks().length),
  prev: () => {
    if (get().progress > 0.06) return set({ progress: 0 })
    const n = get().tracks().length
    get().setFocused((get().focused - 1 + n) % n)
  },

  seek: (p) => set({ progress: Math.min(1, Math.max(0, p)) }),

  tick: (dt) => {
    const { isPlaying, progress } = get()
    const t = get().current()
    if (!isPlaying || !t) return
    const p = progress + (dt * 1000) / t.durationMs
    if (p >= 1) return get().next()
    set({ progress: p })
  },

  setVolume: (v) => {
    audio.setVolume(v)
    set({ volume: v })
  },

  toggleFilters: () => {
    const filtersOn = !get().filtersOn
    audio.setProfile(profileOf(get().decade, filtersOn))
    set({ filtersOn })
  },

  connect: (p) => set((s) => ({ connected: { ...s.connected, [p]: true } })),
  disconnect: (p) => set((s) => ({ connected: { ...s.connected, [p]: false }, spotifyUser: p === 'spotify' ? null : s.spotifyUser })),
  setSpotifyUser: (user) => set({ spotifyUser: user }),

  pushMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),

  appendToLast: (chunk) =>
    set((s) => {
      const messages = s.messages.slice()
      const last = messages[messages.length - 1]
      if (last) messages[messages.length - 1] = { ...last, content: last.content + chunk }
      return { messages }
    }),

  finishLast: (trackIds) =>
    set((s) => {
      const messages = s.messages.slice()
      const last = messages[messages.length - 1]
      if (last) messages[messages.length - 1] = { ...last, streaming: false, trackIds }
      return { messages }
    }),

  savePlaylist: (title, trackIds) =>
    set((s) => ({
      savedPlaylists: [
        { id: `pl-${s.savedPlaylists.length + 1}`, title, decade: s.decade, trackIds },
        ...s.savedPlaylists,
      ],
    })),
}))
