"use client"

import React, { useEffect, useState } from "react"
import { profile } from "@/lib/win95/portfolio"

/* ------------------------------------------------------------------ */
/*  BIOS POST                                                           */
/* ------------------------------------------------------------------ */

const BIOS_LINES: [string, number][] = [
  ["Award Modular BIOS v4.51PG, An Energy Star Ally", 0],
  ["Copyright (C) 1984-95, Award Software, Inc.", 0],
  ["", 0],
  [`${profile.name.toUpperCase()} PORTFOLIO BIOS Rev 1.00`, 200],
  ["", 0],
  ["PENTIUM-S CPU at 133MHz", 300],
  ["Memory Test :  ", 100],
  ["", 0],
  ["Award Plug and Play BIOS Extension v1.0A", 900],
  ["Copyright (C) 1995, Award Software, Inc.", 0],
  ["", 0],
  ["Detecting HDD Primary Master   ... QUANTUM FIREBALL 2110A", 500],
  ["Detecting HDD Primary Slave    ... None", 300],
  ["Detecting HDD Secondary Master ... MITSUMI CD-ROM FX400", 300],
  ["Detecting HDD Secondary Slave  ... None", 300],
  ["", 0],
  ["Floppy disk(s) fail (40)", 0],
  ["", 0],
  ["Press DEL to enter SETUP, ESC to skip memory test", 300],
]

export function BiosScreen({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0)
  const [mem, setMem] = useState(0)

  useEffect(() => {
    let i = 0
    let cancelled = false
    const next = () => {
      if (cancelled) return
      if (i >= BIOS_LINES.length) {
        setTimeout(() => !cancelled && onDone(), 900)
        return
      }
      const [, delay] = BIOS_LINES[i]
      setTimeout(() => {
        if (cancelled) return
        i++
        setN(i)
        next()
      }, delay)
    }
    next()
    return () => {
      cancelled = true
    }
  }, [onDone])

  // memory count-up
  useEffect(() => {
    if (n < 7) return
    if (mem >= 32768) return
    const t = setTimeout(() => setMem((m) => Math.min(32768, m + 2048)), 25)
    return () => clearTimeout(t)
  }, [n, mem])

  return (
    <div className="boot">
      {BIOS_LINES.slice(0, n).map(([line], i) => (
        <div key={i}>
          {line}
          {i === 6 && (
            <>
              {String(mem).padStart(6, " ")}K{mem >= 32768 ? " OK" : ""}
            </>
          )}
        </div>
      ))}
      {n >= BIOS_LINES.length && (
        <>
          <br />
          <div style={{ color: "#fff" }}>Starting Windows 95...</div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Windows 95 flag logo (CSS)                                          */
/* ------------------------------------------------------------------ */

export function Win95Flag({ scale = 1 }: { scale?: number }) {
  const w = 120 * scale
  return (
    <svg width={w} height={w * 0.85} viewBox="0 0 120 102" shapeRendering="crispEdges" style={{ display: "block" }}>
      {/* speed lines */}
      <g fill="#000">
        <rect x="0" y="22" width="34" height="5" />
        <rect x="0" y="36" width="34" height="5" />
        <rect x="0" y="50" width="34" height="5" />
        <rect x="0" y="64" width="34" height="5" />
      </g>
      <g fill="#000">
        <rect x="0" y="24" width="30" height="1" fill="#fff" />
      </g>
      {/* waving flag panes */}
      <g transform="translate(40 6)">
        <path d="M0 14 Q20 2 40 10 L40 48 Q20 40 0 52 Z" fill="#000" />
        <path d="M2 16 Q20 5 38 12 L38 46 Q20 39 2 50 Z" fill="#f33b2d" />
        <path d="M40 10 Q60 18 80 6 L80 44 Q60 56 40 48 Z" fill="#000" />
        <path d="M42 12 Q60 19 78 8 L78 42 Q60 53 42 46 Z" fill="#35b03a" />
        <path d="M0 52 Q20 40 40 48 L40 86 Q20 78 0 90 Z" fill="#000" />
        <path d="M2 50 Q20 39 38 46 L38 84 Q20 77 2 88 Z" fill="#1e5bd6" />
        <path d="M40 48 Q60 56 80 44 L80 82 Q60 94 40 86 Z" fill="#000" />
        <path d="M42 46 Q60 53 78 42 L78 80 Q60 91 42 84 Z" fill="#f6d12b" />
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Splash: logo over clouds with scrolling bar                         */
/* ------------------------------------------------------------------ */

export function SplashScreen({ onDone, duration = 4200 }: { onDone: () => void; duration?: number }) {
  useEffect(() => {
    const t = setTimeout(onDone, duration)
    return () => clearTimeout(t)
  }, [onDone, duration])
  return (
    <div className="splash">
      <div className="splash-art">
        <div className="splash-sky" />
        <div className="splash-brand">
          <Win95Flag scale={1.1} />
          <div className="splash-title">
            <small>MICROSOFT</small>
            Windows<span className="v95">95</span>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 24,
            bottom: 36,
            fontFamily: "Arial, sans-serif",
            fontSize: 12,
            color: "#000",
            opacity: 0.8,
          }}
        >
          {profile.name} &middot; Portfolio Edition
        </div>
        <div className="splash-bar" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Shutdown screens                                                    */
/* ------------------------------------------------------------------ */

export function ShutdownWait({ onDone, restart }: { onDone: () => void; restart?: boolean }) {
  useEffect(() => {
    const t = setTimeout(onDone, restart ? 2600 : 3200)
    return () => clearTimeout(t)
  }, [onDone, restart])
  return (
    <div className="shutdown-screen wait">
      <div className="pls">
        <div className="splash-sky" />
        <div className="txt">Please wait while your computer shuts down.</div>
      </div>
    </div>
  )
}

export function OffScreen({ onPowerOn }: { onPowerOn: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onPowerOn()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onPowerOn])
  return (
    <div className="off-screen" onClick={onPowerOn}>
      <div>
        It&apos;s now safe to turn off
        <br />
        your computer.
        <small>(click anywhere to turn it back on)</small>
      </div>
    </div>
  )
}
