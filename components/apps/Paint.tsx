"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm, launch } from "@/lib/win95/store"
import { fs } from "@/lib/win95/fs"
import { settings } from "@/lib/win95/settings"
import { MenuBar } from "@/components/win95/Menu"
import { fileDialog } from "@/components/win95/FileDialog"
import { StatusBar } from "@/components/win95/controls"

/* ------------------------------------------------------------------ */
/*  Paint                                                               */
/* ------------------------------------------------------------------ */

type Tool = "freeselect" | "select" | "eraser" | "fill" | "pick" | "zoom" | "pencil" | "brush" | "airbrush" | "text" | "line" | "curve" | "rect" | "polygon" | "ellipse" | "roundrect"

const TOOLS: { id: Tool; title: string; glyph: string }[] = [
  { id: "freeselect", title: "Free-Form Select", glyph: "⌒" },
  { id: "select", title: "Select", glyph: "⬚" },
  { id: "eraser", title: "Eraser/Color Eraser", glyph: "◧" },
  { id: "fill", title: "Fill With Color", glyph: "⬙" },
  { id: "pick", title: "Pick Color", glyph: "✎" },
  { id: "zoom", title: "Magnifier", glyph: "🔍" },
  { id: "pencil", title: "Pencil", glyph: "✏" },
  { id: "brush", title: "Brush", glyph: "🖌" },
  { id: "airbrush", title: "Airbrush", glyph: "💨" },
  { id: "text", title: "Text", glyph: "A" },
  { id: "line", title: "Line", glyph: "╲" },
  { id: "curve", title: "Curve", glyph: "〰" },
  { id: "rect", title: "Rectangle", glyph: "▭" },
  { id: "polygon", title: "Polygon", glyph: "⬠" },
  { id: "ellipse", title: "Ellipse", glyph: "⬭" },
  { id: "roundrect", title: "Rounded Rectangle", glyph: "▢" },
]

const PALETTE = [
  "#000000", "#808080", "#800000", "#808000", "#008000", "#008080", "#000080", "#800080", "#808040", "#004040", "#0080ff", "#004080", "#8000ff", "#804000",
  "#ffffff", "#c0c0c0", "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ffff80", "#00ff80", "#80ffff", "#8080ff", "#ff0080", "#ff8040",
]

const FILTERS = [
  { label: "Bitmap Files (*.bmp)", exts: ["BMP"] },
  { label: "PNG Files (*.png)", exts: ["PNG"] },
  { label: "All Files (*.*)", exts: ["*"] },
]

interface Sel {
  x: number
  y: number
  w: number
  h: number
  data?: ImageData
}

export function Paint({ win }: AppProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [path, setPath] = useState<string | null>((win.props.path as string) ?? null)
  const [dirty, setDirty] = useState(false)
  const [tool, setTool] = useState<Tool>("pencil")
  const [fg, setFg] = useState("#000000")
  const [bg, setBg] = useState("#ffffff")
  const [lineWidth, setLineWidth] = useState(1)
  const [brushSize, setBrushSize] = useState(4)
  const [fillMode, setFillMode] = useState<0 | 1 | 2>(0) // outline, outline+fill, fill
  const [zoom, setZoom] = useState(1)
  const [size, setSize] = useState({ w: 400, h: 300 })
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [sel, setSel] = useState<Sel | null>(null)
  const [showTools, setShowTools] = useState(true)
  const [showColors, setShowColors] = useState(true)
  const [showStatus, setShowStatus] = useState(true)
  const [opaque, setOpaque] = useState(true)
  const undoStack = useRef<ImageData[]>([])
  const redoStack = useRef<ImageData[]>([])
  const drawing = useRef<{
    start: { x: number; y: number }
    last: { x: number; y: number }
    base: ImageData
    button: number
    polyPts?: { x: number; y: number }[]
    curveStage?: number
    curveA?: { x: number; y: number }
    curveB?: { x: number; y: number }
    selMove?: { ox: number; oy: number }
  } | null>(null)
  const [, force] = useState(0)

  const name = path ? fs.basename(path) : "untitled"
  useEffect(() => {
    wm.setTitle(win.id, `${name} - Paint`)
  }, [name, win.id])

  const ctx = () => canvasRef.current!.getContext("2d", { willReadFrequently: true })!

  const snapshot = () => ctx().getImageData(0, 0, size.w, size.h)
  const pushUndo = () => {
    undoStack.current.push(snapshot())
    if (undoStack.current.length > 12) undoStack.current.shift()
    redoStack.current = []
  }

  const clearCanvas = useCallback((w: number, h: number, color = "#ffffff") => {
    const c = canvasRef.current
    if (!c) return
    c.width = w
    c.height = h
    const g = c.getContext("2d")!
    g.fillStyle = color
    g.fillRect(0, 0, w, h)
  }, [])

  const loadImage = useCallback(
    (dataUrl: string) =>
      new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => {
          setSize({ w: img.width, h: img.height })
          requestAnimationFrame(() => {
            clearCanvas(img.width, img.height)
            ctx().drawImage(img, 0, 0)
            resolve()
          })
        }
        img.onerror = () => resolve()
        img.src = dataUrl
      }),
    [clearCanvas],
  )

  // initial load
  useEffect(() => {
    const p = win.props.path as string | undefined
    const content = p ? fs.readFile(p) : null
    if (content && content.startsWith("data:image")) loadImage(content)
    else clearCanvas(400, 300)
    undoStack.current = []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const c = canvasRef.current
    if (c && (c.width !== size.w || c.height !== size.h)) {
      const old = ctx().getImageData(0, 0, c.width, c.height)
      c.width = size.w
      c.height = size.h
      const g = ctx()
      g.fillStyle = "#ffffff"
      g.fillRect(0, 0, size.w, size.h)
      g.putImageData(old, 0, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size])

  /* ---------- file ops ---------- */
  const saveTo = (target: string) => {
    const data = canvasRef.current!.toDataURL("image/png")
    if (!fs.writeFile(target, data, { size: Math.round(data.length * 0.75) })) {
      wm.msgBox({ parentId: win.id, title: "Paint", text: "Paint cannot save this file.", icon: "error" })
      return false
    }
    setPath(fs.realPath(target))
    setDirty(false)
    settings.addRecent(fs.realPath(target))
    return true
  }
  const saveAs = async () => {
    const t = await fileDialog({ parentId: win.id, mode: "save", filters: FILTERS, initialDir: path ? fs.parent(path) : "C:\\My Documents", defaultName: path ? fs.basename(path) : "untitled.bmp" })
    return t ? saveTo(t) : false
  }
  const save = () => (path ? saveTo(path) : saveAs())
  const confirmDiscard = useCallback(async () => {
    if (!dirty) return true
    const r = await wm.msgBox({ parentId: win.id, title: "Paint", text: `Save changes to ${name}?`, icon: "warning", buttons: ["Yes", "No", "Cancel"] })
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
    setSize({ w: 400, h: 300 })
    requestAnimationFrame(() => clearCanvas(400, 300))
    setDirty(false)
    setSel(null)
  }
  const doOpen = async () => {
    if (!(await confirmDiscard())) return
    const t = await fileDialog({ parentId: win.id, mode: "open", filters: FILTERS, initialDir: path ? fs.parent(path) : "C:\\My Documents" })
    if (!t) return
    const content = fs.readFile(t)
    setPath(fs.realPath(t))
    if (content && content.startsWith("data:image")) await loadImage(content)
    else {
      setSize({ w: 400, h: 300 })
      requestAnimationFrame(() => clearCanvas(400, 300))
    }
    setDirty(false)
    settings.addRecent(fs.realPath(t))
  }

  const setWallpaper = (mode: "tile" | "center") => {
    const data = canvasRef.current!.toDataURL("image/png")
    const key = name.replace(/\.[^.]+$/, "") || "untitled"
    settings.set({ customWallpapers: { ...settings.get().customWallpapers, [key]: data }, wallpaper: key, wallpaperMode: mode, pattern: null })
  }

  /* ---------- drawing ---------- */
  const canvasPoint = (e: React.PointerEvent | PointerEvent) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return { x: Math.floor((e.clientX - r.left) / zoom), y: Math.floor((e.clientY - r.top) / zoom) }
  }

  const colorFor = (button: number) => (button === 2 ? bg : fg)

  const floodFill = (x: number, y: number, color: string) => {
    const g = ctx()
    const img = g.getImageData(0, 0, size.w, size.h)
    const d = img.data
    const idx = (x + y * size.w) * 4
    const target = [d[idx], d[idx + 1], d[idx + 2], d[idx + 3]]
    const tmp = document.createElement("canvas").getContext("2d")!
    tmp.fillStyle = color
    tmp.fillRect(0, 0, 1, 1)
    const rep = tmp.getImageData(0, 0, 1, 1).data
    if (target[0] === rep[0] && target[1] === rep[1] && target[2] === rep[2]) return
    const stack = [[x, y]]
    const match = (i: number) => d[i] === target[0] && d[i + 1] === target[1] && d[i + 2] === target[2] && d[i + 3] === target[3]
    while (stack.length) {
      const [px, py] = stack.pop()!
      let i = (px + py * size.w) * 4
      if (px < 0 || px >= size.w || py < 0 || py >= size.h || !match(i)) continue
      // scan line
      let x1 = px
      while (x1 >= 0 && match((x1 + py * size.w) * 4)) x1--
      x1++
      let x2 = px
      while (x2 < size.w && match((x2 + py * size.w) * 4)) x2++
      for (let xx = x1; xx < x2; xx++) {
        i = (xx + py * size.w) * 4
        d[i] = rep[0]
        d[i + 1] = rep[1]
        d[i + 2] = rep[2]
        d[i + 3] = 255
        if (py > 0) stack.push([xx, py - 1])
        if (py < size.h - 1) stack.push([xx, py + 1])
      }
    }
    g.putImageData(img, 0, 0)
  }

  const drawShape = (g: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, color: string, fill: string) => {
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    const w = Math.abs(b.x - a.x)
    const h = Math.abs(b.y - a.y)
    g.lineWidth = lineWidth
    g.strokeStyle = color
    g.fillStyle = fill
    g.beginPath()
    if (tool === "rect") g.rect(x + 0.5, y + 0.5, w, h)
    else if (tool === "roundrect") {
      const r = Math.min(8, w / 2, h / 2)
      g.moveTo(x + r, y + 0.5)
      g.arcTo(x + w, y, x + w, y + h, r)
      g.arcTo(x + w, y + h, x, y + h, r)
      g.arcTo(x, y + h, x, y, r)
      g.arcTo(x, y, x + w, y, r)
      g.closePath()
    } else if (tool === "ellipse") g.ellipse(x + w / 2, y + h / 2, Math.max(0.5, w / 2), Math.max(0.5, h / 2), 0, 0, Math.PI * 2)
    if (fillMode > 0) g.fill()
    if (fillMode < 2) g.stroke()
  }

  const commitSelection = () => {
    if (sel?.data) {
      const g = ctx()
      if (opaque) g.putImageData(sel.data, sel.x, sel.y)
      else {
        // transparent paste: skip bg pixels
        const tmp = document.createElement("canvas")
        tmp.width = sel.w
        tmp.height = sel.h
        const tg = tmp.getContext("2d")!
        const d = sel.data
        const bgc = hexToRgb(bg)
        const copy = new ImageData(new Uint8ClampedArray(d.data), d.width, d.height)
        for (let i = 0; i < copy.data.length; i += 4) {
          if (copy.data[i] === bgc[0] && copy.data[i + 1] === bgc[1] && copy.data[i + 2] === bgc[2]) copy.data[i + 3] = 0
        }
        tg.putImageData(copy, 0, 0)
        g.drawImage(tmp, sel.x, sel.y)
      }
    }
    setSel(null)
  }

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 2) return
    e.preventDefault()
    const p = canvasPoint(e)
    const g = ctx()
    const color = colorFor(e.button)

    if (tool === "zoom") {
      setZoom(e.button === 2 ? 1 : zoom >= 4 ? 1 : zoom === 1 ? 2 : 4)
      return
    }
    if (tool === "pick") {
      const d = g.getImageData(p.x, p.y, 1, 1).data
      const hex = rgbToHex(d[0], d[1], d[2])
      if (e.button === 2) setBg(hex)
      else setFg(hex)
      return
    }
    if (tool === "fill") {
      pushUndo()
      floodFill(p.x, p.y, color)
      setDirty(true)
      return
    }
    if (tool === "text") {
      pushUndo()
      wm.prompt({ parentId: win.id, title: "Text", label: "Enter text:", icon: "paint_file" }).then((t) => {
        if (!t) return
        g.fillStyle = fg
        g.font = "16px Arial, sans-serif"
        g.textBaseline = "top"
        g.fillText(t, p.x, p.y)
        setDirty(true)
      })
      return
    }
    if (tool === "select" || tool === "freeselect") {
      if (sel && p.x >= sel.x && p.x < sel.x + sel.w && p.y >= sel.y && p.y < sel.y + sel.h) {
        // start moving existing selection
        if (!sel.data) {
          pushUndo()
          const data = g.getImageData(sel.x, sel.y, sel.w, sel.h)
          g.fillStyle = bg
          g.fillRect(sel.x, sel.y, sel.w, sel.h)
          setSel({ ...sel, data })
          drawing.current = { start: p, last: p, base: g.getImageData(0, 0, size.w, size.h), button: e.button, selMove: { ox: p.x - sel.x, oy: p.y - sel.y } }
        } else {
          drawing.current = { start: p, last: p, base: g.getImageData(0, 0, size.w, size.h), button: e.button, selMove: { ox: p.x - sel.x, oy: p.y - sel.y } }
        }
        return
      }
      commitSelection()
      drawing.current = { start: p, last: p, base: snapshot(), button: e.button }
      setSel({ x: p.x, y: p.y, w: 0, h: 0 })
      return
    }
    if (tool === "polygon") {
      if (drawing.current?.polyPts) {
        drawing.current.polyPts.push(p)
        drawing.current.last = p
        return
      }
      pushUndo()
      drawing.current = { start: p, last: p, base: snapshot(), button: e.button, polyPts: [p] }
      return
    }
    if (tool === "curve") {
      if (drawing.current?.curveStage) {
        return
      }
      pushUndo()
      drawing.current = { start: p, last: p, base: snapshot(), button: e.button, curveStage: 0 }
      return
    }

    pushUndo()
    drawing.current = { start: p, last: p, base: snapshot(), button: e.button }
    if (tool === "pencil" || tool === "brush" || tool === "eraser" || tool === "airbrush") {
      stroke(g, p, p, e.button)
    }
    setDirty(true)
  }

  const stroke = (g: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, button: number) => {
    if (tool === "airbrush") {
      g.fillStyle = colorFor(button)
      for (let i = 0; i < 12; i++) {
        const ang = Math.random() * Math.PI * 2
        const r = Math.random() * brushSize * 2
        g.fillRect(Math.round(b.x + Math.cos(ang) * r), Math.round(b.y + Math.sin(ang) * r), 1, 1)
      }
      return
    }
    g.lineCap = tool === "brush" ? "round" : "square"
    g.lineJoin = "round"
    g.strokeStyle = tool === "eraser" ? bg : colorFor(button)
    g.lineWidth = tool === "pencil" ? 1 : tool === "eraser" ? brushSize * 2 : brushSize
    g.beginPath()
    g.moveTo(a.x + 0.5, a.y + 0.5)
    g.lineTo(b.x + 0.5, b.y + 0.5)
    g.stroke()
  }

  const onMove = (e: React.PointerEvent) => {
    const p = canvasPoint(e)
    setPos(p.x >= 0 && p.y >= 0 && p.x < size.w && p.y < size.h ? p : null)
    const d = drawing.current
    if (!d) return
    const g = ctx()
    if (tool === "pencil" || tool === "brush" || tool === "eraser" || tool === "airbrush") {
      stroke(g, d.last, p, d.button)
      d.last = p
      return
    }
    if (tool === "select" || tool === "freeselect") {
      if (d.selMove && sel) {
        g.putImageData(d.base, 0, 0)
        const nx = p.x - d.selMove.ox
        const ny = p.y - d.selMove.oy
        if (sel.data) g.putImageData(sel.data, nx, ny)
        setSel({ ...sel, x: nx, y: ny })
        return
      }
      setSel({ x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), w: Math.abs(p.x - d.start.x), h: Math.abs(p.y - d.start.y) })
      return
    }
    g.putImageData(d.base, 0, 0)
    const color = colorFor(d.button)
    const fill = d.button === 2 ? fg : bg
    if (tool === "line") {
      g.lineWidth = lineWidth
      g.strokeStyle = color
      g.beginPath()
      g.moveTo(d.start.x + 0.5, d.start.y + 0.5)
      g.lineTo(p.x + 0.5, p.y + 0.5)
      g.stroke()
    } else if (tool === "rect" || tool === "ellipse" || tool === "roundrect") {
      drawShape(g, d.start, p, color, fill)
    } else if (tool === "polygon" && d.polyPts) {
      g.lineWidth = lineWidth
      g.strokeStyle = color
      g.beginPath()
      d.polyPts.forEach((pt, i) => (i ? g.lineTo(pt.x + 0.5, pt.y + 0.5) : g.moveTo(pt.x + 0.5, pt.y + 0.5)))
      g.lineTo(p.x + 0.5, p.y + 0.5)
      g.stroke()
    } else if (tool === "curve") {
      g.lineWidth = lineWidth
      g.strokeStyle = color
      g.beginPath()
      if (d.curveStage === 0) {
        g.moveTo(d.start.x, d.start.y)
        g.lineTo(p.x, p.y)
      } else {
        g.moveTo(d.start.x, d.start.y)
        g.quadraticCurveTo(p.x, p.y, d.curveA!.x, d.curveA!.y)
      }
      g.stroke()
    }
  }

  const onUp = (e: React.PointerEvent) => {
    const d = drawing.current
    if (!d) return
    const p = canvasPoint(e)
    if (tool === "polygon") {
      // keep collecting until double click
      return
    }
    if (tool === "curve") {
      if (d.curveStage === 0) {
        d.curveA = p
        d.curveStage = 1
        // next drag bends
        const g = ctx()
        const bend = (ev: PointerEvent) => {
          const q = canvasPoint(ev)
          g.putImageData(d.base, 0, 0)
          g.lineWidth = lineWidth
          g.strokeStyle = colorFor(d.button)
          g.beginPath()
          g.moveTo(d.start.x, d.start.y)
          g.quadraticCurveTo(q.x, q.y, d.curveA!.x, d.curveA!.y)
          g.stroke()
        }
        const finish = () => {
          window.removeEventListener("pointermove", bend)
          window.removeEventListener("pointerup", finish)
          drawing.current = null
          setDirty(true)
        }
        window.addEventListener("pointermove", bend)
        window.addEventListener("pointerup", finish)
        return
      }
    }
    if ((tool === "select" || tool === "freeselect") && !d.selMove) {
      if (sel && (sel.w < 2 || sel.h < 2)) setSel(null)
    }
    drawing.current = null
    if (tool !== "select" && tool !== "freeselect") setDirty(true)
    else if (d.selMove) setDirty(true)
  }

  const onDoubleClick = () => {
    const d = drawing.current
    if (tool === "polygon" && d?.polyPts) {
      const g = ctx()
      g.putImageData(d.base, 0, 0)
      g.lineWidth = lineWidth
      g.strokeStyle = colorFor(d.button)
      g.fillStyle = d.button === 2 ? fg : bg
      g.beginPath()
      d.polyPts.forEach((pt, i) => (i ? g.lineTo(pt.x + 0.5, pt.y + 0.5) : g.moveTo(pt.x + 0.5, pt.y + 0.5)))
      g.closePath()
      if (fillMode > 0) g.fill()
      if (fillMode < 2) g.stroke()
      drawing.current = null
      setDirty(true)
    }
  }

  const undo = () => {
    const s = undoStack.current.pop()
    if (!s) return
    redoStack.current.push(snapshot())
    ctx().putImageData(s, 0, 0)
    setSel(null)
    setDirty(true)
  }
  const redo = () => {
    const s = redoStack.current.pop()
    if (!s) return
    undoStack.current.push(snapshot())
    ctx().putImageData(s, 0, 0)
    setDirty(true)
  }

  const clipRef = useRef<ImageData | null>(null)
  const copySel = () => {
    if (!sel) return
    clipRef.current = sel.data ?? ctx().getImageData(sel.x, sel.y, sel.w, sel.h)
  }
  const cutSel = () => {
    if (!sel) return
    copySel()
    pushUndo()
    if (!sel.data) {
      const g = ctx()
      g.fillStyle = bg
      g.fillRect(sel.x, sel.y, sel.w, sel.h)
    }
    setSel(null)
    setDirty(true)
  }
  const paste = () => {
    const d = clipRef.current
    if (!d) return
    pushUndo()
    setSel({ x: 0, y: 0, w: d.width, h: d.height, data: d })
    ctx().putImageData(d, 0, 0)
    setTool("select")
    setDirty(true)
  }
  const clearSel = () => {
    if (!sel) return
    pushUndo()
    const g = ctx()
    g.fillStyle = bg
    g.fillRect(sel.x, sel.y, sel.w, sel.h)
    setSel(null)
    setDirty(true)
  }
  const selectAll = () => {
    commitSelection()
    setTool("select")
    setSel({ x: 0, y: 0, w: size.w, h: size.h })
  }

  const image = {
    flipH: () => transform((g, c) => { g.translate(c.width, 0); g.scale(-1, 1) }),
    flipV: () => transform((g, c) => { g.translate(0, c.height); g.scale(1, -1) }),
    rot90: () => transform((g, c) => { g.translate(c.width, 0); g.rotate(Math.PI / 2) }, true),
    rot180: () => transform((g, c) => { g.translate(c.width, c.height); g.rotate(Math.PI) }),
    invert: () => {
      pushUndo()
      const g = ctx()
      const img = g.getImageData(0, 0, size.w, size.h)
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = 255 - img.data[i]
        img.data[i + 1] = 255 - img.data[i + 1]
        img.data[i + 2] = 255 - img.data[i + 2]
      }
      g.putImageData(img, 0, 0)
      setDirty(true)
    },
    clear: () => {
      pushUndo()
      const g = ctx()
      g.fillStyle = bg
      g.fillRect(0, 0, size.w, size.h)
      setSel(null)
      setDirty(true)
    },
    attributes: async () => {
      const w = await wm.prompt({ parentId: win.id, title: "Attributes", label: `Width (pixels):`, value: String(size.w) })
      if (w === null) return
      const h = await wm.prompt({ parentId: win.id, title: "Attributes", label: `Height (pixels):`, value: String(size.h) })
      if (h === null) return
      const nw = Math.max(1, Math.min(2000, parseInt(w) || size.w))
      const nh = Math.max(1, Math.min(2000, parseInt(h) || size.h))
      pushUndo()
      setSize({ w: nw, h: nh })
      setDirty(true)
    },
    stretch: async () => {
      const pct = await wm.prompt({ parentId: win.id, title: "Stretch and Skew", label: "Stretch horizontally and vertically (%):", value: "100" })
      if (pct === null) return
      const f = (parseInt(pct) || 100) / 100
      pushUndo()
      const c = canvasRef.current!
      const tmp = document.createElement("canvas")
      tmp.width = c.width
      tmp.height = c.height
      tmp.getContext("2d")!.drawImage(c, 0, 0)
      const nw = Math.max(1, Math.round(size.w * f))
      const nh = Math.max(1, Math.round(size.h * f))
      setSize({ w: nw, h: nh })
      requestAnimationFrame(() => {
        const g = ctx()
        g.imageSmoothingEnabled = false
        g.fillStyle = "#fff"
        g.fillRect(0, 0, nw, nh)
        g.drawImage(tmp, 0, 0, nw, nh)
      })
      setDirty(true)
    },
  }

  function transform(fn: (g: CanvasRenderingContext2D, c: HTMLCanvasElement) => void, swap = false) {
    pushUndo()
    const c = canvasRef.current!
    const tmp = document.createElement("canvas")
    tmp.width = c.width
    tmp.height = c.height
    tmp.getContext("2d")!.drawImage(c, 0, 0)
    const nw = swap ? c.height : c.width
    const nh = swap ? c.width : c.height
    const apply = () => {
      const g = ctx()
      g.save()
      g.fillStyle = "#fff"
      g.fillRect(0, 0, nw, nh)
      fn(g, { width: nw, height: nh } as HTMLCanvasElement)
      g.drawImage(tmp, 0, 0)
      g.restore()
      setDirty(true)
    }
    if (swap) {
      setSize({ w: nw, h: nh })
      requestAnimationFrame(apply)
    } else apply()
  }

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (wm.getSnapshot().activeId !== win.id) return
      if (e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault()
        undo()
      } else if (e.ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault()
        redo()
      } else if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault()
        save()
      } else if (e.ctrlKey && e.key.toLowerCase() === "a") {
        e.preventDefault()
        selectAll()
      } else if (e.ctrlKey && e.key.toLowerCase() === "c") copySel()
      else if (e.ctrlKey && e.key.toLowerCase() === "x") cutSel()
      else if (e.ctrlKey && e.key.toLowerCase() === "v") paste()
      else if (e.key === "Delete") clearSel()
      else if (e.key === "Escape") commitSelection()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const menus = [
    {
      label: "&File",
      items: [
        { label: "&New", accel: "Ctrl+N", onClick: doNew },
        { label: "&Open...", accel: "Ctrl+O", onClick: doOpen },
        { label: "&Save", accel: "Ctrl+S", onClick: () => save() },
        { label: "Save &As...", onClick: () => saveAs() },
        { sep: true },
        { label: "Print Pre&view", disabled: true },
        { label: "Page Se&tup...", disabled: true },
        { label: "&Print...", accel: "Ctrl+P", onClick: () => window.print() },
        { sep: true },
        { label: "S&end...", disabled: true },
        { sep: true },
        { label: "Set As &Wallpaper (Tiled)", onClick: () => setWallpaper("tile") },
        { label: "Set As Wa&llpaper (Centered)", onClick: () => setWallpaper("center") },
        { sep: true },
        { label: "E&xit", onClick: () => wm.requestClose(win.id) },
      ],
    },
    {
      label: "&Edit",
      items: [
        { label: "&Undo", accel: "Ctrl+Z", disabled: !undoStack.current.length, onClick: undo },
        { label: "&Repeat", accel: "F4", disabled: !redoStack.current.length, onClick: redo },
        { sep: true },
        { label: "Cu&t", accel: "Ctrl+X", disabled: !sel, onClick: cutSel },
        { label: "&Copy", accel: "Ctrl+C", disabled: !sel, onClick: copySel },
        { label: "&Paste", accel: "Ctrl+V", disabled: !clipRef.current, onClick: paste },
        { label: "C&lear Selection", accel: "Del", disabled: !sel, onClick: clearSel },
        { label: "Select &All", accel: "Ctrl+A", onClick: selectAll },
        { sep: true },
        { label: "C&opy To...", disabled: !sel, onClick: async () => {
            if (!sel) return
            const t = await fileDialog({ parentId: win.id, mode: "save", title: "Copy To", filters: FILTERS, defaultName: "selection.bmp" })
            if (!t) return
            const tmp = document.createElement("canvas")
            tmp.width = sel.w
            tmp.height = sel.h
            tmp.getContext("2d")!.putImageData(sel.data ?? ctx().getImageData(sel.x, sel.y, sel.w, sel.h), 0, 0)
            fs.writeFile(t, tmp.toDataURL("image/png"))
          } },
        { label: "Paste &From...", onClick: async () => {
            const t = await fileDialog({ parentId: win.id, mode: "open", title: "Paste From", filters: FILTERS })
            if (!t) return
            const content = fs.readFile(t)
            if (!content?.startsWith("data:image")) return
            const img = new Image()
            img.onload = () => {
              pushUndo()
              const tmp = document.createElement("canvas")
              tmp.width = img.width
              tmp.height = img.height
              const tg = tmp.getContext("2d")!
              tg.drawImage(img, 0, 0)
              const data = tg.getImageData(0, 0, img.width, img.height)
              setSel({ x: 0, y: 0, w: img.width, h: img.height, data })
              ctx().putImageData(data, 0, 0)
              setTool("select")
              setDirty(true)
            }
            img.src = content
          } },
      ],
    },
    {
      label: "&View",
      items: [
        { label: "&Tool Box", accel: "Ctrl+T", checked: showTools, onClick: () => setShowTools(!showTools) },
        { label: "&Color Box", accel: "Ctrl+A", checked: showColors, onClick: () => setShowColors(!showColors) },
        { label: "&Status Bar", checked: showStatus, onClick: () => setShowStatus(!showStatus) },
        { sep: true },
        {
          label: "&Zoom",
          items: [
            { label: "&Normal Size", accel: "Ctrl+PgUp", radio: true, checked: zoom === 1, onClick: () => setZoom(1) },
            { label: "&Large Size", accel: "Ctrl+PgDn", radio: true, checked: zoom === 4, onClick: () => setZoom(4) },
            { label: "C&ustom...", radio: true, checked: zoom === 2 || zoom === 8, onClick: () => setZoom(zoom === 2 ? 8 : 2) },
            { sep: true },
            { label: "Show &Grid", accel: "Ctrl+G", disabled: zoom < 4 },
            { label: "Show T&humbnail", disabled: true },
          ],
        },
        { label: "&View Bitmap", accel: "Ctrl+F", onClick: () => { setShowTools(false); setShowColors(false); setShowStatus(false) } },
        { label: "Te&xt Toolbar", disabled: tool !== "text" },
      ],
    },
    {
      label: "&Image",
      items: [
        {
          label: "&Flip/Rotate...",
          items: [
            { label: "Flip &horizontal", onClick: image.flipH },
            { label: "Flip &vertical", onClick: image.flipV },
            { label: "Rotate by &90°", onClick: image.rot90 },
            { label: "Rotate by 1&80°", onClick: image.rot180 },
          ],
        },
        { label: "&Stretch/Skew...", onClick: image.stretch },
        { label: "&Invert Colors", accel: "Ctrl+I", onClick: image.invert },
        { label: "&Attributes...", accel: "Ctrl+E", onClick: image.attributes },
        { label: "&Clear Image", accel: "Ctrl+Shft+N", onClick: image.clear },
      ],
    },
    {
      label: "&Options",
      items: [
        { label: "&Edit Colors...", onClick: () => {
            const inp = document.createElement("input")
            inp.type = "color"
            inp.value = fg
            inp.onchange = () => setFg(inp.value)
            inp.click()
          } },
        { label: "&Get Colors...", disabled: true },
        { label: "&Save Colors...", disabled: true },
        { sep: true },
        { label: "&Draw Opaque", checked: opaque, onClick: () => setOpaque(!opaque) },
      ],
    },
    {
      label: "&Help",
      items: [
        { label: "&Help Topics", onClick: () => launch("help", { topic: "paint" }) },
        { sep: true },
        { label: "&About Paint", onClick: () => wm.msgBox({ parentId: win.id, title: "About Paint", text: "Microsoft Paint\nWindows 95\n\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) },
      ],
    },
  ]

  const optionsBox = () => {
    if (tool === "line" || tool === "curve") {
      return (
        <div className="col" style={{ gap: 2, padding: 4 }}>
          {[1, 2, 3, 4, 5].map((w) => (
            <button key={w} type="button" className="paint-tool" style={{ width: 42, height: 8, boxShadow: lineWidth === w ? "var(--sunken)" : "none", background: lineWidth === w ? "var(--highlight)" : "transparent", padding: 0 }} onClick={() => setLineWidth(w)}>
              <div style={{ width: 34, height: w, background: lineWidth === w ? "#fff" : "#000" }} />
            </button>
          ))}
        </div>
      )
    }
    if (tool === "rect" || tool === "ellipse" || tool === "roundrect" || tool === "polygon") {
      return (
        <div className="col" style={{ gap: 2, padding: 4 }}>
          {[0, 1, 2].map((m) => (
            <button key={m} type="button" className="paint-tool" style={{ width: 42, height: 14, boxShadow: fillMode === m ? "var(--sunken)" : "none", background: fillMode === m ? "var(--highlight)" : "transparent" }} onClick={() => setFillMode(m as 0 | 1 | 2)}>
              <div style={{ width: 30, height: 10, border: m < 2 ? `1px solid ${fillMode === m ? "#fff" : "#000"}` : "none", background: m === 0 ? "transparent" : fillMode === m ? "#c0c0c0" : "#808080" }} />
            </button>
          ))}
        </div>
      )
    }
    if (tool === "brush" || tool === "airbrush" || tool === "eraser") {
      return (
        <div className="paint-tool-grid" style={{ padding: 4, gap: 2 }}>
          {[2, 4, 6, 8].map((s) => (
            <button key={s} type="button" className="paint-tool" style={{ width: 21, height: 21, boxShadow: brushSize === s ? "var(--sunken)" : "none", background: brushSize === s ? "var(--highlight)" : "transparent" }} onClick={() => setBrushSize(s)}>
              <div style={{ width: s, height: s, background: brushSize === s ? "#fff" : "#000", borderRadius: tool === "brush" ? "50%" : 0 }} />
            </button>
          ))}
        </div>
      )
    }
    if (tool === "select" || tool === "freeselect") {
      return (
        <div className="col" style={{ gap: 2, padding: 4 }}>
          <button type="button" className="paint-tool" style={{ width: 42, height: 20, boxShadow: opaque ? "var(--sunken)" : "none" }} onClick={() => setOpaque(true)} title="Opaque">
            <div style={{ width: 20, height: 12, background: "#808080", border: "1px solid #000" }} />
          </button>
          <button type="button" className="paint-tool" style={{ width: 42, height: 20, boxShadow: !opaque ? "var(--sunken)" : "none" }} onClick={() => setOpaque(false)} title="Transparent">
            <div style={{ width: 20, height: 12, border: "1px dashed #000" }} />
          </button>
        </div>
      )
    }
    if (tool === "zoom") {
      return (
        <div className="col" style={{ gap: 2, padding: 4 }}>
          {[1, 2, 4, 8].map((z) => (
            <button key={z} type="button" className="paint-tool" style={{ width: 42, height: 11, fontSize: 9, boxShadow: zoom === z ? "var(--sunken)" : "none" }} onClick={() => setZoom(z)}>
              {z}x
            </button>
          ))}
        </div>
      )
    }
    return <div style={{ height: 66 }} />
  }

  return (
    <>
      <MenuBar menus={menus} />
      <div className="row" style={{ flex: 1, alignItems: "stretch", minHeight: 0 }}>
        {showTools && (
          <div className="paint-tools">
            <div className="paint-tool-grid">
              {TOOLS.map((t) => (
                <button key={t.id} type="button" className={`paint-tool ${tool === t.id ? "on" : ""}`} title={t.title} onClick={() => { commitSelection(); setTool(t.id); drawing.current = null }}>
                  <span style={{ fontSize: 13, lineHeight: 1 }}>{t.glyph}</span>
                </button>
              ))}
            </div>
            <div style={{ boxShadow: "var(--sunken)", marginTop: 4, minHeight: 66, display: "flex", justifyContent: "center" }}>{optionsBox()}</div>
          </div>
        )}
        <div className="paint-canvas w95-scroll" onContextMenu={(e) => e.preventDefault()} onPointerLeave={() => setPos(null)}>
          <div style={{ position: "relative", width: size.w * zoom, height: size.h * zoom, display: "inline-block" }}>
            <canvas
              ref={canvasRef}
              width={size.w}
              height={size.h}
              style={{ width: size.w * zoom, height: size.h * zoom, imageRendering: "pixelated", display: "block", cursor: tool === "text" ? "text" : "crosshair", background: "#fff" }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onDoubleClick={onDoubleClick}
            />
            {sel && (
              <div
                style={{
                  position: "absolute",
                  left: sel.x * zoom,
                  top: sel.y * zoom,
                  width: sel.w * zoom,
                  height: sel.h * zoom,
                  border: "1px dashed #000",
                  outline: "1px dashed #fff",
                  pointerEvents: "none",
                }}
              />
            )}
            {/* resize grip */}
            <div
              style={{ position: "absolute", right: -5, bottom: -5, width: 5, height: 5, background: "#000080", cursor: "nwse-resize" }}
              onPointerDown={(e) => {
                e.stopPropagation()
                const start = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }
                const move = (ev: PointerEvent) => {
                  setSize({ w: Math.max(1, Math.round(start.w + (ev.clientX - start.x) / zoom)), h: Math.max(1, Math.round(start.h + (ev.clientY - start.y) / zoom)) })
                }
                const up = () => {
                  window.removeEventListener("pointermove", move)
                  window.removeEventListener("pointerup", up)
                  setDirty(true)
                }
                window.addEventListener("pointermove", move)
                window.addEventListener("pointerup", up)
              }}
            />
          </div>
        </div>
      </div>
      {showColors && (
        <div className="row" style={{ padding: "4px 4px 2px", gap: 2 }}>
          <div className="cur-colors">
            <div className="fg" style={{ background: fg }} />
            <div className="bg" style={{ background: bg }} />
          </div>
          <div className="palette" onContextMenu={(e) => e.preventDefault()}>
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className="sw"
                style={{ background: c }}
                onClick={() => setFg(c)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setBg(c)
                }}
                onDoubleClick={() => {
                  const inp = document.createElement("input")
                  inp.type = "color"
                  inp.value = c
                  inp.onchange = () => setFg(inp.value)
                  inp.click()
                }}
              />
            ))}
          </div>
        </div>
      )}
      {showStatus && (
        <StatusBar
          cells={[
            "For Help, click Help Topics on the Help Menu.",
            pos ? `${pos.x},${pos.y}` : "",
            sel ? `${sel.w}x${sel.h}` : drawing.current && pos ? `${Math.abs(pos.x - drawing.current.start.x)}x${Math.abs(pos.y - drawing.current.start.y)}` : "",
          ]}
        />
      )}
      <span style={{ display: "none" }} onClick={() => force((x) => x + 1)} />
    </>
  )
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")
}

registerApp({
  id: "paint",
  name: "Paint",
  icon: "paint_file",
  component: Paint,
  width: 560,
  height: 460,
  minW: 320,
  minH: 240,
  exe: "MSPAINT.EXE",
  startMenu: ["Programs", "Accessories"],
  title: (p) => `${p.path ? fs.basename(String(p.path)) : "untitled"} - Paint`,
})
