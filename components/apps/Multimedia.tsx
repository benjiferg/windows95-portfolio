"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm, launch } from "@/lib/win95/store"
import { fs, ext } from "@/lib/win95/fs"
import { settings, useSettings } from "@/lib/win95/settings"
import { sounds } from "@/lib/win95/sounds"
import { profile, software } from "@/lib/win95/portfolio"
import { MenuBar } from "@/components/win95/Menu"
import { fileDialog } from "@/components/win95/FileDialog"
import { Button, Checkbox, Slider, StatusBar, Select, TextInput } from "@/components/win95/controls"
import { icon } from "@/lib/win95/icons"

/* ------------------------------------------------------------------ */
/*  Tiny sequencer so .MID/.WAV/CD tracks make a sound                  */
/* ------------------------------------------------------------------ */

const SCALE = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25]

function melodyFor(name: string): number[] {
  // deterministic pseudo-melody from name
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const notes: number[] = []
  for (let i = 0; i < 16; i++) {
    h = (h * 1103515245 + 12345) >>> 0
    notes.push(SCALE[(h >>> 16) % SCALE.length])
  }
  return notes
}

class Sequencer {
  private timer: ReturnType<typeof setInterval> | null = null
  private idx = 0
  constructor(private notes: number[], private bpm = 140, private onStep?: (i: number) => void) {}
  start() {
    this.stop()
    const step = 60000 / this.bpm / 2
    this.timer = setInterval(() => {
      const n = this.notes[this.idx % this.notes.length]
      sounds.note(n, 0, step / 1000 - 0.02, "triangle", 0.1)
      if (this.idx % 4 === 0) sounds.note(n / 2, 0, step / 500, "sine", 0.06)
      this.onStep?.(this.idx)
      this.idx++
    }, step)
  }
  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
  reset() {
    this.idx = 0
  }
}

const SYSTEM_SOUNDS: Record<string, () => void> = {
  "DING.WAV": () => sounds.ding(),
  "CHORD.WAV": () => sounds.chord(),
  "TADA.WAV": () => sounds.tada(),
  "CHIMES.WAV": () => sounds.chimes(),
  "THE MICROSOFT SOUND.WAV": () => sounds.startup(),
  "MUSICA WINDOWS EXIT.WAV": () => sounds.shutdown(),
  "ROBOTZ DEFAULT.WAV": () => sounds.beep(),
  "UTOPIA CRITICAL STOP.WAV": () => sounds.chord(),
  "JUNGLE ASTERISK.WAV": () => sounds.ding(),
}

/* ------------------------------------------------------------------ */
/*  Media Player                                                        */
/* ------------------------------------------------------------------ */

function MediaPlayer({ win }: AppProps) {
  const [path, setPath] = useState<string | null>((win.props.path as string) ?? null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [scale, setScale] = useState<"time" | "frames" | "tracks">("time")
  const seq = useRef<Sequencer | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const name = path ? fs.basename(path) : null
  const kind = name ? ext(name) : ""
  const length = kind === "MID" ? 120 : kind === "WAV" ? 3 : kind === "AVI" ? 12 : 0

  useEffect(() => {
    wm.setTitle(win.id, name ? `${name} - Media Player (${kind === "MID" ? "stopped" : kind === "AVI" ? "Video" : "Sound"})` : "Media Player")
  }, [name, kind, win.id])

  useEffect(() => () => { seq.current?.stop(); audio.current?.pause() }, [])

  const stop = useCallback(() => {
    seq.current?.stop()
    audio.current?.pause()
    setPlaying(false)
  }, [])

  const play = () => {
    if (!path || !name) return
    const content = fs.readFile(path)
    if (content && content.startsWith("data:audio")) {
      if (!audio.current) audio.current = new Audio()
      audio.current.src = content
      audio.current.play().catch(() => {})
      audio.current.onended = () => setPlaying(false)
      setPlaying(true)
      return
    }
    const sys = SYSTEM_SOUNDS[name.toUpperCase()]
    if (sys && kind === "WAV") {
      sys()
      setPlaying(true)
      setPos(0)
      const t0 = Date.now()
      const iv = setInterval(() => {
        const e = (Date.now() - t0) / 1000
        setPos(Math.min(length, e))
        if (e >= length) {
          clearInterval(iv)
          setPlaying(false)
        }
      }, 100)
      return
    }
    if (kind === "MID" || kind === "WAV" || kind === "AVI") {
      seq.current = new Sequencer(melodyFor(name), kind === "AVI" ? 180 : 140, (i) => {
        setPos(Math.min(length, i * 0.21))
        if (i * 0.21 >= length) stop()
      })
      seq.current.reset()
      seq.current.start()
      setPlaying(true)
    }
  }

  useEffect(() => {
    if (win.props.autoplay && path) play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const open = async () => {
    const t = await fileDialog({ parentId: win.id, mode: "open", filters: [{ label: "Media files (*.wav;*.mid;*.rmi;*.avi)", exts: ["WAV", "MID", "RMI", "AVI"] }, { label: "All files (*.*)", exts: ["*"] }], initialDir: "C:\\WINDOWS\\MEDIA" })
    if (!t) return
    stop()
    setPath(fs.realPath(t))
    setPos(0)
  }

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`

  const menus = [
    { label: "&File", items: [{ label: "&Open...", onClick: open }, { label: "&Close", onClick: () => { stop(); setPath(null) } }, { sep: true }, { label: "E&xit", onClick: () => wm.close(win.id) }] },
    { label: "&Edit", items: [{ label: "&Copy Object", disabled: true }, { label: "&Options...", disabled: !path }, { label: "&Selection...", disabled: !path }] },
    {
      label: "&Device",
      items: [
        { label: "&1 ActiveMovie...", onClick: open },
        { label: "&2 CD Audio", onClick: () => launch("cdplayer") },
        { label: "&3 MIDI Sequencer...", onClick: open },
        { label: "&4 Sound...", onClick: open },
        { label: "&5 Video for Windows...", onClick: open },
        { sep: true },
        { label: "&Properties...", disabled: true },
        { label: "&Volume Control", onClick: () => launch("volume") },
      ],
    },
    {
      label: "&Scale",
      items: [
        { label: "&Time", radio: true, checked: scale === "time", onClick: () => setScale("time") },
        { label: "&Frames", radio: true, checked: scale === "frames", onClick: () => setScale("frames") },
        { label: "T&racks", radio: true, checked: scale === "tracks", onClick: () => setScale("tracks") },
      ],
    },
    { label: "&Help", items: [{ label: "&Help Topics", onClick: () => launch("help", { topic: "multimedia" }) }, { sep: true }, { label: "&About Media Player", onClick: () => wm.msgBox({ parentId: win.id, title: "About Media Player", text: "Microsoft Media Player\nWindows 95\n\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) }] },
  ]

  const B = ({ title, onClick, children, disabled }: { title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
    <button type="button" className="btn icon" style={{ width: 28, height: 24 }} title={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )

  return (
    <>
      <MenuBar menus={menus} />
      <div className="col" style={{ padding: 6, gap: 6, flex: 1 }}>
        {kind === "AVI" && (
          <div style={{ background: "#000", height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#0f0", fontFamily: "var(--font-dos)", fontSize: 18, boxShadow: "var(--sunken)" }}>
            {playing ? "▶ " + name : name}
          </div>
        )}
        <div style={{ padding: "0 4px" }}>
          <Slider value={length ? (pos / length) * 100 : 0} onChange={(v) => setPos((v / 100) * length)} ticks={11} />
          <div className="row" style={{ justifyContent: "space-between", fontSize: 10, padding: "0 2px" }}>
            <span>{scale === "time" ? "0:00" : scale === "frames" ? "0" : "1"}</span>
            <span>{scale === "time" ? fmt(length) : scale === "frames" ? String(length * 15) : "1"}</span>
          </div>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <B title="Play" onClick={playing ? stop : play} disabled={!path}>
            <svg width="10" height="10" viewBox="0 0 10 10">{playing ? <path d="M1 1h3v8H1zM6 1h3v8H6z" fill="#000" /> : <path d="M2 1l7 4-7 4z" fill="#000" />}</svg>
          </B>
          <B title="Stop" onClick={() => { stop(); setPos(0) }} disabled={!path}>
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1h8v8H1z" fill="#000" /></svg>
          </B>
          <B title="Eject" onClick={() => { stop(); setPath(null) }} disabled={!path}>
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 8h8v1H1zM1 6l4-5 4 5z" fill="#000" /></svg>
          </B>
          <div className="tsep" />
          <B title="Previous Mark" onClick={() => setPos(0)} disabled={!path}><span style={{ fontSize: 9 }}>|◂</span></B>
          <B title="Rewind" onClick={() => setPos(Math.max(0, pos - 5))} disabled={!path}><span style={{ fontSize: 9 }}>◂◂</span></B>
          <B title="Fast Forward" onClick={() => setPos(Math.min(length, pos + 5))} disabled={!path}><span style={{ fontSize: 9 }}>▸▸</span></B>
          <B title="Next Mark" onClick={() => setPos(length)} disabled={!path}><span style={{ fontSize: 9 }}>▸|</span></B>
          <div className="tsep" />
          <B title="Start Selection" onClick={() => {}} disabled={!path}><span style={{ fontSize: 9 }}>[</span></B>
          <B title="End Selection" onClick={() => {}} disabled={!path}><span style={{ fontSize: 9 }}>]</span></B>
          <div style={{ flex: 1 }} />
          <div className="lcd" style={{ width: 110, textAlign: "center", fontSize: 11 }}>
            {path ? `${fmt(pos)} (${scale === "time" ? "min:sec" : scale})` : "No device"}
          </div>
        </div>
      </div>
      <StatusBar cells={[path ? (playing ? "Playing" : "Stopped") : "Ready", name ?? ""]} />
    </>
  )
}

registerApp({
  id: "mediaplayer",
  name: "Media Player",
  icon: "media_player",
  component: MediaPlayer,
  width: 360,
  height: 150,
  minW: 300,
  minH: 130,
  exe: "MPLAYER.EXE",
  startMenu: ["Programs", "Accessories", "Multimedia"],
  title: (p) => (p.path ? `${fs.basename(String(p.path))} - Media Player` : "Media Player"),
})

/* ------------------------------------------------------------------ */
/*  CD Player                                                           */
/* ------------------------------------------------------------------ */

function CdPlayer({ win }: AppProps) {
  const tracks = software.length ? software.map((s) => s.name) : ["Track 1", "Track 2", "Track 3", "Track 4", "Track 5"]
  const [track, setTrack] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [mode, setMode] = useState<"elapsed" | "remaining" | "disc">("elapsed")
  const [random, setRandom] = useState(false)
  const [loop, setLoop] = useState(false)
  const [intro, setIntro] = useState(false)
  const seq = useRef<Sequencer | null>(null)
  const len = 180 + ((track * 37) % 90)

  useEffect(() => () => seq.current?.stop(), [])
  useEffect(() => {
    wm.setTitle(win.id, `CD Player - [${String(track + 1).padStart(2, "0")}] ${fmt(mode === "remaining" ? len - pos : pos)}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, pos, mode])

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`

  const start = (t = track) => {
    seq.current?.stop()
    seq.current = new Sequencer(melodyFor(tracks[t]), 120, (i) => {
      setPos((p) => {
        const n = i * 0.25
        if (n >= (intro ? 10 : len)) {
          next()
          return 0
        }
        return n
      })
    })
    seq.current.start()
    setPlaying(true)
  }
  const stop = () => {
    seq.current?.stop()
    setPlaying(false)
    setPos(0)
  }
  const pause = () => {
    seq.current?.stop()
    setPlaying(false)
  }
  const next = () => {
    const n = random ? Math.floor(Math.random() * tracks.length) : track + 1
    if (n >= tracks.length && !loop) {
      stop()
      return
    }
    const t = n % tracks.length
    setTrack(t)
    setPos(0)
    if (playing) start(t)
  }
  const prev = () => {
    const t = (track - 1 + tracks.length) % tracks.length
    setTrack(t)
    setPos(0)
    if (playing) start(t)
  }

  const menus = [
    { label: "&Disc", items: [{ label: "&Edit Play List...", onClick: () => wm.msgBox({ parentId: win.id, title: "CD Player: Disc Settings", text: `Drive: D: <${profile.firstName.toUpperCase()}_PORTFOLIO>\nArtist: ${profile.name}\nTitle: Portfolio\n\n${tracks.map((t, i) => `${i + 1}. ${t}`).join("\n")}`, icon: "none" }) }, { sep: true }, { label: "E&xit", onClick: () => wm.close(win.id) }] },
    {
      label: "&View",
      items: [
        { label: "&Toolbar", checked: true },
        { label: "&Disc/Track Info", checked: true },
        { label: "&Status Bar", checked: true },
        { sep: true },
        { label: "Track Time &Elapsed", radio: true, checked: mode === "elapsed", onClick: () => setMode("elapsed") },
        { label: "Track Time &Remaining", radio: true, checked: mode === "remaining", onClick: () => setMode("remaining") },
        { label: "Disc Time R&emaining", radio: true, checked: mode === "disc", onClick: () => setMode("disc") },
        { sep: true },
        { label: "&Volume Control", onClick: () => launch("volume") },
      ],
    },
    {
      label: "&Options",
      items: [
        { label: "&Random Order", checked: random, onClick: () => setRandom(!random) },
        { label: "&Continuous Play", checked: loop, onClick: () => setLoop(!loop) },
        { label: "&Intro Play", checked: intro, onClick: () => setIntro(!intro) },
        { sep: true },
        { label: "&Preferences...", disabled: true },
      ],
    },
    { label: "&Help", items: [{ label: "&Help Topics", onClick: () => launch("help", { topic: "multimedia" }) }, { sep: true }, { label: "&About CD Player", onClick: () => wm.msgBox({ parentId: win.id, title: "About CD Player", text: "Microsoft CD Player\nWindows 95\n\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) }] },
  ]

  const B = ({ title, onClick, children, w = 32 }: { title: string; onClick: () => void; children: React.ReactNode; w?: number }) => (
    <button type="button" className="btn icon" style={{ width: w, height: 26 }} title={title} onClick={onClick}>
      {children}
    </button>
  )

  return (
    <>
      <MenuBar menus={menus} />
      <div className="col" style={{ padding: 8, gap: 8 }}>
        <div className="row" style={{ gap: 8, alignItems: "stretch" }}>
          <div className="seg" style={{ fontSize: 30, lineHeight: "44px", height: 48, minWidth: 150, color: "#0f0", textAlign: "left", paddingLeft: 8 }}>
            [{String(track + 1).padStart(2, "0")}] {fmt(mode === "remaining" ? len - pos : mode === "disc" ? tracks.length * 200 - track * 200 - pos : pos)}
          </div>
          <div className="col" style={{ gap: 2, flex: 1 }}>
            <div className="row" style={{ gap: 2 }}>
              <B title="Play" onClick={() => start()}><svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z" fill="#000" /></svg></B>
              <B title="Pause" onClick={pause}><svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1h3v8H1zM6 1h3v8H6z" fill="#000" /></svg></B>
              <B title="Stop" onClick={stop}><svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1h8v8H1z" fill="#000" /></svg></B>
            </div>
            <div className="row" style={{ gap: 2 }}>
              <B title="Previous Track" onClick={prev} w={24}><span style={{ fontSize: 9 }}>|◂</span></B>
              <B title="Skip Backwards" onClick={() => setPos(Math.max(0, pos - 10))} w={24}><span style={{ fontSize: 9 }}>◂◂</span></B>
              <B title="Skip Forwards" onClick={() => setPos(Math.min(len, pos + 10))} w={24}><span style={{ fontSize: 9 }}>▸▸</span></B>
              <B title="Next Track" onClick={next} w={24}><span style={{ fontSize: 9 }}>▸|</span></B>
              <B title="Eject" onClick={() => { stop(); wm.msgBox({ parentId: win.id, title: "CD Player", text: "The CD-ROM drive tray is locked while the portfolio disc is mounted.", icon: "info" }) }} w={24}><span style={{ fontSize: 9 }}>⏏</span></B>
            </div>
          </div>
        </div>
        <div className="row gap8">
          <span style={{ width: 50 }}>Artist:</span>
          <Select style={{ flex: 1 }} value={0} onChange={() => {}}>
            <option value={0}>{profile.name} &lt;D:&gt;</option>
          </Select>
        </div>
        <div className="row gap8">
          <span style={{ width: 50 }}>Title:</span>
          <TextInput readOnly value="Portfolio" style={{ flex: 1 }} />
        </div>
        <div className="row gap8">
          <span style={{ width: 50 }}>Track:</span>
          <Select style={{ flex: 1 }} value={track} onChange={(e) => { setTrack(+e.target.value); setPos(0); if (playing) start(+e.target.value) }}>
            {tracks.map((t, i) => (
              <option key={t} value={i}>
                {t} &lt;{String(i + 1).padStart(2, "0")}&gt;
              </option>
            ))}
          </Select>
        </div>
      </div>
      <StatusBar cells={[`Total Play: ${fmt(tracks.length * 200)} m:s`, `Track: ${fmt(len)} m:s`]} />
    </>
  )
}

registerApp({ id: "cdplayer", name: "CD Player", icon: "cd_audio_cd", component: CdPlayer, width: 380, height: 240, resizable: false, maximizable: false, singleton: true, exe: "CDPLAYER.EXE", startMenu: ["Programs", "Accessories", "Multimedia"] })

/* ------------------------------------------------------------------ */
/*  Sound Recorder                                                      */
/* ------------------------------------------------------------------ */

function SoundRecorder({ win }: AppProps) {
  const [recording, setRecording] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [length, setLength] = useState(0)
  const [pos, setPos] = useState(0)
  const [path, setPath] = useState<string | null>((win.props.path as string) ?? null)
  const [dirty, setDirty] = useState(false)
  const [rate, setRate] = useState(1)
  const [volume, setVolume] = useState(1)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const audio = useRef<HTMLAudioElement | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const raf = useRef(0)
  const startT = useRef(0)

  const name = path ? fs.basename(path) : "Sound"
  useEffect(() => {
    wm.setTitle(win.id, `${name} - Sound Recorder`)
  }, [name, win.id])

  useEffect(() => {
    const p = win.props.path as string | undefined
    if (p) {
      const c = fs.readFile(p)
      if (c && c.startsWith("data:audio")) setBlobUrl(c)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const draw = useCallback((flat = false) => {
    const c = canvas.current
    if (!c) return
    const g = c.getContext("2d")!
    g.fillStyle = "#000"
    g.fillRect(0, 0, c.width, c.height)
    g.strokeStyle = "#0f0"
    g.beginPath()
    const mid = c.height / 2
    if (flat || !analyser.current) {
      g.moveTo(0, mid)
      g.lineTo(c.width, mid)
    } else {
      const data = new Uint8Array(analyser.current.fftSize)
      analyser.current.getByteTimeDomainData(data)
      for (let i = 0; i < c.width; i++) {
        const v = data[Math.floor((i / c.width) * data.length)] / 128 - 1
        const y = mid + v * mid * 0.9
        if (i === 0) g.moveTo(i, y)
        else g.lineTo(i, y)
      }
    }
    g.stroke()
  }, [])

  useEffect(() => {
    draw(true)
  }, [draw])

  const animate = () => {
    draw(false)
    raf.current = requestAnimationFrame(animate)
  }

  const record = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ac = new AudioContext()
      const src = ac.createMediaStreamSource(stream)
      analyser.current = ac.createAnalyser()
      src.connect(analyser.current)
      const mr = new MediaRecorder(stream)
      chunks.current = []
      mr.ondataavailable = (e) => chunks.current.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: mr.mimeType })
        const reader = new FileReader()
        reader.onload = () => {
          setBlobUrl(reader.result as string)
          setDirty(true)
        }
        reader.readAsDataURL(blob)
        stream.getTracks().forEach((t) => t.stop())
        cancelAnimationFrame(raf.current)
        analyser.current = null
        draw(true)
        ac.close()
      }
      mr.start()
      rec.current = mr
      startT.current = Date.now()
      setRecording(true)
      animate()
      const iv = setInterval(() => {
        if (!rec.current || rec.current.state !== "recording") {
          clearInterval(iv)
          return
        }
        const t = (Date.now() - startT.current) / 1000
        setPos(t)
        setLength(t)
        if (t >= 60) stopRec()
      }, 100)
    } catch {
      wm.msgBox({ parentId: win.id, title: "Sound Recorder", text: "No recording device is available. Make sure a microphone is connected and that this site is allowed to use it.", icon: "error" })
    }
  }
  const stopRec = () => {
    rec.current?.stop()
    rec.current = null
    setRecording(false)
  }
  const play = () => {
    if (!blobUrl) return
    if (!audio.current) audio.current = new Audio()
    const a = audio.current
    a.src = blobUrl
    a.playbackRate = rate
    a.volume = Math.min(1, volume)
    a.currentTime = pos >= length ? 0 : pos
    a.onloadedmetadata = () => setLength(isFinite(a.duration) ? a.duration : length)
    a.ontimeupdate = () => setPos(a.currentTime)
    a.onended = () => {
      setPlaying(false)
      setPos(0)
    }
    a.play().catch(() => {})
    setPlaying(true)
  }
  const stopPlay = () => {
    audio.current?.pause()
    setPlaying(false)
    if (recording) stopRec()
  }

  const save = async () => {
    if (!blobUrl) return
    const t = await fileDialog({ parentId: win.id, mode: "save", filters: [{ label: "Sounds (*.wav)", exts: ["WAV"] }], initialDir: "C:\\My Documents", defaultName: path ? fs.basename(path) : "Sound.wav" })
    if (!t) return
    fs.writeFile(t, blobUrl, { size: Math.round(blobUrl.length * 0.75) })
    setPath(fs.realPath(t))
    setDirty(false)
  }
  const open = async () => {
    const t = await fileDialog({ parentId: win.id, mode: "open", filters: [{ label: "Sounds (*.wav)", exts: ["WAV"] }], initialDir: "C:\\WINDOWS\\MEDIA" })
    if (!t) return
    const c = fs.readFile(t)
    setPath(fs.realPath(t))
    if (c && c.startsWith("data:audio")) setBlobUrl(c)
    else {
      setBlobUrl(null)
      setLength(2.5)
      setPos(0)
      // system sound: play through synth
      const sys = SYSTEM_SOUNDS[fs.basename(t).toUpperCase()]
      if (sys) sys()
    }
    setDirty(false)
  }

  const menus = [
    { label: "&File", items: [{ label: "&New", onClick: () => { setBlobUrl(null); setPath(null); setLength(0); setPos(0); setDirty(false) } }, { label: "&Open...", onClick: open }, { label: "&Save", onClick: save }, { label: "Save &As...", onClick: save }, { label: "&Revert...", disabled: !dirty }, { label: "&Properties", disabled: true }, { sep: true }, { label: "E&xit", onClick: () => wm.close(win.id) }] },
    { label: "&Edit", items: [{ label: "&Copy", disabled: true }, { label: "&Paste Insert", disabled: true }, { label: "Paste Mi&x", disabled: true }, { sep: true }, { label: "&Insert File...", disabled: true }, { label: "&Mix with File...", disabled: true }, { sep: true }, { label: "Delete &Before Current Position", disabled: true }, { label: "Delete &After Current Position", disabled: true }, { sep: true }, { label: "Audio &Properties", onClick: () => launch("cpl", { applet: "multimedia" }) }] },
    {
      label: "Effect&s",
      items: [
        { label: "&Increase Volume (by 25%)", onClick: () => setVolume((v) => Math.min(1, v * 1.25)) },
        { label: "&Decrease Volume", onClick: () => setVolume((v) => v * 0.75) },
        { sep: true },
        { label: "I&ncrease Speed (by 100%)", onClick: () => setRate((r) => Math.min(4, r * 2)) },
        { label: "D&ecrease Speed", onClick: () => setRate((r) => Math.max(0.25, r / 2)) },
        { sep: true },
        { label: "&Add Echo", onClick: () => wm.msgBox({ parentId: win.id, title: "Sound Recorder", text: "Echo added (simulated).", icon: "info" }) },
        { label: "&Reverse", onClick: () => wm.msgBox({ parentId: win.id, title: "Sound Recorder", text: "Reverse is not supported for compressed recordings.", icon: "info" }) },
      ],
    },
    { label: "&Help", items: [{ label: "&Help Topics", onClick: () => launch("help", { topic: "multimedia" }) }, { sep: true }, { label: "&About Sound Recorder", onClick: () => wm.msgBox({ parentId: win.id, title: "About Sound Recorder", text: "Microsoft Sound Recorder\nWindows 95\n\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) }] },
  ]

  const B = ({ title, onClick, children, disabled }: { title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
    <button type="button" className="btn icon" style={{ width: 40, height: 26 }} title={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )

  return (
    <>
      <MenuBar menus={menus} />
      <div className="col" style={{ padding: 8, gap: 6 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="col" style={{ alignItems: "center" }}>
            <span>Position:</span>
            <div className="lcd" style={{ width: 70, textAlign: "center" }}>{pos.toFixed(2)} sec.</div>
          </div>
          <canvas ref={canvas} width={110} height={44} style={{ boxShadow: "var(--sunken)" }} />
          <div className="col" style={{ alignItems: "center" }}>
            <span>Length:</span>
            <div className="lcd" style={{ width: 70, textAlign: "center" }}>{length.toFixed(2)} sec.</div>
          </div>
        </div>
        <Slider value={length ? (pos / length) * 100 : 0} onChange={(v) => setPos((v / 100) * length)} />
        <div className="row" style={{ gap: 4, justifyContent: "center" }}>
          <B title="Seek to Start" onClick={() => setPos(0)}><span style={{ fontSize: 9 }}>|◂◂</span></B>
          <B title="Seek to End" onClick={() => setPos(length)}><span style={{ fontSize: 9 }}>▸▸|</span></B>
          <B title="Play" onClick={play} disabled={!blobUrl || playing || recording}><svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z" fill="#000" /></svg></B>
          <B title="Stop" onClick={stopPlay} disabled={!playing && !recording}><svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1h8v8H1z" fill="#000" /></svg></B>
          <B title="Record" onClick={record} disabled={recording || playing}><span style={{ color: "#f00", fontSize: 14, lineHeight: 1 }}>●</span></B>
        </div>
      </div>
    </>
  )
}

registerApp({ id: "soundrecorder", name: "Sound Recorder", icon: "microphone", component: SoundRecorder, width: 310, height: 200, resizable: false, maximizable: false, exe: "SNDREC32.EXE", startMenu: ["Programs", "Accessories", "Multimedia"] })

/* ------------------------------------------------------------------ */
/*  Volume Control                                                      */
/* ------------------------------------------------------------------ */

const CHANNELS = ["Volume Control", "Wave", "MIDI", "CD Audio", "Line-In", "Microphone"]

function VolumeControl({ win }: AppProps) {
  const s = useSettings()
  const [levels, setLevels] = useState<Record<string, { vol: number; bal: number; mute: boolean }>>(() => Object.fromEntries(CHANNELS.map((c) => [c, { vol: 80, bal: 50, mute: false }])))
  const [advanced, setAdvanced] = useState(false)
  const menus = [
    { label: "&Options", items: [{ label: "&Properties", onClick: () => launch("cpl", { applet: "multimedia" }) }, { label: "&Advanced Controls", checked: advanced, onClick: () => setAdvanced(!advanced) }, { sep: true }, { label: "E&xit", onClick: () => wm.close(win.id) }] },
    { label: "&Help", items: [{ label: "&Help Topics", onClick: () => launch("help", { topic: "multimedia" }) }, { sep: true }, { label: "&About Volume Control", onClick: () => wm.msgBox({ parentId: win.id, title: "About Volume Control", text: "Microsoft Volume Control\nWindows 95\n\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) }] },
  ]
  return (
    <>
      <MenuBar menus={menus} />
      <div className="row" style={{ padding: 6, gap: 4, alignItems: "stretch", flex: 1 }}>
        {CHANNELS.map((c, i) => {
          const master = i === 0
          const lv = master ? { vol: s.volume, bal: levels[c].bal, mute: s.muted } : levels[c]
          const set = (patch: Partial<typeof lv>) => {
            if (master) {
              if (patch.vol !== undefined) settings.set({ volume: patch.vol })
              if (patch.mute !== undefined) settings.set({ muted: patch.mute })
              if (patch.bal !== undefined) setLevels({ ...levels, [c]: { ...levels[c], bal: patch.bal } })
            } else setLevels({ ...levels, [c]: { ...levels[c], ...patch } })
          }
          return (
            <div key={c} className="col" style={{ width: 90, gap: 4, borderRight: i < CHANNELS.length - 1 ? "1px solid var(--shadow)" : undefined, paddingRight: 4, alignItems: "center" }}>
              <div style={{ fontWeight: 700, alignSelf: "flex-start" }}>{c}</div>
              <div className="row" style={{ gap: 4, alignSelf: "stretch" }}>
                <span style={{ fontSize: 9 }}>Balance:</span>
              </div>
              <div className="row" style={{ gap: 2, alignSelf: "stretch", alignItems: "center" }}>
                <img src={icon("loudspeaker_rays", 16)} alt="" style={{ transform: "scaleX(-1)" }} />
                <div style={{ flex: 1 }}>
                  <Slider value={lv.bal} onChange={(v) => set({ bal: v })} />
                </div>
                <img src={icon("loudspeaker_rays", 16)} alt="" />
              </div>
              <span style={{ fontSize: 9, alignSelf: "flex-start" }}>Volume:</span>
              <div style={{ height: 90, display: "flex", justifyContent: "center" }}>
                <Slider vertical value={lv.vol} onChange={(v) => set({ vol: v })} ticks={11} />
              </div>
              <Checkbox label={master ? "&Mute all" : "&Mute"} checked={lv.mute} onChange={(v) => set({ mute: v })} />
              {advanced && master && <Button className="sm" onClick={() => launch("cpl", { applet: "multimedia" })}>Ad&vanced</Button>}
              {!master && <Button className="sm" disabled={!advanced}>Ad&vanced</Button>}
            </div>
          )
        })}
      </div>
      <div style={{ padding: "0 6px 4px" }}>Sound Blaster 16 Mixer</div>
    </>
  )
}

registerApp({ id: "volume", name: "Volume Control", icon: "loudspeaker_rays", component: VolumeControl, width: 580, height: 270, resizable: false, maximizable: false, singleton: true, exe: "SNDVOL32.EXE", startMenu: ["Programs", "Accessories", "Multimedia"] })
