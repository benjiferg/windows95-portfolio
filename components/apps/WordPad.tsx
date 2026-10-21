"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm, launch } from "@/lib/win95/store"
import { fs, ext } from "@/lib/win95/fs"
import { settings } from "@/lib/win95/settings"
import { MenuBar } from "@/components/win95/Menu"
import { fileDialog } from "@/components/win95/FileDialog"
import { StatusBar, Select } from "@/components/win95/controls"
import { icon } from "@/lib/win95/icons"

/* ------------------------------------------------------------------ */
/*  WordPad — rich text via contentEditable                            */
/* ------------------------------------------------------------------ */

const FILTERS = [
  { label: "Word for Windows 6.0 (*.doc)", exts: ["DOC"] },
  { label: "Rich Text Format (*.rtf)", exts: ["RTF"] },
  { label: "Text Documents (*.txt)", exts: ["TXT"] },
  { label: "All Documents (*.*)", exts: ["*"] },
]

const FONTS = ["Times New Roman", "Arial", "Courier New", "MS Sans Serif", "Georgia", "Verdana", "Comic Sans MS", "Symbol"]
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** Tiny markdown-ish → HTML converter for seeded documents. */
export function textToHtml(text: string): string {
  if (/^\s*</.test(text)) return text
  const lines = text.split(/\r?\n/)
  const out: string[] = []
  let inList = false
  for (const raw of lines) {
    const line = raw.replace(/\*\*(.+?)\*\*/g, (_, b) => `<b>${esc(b)}</b>`)
    const safe = (s: string) => s.replace(/<(?!\/?b>)/g, "&lt;")
    if (/^### /.test(line)) {
      if (inList) (out.push("</ul>"), (inList = false))
      out.push(`<h3>${safe(line.slice(4))}</h3>`)
    } else if (/^## /.test(line)) {
      if (inList) (out.push("</ul>"), (inList = false))
      out.push(`<h2>${safe(line.slice(3))}</h2>`)
    } else if (/^# /.test(line)) {
      if (inList) (out.push("</ul>"), (inList = false))
      out.push(`<h1>${safe(line.slice(2))}</h1>`)
    } else if (/^[-*] /.test(line)) {
      if (!inList) (out.push("<ul>"), (inList = true))
      out.push(`<li>${safe(line.slice(2))}</li>`)
    } else if (!line.trim()) {
      if (inList) (out.push("</ul>"), (inList = false))
      out.push("<p><br></p>")
    } else {
      if (inList) (out.push("</ul>"), (inList = false))
      out.push(`<p>${safe(line)}</p>`)
    }
  }
  if (inList) out.push("</ul>")
  return out.join("")
}

export function WordPad({ win }: AppProps) {
  const initialPath = (win.props.path as string | undefined) ?? null
  const [path, setPath] = useState<string | null>(initialPath)
  const [dirty, setDirty] = useState(false)
  const [font, setFont] = useState("Times New Roman")
  const [fsize, setFsize] = useState(10)
  const [bold, setBold] = useState(false)
  const [italic, setItalic] = useState(false)
  const [underline, setUnderline] = useState(false)
  const [align, setAlign] = useState("left")
  const [showToolbar, setShowToolbar] = useState(true)
  const [showFormat, setShowFormat] = useState(true)
  const [showRuler, setShowRuler] = useState(true)
  const [showStatus, setShowStatus] = useState(true)
  const [wrapMode, setWrapMode] = useState<"window" | "ruler" | "none">("window")
  const edRef = useRef<HTMLDivElement>(null)
  const [findText, setFindText] = useState("")

  const name = path ? fs.basename(path) : "Document"
  useEffect(() => {
    wm.setTitle(win.id, `${name} - WordPad`)
  }, [name, win.id])

  const load = useCallback((p: string | null) => {
    const el = edRef.current
    if (!el) return
    if (!p) {
      el.innerHTML = "<p><br></p>"
      return
    }
    const content = fs.readFile(p) ?? ""
    el.innerHTML = ext(p) === "TXT" ? `<pre style="font-family:'Courier New';white-space:pre-wrap">${esc(content)}</pre>` : textToHtml(content)
  }, [])

  useEffect(() => {
    load(initialPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const serialize = (p: string) => {
    const el = edRef.current!
    if (ext(p) === "TXT") return el.innerText
    return el.innerHTML
  }

  const saveTo = (target: string) => {
    if (!fs.writeFile(target, serialize(target))) {
      wm.msgBox({ parentId: win.id, title: "WordPad", text: "Failed to save document.", icon: "error" })
      return false
    }
    setPath(fs.realPath(target))
    setDirty(false)
    settings.addRecent(fs.realPath(target))
    return true
  }
  const saveAs = async () => {
    const t = await fileDialog({ parentId: win.id, mode: "save", filters: FILTERS, initialDir: path ? fs.parent(path) : "C:\\My Documents", defaultName: path ? fs.basename(path) : "Document.doc" })
    return t ? saveTo(t) : false
  }
  const save = () => (path ? saveTo(path) : saveAs())

  const confirmDiscard = useCallback(async () => {
    if (!dirty) return true
    const r = await wm.msgBox({ parentId: win.id, title: "WordPad", text: `Save changes to ${name}?`, icon: "warning", buttons: ["Yes", "No", "Cancel"] })
    if (r === "Yes") return save()
    return r === "No"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, name, path])
  useEffect(() => {
    wm.setCloseGuard(win.id, confirmDiscard)
    return () => wm.setCloseGuard(win.id, null)
  }, [confirmDiscard, win.id])

  const doNew = async () => {
    if (!(await confirmDiscard())) return
    setPath(null)
    load(null)
    setDirty(false)
  }
  const doOpen = async () => {
    if (!(await confirmDiscard())) return
    const t = await fileDialog({ parentId: win.id, mode: "open", filters: FILTERS, initialDir: path ? fs.parent(path) : "C:\\My Documents" })
    if (!t) return
    setPath(fs.realPath(t))
    load(t)
    setDirty(false)
    settings.addRecent(fs.realPath(t))
  }

  const cmd = (c: string, v?: string) => {
    edRef.current?.focus()
    document.execCommand(c, false, v)
    setDirty(true)
    updateState()
  }

  const updateState = () => {
    try {
      setBold(document.queryCommandState("bold"))
      setItalic(document.queryCommandState("italic"))
      setUnderline(document.queryCommandState("underline"))
      const f = document.queryCommandValue("fontName").replace(/['"]/g, "")
      if (f) setFont(f.split(",")[0])
      if (document.queryCommandState("justifyCenter")) setAlign("center")
      else if (document.queryCommandState("justifyRight")) setAlign("right")
      else setAlign("left")
    } catch {
      /* ignore */
    }
  }

  const setFontSize = (pt: number) => {
    setFsize(pt)
    edRef.current?.focus()
    // execCommand fontSize uses 1-7; apply via span style instead
    document.execCommand("fontSize", false, "7")
    const el = edRef.current
    el?.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = document.createElement("span")
      span.style.fontSize = pt + "pt"
      span.innerHTML = (f as HTMLElement).innerHTML
      f.replaceWith(span)
    })
    setDirty(true)
  }

  const insertDateTime = async () => {
    const d = new Date()
    const formats = [d.toLocaleDateString(), d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }), d.toLocaleTimeString(), `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`]
    const r = await wm.prompt({ parentId: win.id, title: "Date and Time", label: "Available formats:\n" + formats.map((f, i) => `  ${i + 1}. ${f}`).join("\n") + "\n\nChoose (1-4):", value: "1" })
    if (r === null) return
    const f = formats[Math.max(0, Math.min(3, (parseInt(r) || 1) - 1))]
    cmd("insertText", f)
  }

  const doFind = async (again = false) => {
    let q = findText
    if (!again || !q) {
      const r = await wm.prompt({ parentId: win.id, title: "Find", label: "Find what:", value: findText, okLabel: "Find Next" })
      if (r === null) return
      q = r
      setFindText(r)
    }
    if (!q) return
    const w = window as unknown as { find?: (s: string, cs?: boolean, back?: boolean, wrap?: boolean) => boolean }
    edRef.current?.focus()
    const found = w.find ? w.find(q, false, false, true) : false
    if (!found) wm.msgBox({ parentId: win.id, title: "WordPad", text: "WordPad has finished searching the document.", icon: "info" })
  }

  const menus = [
    {
      label: "&File",
      items: [
        { label: "&New...", accel: "Ctrl+N", onClick: doNew },
        { label: "&Open...", accel: "Ctrl+O", onClick: doOpen },
        { label: "&Save", accel: "Ctrl+S", onClick: () => save() },
        { label: "Save &As...", onClick: () => saveAs() },
        { sep: true },
        { label: "&Print...", accel: "Ctrl+P", onClick: () => window.print() },
        { label: "Print Pre&view", disabled: true },
        { label: "Page Set&up...", disabled: true },
        { sep: true },
        ...settings
          .get()
          .recentDocs.filter((p) => ["DOC", "RTF", "TXT", "WRI"].includes(ext(p)))
          .slice(0, 4)
          .map((p, i) => ({ label: `&${i + 1} ${p}`, onClick: () => { setPath(p); load(p); setDirty(false) } })),
        { sep: true },
        { label: "Sen&d...", disabled: true },
        { sep: true },
        { label: "E&xit", onClick: () => wm.requestClose(win.id) },
      ],
    },
    {
      label: "&Edit",
      items: [
        { label: "&Undo", accel: "Ctrl+Z", onClick: () => cmd("undo") },
        { sep: true },
        { label: "Cu&t", accel: "Ctrl+X", onClick: () => cmd("cut") },
        { label: "&Copy", accel: "Ctrl+C", onClick: () => cmd("copy") },
        { label: "&Paste", accel: "Ctrl+V", onClick: () => navigator.clipboard?.readText().then((t) => cmd("insertText", t)).catch(() => {}) },
        { label: "Paste &Special...", disabled: true },
        { label: "Cle&ar", accel: "Del", onClick: () => cmd("delete") },
        { label: "Select A&ll", accel: "Ctrl+A", onClick: () => cmd("selectAll") },
        { sep: true },
        { label: "&Find...", accel: "Ctrl+F", onClick: () => doFind(false) },
        { label: "Find &Next", accel: "F3", onClick: () => doFind(true) },
        { label: "R&eplace...", accel: "Ctrl+H", onClick: async () => {
            const a = await wm.prompt({ parentId: win.id, title: "Replace", label: "Find what:" })
            if (!a) return
            const b = await wm.prompt({ parentId: win.id, title: "Replace", label: "Replace with:" })
            if (b === null) return
            const el = edRef.current!
            el.innerHTML = el.innerHTML.split(esc(a)).join(esc(b))
            setDirty(true)
          } },
        { sep: true },
        { label: "Lin&ks...", disabled: true },
        { label: "Object Propert&ies", disabled: true },
        { label: "&Object", disabled: true },
      ],
    },
    {
      label: "&View",
      items: [
        { label: "&Toolbar", checked: showToolbar, onClick: () => setShowToolbar(!showToolbar) },
        { label: "&Format Bar", checked: showFormat, onClick: () => setShowFormat(!showFormat) },
        { label: "&Ruler", checked: showRuler, onClick: () => setShowRuler(!showRuler) },
        { label: "&Status Bar", checked: showStatus, onClick: () => setShowStatus(!showStatus) },
        { sep: true },
        {
          label: "&Options...",
          items: [
            { label: "Wrap to &window", radio: true, checked: wrapMode === "window", onClick: () => setWrapMode("window") },
            { label: "Wrap to &ruler", radio: true, checked: wrapMode === "ruler", onClick: () => setWrapMode("ruler") },
            { label: "&No wrap", radio: true, checked: wrapMode === "none", onClick: () => setWrapMode("none") },
          ],
        },
      ],
    },
    {
      label: "&Insert",
      items: [
        { label: "&Date and Time...", onClick: insertDateTime },
        { label: "&Object...", disabled: true },
      ],
    },
    {
      label: "F&ormat",
      items: [
        { label: "&Font...", onClick: async () => {
            const f = await wm.prompt({ parentId: win.id, title: "Font", label: "Font name (" + FONTS.join(", ") + "):", value: font })
            if (f) { setFont(f); cmd("fontName", f) }
          } },
        { label: "&Bullet Style", onClick: () => cmd("insertUnorderedList") },
        { label: "&Paragraph...", items: [
            { label: "&Left", radio: true, checked: align === "left", onClick: () => cmd("justifyLeft") },
            { label: "&Center", radio: true, checked: align === "center", onClick: () => cmd("justifyCenter") },
            { label: "&Right", radio: true, checked: align === "right", onClick: () => cmd("justifyRight") },
          ] },
        { label: "&Tabs...", disabled: true },
      ],
    },
    {
      label: "&Help",
      items: [
        { label: "&Help Topics", onClick: () => launch("help", { topic: "wordpad" }) },
        { sep: true },
        { label: "&About WordPad", onClick: () => wm.msgBox({ parentId: win.id, title: "About WordPad", text: "Microsoft WordPad\nWindows 95\n\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) },
      ],
    },
  ]

  const TB = ({ title, onClick, children, on }: { title: string; onClick: () => void; children: React.ReactNode; on?: boolean }) => (
    <button type="button" className={`tbtn ${on ? "on" : ""}`} title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  )

  return (
    <>
      <MenuBar menus={menus} />
      {showToolbar && (
        <div className="toolbar">
          <TB title="New" onClick={doNew}><img src={icon("document", 16)} alt="" /></TB>
          <TB title="Open" onClick={doOpen}><img src={icon("directory_open_cool", 16)} alt="" /></TB>
          <TB title="Save" onClick={() => save()}><img src={icon("floppy_drive_3_5", 16)} alt="" /></TB>
          <div className="tsep" />
          <TB title="Print" onClick={() => window.print()}><img src={icon("printer", 16)} alt="" /></TB>
          <TB title="Print Preview" onClick={() => {}}><img src={icon("magnifying_glass", 16)} alt="" /></TB>
          <div className="tsep" />
          <TB title="Find" onClick={() => doFind(false)}><img src={icon("search_file", 16)} alt="" /></TB>
          <div className="tsep" />
          <TB title="Cut" onClick={() => cmd("cut")}><span style={{ fontSize: 12 }}>✂</span></TB>
          <TB title="Copy" onClick={() => cmd("copy")}><img src={icon("file_set", 16)} alt="" /></TB>
          <TB title="Paste" onClick={() => navigator.clipboard?.readText().then((t) => cmd("insertText", t)).catch(() => {})}><img src={icon("note", 16)} alt="" /></TB>
          <TB title="Undo" onClick={() => cmd("undo")}><span style={{ fontSize: 12 }}>↶</span></TB>
          <div className="tsep" />
          <TB title="Date/Time" onClick={insertDateTime}><img src={icon("time_and_date", 16)} alt="" /></TB>
        </div>
      )}
      {showFormat && (
        <div className="toolbar">
          <Select value={font} onChange={(e) => { setFont(e.target.value); cmd("fontName", e.target.value) }} style={{ width: 150, height: 20, padding: "1px 2px" }} onMouseDown={(e) => e.stopPropagation()}>
            {FONTS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </Select>
          <Select value={fsize} onChange={(e) => setFontSize(+e.target.value)} style={{ width: 50, height: 20, padding: "1px 2px" }}>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <div className="tsep" />
          <TB title="Bold" on={bold} onClick={() => cmd("bold")}><b>B</b></TB>
          <TB title="Italic" on={italic} onClick={() => cmd("italic")}><i style={{ fontFamily: "serif" }}>I</i></TB>
          <TB title="Underline" on={underline} onClick={() => cmd("underline")}><u>U</u></TB>
          <TB title="Color" onClick={() => {
            const inp = document.createElement("input")
            inp.type = "color"
            inp.onchange = () => cmd("foreColor", inp.value)
            inp.click()
          }}><span style={{ color: "#f00", fontWeight: 700 }}>▣</span></TB>
          <div className="tsep" />
          <TB title="Align Left" on={align === "left"} onClick={() => cmd("justifyLeft")}><span style={{ fontSize: 10 }}>≡</span></TB>
          <TB title="Center" on={align === "center"} onClick={() => cmd("justifyCenter")}><span style={{ fontSize: 10 }}>☰</span></TB>
          <TB title="Align Right" on={align === "right"} onClick={() => cmd("justifyRight")}><span style={{ fontSize: 10 }}>≡</span></TB>
          <div className="tsep" />
          <TB title="Bullets" onClick={() => cmd("insertUnorderedList")}><span style={{ fontSize: 10 }}>•≡</span></TB>
        </div>
      )}
      {showRuler && (
        <div style={{ height: 18, background: "var(--window)", margin: "2px 0 0", boxShadow: "var(--sunken-thin)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 16, right: 16, top: 7, height: 1, background: "#000" }} />
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} style={{ position: "absolute", left: 16 + i * 12, top: i % 8 === 0 ? 4 : 6, width: 1, height: i % 8 === 0 ? 7 : 3, background: "#000" }} />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} style={{ position: "absolute", left: 16 + (i + 1) * 96 - 3, top: -1, fontSize: 9 }}>{i + 1}</span>
          ))}
        </div>
      )}
      <div
        ref={edRef}
        className="doc-view w95-scroll"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        style={{ fontFamily: `'${font}', serif`, fontSize: `${fsize}pt`, whiteSpace: wrapMode === "none" ? "nowrap" : "normal", maxWidth: wrapMode === "ruler" ? 500 : undefined, outline: "none" }}
        onInput={() => setDirty(true)}
        onKeyUp={updateState}
        onMouseUp={updateState}
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key.toLowerCase() === "s") {
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
          } else if (e.key === "F3") {
            e.preventDefault()
            doFind(true)
          }
        }}
      />
      {showStatus && <StatusBar cells={["For Help, press F1", dirty ? "Modified" : ""]} />}
    </>
  )
}

registerApp({
  id: "wordpad",
  name: "WordPad",
  icon: "write_wordpad",
  component: WordPad,
  width: 600,
  height: 440,
  minW: 320,
  minH: 200,
  exe: "WORDPAD.EXE",
  startMenu: ["Programs", "Accessories"],
  title: (p) => `${p.path ? fs.basename(String(p.path)) : "Document"} - WordPad`,
})
