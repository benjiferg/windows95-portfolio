"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm, launch } from "@/lib/win95/store"
import { sounds } from "@/lib/win95/sounds"
import { MenuBar } from "@/components/win95/Menu"
import { Button, TextInput } from "@/components/win95/controls"

/* ------------------------------------------------------------------ */
/*  Minesweeper                                                         */
/* ------------------------------------------------------------------ */

type Level = { name: string; rows: number; cols: number; mines: number }
const LEVELS: Record<string, Level> = {
  beginner: { name: "Beginner", rows: 8, cols: 8, mines: 10 },
  intermediate: { name: "Intermediate", rows: 16, cols: 16, mines: 40 },
  expert: { name: "Expert", rows: 16, cols: 30, mines: 99 },
}

interface Cell {
  mine: boolean
  open: boolean
  flag: 0 | 1 | 2 // 0 none, 1 flag, 2 question
  n: number
}

type State = "ready" | "playing" | "won" | "lost"

const NUM_COLORS = ["", "#0000ff", "#008000", "#ff0000", "#000080", "#800000", "#008080", "#000000", "#808080"]

function makeBoard(level: Level): Cell[][] {
  return Array.from({ length: level.rows }, () => Array.from({ length: level.cols }, () => ({ mine: false, open: false, flag: 0 as const, n: 0 })))
}

function placeMines(board: Cell[][], level: Level, safeR: number, safeC: number) {
  let placed = 0
  while (placed < level.mines) {
    const r = Math.floor(Math.random() * level.rows)
    const c = Math.floor(Math.random() * level.cols)
    if (board[r][c].mine || (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)) continue
    board[r][c].mine = true
    placed++
  }
  for (let r = 0; r < level.rows; r++)
    for (let c = 0; c < level.cols; c++) {
      let n = 0
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr
          const cc = c + dc
          if (rr >= 0 && rr < level.rows && cc >= 0 && cc < level.cols && board[rr][cc].mine) n++
        }
      board[r][c].n = n
    }
}

const BEST_KEY = "w95.minesweeper.best"
function loadBest(): Record<string, { time: number; name: string }> {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? "{}")
  } catch {
    return {}
  }
}

export function Minesweeper({ win }: AppProps) {
  const [levelKey, setLevelKey] = useState("beginner")
  const [custom, setCustom] = useState<Level | null>(null)
  const level = custom ?? LEVELS[levelKey]
  const [board, setBoard] = useState<Cell[][]>(() => makeBoard(LEVELS.beginner))
  const [state, setState] = useState<State>("ready")
  const [time, setTime] = useState(0)
  const [flags, setFlags] = useState(0)
  const [face, setFace] = useState<"smile" | "o" | "dead" | "cool">("smile")
  const [marks, setMarks] = useState(true)
  const [color, setColor] = useState(true)
  const [sound, setSound] = useState(false)
  const [best, setBest] = useState(loadBest)
  const [boom, setBoom] = useState<[number, number] | null>(null)
  const mouseDown = useRef(false)

  const reset = useCallback(
    (lv: Level) => {
      setBoard(makeBoard(lv))
      setState("ready")
      setTime(0)
      setFlags(0)
      setFace("smile")
      setBoom(null)
    },
    [],
  )

  useEffect(() => {
    reset(level)
  }, [level, reset])

  // window size follows board
  useEffect(() => {
    const w = level.cols * 16 + 20 + 6
    const h = level.rows * 16 + 20 + 19 + 37 + 18 + 12
    wm.update(win.id, { w: Math.max(w, 166), h })
  }, [level, win.id])

  useEffect(() => {
    if (state !== "playing") return
    const t = setInterval(() => setTime((x) => Math.min(999, x + 1)), 1000)
    return () => clearInterval(t)
  }, [state])

  const openCell = (b: Cell[][], r: number, c: number) => {
    const stack: [number, number][] = [[r, c]]
    while (stack.length) {
      const [rr, cc] = stack.pop()!
      const cell = b[rr][cc]
      if (cell.open || cell.flag === 1) continue
      cell.open = true
      cell.flag = 0
      if (cell.n === 0 && !cell.mine) {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const nr = rr + dr
            const nc = cc + dc
            if (nr >= 0 && nr < level.rows && nc >= 0 && nc < level.cols && !b[nr][nc].open) stack.push([nr, nc])
          }
      }
    }
  }

  const checkWin = (b: Cell[][]) => {
    for (const row of b) for (const cell of row) if (!cell.mine && !cell.open) return false
    return true
  }

  const click = (r: number, c: number) => {
    if (state === "won" || state === "lost") return
    const b = board.map((row) => row.map((cell) => ({ ...cell })))
    const cell = b[r][c]
    if (cell.flag === 1 || cell.open) return
    let st = state
    if (state === "ready") {
      placeMines(b, level, r, c)
      st = "playing"
      setState("playing")
    }
    if (cell.mine) {
      // lose
      for (const row of b)
        for (const x of row) {
          if (x.mine) x.open = true
        }
      setBoom([r, c])
      setBoard(b)
      setState("lost")
      setFace("dead")
      if (sound) sounds.explosion()
      return
    }
    openCell(b, r, c)
    setBoard(b)
    if (checkWin(b)) {
      setState("won")
      setFace("cool")
      // auto-flag remaining mines
      for (const row of b) for (const x of row) if (x.mine) x.flag = 1
      setFlags(level.mines)
      if (sound) sounds.tada()
      if (!custom) {
        const prev = best[levelKey]
        if (!prev || time < prev.time) {
          wm.prompt({ parentId: win.id, title: "Fastest Mine Sweepers", label: `You have the fastest time for ${level.name.toLowerCase()} level.\nPlease enter your name.`, value: prev?.name ?? "Anonymous" }).then((name) => {
            const nb = { ...best, [levelKey]: { time, name: name || "Anonymous" } }
            setBest(nb)
            localStorage.setItem(BEST_KEY, JSON.stringify(nb))
          })
        }
      }
    } else if (st === "playing") setFace("smile")
  }

  const rightClick = (r: number, c: number) => {
    if (state === "won" || state === "lost") return
    const b = board.map((row) => row.map((cell) => ({ ...cell })))
    const cell = b[r][c]
    if (cell.open) return
    if (cell.flag === 0) {
      cell.flag = 1
      setFlags(flags + 1)
    } else if (cell.flag === 1) {
      cell.flag = marks ? 2 : 0
      setFlags(flags - 1)
    } else cell.flag = 0
    setBoard(b)
  }

  const chord = (r: number, c: number) => {
    const cell = board[r][c]
    if (!cell.open || cell.n === 0) return
    let f = 0
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr
        const cc = c + dc
        if (rr >= 0 && rr < level.rows && cc >= 0 && cc < level.cols && board[rr][cc].flag === 1) f++
      }
    if (f !== cell.n) return
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr
        const cc = c + dc
        if (rr >= 0 && rr < level.rows && cc >= 0 && cc < level.cols && !board[rr][cc].open && board[rr][cc].flag !== 1) click(rr, cc)
      }
  }

  const customDialog = async () => {
    const h = await wm.prompt({ parentId: win.id, title: "Custom Field", label: "Height (9-24):", value: String(level.rows) })
    if (h === null) return
    const w = await wm.prompt({ parentId: win.id, title: "Custom Field", label: "Width (9-30):", value: String(level.cols) })
    if (w === null) return
    const m = await wm.prompt({ parentId: win.id, title: "Custom Field", label: "Mines (10-667):", value: String(level.mines) })
    if (m === null) return
    const rows = Math.max(9, Math.min(24, parseInt(h) || 9))
    const cols = Math.max(9, Math.min(30, parseInt(w) || 9))
    const mines = Math.max(10, Math.min((rows - 1) * (cols - 1), parseInt(m) || 10))
    setCustom({ name: "Custom", rows, cols, mines })
    setLevelKey("custom")
  }

  const menus = [
    {
      label: "&Game",
      items: [
        { label: "&New", accel: "F2", onClick: () => reset(level) },
        { sep: true },
        { label: "&Beginner", radio: true, checked: levelKey === "beginner", onClick: () => { setCustom(null); setLevelKey("beginner") } },
        { label: "&Intermediate", radio: true, checked: levelKey === "intermediate", onClick: () => { setCustom(null); setLevelKey("intermediate") } },
        { label: "&Expert", radio: true, checked: levelKey === "expert", onClick: () => { setCustom(null); setLevelKey("expert") } },
        { label: "&Custom...", radio: true, checked: levelKey === "custom", onClick: customDialog },
        { sep: true },
        { label: "&Marks (?)", checked: marks, onClick: () => setMarks(!marks) },
        { label: "Co&lor", checked: color, onClick: () => setColor(!color) },
        { label: "&Sound", checked: sound, onClick: () => setSound(!sound) },
        { sep: true },
        { label: "Best &Times...", onClick: () => launch("minetimes", { best }, { parentId: win.id, modal: true }) },
        { sep: true },
        { label: "E&xit", onClick: () => wm.close(win.id) },
      ],
    },
    {
      label: "&Help",
      items: [
        { label: "&Contents", onClick: () => launch("help", { topic: "minesweeper" }) },
        { label: "&Search for Help on...", disabled: true },
        { label: "&How to Play", onClick: () => wm.msgBox({ parentId: win.id, title: "Minesweeper", text: "Uncover all the squares that do not contain mines.\n\nLeft-click to uncover a square. Right-click to mark a square as a mine. The number on a square tells you how many mines touch it.\n\nClick a number with both buttons (or middle-click) to uncover all its unmarked neighbours.", icon: "info" }) },
        { sep: true },
        { label: "&About Minesweeper...", onClick: () => wm.msgBox({ parentId: win.id, title: "About Minesweeper", text: "Microsoft Minesweeper\nWindows 95\n\nby Robert Donner and Curt Johnson\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) },
      ],
    },
  ]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (wm.getSnapshot().activeId !== win.id) return
      if (e.key === "F2") reset(level)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [level, reset, win.id])

  const faces = { smile: "🙂", o: "😮", dead: "😵", cool: "😎" }
  const remaining = level.mines - flags
  const seg = (n: number) => String(Math.max(-99, Math.min(999, n))).padStart(3, "0").replace(/^0(-)/, "$1")

  return (
    <>
      <MenuBar menus={menus} />
      <div style={{ padding: 6, background: "var(--face)", flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", filter: color ? "none" : "grayscale(1)" }}>
        <div style={{ boxShadow: "inset -3px -3px var(--hilight), inset 3px 3px var(--shadow)", padding: 6, display: "inline-flex", flexDirection: "column", gap: 6 }}>
          <div className="row" style={{ justifyContent: "space-between", boxShadow: "inset -2px -2px var(--hilight), inset 2px 2px var(--shadow)", padding: 4 }}>
            <div className="seg">{seg(remaining)}</div>
            <button
              type="button"
              className="smiley"
              onClick={() => reset(level)}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {faces[face]}
            </button>
            <div className="seg">{seg(time)}</div>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: `repeat(${level.cols}, 16px)`, boxShadow: "inset -3px -3px var(--hilight), inset 3px 3px var(--shadow)", padding: 3 }}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={() => {
              mouseDown.current = true
              if (state === "ready" || state === "playing") setFace("o")
            }}
            onPointerUp={() => {
              mouseDown.current = false
              if (state === "ready" || state === "playing") setFace("smile")
            }}
            onPointerLeave={() => {
              if ((state === "ready" || state === "playing") && face === "o") setFace("smile")
            }}
          >
            {board.map((row, r) =>
              row.map((cell, c) => {
                const isBoom = boom && boom[0] === r && boom[1] === c
                let content: React.ReactNode = ""
                if (cell.open) {
                  if (cell.mine) content = "💣"
                  else if (cell.n) content = <span style={{ color: NUM_COLORS[cell.n] }}>{cell.n}</span>
                } else if (cell.flag === 1) content = <span style={{ color: "#f00" }}>▶</span>
                else if (cell.flag === 2) content = "?"
                if (state === "lost" && cell.flag === 1 && !cell.mine) content = <span style={{ color: "#000" }}>✕</span>
                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    className={`mine-cell ${cell.open ? "open" : ""} ${isBoom ? "boom" : ""}`}
                    style={cell.open && cell.mine && !isBoom ? { fontSize: 11 } : cell.open && cell.mine ? { fontSize: 11 } : undefined}
                    onClick={() => click(r, c)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      rightClick(r, c)
                    }}
                    onAuxClick={(e) => {
                      if (e.button === 1) chord(r, c)
                    }}
                    onDoubleClick={() => chord(r, c)}
                  >
                    {content}
                  </button>
                )
              }),
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function BestTimes({ win }: AppProps) {
  const best = (win.props.best as Record<string, { time: number; name: string }>) ?? {}
  const [b, setB] = useState(best)
  const row = (k: string, label: string) => (
    <tr key={k}>
      <td style={{ paddingRight: 20 }}>{label}:</td>
      <td style={{ paddingRight: 20 }}>{b[k]?.time ?? 999} seconds</td>
      <td>{b[k]?.name ?? "Anonymous"}</td>
    </tr>
  )
  return (
    <div className="dlg">
      <div style={{ fontWeight: 700 }}>Fastest Mine Sweepers</div>
      <table>
        <tbody>
          {row("beginner", "Beginner")}
          {row("intermediate", "Intermediate")}
          {row("expert", "Expert")}
        </tbody>
      </table>
      <div className="dlg-buttons center">
        <Button
          onClick={() => {
            setB({})
            localStorage.removeItem(BEST_KEY)
          }}
        >
          &Reset Scores
        </Button>
        <Button isDefault onClick={() => wm.close(win.id)}>
          OK
        </Button>
      </div>
    </div>
  )
}

registerApp({
  id: "minetimes",
  name: "Fastest Mine Sweepers",
  icon: "minesweeper",
  component: BestTimes,
  width: 320,
  height: 150,
  resizable: false,
  minimizable: false,
  maximizable: false,
  noTaskbar: true,
})

registerApp({
  id: "minesweeper",
  name: "Minesweeper",
  icon: "minesweeper",
  component: Minesweeper,
  width: 154,
  height: 240,
  resizable: false,
  maximizable: false,
  singleton: true,
  exe: "WINMINE.EXE",
  startMenu: ["Programs", "Accessories", "Games"],
})

export { TextInput }
