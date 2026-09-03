import type { Track, DecadeId } from '@/types'
import SEED_TRACKS from './seed_tracks.json'
import { hash } from '@/lib/math'

type Seed = [
  title: string,
  artist: string,
  album: string,
  year: number,
  seconds: number,
  energy: number,
  valence: number,
  dance: number,
  acoustic: number,
  tempo: number,
  c1: string,
  c2: string,
]

const SEEDS: Record<DecadeId, Seed[]> = {
  '50s': [
    ['Johnny B. Goode', 'Chuck Berry', 'Chuck Berry Is on Top', 1958, 161, 0.82, 0.93, 0.62, 0.24, 168, '#E8C88A', '#7A3B12'],
    ['Blue Moon', 'Elvis Presley', 'Elvis Presley', 1956, 143, 0.28, 0.31, 0.34, 0.78, 76, '#2E3A4F', '#C9A227'],
    ['Take Five', 'Dave Brubeck Quartet', 'Time Out', 1959, 324, 0.41, 0.55, 0.58, 0.62, 174, '#1F2933', '#D98E04'],
    ['La Bamba', 'Ritchie Valens', 'Ritchie Valens', 1958, 126, 0.86, 0.95, 0.71, 0.31, 152, '#B5342B', '#F2C14E'],
    ['Fever', 'Peggy Lee', 'Beauty and the Beat!', 1958, 199, 0.34, 0.48, 0.66, 0.55, 100, '#111318', '#C0392B'],
    ['Rock Around the Clock', 'Bill Haley &amp; His Comets', 'Rock Around the Clock', 1954, 128, 0.88, 0.92, 0.68, 0.27, 182, '#E8C88A', '#3B2C1A'],
    ['Sh-Boom', 'The Chords', 'Sh-Boom', 1954, 154, 0.55, 0.86, 0.59, 0.49, 132, '#D6A756', '#4B2E12'],
    ['Hound Dog', 'Big Mama Thornton', 'Hound Dog', 1952, 155, 0.64, 0.61, 0.63, 0.44, 90, '#6E4B1F', '#E0B15E'],
  ],
  '60s': [
    ['Come Together', 'The Beatles', 'Abbey Road', 1969, 259, 0.62, 0.44, 0.68, 0.18, 82, '#FF8A3D', '#5B2A86'],
    ['Respect', 'Aretha Franklin', 'I Never Loved a Man', 1967, 147, 0.79, 0.9, 0.8, 0.22, 115, '#FFD166', '#C1121F'],
    ['Purple Haze', 'Jimi Hendrix', 'Are You Experienced', 1967, 170, 0.88, 0.55, 0.49, 0.06, 109, '#7B2CBF', '#FF8A3D'],
    ['My Girl', 'The Temptations', 'The Temptations Sing Smokey', 1964, 165, 0.45, 0.86, 0.62, 0.41, 104, '#06D6A0', '#FFD166'],
    ['Paint It, Black', 'The Rolling Stones', 'Aftermath', 1966, 202, 0.85, 0.36, 0.55, 0.09, 160, '#22223B', '#E63946'],
    ['A Change Is Gonna Come', 'Sam Cooke', 'Ain’t That Good News', 1964, 191, 0.31, 0.28, 0.35, 0.72, 68, '#3A506B', '#FFB703'],
    ['Good Vibrations', 'The Beach Boys', 'Smiley Smile', 1966, 219, 0.6, 0.83, 0.5, 0.35, 132, '#4CC9F0', '#FFD166'],
    ['Fortunate Son', 'Creedence Clearwater Revival', 'Willy and the Poor Boys', 1969, 140, 0.87, 0.66, 0.57, 0.11, 133, '#8A5A28', '#E5533D'],
  ],
  '70s': [
    ['Bohemian Rhapsody', 'Queen', 'A Night at the Opera', 1975, 354, 0.7, 0.22, 0.39, 0.29, 72, '#FFB703', '#3D348B'],
    ['Superstition', 'Stevie Wonder', 'Talking Book', 1972, 245, 0.83, 0.84, 0.87, 0.05, 100, '#FB8500', '#8338EC'],
    ['Comfortably Numb', 'Pink Floyd', 'The Wall', 1979, 382, 0.52, 0.2, 0.34, 0.16, 63, '#1D3557', '#E63946'],
    ['Stayin’ Alive', 'Bee Gees', 'Saturday Night Fever', 1977, 285, 0.76, 0.8, 0.92, 0.11, 104, '#FFD166', '#EF476F'],
    ['London Calling', 'The Clash', 'London Calling', 1979, 199, 0.9, 0.47, 0.52, 0.03, 133, '#000814', '#FFB703'],
    ['Dreams', 'Fleetwood Mac', 'Rumours', 1977, 257, 0.51, 0.6, 0.75, 0.35, 120, '#E0AAFF', '#5A189A'],
    ['Vitamin C', 'Can', 'Ege Bamyası', 1972, 208, 0.74, 0.42, 0.81, 0.08, 112, '#D6752A', '#1B1B2F'],
    ['Strawberry Letter 23', 'Shuggie Otis', 'Inspiration Information', 1971, 232, 0.49, 0.72, 0.7, 0.28, 96, '#F4A261', '#6D597A'],
  ],
  '80s': [
    ['Blue Monday', 'New Order', 'Blue Monday', 1983, 448, 0.85, 0.44, 0.86, 0.02, 130, '#22E0FF', '#3D348B'],
    ['Billie Jean', 'Michael Jackson', 'Thriller', 1982, 294, 0.79, 0.72, 0.92, 0.03, 117, '#FF2D95', '#0B0616'],
    ['Take On Me', 'a-ha', 'Hunting High and Low', 1985, 225, 0.88, 0.86, 0.57, 0.02, 169, '#4CC9F0', '#F72585'],
    ['Sweet Dreams (Are Made of This)', 'Eurythmics', 'Sweet Dreams', 1983, 216, 0.72, 0.42, 0.79, 0.06, 126, '#C77DFF', '#10002B'],
    ['Purple Rain', 'Prince', 'Purple Rain', 1984, 520, 0.6, 0.3, 0.4, 0.15, 113, '#7209B7', '#F72585'],
    ['Enjoy the Silence', 'Depeche Mode', 'Violator', 1990, 373, 0.68, 0.35, 0.74, 0.04, 112, '#22E0FF', '#240046'],
    ['Just Like Heaven', 'The Cure', 'Kiss Me, Kiss Me, Kiss Me', 1987, 213, 0.81, 0.75, 0.6, 0.05, 148, '#FF5CC8', '#1B1035'],
    ['Planet Rock', 'Afrika Bambaataa', 'Planet Rock', 1982, 383, 0.78, 0.68, 0.9, 0.01, 128, '#F72585', '#02010A'],
  ],
  '90s': [
    ['Smells Like Teen Spirit', 'Nirvana', 'Nevermind', 1991, 301, 0.91, 0.72, 0.5, 0.0, 117, '#8AC926', '#1A1423'],
    ['Bittersweet Symphony', 'The Verve', 'Urban Hymns', 1997, 348, 0.63, 0.31, 0.53, 0.12, 86, '#ADB5BD', '#3A0CA3'],
    ['Ready or Not', 'Fugees', 'The Score', 1996, 227, 0.55, 0.42, 0.72, 0.19, 87, '#2B9348', '#161A1D'],
    ['Wonderwall', 'Oasis', '(What’s the Story) Morning Glory?', 1995, 258, 0.59, 0.44, 0.41, 0.36, 87, '#457B9D', '#F1FAEE'],
    ['Around the World', 'Daft Punk', 'Homework', 1997, 429, 0.87, 0.75, 0.94, 0.01, 121, '#22E0FF', '#F72585'],
    ['Zombie', 'The Cranberries', 'No Need to Argue', 1994, 306, 0.78, 0.2, 0.44, 0.11, 84, '#40916C', '#212529'],
    ['Killing in the Name', 'Rage Against the Machine', 'Rage Against the Machine', 1992, 313, 0.94, 0.38, 0.55, 0.0, 89, '#C1121F', '#0B090A'],
    ['Protection', 'Massive Attack', 'Protection', 1994, 470, 0.4, 0.34, 0.68, 0.15, 88, '#5C677D', '#1B263B'],
  ],
  '00s': [
    ['Last Nite', 'The Strokes', 'Is This It', 2001, 193, 0.82, 0.78, 0.61, 0.04, 105, '#E76F51', '#264653'],
    ['Seven Nation Army', 'The White Stripes', 'Elephant', 2003, 232, 0.79, 0.32, 0.74, 0.01, 124, '#D00000', '#03071E'],
    ['Crazy in Love', 'Beyoncé', 'Dangerously in Love', 2003, 236, 0.84, 0.7, 0.66, 0.05, 100, '#FF006E', '#FFBE0B'],
    ['Mr. Brightside', 'The Killers', 'Hot Fuss', 2004, 222, 0.92, 0.76, 0.35, 0.0, 148, '#4D7CFF', '#F72585'],
    ['Hey Ya!', 'OutKast', 'Speakerboxxx/The Love Below', 2003, 235, 0.88, 0.96, 0.72, 0.1, 79, '#06D6A0', '#EF476F'],
    ['Paper Planes', 'M.I.A.', 'Kala', 2007, 205, 0.65, 0.62, 0.83, 0.09, 86, '#FFD60A', '#003566'],
    ['Maps', 'Yeah Yeah Yeahs', 'Fever to Tell', 2003, 220, 0.6, 0.4, 0.42, 0.08, 100, '#B5179E', '#1D1D2C'],
    ['Idioteque', 'Radiohead', 'Kid A', 2000, 289, 0.7, 0.25, 0.71, 0.03, 140, '#4361EE', '#0B132B'],
  ],
  '10s': [
    ['Midnight City', 'M83', 'Hurry Up, We’re Dreaming', 2011, 244, 0.83, 0.55, 0.58, 0.02, 105, '#B892FF', '#0B0616'],
    ['Get Lucky', 'Daft Punk', 'Random Access Memories', 2013, 369, 0.81, 0.86, 0.79, 0.04, 116, '#FFD166', '#7209B7'],
    ['Blinding Lights', 'The Weeknd', 'After Hours', 2019, 200, 0.73, 0.33, 0.51, 0.0, 171, '#FF2D95', '#1A1423'],
    ['Do I Wanna Know?', 'Arctic Monkeys', 'AM', 2013, 272, 0.55, 0.41, 0.55, 0.19, 85, '#9D0208', '#03071E'],
    ['Redbone', 'Childish Gambino', 'Awaken, My Love!', 2016, 327, 0.42, 0.53, 0.74, 0.28, 80, '#E85D04', '#370617'],
    ['Take Me Out', 'Two Door Cinema Club', 'Tourist History', 2010, 174, 0.86, 0.83, 0.66, 0.02, 130, '#22E0FF', '#2B2D42'],
    ['The Less I Know the Better', 'Tame Impala', 'Currents', 2015, 216, 0.7, 0.79, 0.64, 0.14, 117, '#FF5CC8', '#2D1B4E'],
    ['Nights', 'Frank Ocean', 'Blonde', 2016, 307, 0.5, 0.45, 0.6, 0.22, 89, '#7B9EA8', '#221E22'],
  ],
}

/** Perfil de gosto demo — no produto real vem de GET /v1/me/taste. */
export const DEMO_TASTE = { energy: 0.78, valence: 0.55, danceability: 0.7, acousticness: 0.08 }

function affinityFor(f: Track['features']): number {
  const d =
    Math.abs(f.energy - DEMO_TASTE.energy) * 1.2 +
    Math.abs(f.valence - DEMO_TASTE.valence) * 0.7 +
    Math.abs(f.danceability - DEMO_TASTE.danceability) * 1.0 +
    Math.abs(f.acousticness - DEMO_TASTE.acousticness) * 0.6
  return Math.round(Math.max(38, 100 - (d / 3.5) * 100))
}

export const TRACKS: Track[] = (Object.keys(SEEDS) as DecadeId[]).flatMap((decade) =>
  SEEDS[decade].map((s, i) => {
    const id = `${decade}-${i}`
    const features = {
      energy: s[5],
      valence: s[6],
      danceability: s[7],
      acousticness: s[8],
      tempo: s[9],
    }
    // A semente musical é derivada dos atributos: mesma faixa, mesmo som, sempre.
    const music = {
      root: Math.floor(hash(id) * 12),
      minor: features.valence < 0.5,
      bpm: Math.max(68, Math.min(150, features.tempo > 150 ? features.tempo / 2 : features.tempo)),
      drums: decade !== '50s' || features.energy > 0.6,
    }
    return {
      id,
      decade,
      title: s[0].replace('&amp;', '&'),
      artist: s[1].replace('&amp;', '&'),
      album: s[2],
      year: s[3],
      durationMs: s[4] * 1000,
      palette: [s[10], s[11]] as [string, string],
      features,
      music,
      // Sem correspondente real no seed manual (o backend usa a popularidade
      // que a Groq estima); deriva um valor plausível e determinístico do id
      // — mesma faixa, sempre a mesma popularidade, sem precisar inventar
      // 56 números à mão.
      popularity: Math.round(40 + hash(`${id}-pop`) * 55),
      affinity: affinityFor(features),
    }
  }),
)

export const TRACK_MAP: Record<string, Track> = {}
;(SEED_TRACKS as unknown as Track[]).forEach((t) => {
  TRACK_MAP[t.id] = { ...t, affinity: affinityFor(t.features) }
})

export function tracksOfDecade(decade: DecadeId): Track[] {
  const tracks = (SEED_TRACKS as unknown as Track[]).filter((t) => t.decade === decade)

  return tracks.map((t) => ({
    ...t,
    affinity: affinityFor(t.features),
  }))
}

// force reload 09/01/2026 22:59:54
