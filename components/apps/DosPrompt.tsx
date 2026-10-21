"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm } from "@/lib/win95/store"
import { system } from "@/lib/win95/system"
import { DosShell, type DosIO } from "@/lib/win95/dos"
import { fs, matchGlob } from "@/lib/win95/fs"

/* ------------------------------------------------------------------ */
/*  MS-DOS Prompt — terminal view over DosShell                         */
/* ------------------------------------------------------------------ */

type Mode = { kind: "input" } | { kind: "ask"; prompt: string; resolve: (s: string) => void } | { kind: "key"; prompt: string; resolve: (s: string) => void } | { kind: "busy" }

const MAX_LINES = 3000

export function DosPrompt({ win }: AppProps) {
  const fullscreen = !!win.props.fullscreen
  const [buffer, setBuffer] = useState<string>("")
  const [input, setInput] = useState("")
  const [cursor, setCursor] = useState(0)
  const [mode, setMode] = useState<Mode>({ kind: "input" })
  const [colors, setColors] = useState({ fg: "#c0c0c0", bg: "#000000" })
  const history = useRef<string[]>([])
  const histIdx = useRef(-1)
  const shellRef = useRef<DosShell | null>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const modeRef = useRef<Mode>(mode)
  modeRef.current = mode

  const append = useCallback((t: string) => {
    setBuffer((b) => {
      // handle carriage return (overwrite current line)
      let next = b
      for (const part of t.split(/(\r)/)) {
        if (part === "\r") {
          const i = next.lastIndexOf("\n")
          next = next.slice(0, i + 1)
        } else next += part
      }
      const lines = next.split("\n")
      if (lines.length > MAX_LINES) next = lines.slice(lines.length - MAX_LINES).join("\n")
      return next
    })
  }, [])

  // create shell once
  if (!shellRef.current) {
    const io: DosIO = {
      print: (t) => append(t),
      clear: () => setBuffer(""),
      ask: (prompt) =>
        new Promise<string>((resolve) => {
          setMode({ kind: "ask", prompt, resolve })
        }),
      askKey: (prompt) =>
        new Promise<string>((resolve) => {
          setMode({ kind: "key", prompt, resolve })
        }),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      exit: () => {
        if (fullscreen) system.setPhase("desktop")
        else wm.close(win.id)
      },
      setTitle: (t) => wm.setTitle(win.id, t),
    }
    const sh = new DosShell(io, { fullscreen })
    sh.onColor = (fg, bg) => setColors({ fg, bg })
    shellRef.current = sh
    // banner
    setTimeout(() => {
      append(fullscreen ? "\nMicrosoft(R) Windows 95\n   (C)Copyright Microsoft Corp 1981-1996.\n\nType WIN or EXIT to return to Windows.\n\n" : sh.banner())
    }, 0)
  }
  const shell = shellRef.current

  // scroll to bottom
  useEffect(() => {
    const el = viewRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [buffer, input, mode])

  // focus
  const focus = useCallback(() => inputRef.current?.focus({ preventScroll: true }), [])
  useEffect(() => {
    focus()
  }, [focus])

  const runLine = useCallback(
    async (line: string) => {
      append(shell.prompt() + line + "\n")
      if (line.trim()) {
        history.current = [line, ...history.current.filter((h) => h !== line)].slice(0, 50)
      }
      histIdx.current = -1
      setInput("")
      setCursor(0)
      setMode({ kind: "busy" })
      try {
        await shell.exec(line)
      } catch (e) {
        append(`\nGeneral failure: ${(e as Error).message}\n`)
      }
      append("\n")
      setMode({ kind: "input" })
    },
    [append, shell],
  )

  const complete = () => {
    const parts = input.split(/\s+/)
    const last = parts[parts.length - 1] ?? ""
    if (!last) return
    const norm = fs.normalize(last, shell.cwd)
    const dir = last.endsWith("\\") ? norm : fs.parent(norm)
    const prefix = last.endsWith("\\") ? "" : fs.basename(norm)
    const matches = matchGlob(fs, dir, prefix + "*")
    if (!matches.length) return
    const m = matches[0]
    const lastSlash = last.lastIndexOf("\\")
    const head = lastSlash >= 0 ? last.slice(0, lastSlash + 1) : ""
    let name = m.name
    if (/\s/.test(name)) name = `"${name}"`
    parts[parts.length - 1] = head + name
    const next = parts.join(" ")
    setInput(next)
    setCursor(next.length)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const m = modeRef.current
    if (m.kind === "busy") {
      if (e.ctrlKey && e.key.toLowerCase() === "c") {
        shell.abort()
        append("^C\n")
      }
      e.preventDefault()
      return
    }
    if (m.kind === "key") {
      e.preventDefault()
      if (e.key.length === 1) {
        setMode({ kind: "busy" })
        m.resolve(e.key)
      } else if (e.key === "Enter" || e.key === "Escape") {
        setMode({ kind: "busy" })
        m.resolve(e.key === "Enter" ? "\n" : "\x1b")
      }
      return
    }
    // input / ask modes share line editing
    if (e.ctrlKey && e.key.toLowerCase() === "c") {
      e.preventDefault()
      if (m.kind === "ask") {
        append(m.prompt + input + "^C\n")
        setInput("")
        setCursor(0)
        setMode({ kind: "busy" })
        m.resolve("")
      } else {
        append(shell.prompt() + input + "^C\n")
        setInput("")
        setCursor(0)
      }
      return
    }
    if (e.ctrlKey && e.key.toLowerCase() === "v") return // allow paste
    if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault()
      setBuffer("")
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    switch (e.key) {
      case "Enter": {
        e.preventDefault()
        if (m.kind === "ask") {
          append(m.prompt + input + "\n")
          const v = input
          setInput("")
          setCursor(0)
          setMode({ kind: "busy" })
          m.resolve(v)
        } else runLine(input)
        return
      }
      case "Backspace":
        e.preventDefault()
        if (cursor > 0) {
          setInput(input.slice(0, cursor - 1) + input.slice(cursor))
          setCursor(cursor - 1)
        }
        return
      case "Delete":
        e.preventDefault()
        setInput(input.slice(0, cursor) + input.slice(cursor + 1))
        return
      case "ArrowLeft":
        e.preventDefault()
        setCursor(Math.max(0, cursor - 1))
        return
      case "ArrowRight":
        e.preventDefault()
        setCursor(Math.min(input.length, cursor + 1))
        return
      case "Home":
        e.preventDefault()
        setCursor(0)
        return
      case "End":
        e.preventDefault()
        setCursor(input.length)
        return
      case "Escape":
        e.preventDefault()
        setInput("")
        setCursor(0)
        return
      case "Tab":
        e.preventDefault()
        complete()
        return
      case "ArrowUp":
      case "ArrowDown": {
        e.preventDefault()
        if (m.kind !== "input") return
        const h = history.current
        if (!h.length) return
        let idx = histIdx.current
        idx = e.key === "ArrowUp" ? Math.min(h.length - 1, idx + 1) : Math.max(-1, idx - 1)
        histIdx.current = idx
        const v = idx < 0 ? "" : h[idx]
        setInput(v)
        setCursor(v.length)
        return
      }
      case "F3": {
        e.preventDefault()
        const v = history.current[0] ?? ""
        setInput(v)
        setCursor(v.length)
        return
      }
    }
    if (e.key.length === 1) {
      e.preventDefault()
      if (input.length >= 255) return
      setInput(input.slice(0, cursor) + e.key + input.slice(cursor))
      setCursor(cursor + 1)
    }
  }

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const t = e.clipboardData.getData("text").replace(/\r?\n[\s\S]*$/, "")
    setInput(input.slice(0, cursor) + t + input.slice(cursor))
    setCursor(cursor + t.length)
  }

  const promptText = mode.kind === "input" ? shell.prompt() : mode.kind === "ask" || mode.kind === "key" ? mode.prompt : ""
  const showCursor = mode.kind !== "busy"
  const before = input.slice(0, cursor)
  const at = input[cursor] ?? " "
  const after = input.slice(cursor + 1)

  return (
    <div
      ref={viewRef}
      className={`dos w95-scroll ${fullscreen ? "fullscreen" : ""}`}
      style={{ color: colors.fg, background: colors.bg }}
      onPointerDown={() => setTimeout(focus, 0)}
    >
      {buffer}
      {promptText}
      {mode.kind !== "key" && before}
      {showCursor && mode.kind !== "key" && (
        <span style={{ position: "relative" }}>
          <span style={{ visibility: "hidden" }}>{at}</span>
          <span style={{ position: "absolute", left: 0, top: 0 }}>{at === " " ? "" : at}</span>
          <span className="cursor" style={{ position: "absolute", left: 0, bottom: 0, background: colors.fg }} />
        </span>
      )}
      {mode.kind === "key" && showCursor && <span className="cursor" style={{ background: colors.fg }} />}
      {mode.kind !== "key" && after}
      <textarea
        ref={inputRef}
        value=""
        onChange={() => {}}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="MS-DOS Prompt input"
        style={{ position: "absolute", opacity: 0, width: 1, height: 1, left: 0, top: 0, pointerEvents: "none" }}
      />
    </div>
  )
}

registerApp({
  id: "dos",
  name: "MS-DOS Prompt",
  icon: "ms_dos",
  component: DosPrompt,
  width: 660,
  height: 420,
  minW: 300,
  minH: 150,
  exe: "COMMAND.COM",
  startMenu: ["Programs"],
})
