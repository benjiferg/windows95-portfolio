"use client"

import React, { useEffect, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm } from "@/lib/win95/store"
import { sounds } from "@/lib/win95/sounds"
import { MenuBar } from "@/components/win95/Menu"
import { Button, Select, TextInput } from "@/components/win95/controls"
import { clipboard, useClipboard } from "@/lib/win95/clipboard"

/* ------------------------------------------------------------------ */
/*  Character Map                                                       */
/* ------------------------------------------------------------------ */

const CHARMAP_FONTS = [
  { label: "Arial", css: "Arial, Helvetica, sans-serif" },
  { label: "Courier New", css: "'Courier New', Courier, monospace" },
  { label: "Times New Roman", css: "'Times New Roman', Times, serif" },
  { label: "MS Sans Serif", css: "var(--font)" },
  { label: "Symbol", css: "Symbol, serif" },
  { label: "Wingdings", css: "Wingdings, 'Segoe UI Symbol', sans-serif" },
]

function CharMap({ win }: AppProps) {
  const [font, setFont] = useState(0)
  const [sel, setSel] = useState<number | null>(null)
  const [buf, setBuf] = useState("")
  const chars: number[] = []
  for (let c = 32; c <= 255; c++) if (c < 127 || c > 160) chars.push(c)
  const code = sel ?? 32
  return (
    <div className="col" style={{ flex: 1, padding: 8, gap: 8 }}>
      <div className="row" style={{ gap: 8 }}>
        <span>
          <u>F</u>ont:
        </span>
        <Select value={font} onChange={(e) => setFont(+e.target.value)} style={{ flex: 1 }}>
          {CHARMAP_FONTS.map((f, i) => (
            <option key={f.label} value={i}>
              {f.label}
            </option>
          ))}
        </Select>
        <span>
          <u>C</u>haracters to copy:
        </span>
        <TextInput value={buf} onChange={(e) => setBuf(e.target.value)} style={{ width: 120, fontFamily: CHARMAP_FONTS[font].css }} />
        <Button onClick={() => wm.close(win.id)}>Close</Button>
      </div>
      <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
        <div className="charmap-grid" style={{ fontFamily: CHARMAP_FONTS[font].css }}>
          {chars.map((c) => (
            <button
              key={c}
              type="button"
              className={sel === c ? "sel" : ""}
              onClick={() => setSel(c)}
              onDoubleClick={() => setBuf(buf + String.fromCharCode(c))}
              title={`Alt+0${c}`}
            >
              {String.fromCharCode(c)}
            </button>
          ))}
        </div>
        <div className="col" style={{ gap: 6 }}>
          <Button onClick={() => sel !== null && setBuf(buf + String.fromCharCode(sel))}>&Select</Button>
          <Button
            onClick={() => {
              clipboard.set(buf)
              navigator.clipboard?.writeText(buf).catch(() => {})
            }}
            disabled={!buf}
          >
            &Copy
          </Button>
          <Button disabled>&Help</Button>
        </div>
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span>Table of available characters in the selected font.</span>
        <span>Keystroke: Alt+0{code}</span>
      </div>
    </div>
  )
}

registerApp({
  id: "charmap",
  name: "Character Map",
  icon: "charmap",
  component: CharMap,
  width: 560,
  height: 330,
  resizable: false,
  maximizable: false,
  singleton: true,
  exe: "CHARMAP.EXE",
  startMenu: ["Programs", "Accessories"],
})

/* ------------------------------------------------------------------ */
/*  Clock                                                               */
/* ------------------------------------------------------------------ */

function Clock({ win }: AppProps) {
  const [now, setNow] = useState(() => new Date())
  const [analog, setAnalog] = useState(true)
  const [seconds, setSeconds] = useState(true)
  const [date, setDate] = useState(true)
  const [gmt, setGmt] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 250)
    return () => clearInterval(t)
  }, [])
  const d = gmt ? new Date(now.getTime() + now.getTimezoneOffset() * 60000) : now
  const h = d.getHours()
  const m = d.getMinutes()
  const s = d.getSeconds()
  useEffect(() => {
    if (date) wm.setTitle(win.id, `Clock - ${d.toLocaleDateString()}`)
    else wm.setTitle(win.id, "Clock")
  }, [date, win.id, d.getDate()])

  const menus = [
    {
      label: "&Settings",
      items: [
        { label: "&Analog", radio: true, checked: analog, onClick: () => setAnalog(true) },
        { label: "&Digital", radio: true, checked: !analog, onClick: () => setAnalog(false) },
        { label: "Set &Font...", disabled: analog },
        { sep: true },
        { label: "&GMT", checked: gmt, onClick: () => setGmt(!gmt) },
        { label: "&No Title", disabled: true },
        { label: "&Seconds", checked: seconds, onClick: () => setSeconds(!seconds) },
        { label: "Dat&e", checked: date, onClick: () => setDate(!date) },
        { sep: true },
        { label: "A&bout Clock...", onClick: () => wm.msgBox({ parentId: win.id, title: "About Clock", text: "Microsoft Clock\nWindows 95\n\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) },
      ],
    },
  ]

  const size = Math.max(60, Math.min(win.w - 20, win.h - 60))
  const r = size / 2
  const hand = (len: number, angle: number, width: number, color: string) => {
    const a = (angle - 90) * (Math.PI / 180)
    return <line x1={r} y1={r} x2={r + Math.cos(a) * len} y2={r + Math.sin(a) * len} stroke={color} strokeWidth={width} strokeLinecap="square" />
  }
  return (
    <>
      <MenuBar menus={menus} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--face)", padding: 4 }} onDoubleClick={() => setAnalog(!analog)}>
        {analog ? (
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={r} cy={r} r={r - 2} fill="var(--face)" stroke="var(--shadow)" strokeWidth={2} />
            <circle cx={r} cy={r} r={r - 4} fill="none" stroke="var(--hilight)" strokeWidth={1} />
            {Array.from({ length: 60 }).map((_, i) => {
              const a = (i * 6 - 90) * (Math.PI / 180)
              const big = i % 5 === 0
              const rr = r - 8
              return (
                <rect
                  key={i}
                  x={r + Math.cos(a) * rr - (big ? 2 : 1)}
                  y={r + Math.sin(a) * rr - (big ? 2 : 1)}
                  width={big ? 4 : 2}
                  height={big ? 4 : 2}
                  fill={big ? "#000080" : "var(--shadow)"}
                />
              )
            })}
            {hand(r * 0.5, (h % 12) * 30 + m * 0.5, 4, "#000080")}
            {hand(r * 0.72, m * 6 + s * 0.1, 3, "#000080")}
            {seconds && hand(r * 0.78, s * 6, 1, "#ff0000")}
            <circle cx={r} cy={r} r={3} fill="#000080" />
          </svg>
        ) : (
          <div style={{ fontFamily: "var(--font-dos)", fontSize: Math.max(24, size / 3), color: "#000080", letterSpacing: 2 }}>
            {`${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}${seconds ? ":" + String(s).padStart(2, "0") : ""} ${h >= 12 ? "PM" : "AM"}`}
          </div>
        )}
      </div>
    </>
  )
}

registerApp({
  id: "clock",
  name: "Clock",
  icon: "clock",
  component: Clock,
  width: 220,
  height: 240,
  minW: 120,
  minH: 120,
  exe: "CLOCK.EXE",
})

/* ------------------------------------------------------------------ */
/*  Clipboard Viewer                                                    */
/* ------------------------------------------------------------------ */

function ClipBrd({ win }: AppProps) {
  const text = useClipboard()
  const refresh = async () => {
    try {
      const t = await navigator.clipboard.readText()
      clipboard.set(t)
    } catch {
      wm.msgBox({ parentId: win.id, title: "Clipboard Viewer", text: "Cannot read the system clipboard in this browser. Text copied from Windows 95 programs is shown here.", icon: "info" })
    }
  }
  const menus = [
    {
      label: "&File",
      items: [
        { label: "&Open...", disabled: true },
        { label: "Save &As...", disabled: true },
        { sep: true },
        { label: "E&xit", onClick: () => wm.close(win.id) },
      ],
    },
    {
      label: "&Edit",
      items: [
        { label: "&Delete", accel: "Del", onClick: () => clipboard.set("") },
        { label: "&Refresh from system clipboard", onClick: refresh },
      ],
    },
    {
      label: "&Display",
      items: [
        { label: "&Auto", radio: true, checked: true },
        { label: "&Text", radio: true, checked: false },
        { label: "&OEM Text", radio: true, checked: false },
      ],
    },
    { label: "&Help", items: [{ label: "&About Clipboard Viewer", onClick: () => wm.msgBox({ parentId: win.id, title: "About Clipboard Viewer", text: "Microsoft Clipboard Viewer\nWindows 95", icon: "none" }) }] },
  ]
  return (
    <>
      <MenuBar menus={menus} />
      <div className="doc-view w95-scroll sel-text" style={{ fontFamily: "var(--font)", fontSize: 11, whiteSpace: "pre-wrap" }}>
        {text || <span className="gray">(Clipboard is empty)</span>}
      </div>
    </>
  )
}

registerApp({
  id: "clipbrd",
  name: "Clipboard Viewer",
  icon: "file_set",
  component: ClipBrd,
  width: 380,
  height: 260,
  exe: "CLIPBRD.EXE",
  singleton: true,
})

/* keep sounds import used for a shared beep helper */
export const beep = () => sounds.beep()
