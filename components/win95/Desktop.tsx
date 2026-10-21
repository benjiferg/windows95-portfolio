"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { fs, useFS, type FSNode } from "@/lib/win95/fs"
import { settings, useSettings, wallpaperUrl, patterns, patternToDataUrl } from "@/lib/win95/settings"
import { launch, wm, useWM } from "@/lib/win95/store"
import { iconFor, displayName, openNode, SPECIAL, DESKTOP_DIR } from "@/lib/win95/shell"
import type { IconName } from "@/lib/win95/icons"
import { icon as iconUrl } from "@/lib/win95/icons"
import { sounds } from "@/lib/win95/sounds"
import { showContextMenu, type MenuItem } from "./Menu"

interface DeskIcon {
  id: string
  label: string
  icon: IconName
  open: () => void
  explore?: () => void
  fsPath?: string
  node?: FSNode
  properties?: () => void
  canDelete: boolean
}

const CELL_W = 75
const CELL_H = 75

export function Desktop() {
  useFS()
  const s = useSettings()
  const { activeId } = useWM()
  const [selected, setSelected] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1024, h: 740 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const recycleCount = fs.recycleCount()

  const icons: DeskIcon[] = useMemo(() => {
    const shell: DeskIcon[] = [
      {
        id: "mycomputer",
        label: "My Computer",
        icon: "computer_explorer",
        open: () => launch("explorer", { path: SPECIAL.MYCOMPUTER }),
        explore: () => launch("explorer", { path: SPECIAL.MYCOMPUTER, tree: true }),
        properties: () => launch("sysprops"),
        canDelete: false,
      },
      {
        id: "network",
        label: "Network Neighborhood",
        icon: "network_normal_two_pcs",
        open: () => launch("explorer", { path: SPECIAL.NETWORK }),
        explore: () => launch("explorer", { path: SPECIAL.NETWORK, tree: true }),
        properties: () => launch("cpl", { applet: "network" }),
        canDelete: false,
      },
      {
        id: "inbox",
        label: "Inbox",
        icon: "envelope_closed",
        open: () => launch("exchange"),
        properties: () => launch("cpl", { applet: "mail" }),
        canDelete: false,
      },
      {
        id: "recycle",
        label: "Recycle Bin",
        icon: recycleCount ? "recycle_bin_full" : "recycle_bin_empty",
        open: () => launch("explorer", { path: SPECIAL.RECYCLE }),
        explore: () => launch("explorer", { path: SPECIAL.RECYCLE, tree: true }),
        properties: () => launch("recycleprops"),
        canDelete: false,
      },
      {
        id: "ie",
        label: "The Internet",
        icon: "msie1",
        open: () => launch("iexplore"),
        properties: () => launch("cpl", { applet: "internet" }),
        canDelete: false,
      },
      {
        id: "msn",
        label: "The Microsoft Network",
        icon: "msn3",
        open: () => launch("msn"),
        canDelete: false,
      },
      {
        id: "briefcase",
        label: "My Briefcase",
        icon: "briefcase",
        open: () => launch("explorer", { path: SPECIAL.BRIEFCASE }),
        canDelete: false,
      },
    ]
    const files = fs.list(DESKTOP_DIR).map<DeskIcon>((n) => {
      const p = DESKTOP_DIR + "\\" + n.name
      return {
        id: "fs:" + n.name.toUpperCase(),
        label: displayName(n),
        icon: iconFor(n, p),
        fsPath: p,
        node: n,
        open: () => openNode(p, n),
        explore: n.type === "dir" ? () => launch("explorer", { path: p, tree: true }) : undefined,
        properties: () => launch("properties", { path: p }),
        canDelete: true,
      }
    })
    return [...shell, ...files]
  }, [recycleCount, s.recentDocs.length, fs.getVersion()])

  const rows = Math.max(1, Math.floor(size.h / CELL_H))

  const positionOf = useCallback(
    (id: string, index: number) => {
      const saved = s.iconPositions[id]
      if (saved) return saved
      const col = Math.floor(index / rows)
      const row = index % rows
      return { x: 2 + col * CELL_W, y: 2 + row * CELL_H }
    },
    [s.iconPositions, rows],
  )

  /* ------------------------------------------------------------ */
  /*  drag                                                         */
  /* ------------------------------------------------------------ */
  const beginDrag = (e: React.PointerEvent, ic: DeskIcon, idx: number) => {
    if (e.button !== 0) return
    const start = { x: e.clientX, y: e.clientY }
    const pos = positionOf(ic.id, idx)
    let moved = false
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x
      const dy = ev.clientY - start.y
      if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return
      moved = true
      setDrag({ id: ic.id, x: pos.x + dx, y: pos.y + dy })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      setDrag(null)
      if (!moved) return
      const dx = ev.clientX - start.x
      const dy = ev.clientY - start.y
      const nx = Math.max(0, Math.min(size.w - CELL_W, pos.x + dx))
      const ny = Math.max(0, Math.min(size.h - 60, pos.y + dy))
      // dropped on recycle bin?
      const rb = icons.findIndex((i) => i.id === "recycle")
      const rbPos = positionOf("recycle", rb)
      const overBin = nx + 37 > rbPos.x && nx + 37 < rbPos.x + CELL_W && ny + 30 > rbPos.y && ny + 30 < rbPos.y + CELL_H
      if (overBin && ic.fsPath) {
        fs.recycle(ic.fsPath)
        return
      }
      settings.set({ iconPositions: { ...settings.get().iconPositions, [ic.id]: { x: nx, y: ny } } })
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  /* ------------------------------------------------------------ */
  /*  actions                                                      */
  /* ------------------------------------------------------------ */
  const deleteIcon = async (ic: DeskIcon) => {
    if (!ic.canDelete || !ic.fsPath) {
      wm.msgBox({ title: "Error Deleting File", text: `Cannot delete ${ic.label}: This is a system object and cannot be deleted.`, icon: "error" })
      return
    }
    const what = ic.node?.type === "dir" ? "folder" : "file"
    const r = await wm.msgBox({
      title: `Confirm ${what === "folder" ? "Folder" : "File"} Delete`,
      text: `Are you sure you want to send '${ic.label}' to the Recycle Bin?`,
      icon: "question",
      buttons: ["Yes", "No"],
    })
    if (r === "Yes") fs.recycle(ic.fsPath)
  }

  const newItem = (kind: "folder" | "txt" | "bmp" | "doc") => {
    const names: Record<string, string> = {
      folder: "New Folder",
      txt: "New Text Document.txt",
      bmp: "New Bitmap Image.bmp",
      doc: "New WordPad Document.doc",
    }
    let name = names[kind]
    let i = 1
    const base = name.replace(/(\.[a-z]+)?$/, "")
    const e = name.slice(base.length)
    while (fs.exists(DESKTOP_DIR + "\\" + name)) name = `${base} (${++i})${e}`
    if (kind === "folder") fs.mkdir(DESKTOP_DIR + "\\" + name)
    else fs.writeFile(DESKTOP_DIR + "\\" + name, "")
    setSelected("fs:" + name.toUpperCase())
    setRenaming("fs:" + name.toUpperCase())
  }

  const arrange = (by: "name" | "type" | "size" | "date") => {
    // Shell icons stay first; reorder is reflected by clearing positions (grid follows list order).
    settings.set({ iconPositions: {} })
    void by
  }

  const desktopMenu: MenuItem[] = [
    {
      label: "Arrange &Icons",
      items: [
        { label: "by &Name", onClick: () => arrange("name") },
        { label: "by &Type", onClick: () => arrange("type") },
        { label: "by Si&ze", onClick: () => arrange("size") },
        { label: "by &Date", onClick: () => arrange("date") },
        { sep: true },
        { label: "&Auto Arrange", checked: Object.keys(s.iconPositions).length === 0, onClick: () => settings.set({ iconPositions: {} }) },
      ],
    },
    { label: "Line &up Icons", onClick: () => settings.set({ iconPositions: {} }) },
    { sep: true },
    { label: "&Paste", disabled: true },
    { label: "Paste &Shortcut", disabled: true },
    { sep: true },
    {
      label: "Ne&w",
      items: [
        { label: "&Folder", icon: "directory_closed", onClick: () => newItem("folder") },
        { label: "&Shortcut", icon: "file_win_shortcut", disabled: true },
        { sep: true },
        { label: "&Text Document", icon: "notepad_file", onClick: () => newItem("txt") },
        { label: "&Bitmap Image", icon: "paint_file", onClick: () => newItem("bmp") },
        { label: "&WordPad Document", icon: "write_file", onClick: () => newItem("doc") },
        { label: "W&ave Sound", icon: "soundgrn", disabled: true },
      ],
    },
    { sep: true },
    { label: "P&roperties", onClick: () => launch("display") },
  ]

  const iconMenu = (ic: DeskIcon): MenuItem[] => [
    { label: "&Open", bold: true, onClick: ic.open },
    ...(ic.explore ? [{ label: "&Explore", onClick: ic.explore }] : []),
    ...(ic.id === "recycle"
      ? [
          {
            label: "&Empty Recycle Bin",
            disabled: recycleCount === 0,
            onClick: async () => {
              const r = await wm.msgBox({
                title: "Confirm Multiple File Delete",
                text: `Are you sure you want to delete these ${recycleCount} items?`,
                icon: "question",
                buttons: ["Yes", "No"],
              })
              if (r === "Yes") {
                fs.emptyRecycleBin()
                sounds.recycle()
              }
            },
          },
        ]
      : []),
    { sep: true },
    { label: "Cu&t", disabled: !ic.canDelete },
    { label: "&Copy", disabled: true },
    { sep: true },
    { label: "Create &Shortcut", disabled: true },
    { label: "&Delete", disabled: !ic.canDelete, onClick: () => deleteIcon(ic) },
    { label: "Rena&me", disabled: !ic.canDelete, onClick: () => setRenaming(ic.id) },
    { sep: true },
    { label: "P&roperties", disabled: !ic.properties, onClick: ic.properties },
  ]

  /* ------------------------------------------------------------ */
  /*  keyboard                                                     */
  /* ------------------------------------------------------------ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeId) return // a window has focus
      if (renaming) return
      const t = e.target as HTMLElement
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return
      const ic = icons.find((i) => i.id === selected)
      if (e.key === "Enter" && ic) ic.open()
      else if (e.key === "Delete" && ic) deleteIcon(ic)
      else if (e.key === "F2" && ic && ic.canDelete) setRenaming(ic.id)
      else if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const idx = icons.findIndex((i) => i.id === selected)
        let n = idx < 0 ? 0 : idx
        if (e.key === "ArrowDown") n = Math.min(icons.length - 1, n + 1)
        if (e.key === "ArrowUp") n = Math.max(0, n - 1)
        if (e.key === "ArrowRight") n = Math.min(icons.length - 1, n + rows)
        if (e.key === "ArrowLeft") n = Math.max(0, n - rows)
        setSelected(icons[n].id)
        e.preventDefault()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [activeId, selected, icons, renaming, rows])

  /* ------------------------------------------------------------ */
  /*  wallpaper                                                    */
  /* ------------------------------------------------------------ */
  const wp = wallpaperUrl(s)
  const style: React.CSSProperties = {}
  if (wp) style.backgroundImage = `url("${wp}")`
  else if (s.pattern && patterns[s.pattern]) {
    style.backgroundImage = `url("${patternToDataUrl(patterns[s.pattern])}")`
    style.backgroundRepeat = "repeat"
  }
  const wallClass = wp ? `wall-${s.wallpaperMode}` : ""

  return (
    <div
      ref={ref}
      className={`desktop ${wallClass}`}
      style={style}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          setSelected(null)
          setRenaming(null)
          wm.blur()
        }
      }}
      onContextMenu={(e) => {
        if (e.target === e.currentTarget) {
          wm.blur()
          showContextMenu(e, desktopMenu)
        }
      }}
    >
      {icons.map((ic, idx) => {
        const pos = drag && drag.id === ic.id ? { x: drag.x, y: drag.y } : positionOf(ic.id, idx)
        const isSel = selected === ic.id
        return (
          <div
            key={ic.id}
            className={`desktop-icon ${isSel ? "selected" : ""} ${drag?.id === ic.id ? "dragging" : ""}`}
            style={{ left: pos.x, top: pos.y }}
            onPointerDown={(e) => {
              e.stopPropagation()
              wm.blur()
              setSelected(ic.id)
              if (renaming && renaming !== ic.id) setRenaming(null)
              beginDrag(e, ic, idx)
            }}
            onDoubleClick={() => {
              if (renaming === ic.id) return
              ic.open()
            }}
            onContextMenu={(e) => {
              setSelected(ic.id)
              showContextMenu(e, iconMenu(ic))
            }}
          >
            <img src={iconUrl(ic.icon, 32)} alt="" draggable={false} />
            {renaming === ic.id && ic.fsPath ? (
              <RenameBox
                value={ic.node ? ic.node.name : ic.label}
                onDone={(v) => {
                  setRenaming(null)
                  if (v && v !== ic.node?.name) {
                    if (!fs.rename(ic.fsPath!, v)) {
                      wm.msgBox({ title: "Error Renaming File", text: "Cannot rename file: A file with the name you specified already exists, or the name is invalid.", icon: "error" })
                    }
                  }
                }}
              />
            ) : (
              <span className="icon-label">{ic.label}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function RenameBox({ value, onDone }: { value: string; onDone: (v: string | null) => void }) {
  const [v, setV] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    const dot = value.lastIndexOf(".")
    el.setSelectionRange(0, dot > 0 ? dot : value.length)
  }, [value])
  return (
    <input
      ref={ref}
      className="field"
      value={v}
      style={{ height: 17, padding: "0 2px", width: 75, textAlign: "center", boxShadow: "inset 0 0 0 1px #000", background: "#fff", color: "#000" }}
      onChange={(e) => setV(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === "Enter") onDone(v.trim())
        if (e.key === "Escape") onDone(null)
      }}
      onBlur={() => onDone(v.trim())}
    />
  )
}
