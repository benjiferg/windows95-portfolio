"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm, launch } from "@/lib/win95/store"
import { fs } from "@/lib/win95/fs"
import { settings } from "@/lib/win95/settings"
import { MenuBar } from "@/components/win95/Menu"
import { fileDialog } from "@/components/win95/FileDialog"
import { StatusBar } from "@/components/win95/controls"

const FILTERS = [
  { label: "Text Documents (*.txt)", exts: ["TXT"] },
  { label: "All Files (*.*)", exts: ["*"] },
]

export function Notepad({ win }: AppProps) {
  const initialPath = (win.props.path as string | undefined) ?? null
  const [path, setPath] = useState<string | null>(initialPath)
  const [text, setText] = useState<string>(() => (initialPath ? fs.readFile(initialPath) ?? "" : ""))
  const [dirty, setDirty] = useState(false)
  const [wrap, setWrap] = useState(true)
  const [find, setFind] = useState("")
  const ta = useRef<HTMLTextAreaElement>(null)

  const name = path ? fs.basename(path) : "Untitled"
  useEffect(() => {
    wm.setTitle(win.id, `${name} - Notepad`)
  }, [name, win.id])

  // reopen when launched with a different path (singleton-less, but keep in sync)
  useEffect(() => {
    const p = win.props.path as string | undefined
    if (p && p !== path) {
      setPath(p)
      setText(fs.readFile(p) ?? "")
      setDirty(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props.path])

  const saveTo = useCallback(
    (target: string) => {
      if (!fs.writeFile(target, text)) {
        wm.msgBox({ parentId: win.id, title: "Notepad", text: `Cannot create the ${fs.basename(target)} file.\nMake sure that the path and filename are correct.`, icon: "error" })
        return false
      }
      setPath(fs.realPath(target))
      setDirty(false)
      settings.addRecent(fs.realPath(target))
      return true
    },
    [text, win.id],
  )

  const saveAs = useCallback(async () => {
    const target = await fileDialog({
      parentId: win.id,
      mode: "save",
      title: "Save As",
      filters: FILTERS,
      initialDir: path ? fs.parent(path) : "C:\\My Documents",
      defaultName: path ? fs.basename(path) : "Untitled.txt",
    })
    if (!target) return false
    return saveTo(target)
  }, [path, saveTo, win.id])

  const save = useCallback(async () => {
    if (path) return saveTo(path)
    return saveAs()
  }, [path, saveAs, saveTo])

  /** Returns true if it's OK to discard the current document. */
  const confirmDiscard = useCallback(async () => {
    if (!dirty) return true
    const r = await wm.msgBox({
      parentId: win.id,
      title: "Notepad",
      text: `The text in the ${name} file has changed.\n\nDo you want to save the changes?`,
      icon: "warning",
      buttons: ["Yes", "No", "Cancel"],
    })
    if (r === "Yes") return save()
    return r === "No"
  }, [dirty, name, save, win.id])

  useEffect(() => {
    wm.setCloseGuard(win.id, confirmDiscard)
    return () => wm.setCloseGuard(win.id, null)
  }, [confirmDiscard, win.id])

  const doNew = async () => {
    if (!(await confirmDiscard())) return
    setPath(null)
    setText("")
    setDirty(false)
  }

  const doOpen = async () => {
    if (!(await confirmDiscard())) return
    const target = await fileDialog({ parentId: win.id, mode: "open", title: "Open", filters: FILTERS, initialDir: path ? fs.parent(path) : "C:\\My Documents" })
    if (!target) return
    const content = fs.readFile(target)
    if (content === null) return
    setPath(fs.realPath(target))
    setText(content)
    setDirty(false)
    settings.addRecent(fs.realPath(target))
  }

  const insertTimeDate = () => {
    const el = ta.current
    if (!el) return
    const d = new Date()
    const stamp = `${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} ${d.toLocaleDateString()}`
    const start = el.selectionStart
    const next = text.slice(0, start) + stamp + text.slice(el.selectionEnd)
    setText(next)
    setDirty(true)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + stamp.length
      el.focus()
    })
  }

  const doFind = async (again = false) => {
    let q = find
    if (!again || !q) {
      const r = await wm.prompt({ parentId: win.id, title: "Find", label: "Find what:", value: find, okLabel: "Find Next" })
      if (r === null) return
      q = r
      setFind(r)
    }
    const el = ta.current
    if (!el || !q) return
    const from = el.selectionEnd
    let idx = text.toLowerCase().indexOf(q.toLowerCase(), from)
    if (idx < 0) idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx < 0) {
      wm.msgBox({ parentId: win.id, title: "Notepad", text: `Cannot find "${q}"`, icon: "info" })
      return
    }
    el.focus()
    el.setSelectionRange(idx, idx + q.length)
  }

  const menus = [
    {
      label: "&File",
      items: [
        { label: "&New", onClick: doNew },
        { label: "&Open...", onClick: doOpen },
        { label: "&Save", onClick: () => save() },
        { label: "Save &As...", onClick: () => saveAs() },
        { sep: true },
        { label: "Page Se&tup...", disabled: true },
        { label: "&Print", onClick: () => window.print() },
        { sep: true },
        { label: "E&xit", onClick: () => wm.requestClose(win.id) },
      ],
    },
    {
      label: "&Edit",
      items: [
        { label: "&Undo", accel: "Ctrl+Z", onClick: () => document.execCommand("undo") },
        { sep: true },
        { label: "Cu&t", accel: "Ctrl+X", onClick: () => document.execCommand("cut") },
        { label: "&Copy", accel: "Ctrl+C", onClick: () => document.execCommand("copy") },
        { label: "&Paste", accel: "Ctrl+V", onClick: async () => {
            try {
              const t = await navigator.clipboard.readText()
              const el = ta.current
              if (!el) return
              const s = el.selectionStart
              const next = text.slice(0, s) + t + text.slice(el.selectionEnd)
              setText(next)
              setDirty(true)
            } catch {
              /* clipboard blocked */
            }
          } },
        { label: "De&lete", accel: "Del", onClick: () => {
            const el = ta.current
            if (!el || el.selectionStart === el.selectionEnd) return
            setText(text.slice(0, el.selectionStart) + text.slice(el.selectionEnd))
            setDirty(true)
          } },
        { sep: true },
        { label: "Select &All", onClick: () => ta.current?.select() },
        { label: "Time/&Date", accel: "F5", onClick: insertTimeDate },
        { sep: true },
        { label: "&Word Wrap", checked: wrap, onClick: () => setWrap((w) => !w) },
      ],
    },
    {
      label: "&Search",
      items: [
        { label: "&Find...", onClick: () => doFind(false) },
        { label: "Find &Next", accel: "F3", onClick: () => doFind(true) },
      ],
    },
    {
      label: "&Help",
      items: [
        { label: "&Help Topics", onClick: () => launch("help", { topic: "notepad" }) },
        { sep: true },
        { label: "&About Notepad", onClick: () => wm.msgBox({ parentId: win.id, title: "About Notepad", text: "Microsoft Notepad\nWindows 95\n\nCopyright © 1981-1995 Microsoft Corp.\n\nThis product is licensed to:\nBenjamin Ferguson", icon: "none" }) },
      ],
    },
  ]

  return (
    <>
      <MenuBar menus={menus} />
      <textarea
        ref={ta}
        className={`textarea-app w95-scroll ${wrap ? "wrap" : ""}`}
        value={text}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value)
          setDirty(true)
        }}
        onKeyDown={(e) => {
          if (e.key === "F5") {
            e.preventDefault()
            insertTimeDate()
          } else if (e.key === "F3") {
            e.preventDefault()
            doFind(true)
          } else if (e.ctrlKey && e.key.toLowerCase() === "s") {
            e.preventDefault()
            save()
          } else if (e.ctrlKey && e.key.toLowerCase() === "o") {
            e.preventDefault()
            doOpen()
          } else if (e.ctrlKey && e.key.toLowerCase() === "n") {
            e.preventDefault()
            doNew()
          } else if (e.ctrlKey && e.key.toLowerCase() === "f") {
            e.preventDefault()
            doFind(false)
          } else if (e.key === "Tab") {
            e.preventDefault()
            const el = e.currentTarget
            const s = el.selectionStart
            setText(text.slice(0, s) + "\t" + text.slice(el.selectionEnd))
            setDirty(true)
            requestAnimationFrame(() => el.setSelectionRange(s + 1, s + 1))
          }
        }}
        autoFocus
      />
      {!wrap && <StatusBar cells={[dirty ? "Modified" : "", `${text.split("\n").length} line(s)`]} />}
    </>
  )
}

registerApp({
  id: "notepad",
  name: "Notepad",
  icon: "notepad",
  component: Notepad,
  width: 520,
  height: 380,
  exe: "NOTEPAD.EXE",
  startMenu: ["Programs", "Accessories"],
  title: (p) => `${p.path ? fs.basename(String(p.path)) : "Untitled"} - Notepad`,
})
