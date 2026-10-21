"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm } from "@/lib/win95/store"
import { fs, useFS, ext, type FSNode } from "@/lib/win95/fs"
import { iconFor } from "@/lib/win95/shell"
import { icon as iconUrl } from "@/lib/win95/icons"
import { Button, Icon, Select, TextInput } from "./controls"

/* ------------------------------------------------------------------ */
/*  Common Open / Save As dialog                                        */
/* ------------------------------------------------------------------ */

export interface FileFilter {
  label: string
  exts: string[] // e.g. ["TXT"]; ["*"] for all
}

export interface FileDialogOptions {
  parentId?: string
  mode: "open" | "save"
  title?: string
  filters: FileFilter[]
  initialDir?: string
  defaultName?: string
}

export function fileDialog(opts: FileDialogOptions): Promise<string | null> {
  return new Promise((resolve) => {
    wm.open({
      appId: "filedlg",
      parentId: opts.parentId,
      modal: !!opts.parentId,
      title: opts.title ?? (opts.mode === "open" ? "Open" : "Save As"),
      props: { ...opts, resolve },
    })
  })
}

const PLACES: { label: string; path: string; icon: string }[] = [
  { label: "Desktop", path: "C:\\WINDOWS\\DESKTOP", icon: "desktop" },
  { label: "My Computer", path: "", icon: "computer_explorer" },
  { label: "Benjamin (C:)", path: "C:\\", icon: "hard_disk_drive" },
  { label: "My Documents", path: "C:\\My Documents", icon: "directory_open_file_mydocs" },
  { label: "Program Files", path: "C:\\Program Files", icon: "directory_closed" },
  { label: "Windows", path: "C:\\WINDOWS", icon: "directory_closed" },
]

function FileDlg({ win }: AppProps) {
  useFS()
  const p = win.props as unknown as FileDialogOptions & { resolve: (v: string | null) => void }
  const [dir, setDir] = useState(() => fs.realPath(p.initialDir && fs.isDir(p.initialDir) ? p.initialDir : "C:\\My Documents"))
  const [name, setName] = useState(p.defaultName ?? "")
  const [filter, setFilter] = useState(0)
  const [sel, setSel] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  const exts = p.filters[filter]?.exts ?? ["*"]
  const items = useMemo(() => {
    return fs.list(dir).filter((n) => n.type === "dir" || exts.includes("*") || exts.includes(ext(n.name)))
  }, [dir, exts, fs.getVersion()])

  const done = (v: string | null) => {
    p.resolve(v)
    wm.close(win.id)
  }

  const accept = async () => {
    let n = name.trim().replace(/^"|"$/g, "")
    if (!n) return
    // allow typing a path
    const full = fs.normalize(n, dir)
    const node = fs.get(full)
    if (node && node.type === "dir") {
      setDir(fs.realPath(full))
      setName("")
      return
    }
    if (p.mode === "open") {
      if (!node) {
        await wm.msgBox({ parentId: win.id, title: p.title ?? "Open", text: `${n}\nFile not found.\nPlease verify the correct file name was given.`, icon: "warning" })
        return
      }
      done(fs.realPath(full))
      return
    }
    // save: add default extension
    if (!ext(n) && !exts.includes("*") && exts[0]) n += "." + exts[0].toLowerCase()
    const target = fs.normalize(n, dir)
    if (fs.exists(target)) {
      const r = await wm.msgBox({
        parentId: win.id,
        title: p.title ?? "Save As",
        text: `${fs.basename(target)} already exists.\nDo you want to replace it?`,
        icon: "warning",
        buttons: ["Yes", "No"],
      })
      if (r !== "Yes") return
    }
    if (!fs.driveReady(target)) {
      await wm.msgBox({ parentId: win.id, title: p.title ?? "Save As", text: `${target.slice(0, 2)}\\ is not accessible.\n\nThe device is not ready.`, icon: "error" })
      return
    }
    done(target)
  }

  const up = () => {
    const parent = fs.parent(dir)
    if (parent !== dir) setDir(parent)
  }

  const open = (n: FSNode) => {
    const full = dir.replace(/\\$/, "") + "\\" + n.name
    if (n.type === "dir") {
      setDir(full)
      setSel(null)
      return
    }
    setName(n.name)
    done(full)
  }

  return (
    <div className="dlg" style={{ gap: 6 }}>
      <div className="dlg-row">
        <span style={{ width: 70 }}>
          {p.mode === "open" ? "Look in:" : "Save in:"}
        </span>
        <Select
          value={PLACES.find((pl) => pl.path.toUpperCase() === dir.toUpperCase().replace(/\\$/, "") || pl.path.toUpperCase() + "\\" === dir.toUpperCase())?.path ?? dir}
          onChange={(e) => e.target.value && setDir(e.target.value)}
          style={{ flex: 1 }}
        >
          {PLACES.filter((pl) => pl.path).map((pl) => (
            <option key={pl.path} value={pl.path}>
              {pl.label}
            </option>
          ))}
          {!PLACES.some((pl) => pl.path.toUpperCase().replace(/\\$/, "") === dir.toUpperCase().replace(/\\$/, "")) && (
            <option value={dir}>{fs.basename(dir) || dir}</option>
          )}
        </Select>
        <button type="button" className="btn icon" title="Up One Level" onClick={up}>
          <img src={iconUrl("directory_open_cool", 16)} alt="" style={{ width: 16, height: 16 }} />
        </button>
        <button type="button" className="btn icon" title="Create New Folder" onClick={() => {
          let n = "New Folder"
          let i = 1
          while (fs.exists(dir + "\\" + n)) n = `New Folder (${++i})`
          fs.mkdir(dir + "\\" + n)
        }}>
          <img src={iconUrl("directory_closed", 16)} alt="" style={{ width: 16, height: 16 }} />
        </button>
      </div>
      <div className="explorer-list small w95-scroll" style={{ height: 170, flex: "none" }}>
        {items.map((n) => (
          <button
            type="button"
            key={n.name}
            className={`file-icon ${sel === n.name ? "sel" : ""}`}
            onClick={() => {
              setSel(n.name)
              if (n.type === "file") setName(n.name)
            }}
            onDoubleClick={() => open(n)}
          >
            <img src={iconUrl(iconFor(n, dir + "\\" + n.name), 16)} alt="" />
            <span className="lbl">{n.name}</span>
          </button>
        ))}
      </div>
      <div className="dlg-row">
        <span style={{ width: 70 }}>File &name:</span>
        <TextInput
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") accept()
            if (e.key === "Escape") done(null)
          }}
          style={{ flex: 1 }}
        />
        <Button isDefault onClick={accept} style={{ width: 75 }}>
          {p.mode === "open" ? "&Open" : "&Save"}
        </Button>
      </div>
      <div className="dlg-row">
        <span style={{ width: 70 }}>Files of &type:</span>
        <Select value={filter} onChange={(e) => setFilter(+e.target.value)} style={{ flex: 1 }}>
          {p.filters.map((f, i) => (
            <option key={i} value={i}>
              {f.label}
            </option>
          ))}
        </Select>
        <Button onClick={() => done(null)} style={{ width: 75 }}>
          Cancel
        </Button>
      </div>
      {p.mode === "open" && (
        <div className="dlg-row">
          <span style={{ width: 70 }} />
          <label className="check">
            <input type="checkbox" /> <span>Open as &read-only</span>
          </label>
        </div>
      )}
    </div>
  )
}

registerApp({
  id: "filedlg",
  name: "Open",
  icon: "directory_open_cool",
  component: FileDlg,
  width: 430,
  height: 320,
  resizable: false,
  minimizable: false,
  maximizable: false,
  noTaskbar: true,
})

/** Icon component re-export for consumers that only import this module. */
export { Icon }
