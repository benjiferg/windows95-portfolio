"use client"

import React, { useEffect, useRef, useState } from "react"
import { fs, useFS, type FSDir, type FSNode } from "@/lib/win95/fs"
import { launch } from "@/lib/win95/store"
import { useSettings } from "@/lib/win95/settings"
import { iconFor, displayName, openNode, openPath, SPECIAL } from "@/lib/win95/shell"
import type { IconName } from "@/lib/win95/icons"
import { Icon } from "./controls"
import { PopupMenu, type MenuItem } from "./Menu"
import { iconForNode } from "@/lib/win95/fs"

const PROGRAMS = "C:\\WINDOWS\\START MENU\\PROGRAMS"

function folderToMenu(path: string, dir: FSDir): MenuItem[] {
  const items = fs.list(path)
  const dirs = items.filter((n) => n.type === "dir")
  const files = items.filter((n) => n.type === "file")
  const out: MenuItem[] = []
  for (const d of dirs) {
    const sub = folderToMenu(path + "\\" + d.name, d as FSDir)
    out.push({
      label: d.name,
      icon: "directory_closed",
      items: sub.length ? sub : [{ label: "(Empty)", disabled: true }],
    })
  }
  for (const f of files) {
    out.push({
      label: displayName(f),
      icon: iconFor(f, path + "\\" + f.name),
      onClick: () => openNode(path + "\\" + f.name, f),
    })
  }
  return out
}

interface TopItem {
  label: string
  icon: IconName
  items?: () => MenuItem[]
  onClick?: () => void
  sep?: boolean
}

export function StartMenu({ onClose }: { onClose: () => void }) {
  useFS()
  const s = useSettings()
  const ref = useRef<HTMLDivElement>(null)
  const [hl, setHl] = useState(-1)
  const [sub, setSub] = useState<number | null>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (t.closest(".start-menu") || t.closest(".popup-menu") || t.closest(".start-button")) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("pointerdown", onDown, true)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown, true)
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  const programsDir = fs.get(PROGRAMS) as FSDir | null

  const top: TopItem[] = [
    {
      label: "Programs",
      icon: "program_manager",
      items: () => (programsDir ? folderToMenu(PROGRAMS, programsDir) : [{ label: "(Empty)", disabled: true }]),
    },
    {
      label: "Documents",
      icon: "directory_open_file_mydocs",
      items: () => {
        const recents = s.recentDocs
          .map((p) => ({ p, node: fs.get(p) as FSNode | null }))
          .filter((x) => x.node)
        if (!recents.length) return [{ label: "(Empty)", disabled: true }]
        return recents.map(({ p, node }) => ({
          label: node!.name,
          icon: iconForNode(node!, p),
          onClick: () => openPath(p),
        }))
      },
    },
    {
      label: "Settings",
      icon: "settings_gear",
      items: () => [
        { label: "&Control Panel", icon: "directory_control_panel", onClick: () => launch("explorer", { path: SPECIAL.CONTROLPANEL }) },
        { label: "&Printers", icon: "printer", onClick: () => launch("explorer", { path: SPECIAL.PRINTERS }) },
        { label: "&Taskbar...", icon: "desktop_w95", onClick: () => launch("taskbarprops") },
      ],
    },
    {
      label: "Find",
      icon: "search_file",
      items: () => [
        { label: "&Files or Folders...", icon: "search_file", onClick: () => launch("find") },
        { label: "&Computer...", icon: "search_computer", onClick: () => launch("find", { computer: true }) },
        { label: "On the &Internet...", icon: "msie1", onClick: () => launch("iexplore", { url: "search" }) },
      ],
    },
    { label: "Help", icon: "help_book_big", onClick: () => launch("help") },
    { label: "Run...", icon: "application_hourglass", onClick: () => launch("run") },
    { label: "", icon: "windows", sep: true },
    { label: "Shut Down...", icon: "shut_down_with_computer", onClick: () => launch("shutdown") },
  ]

  const subItems = sub !== null && top[sub]?.items ? top[sub].items!() : null
  const subPos = (() => {
    if (sub === null) return null
    const el = itemRefs.current[sub]
    const menu = ref.current
    if (!el || !menu) return null
    const r = el.getBoundingClientRect()
    const mr = menu.getBoundingClientRect()
    return { x: mr.right - 3, y: r.top - 3 }
  })()

  const activate = (i: number) => {
    const it = top[i]
    if (it.items) {
      setSub(i)
      setHl(i)
      return
    }
    onClose()
    it.onClick?.()
  }

  return (
    <>
      <div
        ref={ref}
        className="start-menu"
        tabIndex={-1}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (sub !== null) return
          const enabled = top.map((t, i) => (t.sep ? -1 : i)).filter((i) => i >= 0)
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault()
            const cur = enabled.indexOf(hl)
            const next = e.key === "ArrowDown" ? (cur + 1) % enabled.length : (cur - 1 + enabled.length) % enabled.length
            setHl(enabled[next])
          } else if (e.key === "ArrowRight" && top[hl]?.items) setSub(hl)
          else if (e.key === "Enter" && hl >= 0) activate(hl)
        }}
      >
        <div className="start-banner">
          <span>
            <b>Windows</b>95
          </span>
        </div>
        <div className="start-items">
          {top.map((it, i) =>
            it.sep ? (
              <div key={i} className="start-sep" />
            ) : (
              <div
                key={it.label}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                className={`start-item ${hl === i ? "hl" : ""}`}
                onMouseEnter={() => {
                  setHl(i)
                  if (timer.current) clearTimeout(timer.current)
                  timer.current = setTimeout(() => setSub(it.items ? i : null), it.items ? 200 : 300)
                }}
                onClick={() => activate(i)}
              >
                <Icon name={it.icon} size={32} />
                <span>{it.label}</span>
                {it.items && <span className="pm-arrow" />}
              </div>
            ),
          )}
        </div>
      </div>
      {sub !== null && subItems && subPos && (
        <PopupMenu items={subItems} x={subPos.x} y={subPos.y} depth={1} onClose={onClose} autoFocus={false} />
      )}
    </>
  )
}
