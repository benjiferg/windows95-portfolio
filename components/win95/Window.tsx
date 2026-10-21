"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { getApp, type WinState } from "@/lib/win95/registry"
import { wm } from "@/lib/win95/store"
import { icon } from "@/lib/win95/icons"
import { AppErrorBoundary } from "./controls"
import { contextMenu, type MenuItem } from "./Menu"

type Rect = { x: number; y: number; w: number; h: number }

const TASKBAR_H = 28

export function Window({ win, active, blocked }: { win: WinState; active: boolean; blocked: boolean }) {
  const def = getApp(win.appId)
  const [outline, setOutline] = useState<Rect | null>(null)
  const dragRef = useRef<{
    mode: "move" | "resize"
    dir?: string
    startX: number
    startY: number
    rect: Rect
    moved: boolean
  } | null>(null)

  /* ---------------- dragging (title bar) ---------------- */
  const beginDrag = (e: React.PointerEvent, mode: "move" | "resize", dir?: string) => {
    if (e.button !== 0) return
    if (mode === "move" && win.maximized) return
    e.preventDefault()
    e.stopPropagation()
    wm.focus(win.id)
    dragRef.current = {
      mode,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      rect: { x: win.x, y: win.y, w: win.w, h: win.h },
      moved: false,
    }
    const move = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const dx = ev.clientX - d.startX
      const dy = ev.clientY - d.startY
      if (!d.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return
      d.moved = true
      if (d.mode === "move") {
        setOutline({ ...d.rect, x: d.rect.x + dx, y: Math.max(-win.h + 30, d.rect.y + dy) })
      } else {
        let { x, y, w, h } = d.rect
        const dir = d.dir ?? ""
        if (dir.includes("e")) w = Math.max(win.minW, d.rect.w + dx)
        if (dir.includes("s")) h = Math.max(win.minH, d.rect.h + dy)
        if (dir.includes("w")) {
          w = Math.max(win.minW, d.rect.w - dx)
          x = d.rect.x + (d.rect.w - w)
        }
        if (dir.includes("n")) {
          h = Math.max(win.minH, d.rect.h - dy)
          y = d.rect.y + (d.rect.h - h)
        }
        setOutline({ x, y, w, h })
      }
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      const d = dragRef.current
      dragRef.current = null
      setOutline(null)
      if (!d || !d.moved) return
      const dx = ev.clientX - d.startX
      const dy = ev.clientY - d.startY
      if (d.mode === "move") {
        // keep at least the title bar on screen
        const maxY = window.innerHeight - TASKBAR_H - 24
        const nx = Math.max(-d.rect.w + 60, Math.min(window.innerWidth - 60, d.rect.x + dx))
        const ny = Math.max(0, Math.min(maxY, d.rect.y + dy))
        wm.move(win.id, nx, ny)
      } else {
        let { x, y, w, h } = d.rect
        const dir = d.dir ?? ""
        if (dir.includes("e")) w = Math.max(win.minW, d.rect.w + dx)
        if (dir.includes("s")) h = Math.max(win.minH, d.rect.h + dy)
        if (dir.includes("w")) {
          w = Math.max(win.minW, d.rect.w - dx)
          x = d.rect.x + (d.rect.w - w)
        }
        if (dir.includes("n")) {
          h = Math.max(win.minH, d.rect.h - dy)
          y = d.rect.y + (d.rect.h - h)
        }
        wm.resize(win.id, { x, y, w, h })
      }
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  /* ---------------- system menu ---------------- */
  const systemMenu = useCallback((): MenuItem[] => {
    return [
      { label: "&Restore", disabled: !win.maximized, onClick: () => wm.toggleMaximize(win.id) },
      { label: "&Move", disabled: win.maximized },
      { label: "&Size", disabled: !win.resizable || win.maximized },
      { label: "Mi&nimize", disabled: !win.minimizable, onClick: () => wm.minimize(win.id) },
      { label: "Ma&ximize", disabled: !win.maximizable || win.maximized, onClick: () => wm.toggleMaximize(win.id) },
      { sep: true },
      { label: "&Close", accel: "Alt+F4", bold: true, onClick: () => wm.requestClose(win.id) },
    ]
  }, [win])

  const openSystemMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    wm.focus(win.id)
    contextMenu.show(win.x + 3, win.y + 21, systemMenu())
  }

  /* ---------------- maximized windows track viewport ---------------- */
  useEffect(() => {
    if (!win.maximized) return
    const onResize = () =>
      wm.update(win.id, { x: -3, y: -3, w: window.innerWidth + 6, h: window.innerHeight - TASKBAR_H + 6 })
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [win.maximized, win.id])

  if (!def) return null
  const App = def.component

  const style: React.CSSProperties = {
    left: win.x,
    top: win.y,
    width: win.w,
    height: win.h,
    zIndex: win.z,
  }

  return (
    <>
      <div
        className={`window ${active ? "active" : ""} ${win.maximized ? "maximized" : ""} ${win.minimized ? "minimized" : ""}`}
        style={style}
        data-win={win.id}
        onPointerDown={() => {
          if (!active) wm.focus(win.id)
        }}
      >
        {/* title bar */}
        <div
          className="titlebar"
          onPointerDown={(e) => {
            const t = e.target as HTMLElement
            if (t.closest(".title-buttons") || t.closest(".sys-icon")) return
            beginDrag(e, "move")
          }}
          onDoubleClick={(e) => {
            const t = e.target as HTMLElement
            if (t.closest(".title-buttons") || t.closest(".sys-icon")) return
            if (win.maximizable) wm.toggleMaximize(win.id)
          }}
          onContextMenu={openSystemMenu}
        >
          <img
            className="sys-icon"
            src={icon(win.icon, 16)}
            alt=""
            draggable={false}
            onClick={openSystemMenu}
            onDoubleClick={(e) => {
              e.stopPropagation()
              wm.requestClose(win.id)
            }}
          />
          <span className="title">{win.title}</span>
          <div className="title-buttons">
            {win.minimizable && (
              <button
                type="button"
                className="tb"
                title="Minimize"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  wm.minimize(win.id)
                }}
              >
                <svg width="6" height="2" viewBox="0 0 6 2" style={{ marginTop: 6, marginLeft: -2 }}>
                  <path d="M0 0h6v2H0z" fill="#000" />
                </svg>
              </button>
            )}
            {(win.minimizable || win.maximizable) && (
              <button
                type="button"
                className="tb"
                title={win.maximized ? "Restore" : "Maximize"}
                disabled={!win.maximizable}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  wm.toggleMaximize(win.id)
                }}
              >
                {win.maximized ? (
                  <svg width="8" height="9" viewBox="0 0 8 9">
                    <path d="M2 0h6v2H2zM2 2h1v3H2zM7 2h1v5H7zM3 6h4v1H3zM0 3h6v2H0zM0 5h1v4H0zM5 5h1v4H5zM0 8h6v1H0z" fill="#000" />
                  </svg>
                ) : (
                  <svg width="9" height="9" viewBox="0 0 9 9">
                    <path d="M0 0h9v2H0zM0 2h1v7H0zM8 2h1v7H8zM0 8h9v1H0z" fill="#000" />
                  </svg>
                )}
              </button>
            )}
            <button
              type="button"
              className="tb close"
              title="Close"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                wm.requestClose(win.id)
              }}
            >
              <svg width="8" height="7" viewBox="0 0 8 7">
                <path d="M0 0h2v1h1v1h2V1h1V0h2v1H7v1H6v1H5v1h1v1h1v1h1v1H6V6H5V5H3v1H2v1H0V6h1V5h1V4h1V3H2V2H1V1H0z" fill="#000" />
              </svg>
            </button>
          </div>
        </div>

        {/* body */}
        <div className={`window-body ${blocked ? "modal-blocked" : ""}`}>
          <AppErrorBoundary name={def.name}>
            <App win={win} />
          </AppErrorBoundary>
        </div>

        {/* resize handles */}
        {win.resizable && !win.maximized && (
          <>
            {["n", "s", "e", "w", "nw", "ne", "sw", "se"].map((dir) => (
              <div key={dir} className={`rs rs-${dir}`} onPointerDown={(e) => beginDrag(e, "resize", dir)} />
            ))}
          </>
        )}
      </div>
      {outline && (
        <div
          className="drag-outline"
          style={{ position: "fixed", left: outline.x, top: outline.y, width: outline.w, height: outline.h }}
        />
      )}
    </>
  )
}
