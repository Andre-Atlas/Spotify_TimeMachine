import type { AudioProfile, Track } from '@/types'
import { rng } from '@/lib/math'

/* ══════════════════════════════════════════════════════════════════
 * MOTOR DE ÁUDIO
 *
 * O produto real toca prévias de 30 s do Deezer através de
 * MediaElementSource — a única fonte que expõe PCM e portanto a única
 * que o Web Audio API consegue filtrar (Spotify SDK e YouTube IFrame
 * são DRM/iframe e não expõem nada). Ver spec §1.3.
 *
 * Aqui a fonte é um sintetizador procedural: cada faixa gera um motivo
 * determinístico a partir do seu id e dos seus atributos acústicos.
 * Isso mantém o protótipo 100% offline e — mais importante — dá aos
 * filtros de década um sinal real para trabalhar, que é o ponto.
 *
 * Para trocar pela fonte real, substitua `startVoices()` por:
 *   const el = new Audio(previewUrl); el.crossOrigin = 'anonymous'
 *   ctx.createMediaElementSource(el).connect(this.insertIn)
 * O resto da cadeia não muda em nada.
 * ══════════════════════════════════════════════════════════════════ */

const A4 = 440
const midi = (n: number) => A4 * Math.pow(2, (n - 69) / 12)

/** Progressões: menor = i–VI–III–VII, maior = I–V–vi–IV. */
const PROG_MINOR = [0, 8, 3, 10]
const PROG_MAJOR = [0, 7, 9, 5]
const TRIAD_MINOR = [0, 3, 7]
const TRIAD_MAJOR = [0, 4, 7]

interface DecadeVoicing {
  pad: OscillatorType
  bass: OscillatorType
  lead: OscillatorType | null
  padGain: number
  bassGain: number
  leadGain: number
  drumGain: number
  padCutoff: number
  detune: number
}

const VOICING: Record<AudioProfile, DecadeVoicing> = {
  // 50s/60s — poucas vozes, timbre doce, sem arpejo
  am: { pad: 'triangle', bass: 'triangle', lead: null, padGain: 0.16, bassGain: 0.2, leadGain: 0, drumGain: 0.11, padCutoff: 2200, detune: 4 },
  // 70s/80s — pad serrado quente e arpejo
  vinyl: { pad: 'sawtooth', bass: 'sawtooth', lead: 'square', padGain: 0.11, bassGain: 0.22, leadGain: 0.07, drumGain: 0.15, padCutoff: 1700, detune: 9 },
  // 90s — mais sujo, sem brilho
  mp3: { pad: 'sawtooth', bass: 'square', lead: 'sawtooth', padGain: 0.1, bassGain: 0.24, leadGain: 0.06, drumGain: 0.18, padCutoff: 1400, detune: 12 },
  // 00s/10s — brilhante e aberto
  clean: { pad: 'sawtooth', bass: 'sawtooth', lead: 'sawtooth', padGain: 0.1, bassGain: 0.2, leadGain: 0.08, drumGain: 0.14, padCutoff: 3200, detune: 7 },
}

function tanhCurve(drive: number, n = 1024): Float32Array<ArrayBuffer> {
  // buffer explícito: `curve` do WaveShaperNode exige Float32Array<ArrayBuffer>
  const c = new Float32Array(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    c[i] = Math.tanh(x * drive) / Math.tanh(drive)
  }
  return c
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  /** Entrada da cadeia de insert — tudo (síntese, chiado, crackle) passa por aqui. */
  private insertIn!: GainNode
  private insertOut!: GainNode
  private chain: AudioNode[] = []
  /** LFO de wow & flutter, roteado para o detune de cada oscilador. */
  private wow!: GainNode
  private noiseBuf: AudioBuffer | null = null

  private profile: AudioProfile = 'clean'
  private timer: number | null = null
  private crackleTimer: number | null = null
  private nextNoteTime = 0
  private step = 0
  private track: Track | null = null
  private volume = 0.7
  private live: Array<OscillatorNode | AudioBufferSourceNode> = []

  get ready() {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  /** Só pode ser chamado dentro de um gesto do usuário. */
  async init(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      return
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor()
    this.ctx = ctx

    this.master = ctx.createGain()
    this.master.gain.value = this.volume
    this.master.connect(ctx.destination)

    this.insertIn = ctx.createGain()
    this.insertOut = ctx.createGain()
    this.insertOut.connect(this.master)

    this.wow = ctx.createGain()
    this.wow.gain.value = 0
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.8
    lfo.connect(this.wow)
    lfo.start()

    // buffer de ruído reaproveitado por chiado, prato e crackle
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    this.noiseBuf = buf

    await ctx.resume()
    this.buildChain(this.profile)
  }

  /* ── Cadeia de insert por década ──────────────────────────────── */

  setProfile(profile: AudioProfile): void {
    if (!this.ctx || profile === this.profile) {
      this.profile = profile
      return
    }
    const ctx = this.ctx
    const now = ctx.currentTime
    // crossfade de 320 ms: nunca troca a cadeia com sinal passando
    this.insertOut.gain.cancelScheduledValues(now)
    this.insertOut.gain.setValueAtTime(this.insertOut.gain.value, now)
    this.insertOut.gain.linearRampToValueAtTime(0.0001, now + 0.16)
    window.setTimeout(() => {
      this.buildChain(profile)
      const t = ctx.currentTime
      this.insertOut.gain.setValueAtTime(0.0001, t)
      this.insertOut.gain.linearRampToValueAtTime(1, t + 0.16)
    }, 170)
  }

  private buildChain(profile: AudioProfile): void {
    const ctx = this.ctx!
    this.profile = profile
    this.teardownChain()
    this.insertIn.disconnect()

    const nodes: AudioNode[] = []
    const push = <T extends AudioNode>(n: T): T => {
      nodes.push(n)
      return n
    }

    if (profile === 'am') {
      // Rádio AM valvulado: banda estreita, saturação suave, chiado de fita
      const bp = push(ctx.createBiquadFilter())
      bp.type = 'bandpass'
      bp.frequency.value = 1600
      bp.Q.value = 0.9

      const shaper = push(ctx.createWaveShaper())
      shaper.curve = tanhCurve(2.5)
      shaper.oversample = '2x'

      const comp = push(ctx.createDynamicsCompressor())
      comp.threshold.value = -22
      comp.ratio.value = 6
      comp.knee.value = 12
      comp.attack.value = 0.004

      this.hiss(-34, 3200)
      this.wow.gain.value = 0
    } else if (profile === 'vinyl') {
      // Vinil: peso embaixo, brilho cortado, estalos e instabilidade de prato
      const low = push(ctx.createBiquadFilter())
      low.type = 'lowshelf'
      low.frequency.value = 120
      low.gain.value = 2.5

      const high = push(ctx.createBiquadFilter())
      high.type = 'highshelf'
      high.frequency.value = 9000
      high.gain.value = -3

      this.startCrackle()
      this.wow.gain.value = 2.6 // cents
    } else if (profile === 'mp3') {
      // MP3 128 kbps: compressão pesada, corte alto e o pré-eco característico
      const comp = push(ctx.createDynamicsCompressor())
      comp.threshold.value = -18
      comp.ratio.value = 8
      comp.attack.value = 0.003
      comp.release.value = 0.12

      const lp = push(ctx.createBiquadFilter())
      lp.type = 'lowpass'
      lp.frequency.value = 15500

      // pré-eco: um eco curtíssimo ANTES do transiente, sem realimentação
      const delay = ctx.createDelay(0.05)
      delay.delayTime.value = 0.006
      const echoGain = ctx.createGain()
      echoGain.gain.value = 0.08
      lp.connect(delay).connect(echoGain).connect(this.insertOut)
      this.chain.push(delay, echoGain)

      this.wow.gain.value = 0
    } else {
      const air = push(ctx.createBiquadFilter())
      air.type = 'highshelf'
      air.frequency.value = 12000
      air.gain.value = 1
      this.wow.gain.value = 0
    }

    // liga em série: insertIn → …nós… → insertOut
    let prev: AudioNode = this.insertIn
    for (const n of nodes) {
      prev.connect(n)
      prev = n
    }
    prev.connect(this.insertOut)
    this.chain.push(...nodes)
  }

  private teardownChain(): void {
    for (const n of this.chain) {
      try {
        n.disconnect()
      } catch {
        /* nó já solto */
      }
    }
    this.chain = []
    if (this.crackleTimer !== null) {
      window.clearTimeout(this.crackleTimer)
      this.crackleTimer = null
    }
  }

  /** Chiado de fita/rádio: ruído contínuo band-limitado, bem abaixo do sinal. */
  private hiss(db: number, freq: number): void {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = 0.7
    const g = ctx.createGain()
    g.gain.value = Math.pow(10, db / 20)
    src.connect(bp).connect(g).connect(this.insertIn)
    src.start()
    this.chain.push(src, bp, g)
  }

  /**
   * Crackle de agulha: impulsos com intervalo exponencial (processo de Poisson)
   * e decaimento de 2 ms. É a irregularidade que o ouvido reconhece como vinil —
   * um ruído contínuo soa como chuva, não como disco.
   */
  private startCrackle(lambda = 7): void {
    const ctx = this.ctx!
    const schedule = () => {
      if (this.profile !== 'vinyl' || !this.ctx) return
      const gap = -Math.log(1 - Math.random()) / lambda
      const t = ctx.currentTime + gap
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuf
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.16 + Math.random() * 0.14, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.002)
      src.connect(g).connect(this.insertIn)
      src.start(t, Math.random() * 1.8, 0.01)
      this.crackleTimer = window.setTimeout(schedule, Math.max(20, gap * 1000))
    }
    schedule()
  }

  /* ── Sequenciador ─────────────────────────────────────────────── */

  async playTrack(track: Track, profile: AudioProfile, fadeMs = 600): Promise<void> {
    await this.init()
    if (!this.ctx) return
    this.stopVoices()
    this.track = track
    if (profile !== this.profile) this.buildChain(profile)

    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(0.0001, now)
    this.master.gain.linearRampToValueAtTime(this.volume, now + fadeMs / 1000)

    this.nextNoteTime = now + 0.08
    this.step = 0
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = window.setInterval(() => this.scheduler(), 25)
  }

  fadeOut(ms = 400): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(this.master.gain.value, now)
    this.master.gain.linearRampToValueAtTime(0.0001, now + ms / 1000)
    window.setTimeout(() => this.stopVoices(), ms + 40)
  }

  private stopVoices(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    for (const v of this.live) {
      try {
        v.stop()
      } catch {
        /* já parado */
      }
    }
    this.live = []
  }

  setVolume(v: number): void {
    this.volume = v
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
  }

  dispose(): void {
    this.stopVoices()
    this.teardownChain()
    void this.ctx?.close()
    this.ctx = null
  }

  /** Lookahead: agenda até 200 ms à frente, a cada 25 ms. */
  private scheduler(): void {
    const ctx = this.ctx
    const track = this.track
    if (!ctx || !track) return
    const spb = 60 / track.music.bpm / 2 // colcheia
    while (this.nextNoteTime < ctx.currentTime + 0.2) {
      this.emit(this.step, this.nextNoteTime, track)
      this.nextNoteTime += spb
      this.step++
    }
  }

  private emit(step: number, t: number, track: Track): void {
    const v = VOICING[this.profile]
    const { root, minor, drums } = track.music
    const prog = minor ? PROG_MINOR : PROG_MAJOR
    const triad = minor ? TRIAD_MINOR : TRIAD_MAJOR
    const bar = Math.floor(step / 8) % 4
    const beat = step % 8
    const chord = 36 + root + prog[bar]
    const r = rng(hashStep(track.id, step))

    // pad: um acorde por compasso
    if (beat === 0) {
      for (const semi of triad) {
        this.voice(v.pad, midi(chord + 12 + semi), t, 60 / track.music.bpm * 2, v.padGain, v.padCutoff, v.detune)
      }
    }
    // baixo: fundamental nos tempos fortes, quinta no contratempo
    if (beat % 2 === 0) {
      const n = beat === 4 ? chord + 7 : chord
      this.voice(v.bass, midi(n - 12), t, 0.26, v.bassGain, 300, 0)
    }
    // lead: arpejo em colcheia, com furos determinísticos para não soar mecânico
    if (v.lead && r() > 0.42) {
      const semi = triad[(beat + bar) % triad.length]
      this.voice(v.lead, midi(chord + 24 + semi), t, 0.14, v.leadGain, 5200, v.detune)
    }
    // bateria
    if (drums) {
      if (beat === 0 || beat === 4) this.kick(t, v.drumGain)
      if (beat === 2 || beat === 6) this.snare(t, v.drumGain * 0.7)
      if (beat % 2 === 1) this.hat(t, v.drumGain * 0.3)
    }
  }

  private voice(
    type: OscillatorType,
    freq: number,
    t: number,
    dur: number,
    gain: number,
    cutoff: number,
    detune: number,
  ): void {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    if (detune) osc.detune.value = (Math.random() - 0.5) * detune
    // wow & flutter modula o detune de TODA voz — é a rotação do prato,
    // não um efeito por instrumento
    this.wow.connect(osc.detune)

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = cutoff

    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)

    osc.connect(lp).connect(g).connect(this.insertIn)
    osc.start(t)
    osc.stop(t + dur + 0.02)
    this.live.push(osc)
    osc.onended = () => {
      this.live = this.live.filter((x) => x !== osc)
    }
  }

  private kick(t: number, gain: number): void {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(120, t)
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.1)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain * 1.6, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    osc.connect(g).connect(this.insertIn)
    osc.start(t)
    osc.stop(t + 0.24)
  }

  private snare(t: number, gain: number): void {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1900
    bp.Q.value = 0.8
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
    src.connect(bp).connect(g).connect(this.insertIn)
    src.start(t, Math.random(), 0.16)
  }

  private hat(t: number, gain: number): void {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7000
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    src.connect(hp).connect(g).connect(this.insertIn)
    src.start(t, Math.random(), 0.06)
  }
}

function hashStep(id: string, step: number): number {
  let h = 2166136261
  const s = `${id}:${step}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

export const audio = new AudioEngine()
