"use client"

import { settings } from "./settings"

/* ------------------------------------------------------------------ */
/*  Synthesized system sounds (WebAudio). No copyrighted samples —      */
/*  these are original approximations of the Win95 event sounds.        */
/* ------------------------------------------------------------------ */

let ctx: AudioContext | null = null
let master: GainNode | null = null

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
      master = ctx.createGain()
      master.connect(ctx.destination)
    } catch {
      return null
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {})
  return ctx
}

function gainValue() {
  const s = settings.get()
  if (!s.soundsEnabled || s.muted) return 0
  return Math.pow(s.volume / 100, 1.6)
}

function tone(
  freq: number,
  start: number,
  dur: number,
  opts: { type?: OscillatorType; vol?: number; attack?: number; release?: number; detune?: number } = {},
) {
  const c = ac()
  if (!c || !master) return
  master.gain.value = gainValue()
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = opts.type ?? "sine"
  o.frequency.value = freq
  if (opts.detune) o.detune.value = opts.detune
  const t0 = c.currentTime + start
  const a = opts.attack ?? 0.01
  const r = opts.release ?? 0.1
  const v = opts.vol ?? 0.3
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(v, t0 + a)
  g.gain.setValueAtTime(v, t0 + Math.max(a, dur - r))
  g.gain.linearRampToValueAtTime(0, t0 + dur)
  o.connect(g).connect(master)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

function noise(start: number, dur: number, vol = 0.2, lp = 2000) {
  const c = ac()
  if (!c || !master) return
  master.gain.value = gainValue()
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = "lowpass"
  f.frequency.value = lp
  const g = c.createGain()
  g.gain.value = vol
  src.connect(f).connect(g).connect(master)
  src.start(c.currentTime + start)
}

export const sounds = {
  /** Unlock the AudioContext on first user gesture. */
  unlock() {
    ac()
  },

  /** Windows startup — airy ambient chord sequence (~5s). */
  startup() {
    const seq: [number[], number, number][] = [
      [[277.18, 415.3, 554.37, 830.61], 0, 1.6], // Db maj
      [[311.13, 466.16, 622.25, 932.33], 1.2, 1.8], // Eb maj
      [[207.65, 311.13, 415.3, 622.25], 2.6, 2.6], // Ab maj
    ]
    for (const [notes, start, dur] of seq) {
      notes.forEach((n, i) =>
        tone(n, start, dur, { type: "sine", vol: 0.11 - i * 0.015, attack: 0.5, release: 1.2, detune: i % 2 ? 4 : -4 }),
      )
      notes.forEach((n, i) =>
        tone(n * 2, start + 0.1, dur, { type: "triangle", vol: 0.035 - i * 0.005, attack: 0.7, release: 1.2 }),
      )
    }
    // little sparkle
    ;[1108.73, 1244.51, 1661.22].forEach((n, i) => tone(n, 0.3 + i * 0.35, 1.2, { vol: 0.05, attack: 0.05, release: 0.9 }))
  },

  /** Windows exit — short descending chord. */
  shutdown() {
    ;[830.61, 622.25, 415.3].forEach((n, i) => tone(n, i * 0.18, 1.2 - i * 0.1, { vol: 0.14, attack: 0.05, release: 0.8 }))
    tone(207.65, 0.3, 1.4, { type: "triangle", vol: 0.08, attack: 0.3, release: 1 })
  },

  /** Ding (Asterisk / Default Beep). */
  ding() {
    tone(1046.5, 0, 0.5, { vol: 0.25, attack: 0.005, release: 0.45 })
    tone(2093, 0, 0.3, { vol: 0.08, attack: 0.005, release: 0.28 })
    tone(3135, 0, 0.15, { vol: 0.04, attack: 0.005, release: 0.14 })
  },

  /** Chord (Critical Stop / Exclamation / Question). */
  chord() {
    tone(466.16, 0, 0.45, { type: "square", vol: 0.07, attack: 0.005, release: 0.3 })
    tone(587.33, 0, 0.45, { type: "square", vol: 0.07, attack: 0.005, release: 0.3 })
    tone(233.08, 0, 0.45, { type: "triangle", vol: 0.12, attack: 0.005, release: 0.3 })
  },

  /** Tada. */
  tada() {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((n, i) => tone(n, i * 0.11, 0.35, { type: "sawtooth", vol: 0.08, attack: 0.01, release: 0.2 }))
    ;[1046.5, 1318.5, 1568].forEach((n) => tone(n, 0.5, 1.0, { type: "sawtooth", vol: 0.07, attack: 0.02, release: 0.7 }))
    tone(261.63, 0.5, 1.0, { type: "triangle", vol: 0.12, attack: 0.02, release: 0.7 })
  },

  /** Chimes (used by the Clock app). */
  chimes() {
    ;[1568, 1318.5, 1046.5, 783.99].forEach((n, i) => tone(n, i * 0.3, 0.9, { vol: 0.14, attack: 0.005, release: 0.8 }))
  },

  /** Empty Recycle Bin — paper crumple. */
  recycle() {
    noise(0, 0.35, 0.35, 1800)
    noise(0.15, 0.3, 0.2, 900)
  },

  /** Minesweeper explosion. */
  explosion() {
    noise(0, 0.6, 0.6, 600)
    tone(80, 0, 0.5, { type: "sawtooth", vol: 0.2, attack: 0.005, release: 0.4 })
  },

  /** Short click (menu / button). */
  click() {
    noise(0, 0.03, 0.15, 4000)
  },

  /** Modem handshake, for HyperTerminal / Dial-Up. */
  modem(seconds = 4) {
    const c = ac()
    if (!c) return
    // dial tone + DTMF
    tone(350, 0, 0.6, { vol: 0.08 })
    tone(440, 0, 0.6, { vol: 0.08 })
    const dtmf: [number, number][] = [
      [697, 1209],
      [770, 1336],
      [852, 1477],
      [941, 1336],
      [697, 1336],
      [770, 1209],
      [852, 1336],
    ]
    dtmf.forEach(([a, b], i) => {
      tone(a, 0.7 + i * 0.14, 0.1, { vol: 0.08 })
      tone(b, 0.7 + i * 0.14, 0.1, { vol: 0.08 })
    })
    const t = 1.9
    tone(2100, t, 0.5, { vol: 0.1 })
    tone(1800, t + 0.6, 0.3, { type: "square", vol: 0.05 })
    tone(2250, t + 0.6, 0.3, { type: "square", vol: 0.05 })
    for (let i = 0; i < Math.floor((seconds - 2.8) / 0.15); i++) {
      noise(t + 1 + i * 0.15, 0.15, 0.12, 3000 + Math.random() * 2000)
    }
  },

  /** PC speaker beep (DOS). */
  beep() {
    tone(800, 0, 0.18, { type: "square", vol: 0.12, attack: 0.001, release: 0.02 })
  },

  /** Telephone keypad tone. */
  dtmf(key: string) {
    const rows: Record<string, number> = { "1": 697, "2": 697, "3": 697, "4": 770, "5": 770, "6": 770, "7": 852, "8": 852, "9": 852, "*": 941, "0": 941, "#": 941 }
    const cols: Record<string, number> = { "1": 1209, "4": 1209, "7": 1209, "*": 1209, "2": 1336, "5": 1336, "8": 1336, "0": 1336, "3": 1477, "6": 1477, "9": 1477, "#": 1477 }
    if (!rows[key]) return
    tone(rows[key], 0, 0.15, { vol: 0.1 })
    tone(cols[key], 0, 0.15, { vol: 0.1 })
  },

  /** Simple note player for Media Player / CD Player (freq in Hz). */
  note(freq: number, start: number, dur: number, type: OscillatorType = "triangle", vol = 0.12) {
    tone(freq, start, dur, { type, vol, attack: 0.02, release: Math.min(0.2, dur / 2) })
  },

  /** Short "ring" for the phone dialer. */
  ring() {
    for (let i = 0; i < 2; i++) {
      tone(440, i * 0.05, 0.9, { vol: 0.07 })
      tone(480, i * 0.05, 0.9, { vol: 0.07 })
    }
  },

  /** Camera shutter / click for Imaging. */
  shutter() {
    noise(0, 0.08, 0.3, 3000)
  },
}

export type SoundName = keyof typeof sounds
