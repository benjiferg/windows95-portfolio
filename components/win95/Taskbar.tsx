"use client"

import React, { useEffect, useRef, useState } from "react"
import { useWM, wm, launch } from "@/lib/win95/store"
import { settings, useSettings } from "@/lib/win95/settings"
import { system, useSystem } from "@/lib/win95/system"
import { icon } from "@/lib/win95/icons"
import { sounds } from "@/lib/win95/sounds"
import { StartMenu } from "./StartMenu"
import { showContextMenu } from "./Menu"
import { Checkbox, Slider, Tooltip } from "./controls"

function formatClock(d: Date, h24: boolean) {
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, "0")
  if (h24) return `${String(h).padStart(2, "0")}:${m}`
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${m} ${h >= 12 ? "PM" : "AM"}`
}

export function Taskbar() {
  const { windows, activeId } = useWM()
  const s = useSettings()
  const sys = useSystem()
  const [startOpen, setStartOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [volOpen, setVolOpen] = useState(false)
  const lastToggle = useRef(sys.startMenuToggle)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 5000)
    return () => clearInterval(t)
  }, [])

  // Ctrl+Esc requests
  useEffect(() => {
    if (sys.startMenuToggle !== lastToggle.current) {
      lastToggle.current = sys.startMenuToggle
      setStartOpen((o) => !o)
    }
  }, [sys.startMenuToggle])

  useEffect(() => {
    system.setStartMenuOpen(startOpen)
  }, [startOpen])

  useEffect(() => {
    if (!volOpen) return
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest(".vol-popup, .tray-vol")) return
      setVolOpen(false)
    }
    document.addEventListener("pointerdown", onDown, true)
    return () => document.removeEventListener("pointerdown", onDown, true)
  }, [volOpen])

  const taskWins = windows
    .filter((w) => w.taskbar)
    .sort((a, b) => parseInt(a.id.slice(1)) - parseInt(b.id.slice(1)))

  const dateStr = now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  return (
    <>
      {startOpen && <StartMenu onClose={() => setStartOpen(false)} />}
      <div
        className="taskbar"
        onContextMenu={(e) => {
          if ((e.target as HTMLElement).closest(".task-btn, .start-button, .tray")) return
          showContextMenu(e, [
            { label: "&Cascade Windows", onClick: () => wm.cascade() },
            { label: "Tile &Horizontally", onClick: () => wm.tile("h") },
            { label: "Tile &Vertically", onClick: () => wm.tile("v") },
            { label: "&Minimize All Windows", onClick: () => wm.minimizeAll() },
            { sep: true },
            { label: "P&roperties", onClick: () => launch("taskbarprops") },
          ])
        }}
      >
        <button
          type="button"
          className={`start-button ${startOpen ? "open" : ""}`}
          onPointerDown={(e) => {
            e.preventDefault()
            sounds.unlock()
          }}
          onClick={() => setStartOpen((o) => !o)}
        >
          <img src={icon("windows", 16)} alt="" draggable={false} />
          <span>Start</span>
        </button>
        <div className="task-sep" />
        <div className="task-buttons">
          {taskWins.map((w) => {
            const isActive = w.id === activeId || windows.some((c) => c.parentId === w.id && c.id === activeId)
            return (
              <button
                type="button"
                key={w.id}
                className={`task-btn ${isActive && !w.minimized ? "active" : ""}`}
                onClick={() => {
                  if (isActive && !w.minimized) wm.minimize(w.id)
                  else wm.focus(w.id)
                }}
                onContextMenu={(e) => {
                  showContextMenu(e, [
                    { label: "&Restore", disabled: !w.maximized && !w.minimized, onClick: () => (w.minimized ? wm.focus(w.id) : wm.toggleMaximize(w.id)) },
                    { label: "&Move", disabled: true },
                    { label: "&Size", disabled: true },
                    { label: "Mi&nimize", disabled: w.minimized || !w.minimizable, onClick: () => wm.minimize(w.id) },
                    { label: "Ma&ximize", disabled: w.maximized || !w.maximizable, onClick: () => wm.toggleMaximize(w.id) },
                    { sep: true },
                    { label: "&Close", bold: true, onClick: () => wm.requestClose(w.id) },
                  ])
                }}
                title={w.title}
              >
                <img src={icon(w.icon, 16)} alt="" draggable={false} />
                <span>{w.title}</span>
              </button>
            )
          })}
        </div>
        <div className="tray">
          <Tooltip text={s.muted ? "Volume (muted)" : `Volume: ${s.volume}%`}>
            <img
              className="tray-vol"
              src={icon(s.muted ? "loudspeaker_muted" : "loudspeaker_rays", 16)}
              alt="Volume"
              draggable={false}
              onClick={() => setVolOpen((o) => !o)}
              onDoubleClick={() => {
                setVolOpen(false)
                launch("volume")
              }}
            />
          </Tooltip>
          {s.showClock && (
            <Tooltip text={dateStr}>
              <span className="clock" onDoubleClick={() => launch("datetime")}>
                {formatClock(now, s.clock24)}
              </span>
            </Tooltip>
          )}
        </div>
      </div>
      {volOpen && (
        <div
          className="vol-popup"
          style={{
            position: "absolute",
            right: 4,
            bottom: 30,
            width: 70,
            height: 170,
            background: "var(--face)",
            boxShadow: "var(--raised)",
            zIndex: 160000,
            padding: 6,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>Volume</span>
          <div style={{ flex: 1, width: 24 }}>
            <Slider vertical value={s.volume} onChange={(v) => settings.set({ volume: v })} ticks={11} />
          </div>
          <Checkbox label="&Mute" checked={s.muted} onChange={(v) => settings.set({ muted: v })} />
        </div>
      )}
    </>
  )
}
