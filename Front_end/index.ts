export type DecadeId = '50s' | '60s' | '70s' | '80s' | '90s' | '00s' | '10s'

/** Perfil de filtro do Web Audio aplicado às prévias daquela época. */
export type AudioProfile = 'am' | 'vinyl' | 'mp3' | 'clean'

/** Estética usada pelo gerador procedural de capas. */
export type CoverStyle =
  | 'jazz-modern'
  | 'psychedelic'
  | 'gatefold'
  | 'neon-grid'
  | 'xerox'
  | 'plastic'
  | 'minimal'

export interface Decade {
  id: DecadeId
  label: string
  years: string
  /** Dígitos exibidos nos tubos Nixie. */
  nixie: string
  tagline: string
  genres: string[]

  /** Uma palavra que resume a tecnologia dominante da época. */
  era: string

  /** Paleta. `ink` é a versão legível sobre papel claro (contraste AA);
   *  `accent`/`accentAlt` alimentam a arte gerada das capas. */
  ink: string
  accent: string
  accentAlt: string
  audio: AudioProfile
  cover: CoverStyle
}

export interface Track {
  id: string
  decade: DecadeId
  title: string
  artist: string
  album: string
  year: number
  durationMs: number
  palette: [string, string]

  /** Atributos acústicos — no produto real vêm dos dumps do AcousticBrainz. */
  features: {
    energy: number
    valence: number
    danceability: number
    acousticness: number
    tempo: number
  }
  /** Semente musical do sintetizador procedural (§ audioEngine). */
  music: {
    root: number // semitons acima de C2
    minor: boolean
    bpm: number
    drums: boolean
  }
  /** 0–100: compatibilidade com o perfil de gosto do usuário. */
  affinity: number
  reason?: string
}

export interface Trivia {
  year: number
  text: string
}

export interface CuratorMessage {
  id: string
  role: 'user' | 'curator'
  content: string
  streaming?: boolean
  trackIds?: string[]
}

/** As três superfícies do produto. */
export type Surface = 'landing' | 'onboarding' | 'dashboard'

/** Poses nomeadas do rig de câmera. */
export type PoseName = 'overview' | 'focus' | 'needle' | 'nixie' | 'crt' | 'inside'
