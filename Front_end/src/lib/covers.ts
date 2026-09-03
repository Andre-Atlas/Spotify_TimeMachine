import type { CoverStyle, Track } from '@/types'
import { rng, hash } from '@/lib/math'

/* ══════════════════════════════════════════════════════════════════
 * GERADOR DE CAPAS RETRÔ
 *
 * No produto real o curador devolve um `cover_prompt` na mesma chamada
 * que monta a playlist, e esse prompt vai para o gemini-3-pro-image
 * combinado com um style directive fixo por década (spec §5.5).
 *
 * Aqui a arte é desenhada em canvas com os mesmos style directives
 * traduzidos para geometria. Determinístico pelo id da faixa: a mesma
 * música tem sempre a mesma capa, entre sessões e entre dispositivos.
 * ══════════════════════════════════════════════════════════════════ */

type Ctx = CanvasRenderingContext2D

/** Gira o matiz de uma cor hex — dá variedade sem sair da paleta da faixa. */
function shiftHue(hex: string, deg: number, satBoost = 0): string {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const dd = max - min
    s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min)
    h = max === r ? (g - b) / dd + (g < b ? 6 : 0) : max === g ? (b - r) / dd + 2 : (r - g) / dd + 4
    h /= 6
  }
  h = (h + deg / 360 + 1) % 1
  s = Math.min(1, s + satBoost)
  const hue2 = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const pp = 2 * l - q
  const to = (v: number) => Math.round(Math.min(255, Math.max(0, v * 255)))
  return `#${((to(hue2(pp, q, h + 1 / 3)) << 16) | (to(hue2(pp, q, h)) << 8) | to(hue2(pp, q, h - 1 / 3))).toString(16).padStart(6, '0')}`
}

const SANS = 'system-ui, "Segoe UI", Helvetica, Arial, sans-serif'
const SERIF = 'Georgia, "Times New Roman", serif'
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'

/* ── utilitários ───────────────────────────────────────────────── */

function fitText(ctx: Ctx, text: string, max: number, start: number, font: (s: number) => string) {
  let size = start
  ctx.font = font(size)
  while (ctx.measureText(text).width > max && size > 8) {
    size -= 1
    ctx.font = font(size)
  }
  return size
}

function wrapLines(ctx: Ctx, text: string, max: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > max && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function grain(ctx: Ctx, S: number, amount: number, r: () => number) {
  const img = ctx.getImageData(0, 0, S, S)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
}

/* ── os sete estilos ───────────────────────────────────────────── */

function jazzModern(ctx: Ctx, S: number, p: [string, string], title: string, artist: string, r: () => number) {
  ctx.fillStyle = '#EFE7D6'
  ctx.fillRect(0, 0, S, S)
  // blocos geométricos planos, à moda Reid Miles
  const bw = 0.34 + r() * 0.24
  const bh = 0.3 + r() * 0.2
  const by = 0.28 + r() * 0.12
  ctx.fillStyle = p[1]
  ctx.fillRect(S * 0.08, S * by, S * bw, S * bh)
  ctx.fillStyle = p[0]
  ctx.beginPath()
  ctx.arc(S * (0.58 + r() * 0.24), S * (0.36 + r() * 0.16), S * (0.13 + r() * 0.08), 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#1A1A1A'
  ctx.lineWidth = S * 0.006
  for (let i = 0; i < 5; i++) {
    const y = S * (0.78 + i * 0.022)
    ctx.beginPath()
    ctx.moveTo(S * 0.08, y)
    ctx.lineTo(S * (0.35 + r() * 0.55), y)
    ctx.stroke()
  }
  ctx.fillStyle = '#141414'
  const s1 = fitText(ctx, title.toUpperCase(), S * 0.84, S * 0.1, (s) => `700 ${s}px ${SANS}`)
  ctx.fillText(title.toUpperCase(), S * 0.08, S * 0.2)
  ctx.font = `500 ${s1 * 0.42}px ${SANS}`
  ctx.fillStyle = '#4A4A4A'
  ctx.fillText(artist.toUpperCase(), S * 0.08, S * 0.26)
}

function psychedelic(ctx: Ctx, S: number, p: [string, string], title: string, artist: string, r: () => number) {
  const c = S / 2
  ctx.fillStyle = p[1]
  ctx.fillRect(0, 0, S, S)
  // ondas concêntricas deformadas
  // as cores derivam da paleta DA FAIXA, não de uma lista fixa — senão
  // toda capa psicodélica sai igual
  const hues = [
    p[0],
    shiftHue(p[0], 55, 0.15),
    p[1],
    shiftHue(p[1], -70, 0.2),
    shiftHue(p[0], 165, 0.1),
  ]
  const rings = 16 + Math.floor(r() * 10)
  const lobes = 2 + Math.floor(r() * 5)
  const squash = 0.82 + r() * 0.24
  for (let ring = rings; ring > 0; ring--) {
    ctx.beginPath()
    const base = (ring / rings) * S * 0.8
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.06) {
      const wob = Math.sin(a * (lobes + (ring % 3)) + ring * 0.7) * S * 0.045
      const rad = base + wob
      const x = c + Math.cos(a) * rad
      const y = c + Math.sin(a) * rad * squash
      a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = hues[ring % hues.length]
    ctx.globalAlpha = 0.9
    ctx.fill()
  }
  ctx.globalAlpha = 1
  // plateia escura atrás do título: sem ela a tipografia some no padrão
  ctx.fillStyle = 'rgba(20,4,32,.72)'
  ctx.fillRect(0, S * 0.76, S, S * 0.24)
  // tipografia curvada
  ctx.save()
  ctx.translate(c, S * 0.87)
  ctx.fillStyle = '#FFE9B0'
  const s = fitText(ctx, title, S * 0.82, S * 0.11, (v) => `700 ${v}px ${SERIF}`)
  ctx.textAlign = 'center'
  const chars = [...title]
  const step = 0.055
  chars.forEach((ch, i) => {
    const off = (i - (chars.length - 1) / 2) * step
    ctx.save()
    ctx.rotate(off * 0.5)
    ctx.translate(0, -Math.abs(off) * S * 0.06)
    ctx.fillText(ch, off * S * 0.5, 0)
    ctx.restore()
  })
  ctx.restore()
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,233,176,.72)'
  ctx.font = `600 ${s * 0.36}px ${SANS}`
  ctx.fillText(artist, c, S * 0.955)
  ctx.textAlign = 'left'
  grain(ctx, S, 14, r)
}

function gatefold(ctx: Ctx, S: number, p: [string, string], title: string, artist: string, r: () => number) {
  const g = ctx.createLinearGradient(0, 0, S * 0.4, S)
  g.addColorStop(0, p[0])
  g.addColorStop(0.55, p[1])
  g.addColorStop(1, '#0E0A06')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  // halação: um sol difuso fora de centro
  const gx = S * (0.28 + r() * 0.48)
  const gy = S * (0.18 + r() * 0.28)
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, S * (0.38 + r() * 0.24))
  glow.addColorStop(0, 'rgba(255,236,190,.55)')
  glow.addColorStop(1, 'rgba(255,236,190,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, S, S)
  // horizonte
  const hz = 0.58 + r() * 0.16
  ctx.fillStyle = 'rgba(20,12,6,.55)'
  ctx.fillRect(0, S * hz, S, S * (1 - hz))
  // vinheta
  const v = ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.78)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,.6)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, S, S)

  ctx.fillStyle = '#F6EEDF'
  const s = fitText(ctx, title, S * 0.84, S * 0.105, (x) => `400 ${x}px ${SERIF}`)
  const lines = wrapLines(ctx, title, S * 0.84).slice(0, 2)
  lines.forEach((l, i) => ctx.fillText(l, S * 0.08, S * 0.8 + i * s * 1.1))
  ctx.font = `400 ${s * 0.4}px ${SERIF}`
  ctx.fillStyle = 'rgba(246,238,223,.7)'
  ctx.fillText(artist, S * 0.08, S * 0.93)
  grain(ctx, S, 22, r)
}

function neonGrid(ctx: Ctx, S: number, p: [string, string], title: string, artist: string, r: () => number) {
  // parâmetros sorteados primeiro: o céu depende do horizonte
  const cx = S / 2
  const cy = S * (0.44 + r() * 0.12)
  const rad = S * (0.17 + r() * 0.1)
  const bands = 5 + Math.floor(r() * 5)
  const horizon = 0.58 + r() * 0.08
  const cols = 6 + Math.floor(r() * 5)

  const sky = ctx.createLinearGradient(0, 0, 0, S * horizon)
  sky.addColorStop(0, shiftHue(p[1], -18, 0.05))
  sky.addColorStop(1, p[1])
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, S, S)
  const sun = ctx.createLinearGradient(0, cy - rad, 0, cy + rad)
  sun.addColorStop(0, '#FFD166')
  sun.addColorStop(1, p[0])
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, rad, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = sun
  ctx.fillRect(0, cy - rad, S, rad * 2)
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < bands; i++) {
    const y = cy + rad * 0.1 + i * (rad * 0.16)
    ctx.fillRect(0, y, S, rad * 0.055 + i * rad * 0.012)
  }
  ctx.restore()
  // grade em perspectiva
  ctx.fillStyle = '#08000F'
  ctx.fillRect(0, S * horizon, S, S * (1 - horizon))
  ctx.strokeStyle = p[0]
  ctx.lineWidth = S * 0.004
  ctx.globalAlpha = 0.85
  for (let i = -cols; i <= cols; i++) {
    ctx.beginPath()
    ctx.moveTo(cx + i * (S * 0.04), S * horizon)
    ctx.lineTo(cx + i * (S * 0.42), S)
    ctx.stroke()
  }
  for (let i = 0; i < 9; i++) {
    const y = S * horizon + Math.pow(i / 9, 2.1) * S * (1 - horizon)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(S, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  // tipografia cromada esticada
  ctx.save()
  ctx.translate(cx, S * (horizon - 0.3))
  ctx.scale(1.25, 1)
  ctx.textAlign = 'center'
  const s = fitText(ctx, title.toUpperCase(), (S * 0.86) / 1.25, S * 0.1, (x) => `700 ${x}px ${SANS}`)
  const chrome = ctx.createLinearGradient(0, -s * 0.7, 0, s * 0.3)
  chrome.addColorStop(0, '#FFFFFF')
  chrome.addColorStop(0.5, p[0])
  chrome.addColorStop(0.52, '#7A2E63')
  chrome.addColorStop(1, '#FFD9F1')
  ctx.fillStyle = chrome
  ctx.fillText(title.toUpperCase(), 0, 0)
  ctx.restore()
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,.8)'
  ctx.font = `500 ${S * 0.035}px ${MONO}`
  ctx.fillText(artist.toUpperCase(), cx, S * (horizon - 0.24))
  ctx.textAlign = 'left'
}

function xerox(ctx: Ctx, S: number, p: [string, string], title: string, artist: string, r: () => number) {
  ctx.fillStyle = '#D9D6CE'
  ctx.fillRect(0, 0, S, S)
  // retângulos rasgados com registro sujo
  for (let i = 0; i < 6; i++) {
    ctx.save()
    ctx.translate(S * r(), S * r())
    ctx.rotate((r() - 0.5) * 0.5)
    ctx.globalAlpha = 0.55 + r() * 0.35
    ctx.fillStyle = i % 2 ? p[0] : p[1]
    ctx.fillRect(-S * 0.2, -S * 0.06, S * (0.25 + r() * 0.3), S * (0.05 + r() * 0.12))
    ctx.restore()
  }
  ctx.globalAlpha = 1
  // faixa preta central
  ctx.save()
  ctx.translate(S * 0.5, S * 0.52)
  ctx.rotate(-0.035)
  ctx.fillStyle = '#111'
  ctx.fillRect(-S * 0.48, -S * 0.13, S * 0.96, S * 0.26)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#F2F0EA'
  const s = fitText(ctx, title.toUpperCase(), S * 0.9, S * 0.1, (x) => `700 ${x}px ${SANS}`)
  ctx.fillText(title.toUpperCase(), 0, s * 0.16)
  ctx.restore()
  ctx.save()
  ctx.translate(S * 0.5, S * 0.72)
  ctx.rotate(0.02)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#111'
  ctx.font = `700 ${S * 0.045}px ${MONO}`
  ctx.fillText(artist.toUpperCase(), 0, 0)
  ctx.restore()
  ctx.textAlign = 'left'
  grain(ctx, S, 46, r)
}

function plastic(ctx: Ctx, S: number, p: [string, string], title: string, artist: string, r: () => number) {
  const g = ctx.createLinearGradient(0, 0, S, S)
  g.addColorStop(0, p[1])
  g.addColorStop(1, p[0])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  // forma brilhante com reflexo de piso
  const cx = S * (0.36 + r() * 0.28)
  const cy = S * (0.36 + r() * 0.12)
  const rr = S * (0.19 + r() * 0.08)
  const round = [0.42, 1, 0.12, 0.7][Math.floor(r() * 4)]
  const glossy = ctx.createLinearGradient(cx, cy - rr, cx, cy + rr)
  glossy.addColorStop(0, 'rgba(255,255,255,.95)')
  glossy.addColorStop(0.45, p[0])
  glossy.addColorStop(1, 'rgba(0,0,0,.35)')
  ctx.fillStyle = glossy
  ctx.beginPath()
  ctx.roundRect(cx - rr, cy - rr, rr * 2, rr * 2, rr * round)
  ctx.fill()
  // reflexo
  ctx.save()
  ctx.globalAlpha = 0.28
  ctx.translate(cx, cy + rr * 2.1)
  ctx.scale(1, -0.55)
  ctx.fillStyle = glossy
  ctx.beginPath()
  ctx.roundRect(-rr, -rr, rr * 2, rr * 2, rr * round)
  ctx.fill()
  ctx.restore()
  // brilho especular
  ctx.globalAlpha = 0.5
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.ellipse(cx - rr * 0.3, cy - rr * 0.55, rr * 0.5, rr * 0.22, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.textAlign = 'center'
  ctx.fillStyle = '#FFFFFF'
  fitText(ctx, title, S * 0.86, S * 0.085, (x) => `700 ${x}px ${SANS}`)
  ctx.fillText(title, cx, S * 0.86)
  ctx.font = `500 ${S * 0.036}px ${SANS}`
  ctx.fillStyle = 'rgba(255,255,255,.75)'
  ctx.fillText(artist, cx, S * 0.92)
  ctx.textAlign = 'left'
}

function minimal(ctx: Ctx, S: number, p: [string, string], title: string, artist: string, r: () => number) {
  const ang = r() * Math.PI
  const g = ctx.createLinearGradient(
    S * 0.5 - Math.cos(ang) * S * 0.5,
    S * 0.5 - Math.sin(ang) * S * 0.5,
    S * 0.5 + Math.cos(ang) * S * 0.5,
    S * 0.5 + Math.sin(ang) * S * 0.5,
  )
  g.addColorStop(0, p[0])
  g.addColorStop(1, p[1])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  // véu leve: o suficiente para a tipografia branca segurar, sem
  // transformar a capa num retângulo escuro na miniatura
  ctx.fillStyle = 'rgba(10,10,14,.14)'
  ctx.fillRect(0, 0, S, S)

  // um único elemento gráfico, sorteado — quatro capas minimalistas
  // idênticas não são um sistema, são um descuido
  const cx = S * (0.34 + r() * 0.32)
  const cy = S * (0.32 + r() * 0.16)
  const rr = S * (0.16 + r() * 0.1)
  const shape = Math.floor(r() * 4)
  const filled = r() > 0.55
  ctx.strokeStyle = 'rgba(255,255,255,.82)'
  ctx.fillStyle = 'rgba(255,255,255,.82)'
  ctx.lineWidth = S * 0.014
  ctx.beginPath()
  if (shape === 0) ctx.arc(cx, cy, rr, 0, Math.PI * 2)
  else if (shape === 1) ctx.arc(cx, cy, rr, Math.PI, Math.PI * 2)
  else if (shape === 2) ctx.rect(cx - rr, cy - rr, rr * 2, rr * 2)
  else {
    ctx.moveTo(cx - rr, cy + rr * 0.8)
    ctx.lineTo(cx, cy - rr)
    ctx.lineTo(cx + rr, cy + rr * 0.8)
    ctx.closePath()
  }
  if (filled && shape !== 1) ctx.fill()
  else ctx.stroke()

  // faixa de rodapé: dá pé à tipografia e estrutura a composição
  ctx.fillStyle = 'rgba(10,10,14,.34)'
  ctx.fillRect(0, S * 0.72, S, S * 0.28)

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,.96)'
  const s = fitText(ctx, title, S * 0.78, S * 0.062, (x) => `400 ${x}px ${SANS}`)
  ctx.fillText(title, S * 0.5, S * 0.85)
  ctx.font = `500 ${s * 0.58}px ${SANS}`
  ctx.fillStyle = 'rgba(255,255,255,.66)'
  ctx.fillText(artist.toUpperCase(), S * 0.5, S * 0.93)
  ctx.textAlign = 'left'
  grain(ctx, S, 8, r)
}

/* ── API ───────────────────────────────────────────────────────── */

export function drawCover(
  ctx: Ctx,
  S: number,
  style: CoverStyle,
  palette: [string, string],
  title: string,
  artist: string,
  seed: number,
): void {
  const r = rng(seed)
  ctx.clearRect(0, 0, S, S)
  ctx.textBaseline = 'alphabetic'
  switch (style) {
    case 'jazz-modern': return jazzModern(ctx, S, palette, title, artist, r)
    case 'psychedelic': return psychedelic(ctx, S, palette, title, artist, r)
    case 'gatefold': return gatefold(ctx, S, palette, title, artist, r)
    case 'neon-grid': return neonGrid(ctx, S, palette, title, artist, r)
    case 'xerox': return xerox(ctx, S, palette, title, artist, r)
    case 'plastic': return plastic(ctx, S, palette, title, artist, r)
    case 'minimal': return minimal(ctx, S, palette, title, artist, r)
  }
}

const coverCache = new Map<string, HTMLCanvasElement>()

export function coverCanvas(track: Track, style: CoverStyle, S = 512): HTMLCanvasElement {
  const key = `${track.id}:${style}:${S}`
  const cached = coverCache.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')!
  drawCover(ctx, S, style, track.palette, track.title, track.artist, hash(track.id))
  coverCache.set(key, canvas)
  return canvas
}

export function coverDataUrl(track: Track, style: CoverStyle, S = 256): string {
  const apiBase = import.meta.env.VITE_API_BASE_URL
  const isRealTrack = track.id.split('-')[1]?.length > 5
  const coverUrl = apiBase && isRealTrack ? `${apiBase}/tracks/${track.id}/cover` : track.coverUrl

  if (coverUrl) return coverUrl
  return coverCanvas(track, style, S).toDataURL('image/jpeg', 0.82)
}

/**
 * Disco de vinil desenhado em canvas: sulcos concêntricos com a capa
 * aplicada no label. Usado nos cartões do carrossel e no prato do player.
 */
export function vinylCanvas(track: Track, style: CoverStyle, S = 512): HTMLCanvasElement {
  const key = `vinyl:${track.id}:${style}:${S}`
  const cached = coverCache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')!
  const c = S / 2
  const r = rng(hash(track.id) + 0.31)

  ctx.fillStyle = '#111114'
  ctx.beginPath()
  ctx.arc(c, c, c, 0, Math.PI * 2)
  ctx.fill()

  for (let rr = S * 0.235; rr < c * 0.99; rr += 2.1) {
    ctx.strokeStyle = `rgba(255,255,255,${0.02 + r() * 0.05})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(c, c, rr, 0, Math.PI * 2)
    ctx.stroke()
  }
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = 'rgba(255,255,255,.1)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(c, c, S * (0.27 + i * 0.055), 0, Math.PI * 2)
    ctx.stroke()
  }

  // brilho especular diagonal — é o que faz o disco parecer vinil e não papel
  const sheen = ctx.createLinearGradient(0, 0, S, S)
  sheen.addColorStop(0, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.42, 'rgba(255,255,255,.09)')
  sheen.addColorStop(0.5, 'rgba(255,255,255,.16)')
  sheen.addColorStop(0.58, 'rgba(255,255,255,.06)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.save()
  ctx.beginPath()
  ctx.arc(c, c, c, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = sheen
  ctx.fillRect(0, 0, S, S)
  ctx.restore()

  const label = S * 0.225
  ctx.save()
  ctx.beginPath()
  ctx.arc(c, c, label, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(coverCanvas(track, style, 512), c - label, c - label, label * 2, label * 2)
  ctx.restore()

  ctx.strokeStyle = 'rgba(0,0,0,.35)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(c, c, label, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = '#0A0A0C'
  ctx.beginPath()
  ctx.arc(c, c, S * 0.016, 0, Math.PI * 2)
  ctx.fill()

  coverCache.set(key, canvas)
  return canvas
}

export function vinylDataUrl(track: Track, style: CoverStyle, S = 384): string {
  return vinylCanvas(track, style, S).toDataURL('image/png')
}
