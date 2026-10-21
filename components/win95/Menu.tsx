"use client"

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import type { IconName } from "@/lib/win95/icons"
import { Icon, Mnemonic } from "./controls"

/* ------------------------------------------------------------------ */
/*  Menu model                                                          */
/* ------------------------------------------------------------------ */

export interface MenuItem {
  label?: string
  icon?: IconName
  accel?: string
  disabled?: boolean
  checked?: boolean
  radio?: boolean
  bold?: boolean
  sep?: boolean
  items?: MenuItem[]
  onClick?: () => void
}

export const sep: MenuItem = { sep: true }

/* ------------------------------------------------------------------ */
/*  Global context-menu store                                           */
/* ------------------------------------------------------------------ */

interface CtxState {
  items: MenuItem[]
  x: number
  y: number
  large?: boolean
  /** callback when closed */
  onClose?: () => void
}

let ctxState: CtxState | null = null
const ctxListeners = new Set<() => void>()
function emit() {
  ctxListeners.forEach((l) => l())
}

export const contextMenu = {
  show(x: number, y: number, items: MenuItem[], opts: { large?: boolean; onClose?: () => void } = {}) {
    ctxState = { items, x, y, ...opts }
    emit()
  },
  hide() {
    if (!ctxState) return
    const cb = ctxState.onClose
    ctxState = null
    emit()
    cb?.()
  },
  isOpen() {
    return !!ctxState
  },
}

export function showContextMenu(e: React.MouseEvent | MouseEvent, items: MenuItem[]) {
  e.preventDefault()
  e.stopPropagation()
  contextMenu.show(e.clientX, e.clientY, items)
}

export function ContextMenuHost() {
  const st = useSyncExternalStore(
    (l) => {
      ctxListeners.add(l)
      return () => ctxListeners.delete(l)
    },
    () => ctxState,
    () => null,
  )
  if (!st) return null
  return <PopupMenu items={st.items} x={st.x} y={st.y} large={st.large} onClose={() => contextMenu.hide()} />
}

/* ------------------------------------------------------------------ */
/*  PopupMenu — fixed-position, keyboard navigable, nested submenus     */
/* ------------------------------------------------------------------ */

export function PopupMenu({
  items,
  x,
  y,
  onClose,
  large,
  depth = 0,
  openLeft,
  anchorWidth = 0,
  autoFocus = true,
}: {
  items: MenuItem[]
  x: number
  y: number
  onClose: () => void
  large?: boolean
  depth?: number
  openLeft?: boolean
  anchorWidth?: number
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y, flipLeft: !!openLeft })
  const [hl, setHl] = useState(-1)
  const [sub, setSub] = useState<number | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // keep inside viewport
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let nx = x
    let ny = y
    let flipLeft = !!openLeft
    if (openLeft || nx + r.width > vw) {
      nx = Math.max(0, x - r.width - anchorWidth)
      flipLeft = true
    }
    if (ny + r.height > vh) ny = Math.max(0, vh - r.height)
    setPos({ x: nx, y: ny, flipLeft })
  }, [x, y, openLeft, anchorWidth, items])

  // Close on outside pointerdown (root level only)
  useEffect(() => {
    if (depth > 0) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (t.closest(".popup-menu")) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener("pointerdown", onDown, true)
    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("pointerdown", onDown, true)
      document.removeEventListener("keydown", onKey, true)
    }
  }, [depth, onClose])

  useEffect(() => {
    if (autoFocus && depth === 0) ref.current?.focus()
  }, [autoFocus, depth])

  const enabled = (i: number) => items[i] && !items[i].sep && !items[i].disabled

  const activate = useCallback(
    (i: number) => {
      const it = items[i]
      if (!it || it.sep || it.disabled) return
      if (it.items) {
        setSub(i)
        setHl(i)
        return
      }
      onClose()
      it.onClick?.()
    },
    [items, onClose],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (sub !== null) return // submenu handles keys
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const dir = e.key === "ArrowDown" ? 1 : -1
      let i = hl
      for (let k = 0; k < items.length; k++) {
        i = (i + dir + items.length) % items.length
        if (enabled(i)) break
      }
      setHl(i)
    } else if (e.key === "ArrowRight") {
      if (items[hl]?.items) setSub(hl)
    } else if (e.key === "ArrowLeft") {
      if (depth > 0) onClose()
    } else if (e.key === "Enter") {
      e.preventDefault()
      activate(hl)
    } else if (e.key.length === 1) {
      const k = e.key.toLowerCase()
      const idx = items.findIndex((it) => {
        if (!it.label || it.sep || it.disabled) return false
        const amp = it.label.indexOf("&")
        const letter = amp >= 0 ? it.label[amp + 1] : it.label[0]
        return letter?.toLowerCase() === k
      })
      if (idx >= 0) activate(idx)
    }
  }

  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const subPos = (() => {
    if (sub === null) return null
    const el = itemRefs.current[sub]
    const menu = ref.current
    if (!el || !menu) return null
    const r = el.getBoundingClientRect()
    const mr = menu.getBoundingClientRect()
    return { x: pos.flipLeft ? mr.left : mr.right - 3, y: r.top - 3, width: mr.width - 3 }
  })()

  return (
    <>
      <div
        ref={ref}
        className={`popup-menu ${large ? "large" : ""}`}
        style={{ left: pos.x, top: pos.y }}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
        onMouseLeave={() => {
          if (sub === null) setHl(-1)
        }}
      >
        {items.map((it, i) =>
          it.sep ? (
            <div key={i} className="pm-sep" />
          ) : (
            <div
              key={i}
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              className={`pm-item ${i === hl ? "hl" : ""} ${it.disabled ? "disabled" : ""}`}
              style={it.bold ? { fontWeight: 700 } : undefined}
              onMouseEnter={() => {
                setHl(i)
                if (hoverTimer.current) clearTimeout(hoverTimer.current)
                hoverTimer.current = setTimeout(() => {
                  setSub(it.items && !it.disabled ? i : null)
                }, it.items ? 250 : 350)
              }}
              onClick={(e) => {
                e.stopPropagation()
                activate(i)
              }}
            >
              <span className="pm-gutter">
                {it.icon ? (
                  <Icon name={it.icon} size={large ? 32 : 16} />
                ) : it.checked ? (
                  it.radio ? (
                    <span style={{ width: 6, height: 6, background: "currentColor", borderRadius: "50%" }} />
                  ) : (
                    <svg width="7" height="7" viewBox="0 0 7 7">
                      <path d="M0 3h1v1h1v1h1v1h1V5h1V4h1V3h1V2h0V1H6v1H5v1H4v1H3V3H2V2H1V3z" fill="currentColor" />
                    </svg>
                  )
                ) : null}
              </span>
              <span className="pm-label">
                <Mnemonic text={it.label ?? ""} />
              </span>
              {it.accel && <span className="pm-accel">{it.accel}</span>}
              {it.items && <span className="pm-arrow" />}
            </div>
          ),
        )}
      </div>
      {sub !== null && subPos && items[sub]?.items && (
        <PopupMenu
          items={items[sub].items!}
          x={subPos.x}
          y={subPos.y}
          depth={depth + 1}
          openLeft={pos.flipLeft}
          anchorWidth={subPos.width}
          onClose={onClose}
          autoFocus={false}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  MenuBar                                                             */
/* ------------------------------------------------------------------ */

export interface MenuBarItem {
  label: string
  items: MenuItem[] | (() => MenuItem[])
  disabled?: boolean
}

export function MenuBar({ menus }: { menus: MenuBarItem[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const [anchor, setAnchor] = useState({ x: 0, y: 0 })

  const openMenu = (i: number) => {
    const el = refs.current[i]
    if (!el) return
    const r = el.getBoundingClientRect()
    setAnchor({ x: r.left, y: r.bottom })
    setOpen(i)
  }

  const items = open !== null ? (typeof menus[open].items === "function" ? (menus[open].items as () => MenuItem[])() : (menus[open].items as MenuItem[])) : []

  return (
    <div className="menubar" onContextMenu={(e) => e.preventDefault()}>
      {menus.map((m, i) => (
        <button
          type="button"
          key={m.label}
          ref={(el) => {
            refs.current[i] = el
          }}
          className={`mi ${open === i ? "open" : ""} ${m.disabled ? "disabled" : ""}`}
          disabled={m.disabled}
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (open === i) setOpen(null)
            else openMenu(i)
          }}
          onMouseEnter={() => {
            if (open !== null && open !== i) openMenu(i)
          }}
        >
          <Mnemonic text={m.label} />
        </button>
      ))}
      {open !== null && (
        <PopupMenu items={items} x={anchor.x} y={anchor.y} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}
