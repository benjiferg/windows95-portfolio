"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm, launch } from "@/lib/win95/store"
import { sounds } from "@/lib/win95/sounds"
import { MenuBar } from "@/components/win95/Menu"
import { Button, Checkbox, StatusBar } from "@/components/win95/controls"
import { CARD_H, CARD_W, CardView, Slot, freecellDeal, isRed, type Card } from "./cards"

/* ------------------------------------------------------------------ */
/*  FreeCell                                                            */
/* ------------------------------------------------------------------ */

interface Game {
  cascades: Card[][]
  cells: (Card | null)[]
  found: Card[][] // by suit index C D H S
}
type Src = { kind: "cell"; i: number } | { kind: "casc"; i: number; idx: number }
type Dst = { kind: "cell"; i: number } | { kind: "casc"; i: number } | { kind: "found"; i: number }

const SUIT_IDX: Record<string, number> = { C: 0, D: 1, H: 2, S: 3 }
const STATS_KEY = "w95.freecell.stats"

function loadStats() {
  try {
    return { won: 0, lost: 0, streak: 0, streakKind: "none" as "won" | "lost" | "none", ...JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}") }
  } catch {
    return { won: 0, lost: 0, streak: 0, streakKind: "none" as const }
  }
}

function newGame(n: number): Game {
  return { cascades: freecellDeal(n), cells: [null, null, null, null], found: [[], [], [], []] }
}
function clone(g: Game): Game {
  return { cascades: g.cascades.map((c) => c.slice()), cells: g.cells.slice(), found: g.found.map((f) => f.slice()) }
}

function canOnto(moving: Card, onto: Card | undefined) {
  if (!onto) return true
  return onto.rank === moving.rank + 1 && isRed(onto) !== isRed(moving)
}
function isRun(cards: Card[]) {
  for (let i = 1; i < cards.length; i++) if (!canOnto(cards[i], cards[i - 1])) return false
  return true
}
function canFound(c: Card, f: Card[]) {
  return f.length === 0 ? c.rank === 1 : f[f.length - 1].rank === c.rank - 1
}

export function FreeCell({ win }: AppProps) {
  const [gameNo, setGameNo] = useState(() => Math.floor(Math.random() * 32000) + 1)
  const [game, setGame] = useState<Game>(() => newGame(gameNo))
  const [undo, setUndo] = useState<Game[]>([])
  const [sel, setSel] = useState<Src | null>(null)
  const [moves, setMoves] = useState(0)
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing")
  const [stats, setStats] = useState(loadStats)
  const [opts, setOpts] = useState({ quick: false, tips: true, dblclick: true })
  const [kingLook, setKingLook] = useState<"left" | "right">("left")
  const areaRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(632)

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cascW = Math.max(CARD_W + 4, Math.floor((width - 16) / 8))
  // free cells packed at the left edge, foundations at the right edge, king in the gap
  const topX = (i: number) => (i < 4 ? 8 + i * (CARD_W + 2) : width - 8 - (8 - i) * (CARD_W + 2) + 2)
  const kingX = (8 + 4 * (CARD_W + 2) + (width - 8 - 4 * (CARD_W + 2) + 2)) / 2
  const cascX = (i: number) => 8 + i * cascW + (cascW - CARD_W) / 2
  const TOP = 8
  const CASC_Y = TOP + CARD_H + 24
  const off = Math.max(12, Math.min(20, Math.floor((win.h - CASC_Y - 120) / 14)))

  useEffect(() => {
    wm.setTitle(win.id, `FreeCell Game #${gameNo}`)
  }, [gameNo, win.id])

  const start = useCallback((n: number) => {
    setGameNo(n)
    setGame(newGame(n))
    setUndo([])
    setSel(null)
    setMoves(0)
    setStatus("playing")
  }, [])

  const saveStats = (s: ReturnType<typeof loadStats>) => {
    setStats(s)
    localStorage.setItem(STATS_KEY, JSON.stringify(s))
  }

  const freeCells = game.cells.filter((c) => !c).length
  const emptyCascades = game.cascades.filter((c) => !c.length).length

  const maxMovable = (toEmpty: boolean) => (freeCells + 1) * Math.pow(2, Math.max(0, emptyCascades - (toEmpty ? 1 : 0)))

  const cardsOf = (g: Game, s: Src): Card[] => (s.kind === "cell" ? (g.cells[s.i] ? [g.cells[s.i]!] : []) : g.cascades[s.i].slice(s.idx))

  const finish = (g: Game) => {
    setMoves((m) => m + 1)
    setUndo((u) => [...u.slice(-50), clone(game)])
    setGame(g)
    setSel(null)
    if (g.found.every((f) => f.length === 13)) {
      setStatus("won")
      sounds.tada()
      const s = loadStats()
      saveStats({ ...s, won: s.won + 1, streak: s.streakKind === "won" ? s.streak + 1 : 1, streakKind: "won" })
      wm.msgBox({ parentId: win.id, title: "FreeCell", text: "Congratulations, you win!\nDo you want to play again?", icon: "info", buttons: ["Yes", "No"] }).then((r) => {
        if (r === "Yes") start(Math.floor(Math.random() * 32000) + 1)
      })
      return
    }
    if (!hasMoves(g)) {
      setStatus("lost")
      const s = loadStats()
      saveStats({ ...s, lost: s.lost + 1, streak: s.streakKind === "lost" ? s.streak + 1 : 1, streakKind: "lost" })
      sounds.chord()
      wm.msgBox({ parentId: win.id, title: "FreeCell", text: "Sorry, you lose.\nDo you want to play again?", icon: "info", buttons: ["Yes", "No"] }).then((r) => {
        if (r === "Yes") start(Math.floor(Math.random() * 32000) + 1)
      })
    }
  }

  const hasMoves = (g: Game) => {
    if (g.cells.some((c) => !c)) return true
    if (g.cascades.some((c) => !c.length)) return true
    const tops = g.cascades.map((c) => c[c.length - 1]).filter(Boolean) as Card[]
    const movers = [...tops, ...(g.cells.filter(Boolean) as Card[])]
    for (const m of movers) {
      if (canFound(m, g.found[SUIT_IDX[m.suit]])) return true
      for (const c of g.cascades) if (c.length && canOnto(m, c[c.length - 1]) && c[c.length - 1] !== m) return true
    }
    return false
  }

  const tryMove = (src: Src, dst: Dst): boolean => {
    const cards = cardsOf(game, src)
    if (!cards.length) return false
    if (src.kind === "casc" && !isRun(cards)) return false
    const g = clone(game)
    if (dst.kind === "cell") {
      if (cards.length !== 1 || g.cells[dst.i]) return false
      g.cells[dst.i] = cards[0]
    } else if (dst.kind === "found") {
      if (cards.length !== 1) return false
      const f = g.found[SUIT_IDX[cards[0].suit]]
      if (!canFound(cards[0], f)) return false
      f.push(cards[0])
    } else {
      if (src.kind === "casc" && src.i === dst.i) return false
      const target = g.cascades[dst.i]
      const limit = maxMovable(target.length === 0)
      if (cards.length > limit) {
        if (opts.tips) wm.msgBox({ parentId: win.id, title: "FreeCell", text: `You can only move ${limit} card(s) at a time with the current number of free cells.`, icon: "info" })
        return false
      }
      if (!canOnto(cards[0], target[target.length - 1])) return false
      target.push(...cards)
    }
    if (src.kind === "cell") g.cells[src.i] = null
    else g.cascades[src.i].splice(src.idx)
    finish(g)
    return true
  }

  const autoMove = (src: Src) => {
    const cards = cardsOf(game, src)
    if (cards.length !== 1) return
    if (tryMove(src, { kind: "found", i: SUIT_IDX[cards[0].suit] })) return
    const free = game.cells.findIndex((c) => !c)
    if (src.kind === "casc" && free >= 0) tryMove(src, { kind: "cell", i: free })
  }

  const clickCard = (src: Src) => {
    if (status !== "playing") return
    if (sel) {
      const dst: Dst = src.kind === "cell" ? { kind: "cell", i: src.i } : { kind: "casc", i: src.i }
      if (tryMove(sel, dst)) return
      if (JSON.stringify(sel) === JSON.stringify(src)) {
        setSel(null)
        return
      }
    }
    const cards = cardsOf(game, src)
    if (!cards.length || (src.kind === "casc" && !isRun(cards))) {
      setSel(null)
      return
    }
    setSel(src)
  }

  const clickEmpty = (dst: Dst) => {
    if (sel) {
      tryMove(sel, dst)
      setSel(null)
    }
  }

  const isSel = (s: Src) => sel && sel.kind === s.kind && sel.i === s.i && (s.kind === "cell" || s.idx >= (sel as { idx: number }).idx)

  const doUndo = () => {
    const prev = undo[undo.length - 1]
    if (!prev) return
    setGame(prev)
    setUndo(undo.slice(0, -1))
    setSel(null)
  }

  const selectGame = async () => {
    const r = await wm.prompt({ parentId: win.id, title: "Game Number", label: "Select a game number from 1 to 32000:", value: String(gameNo) })
    if (r === null) return
    const n = parseInt(r)
    if (n === -1 || n === -2) {
      start(n === -1 ? 11982 : 11982)
      return
    }
    if (isNaN(n) || n < 1 || n > 32000) {
      wm.msgBox({ parentId: win.id, title: "FreeCell", text: "Please enter a number between 1 and 32000.", icon: "warning" })
      return
    }
    start(n)
  }

  const menus = [
    {
      label: "&Game",
      items: [
        { label: "&New Game", accel: "F2", onClick: () => start(Math.floor(Math.random() * 32000) + 1) },
        { label: "&Select Game...", accel: "F3", onClick: selectGame },
        { label: "&Restart Game", accel: "F4", onClick: () => start(gameNo) },
        { sep: true },
        { label: "&Undo", accel: "F10", disabled: !undo.length, onClick: doUndo },
        { sep: true },
        { label: "S&tatistics...", onClick: () => wm.msgBox({ parentId: win.id, title: "FreeCell Statistics", text: `This session:\n  Wins: ${stats.won}  Losses: ${stats.lost}\n\nTotal:\n  Wins: ${stats.won}  Losses: ${stats.lost}\n  Win percentage: ${stats.won + stats.lost ? Math.round((stats.won / (stats.won + stats.lost)) * 100) : 0}%\n\nStreaks:\n  Current: ${stats.streak} ${stats.streakKind === "none" ? "" : stats.streakKind}`, icon: "none", buttons: ["OK", "Clear"] }).then((r) => {
            if (r === "Clear") saveStats({ won: 0, lost: 0, streak: 0, streakKind: "none" })
          }) },
        { label: "&Options...", onClick: () => launch("fcopts", { ...opts, apply: setOpts }, { parentId: win.id, modal: true }) },
        { sep: true },
        { label: "E&xit", onClick: () => wm.close(win.id) },
      ],
    },
    {
      label: "&Help",
      items: [
        { label: "&Contents", onClick: () => launch("help", { topic: "freecell" }) },
        { label: "&How to Play", onClick: () => wm.msgBox({ parentId: win.id, title: "FreeCell", text: "Move all the cards to the home cells, by suit, from ace to king.\n\nClick a card and then click where you want it to go. The four free cells at the top left hold one card each. Build down in alternating colors on the columns. Any card can be placed on an empty column.\n\nGames #11982 is widely believed to be unsolvable.", icon: "info" }) },
        { sep: true },
        { label: "&About FreeCell...", onClick: () => wm.msgBox({ parentId: win.id, title: "About FreeCell", text: "Microsoft FreeCell\nWindows 95\n\nby Jim Horne\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) },
      ],
    },
  ]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (wm.getSnapshot().activeId !== win.id) return
      if (e.key === "F2") start(Math.floor(Math.random() * 32000) + 1)
      if (e.key === "F3") selectGame()
      if (e.key === "F4") start(gameNo)
      if (e.key === "F10") {
        e.preventDefault()
        doUndo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const cardsLeft = useMemo(() => 52 - game.found.reduce((a, f) => a + f.length, 0), [game])

  const nodes: React.ReactNode[] = []
  let z = 1
  game.cells.forEach((c, i) => {
    if (!c) nodes.push(<Slot key={`cell${i}`} x={topX(i)} y={TOP} onPointerDown={() => clickEmpty({ kind: "cell", i })} />)
    else nodes.push(<CardView key={c.id} card={c} x={topX(i)} y={TOP} z={z++} selected={!!isSel({ kind: "cell", i })} onPointerDown={(e) => { e.stopPropagation(); clickCard({ kind: "cell", i }) }} onDoubleClick={() => opts.dblclick && autoMove({ kind: "cell", i })} />)
  })
  game.found.forEach((f, i) => {
    const x = topX(4 + i)
    if (!f.length) nodes.push(<Slot key={`f${i}`} x={x} y={TOP} label="A" onPointerDown={() => clickEmpty({ kind: "found", i })} />)
    else nodes.push(<CardView key={f[f.length - 1].id} card={f[f.length - 1]} x={x} y={TOP} z={z++} onPointerDown={(e) => { e.stopPropagation(); clickEmpty({ kind: "found", i }) }} />)
  })
  game.cascades.forEach((c, i) => {
    if (!c.length) nodes.push(<Slot key={`c${i}`} x={cascX(i)} y={CASC_Y} onPointerDown={() => clickEmpty({ kind: "casc", i })} />)
    c.forEach((card, idx) => {
      const src: Src = { kind: "casc", i, idx }
      nodes.push(
        <CardView
          key={card.id}
          card={card}
          x={cascX(i)}
          y={CASC_Y + idx * off}
          z={z++}
          selected={!!isSel(src)}
          onPointerDown={(e) => {
            e.stopPropagation()
            clickCard(src)
          }}
          onDoubleClick={idx === c.length - 1 && opts.dblclick ? () => autoMove(src) : undefined}
        />,
      )
    })
  })

  return (
    <>
      <MenuBar menus={menus} />
      <div
        ref={areaRef}
        style={{ flex: 1, background: "#008000", position: "relative", overflow: "hidden" }}
        onPointerDown={() => setSel(null)}
        onPointerMove={(e) => {
          const r = areaRef.current?.getBoundingClientRect()
          if (r) setKingLook(e.clientX - r.left < width / 2 ? "left" : "right")
        }}
      >
        {/* king */}
        <div style={{ position: "absolute", left: kingX - 17, top: TOP + 26, width: 34, height: 44, background: "#c0c0c0", boxShadow: "var(--raised)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, transform: kingLook === "left" ? "scaleX(1)" : "scaleX(-1)" }}>
          {status === "won" ? "😃" : status === "lost" ? "😞" : "🤴"}
        </div>
        {nodes}
      </div>
      <StatusBar cells={[`Cards Left: ${cardsLeft}`, `Moves: ${moves}`]} />
    </>
  )
}

function FcOptions({ win }: AppProps) {
  const p = win.props as { quick: boolean; tips: boolean; dblclick: boolean; apply: (o: { quick: boolean; tips: boolean; dblclick: boolean }) => void }
  const [o, setO] = useState({ quick: p.quick, tips: p.tips, dblclick: p.dblclick })
  return (
    <div className="dlg">
      <Checkbox label="&Quick play messages" checked={o.quick} onChange={(v) => setO({ ...o, quick: v })} />
      <Checkbox label="&Show move limit messages" checked={o.tips} onChange={(v) => setO({ ...o, tips: v })} />
      <Checkbox label="&Double-click moves cards" checked={o.dblclick} onChange={(v) => setO({ ...o, dblclick: v })} />
      <div className="dlg-buttons">
        <Button isDefault onClick={() => { p.apply(o); wm.close(win.id) }}>OK</Button>
        <Button onClick={() => wm.close(win.id)}>Cancel</Button>
      </div>
    </div>
  )
}

registerApp({ id: "fcopts", name: "FreeCell Options", icon: "game_freecell", component: FcOptions, width: 280, height: 150, resizable: false, minimizable: false, maximizable: false, noTaskbar: true })

registerApp({
  id: "freecell",
  name: "FreeCell",
  icon: "game_freecell",
  component: FreeCell,
  width: 640,
  height: 460,
  minW: 632,
  minH: 360,
  singleton: true,
  exe: "FREECELL.EXE",
  startMenu: ["Programs", "Accessories", "Games"],
})
