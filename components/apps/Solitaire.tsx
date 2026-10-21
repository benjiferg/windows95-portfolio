"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm, launch } from "@/lib/win95/store"
import { sounds } from "@/lib/win95/sounds"
import { MenuBar } from "@/components/win95/Menu"
import { Button, Checkbox, Radio, StatusBar } from "@/components/win95/controls"
import { CARD_H, CARD_W, CardView, Slot, isRed, makeDeck, shuffle, type Card } from "./cards"

/* ------------------------------------------------------------------ */
/*  Solitaire (Klondike)                                                */
/* ------------------------------------------------------------------ */

interface TCard {
  card: Card
  up: boolean
}
interface Game {
  stock: Card[]
  waste: Card[]
  found: Card[][]
  tab: TCard[][]
  passes: number
}

type Scoring = "standard" | "vegas" | "none"

const GAP = 10
const TOP = 8
const TAB_Y = TOP + CARD_H + 18

function deal(): Game {
  const deck = shuffle(makeDeck())
  const tab: TCard[][] = []
  let i = 0
  for (let p = 0; p < 7; p++) {
    const pile: TCard[] = []
    for (let k = 0; k <= p; k++) pile.push({ card: deck[i++], up: k === p })
    tab.push(pile)
  }
  return { stock: deck.slice(i), waste: [], found: [[], [], [], []], tab, passes: 0 }
}

function clone(g: Game): Game {
  return { stock: g.stock.slice(), waste: g.waste.slice(), found: g.found.map((f) => f.slice()), tab: g.tab.map((t) => t.map((c) => ({ ...c }))), passes: g.passes }
}

type Src = { kind: "waste" } | { kind: "found"; i: number } | { kind: "tab"; i: number; idx: number }

export function Solitaire({ win }: AppProps) {
  const [game, setGame] = useState<Game>(deal)
  const [undo, setUndo] = useState<{ game: Game; score: number } | null>(null)
  const [drawThree, setDrawThree] = useState(false)
  const [scoring, setScoring] = useState<Scoring>("standard")
  const [timed, setTimed] = useState(true)
  const [showStatus, setShowStatus] = useState(true)
  const [keepScore, setKeepScore] = useState(false)
  const [back, setBack] = useState(0)
  const [score, setScore] = useState(0)
  const [time, setTime] = useState(0)
  const [started, setStarted] = useState(false)
  const [won, setWon] = useState(false)
  const [sel, setSel] = useState<Src | null>(null)
  const [drag, setDrag] = useState<{ src: Src; cards: Card[]; x: number; y: number; dx: number; dy: number } | null>(null)
  const [bounce, setBounce] = useState<{ card: Card; x: number; y: number; vx: number; vy: number }[]>([])
  const areaRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(585)

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pileW = Math.max(CARD_W + 4, Math.floor((width - GAP * 2) / 7))
  const px = (i: number) => GAP + i * pileW
  const upOff = Math.max(10, Math.min(18, Math.floor((win.h - TAB_Y - 140) / 12)))

  useEffect(() => {
    if (!started || won || !timed) return
    const t = setInterval(() => {
      setTime((x) => x + 1)
    }, 1000)
    return () => clearInterval(t)
  }, [started, won, timed])

  useEffect(() => {
    if (!timed || scoring !== "standard" || !started || won) return
    if (time > 0 && time % 10 === 0) setScore((s) => Math.max(0, s - 2))
  }, [time, timed, scoring, started, won])

  const newGame = useCallback(
    (keep = false) => {
      setGame(deal())
      setUndo(null)
      setSel(null)
      setDrag(null)
      setBounce([])
      setWon(false)
      setStarted(false)
      setTime(0)
      if (scoring === "vegas") setScore((s) => (keep && keepScore ? s - 52 : -52))
      else setScore(0)
    },
    [scoring, keepScore],
  )

  const addScore = (n: number) => {
    if (scoring === "none") return
    if (scoring === "vegas") {
      if (n > 0) setScore((s) => s + 5)
      else if (n === -15) setScore((s) => s - 5)
      return
    }
    setScore((s) => Math.max(0, s + n))
  }

  const commit = (g: Game) => {
    setUndo({ game: clone(game), score })
    setGame(g)
    setStarted(true)
    if (g.found.every((f) => f.length === 13)) {
      setWon(true)
      if (scoring === "standard" && timed && time > 30) setScore((s) => s + Math.floor((700000 / time) * 1))
      sounds.tada()
      startBounce(g)
    }
  }

  const startBounce = (g: Game) => {
    // classic cascade: cards fly off the foundations
    const cards = g.found.flatMap((f, i) => f.map((c, k) => ({ card: c, x: px(3 + i), y: TOP, vx: (Math.random() - 0.5) * 8 + (i < 2 ? -2 : 2), vy: -Math.random() * 6, k })))
    cards.sort((a, b) => b.k - a.k)
    let frame = 0
    const active: typeof bounce = []
    let idx = 0
    const h = (areaRef.current?.clientHeight ?? 400) - CARD_H
    const tick = () => {
      frame++
      if (frame % 12 === 0 && idx < cards.length) active.push(cards[idx++])
      for (const c of active) {
        c.vy += 0.6
        c.x += c.vx
        c.y += c.vy
        if (c.y > h) {
          c.y = h
          c.vy = -c.vy * 0.8
        }
      }
      setBounce(active.filter((c) => c.x > -CARD_W && c.x < width + CARD_W).map((c) => ({ ...c })))
      if (idx < cards.length || active.some((c) => c.x > -CARD_W && c.x < width + CARD_W)) raf = requestAnimationFrame(tick)
    }
    let raf = requestAnimationFrame(tick)
    bounceRaf.current = raf
  }
  const bounceRaf = useRef(0)
  useEffect(() => () => cancelAnimationFrame(bounceRaf.current), [])

  /* ---------- moves ---------- */
  const drawFromStock = () => {
    const g = clone(game)
    if (g.stock.length === 0) {
      if (g.waste.length === 0) return
      g.stock = g.waste.reverse()
      g.waste = []
      g.passes++
      if (scoring === "standard") {
        if (!drawThree) addScore(-100)
        else if (g.passes >= 4) addScore(-20)
      }
      if (scoring === "vegas" && g.passes >= (drawThree ? 3 : 1)) {
        return
      }
      commit(g)
      return
    }
    const n = drawThree ? Math.min(3, g.stock.length) : 1
    for (let i = 0; i < n; i++) g.waste.push(g.stock.pop()!)
    commit(g)
  }

  const canStackTab = (moving: Card, onto: TCard | undefined) => {
    if (!onto) return moving.rank === 13
    if (!onto.up) return false
    return onto.card.rank === moving.rank + 1 && isRed(onto.card) !== isRed(moving)
  }
  const canFound = (c: Card, f: Card[]) => (f.length === 0 ? c.rank === 1 : f[f.length - 1].suit === c.suit && f[f.length - 1].rank === c.rank - 1)

  const cardsOf = (g: Game, s: Src): Card[] => {
    if (s.kind === "waste") return g.waste.length ? [g.waste[g.waste.length - 1]] : []
    if (s.kind === "found") return g.found[s.i].length ? [g.found[s.i][g.found[s.i].length - 1]] : []
    return g.tab[s.i].slice(s.idx).map((t) => t.card)
  }

  const removeFrom = (g: Game, s: Src) => {
    if (s.kind === "waste") g.waste.pop()
    else if (s.kind === "found") g.found[s.i].pop()
    else {
      g.tab[s.i].splice(s.idx)
      const last = g.tab[s.i][g.tab[s.i].length - 1]
      if (last && !last.up) {
        last.up = true
        addScore(5)
      }
    }
  }

  const tryMove = (src: Src, dest: { kind: "found"; i: number } | { kind: "tab"; i: number }): boolean => {
    const cards = cardsOf(game, src)
    if (!cards.length) return false
    const g = clone(game)
    if (dest.kind === "found") {
      if (cards.length !== 1 || !canFound(cards[0], g.found[dest.i])) return false
      removeFrom(g, src)
      g.found[dest.i].push(cards[0])
      addScore(10)
      commit(g)
      return true
    }
    if (src.kind === "tab" && src.i === dest.i) return false
    const pile = g.tab[dest.i]
    if (!canStackTab(cards[0], pile[pile.length - 1])) return false
    removeFrom(g, src)
    pile.push(...cards.map((c) => ({ card: c, up: true })))
    if (src.kind === "waste") addScore(5)
    if (src.kind === "found") addScore(-15)
    commit(g)
    return true
  }

  const autoToFoundation = (src: Src) => {
    const cards = cardsOf(game, src)
    if (cards.length !== 1) return false
    for (let i = 0; i < 4; i++) if (tryMove(src, { kind: "found", i })) return true
    return false
  }

  /* ---------- pointer handling ---------- */
  const onCardDown = (e: React.PointerEvent, src: Src) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const cards = cardsOf(game, src)
    if (!cards.length) return
    if (src.kind === "tab" && !game.tab[src.i][src.idx].up) {
      // flip top card if it is the last
      if (src.idx === game.tab[src.i].length - 1) {
        const g = clone(game)
        g.tab[src.i][src.idx].up = true
        addScore(5)
        commit(g)
      }
      return
    }
    const area = areaRef.current!.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const origin = cardPos(src)
    let moved = false
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return
      moved = true
      setDrag({ src, cards, x: origin.x + dx, y: origin.y + dy, dx, dy })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      if (!moved) {
        // click: select / move to selection
        if (sel) {
          const target = src.kind === "tab" ? { kind: "tab" as const, i: src.i } : src.kind === "found" ? { kind: "found" as const, i: src.i } : null
          if (target && tryMove(sel, target)) {
            setSel(null)
            return
          }
          setSel(sel.kind === src.kind && JSON.stringify(sel) === JSON.stringify(src) ? null : src)
        } else setSel(src)
        return
      }
      setDrag(null)
      // find target by drop position
      const x = ev.clientX - area.left
      const y = ev.clientY - area.top
      const cardX = origin.x + (ev.clientX - startX)
      const cx = cardX + CARD_W / 2
      if (y < TAB_Y - 6) {
        for (let i = 0; i < 4; i++) if (cx >= px(3 + i) && cx < px(3 + i) + pileW) tryMove(src, { kind: "found", i })
      } else {
        for (let i = 0; i < 7; i++) if (cx >= px(i) && cx < px(i) + pileW) tryMove(src, { kind: "tab", i })
      }
      setSel(null)
      void x
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const cardPos = (s: Src) => {
    if (s.kind === "waste") return { x: px(1) + (drawThree ? Math.min(2, game.waste.length - 1) * 12 : 0), y: TOP }
    if (s.kind === "found") return { x: px(3 + s.i), y: TOP }
    let y = TAB_Y
    for (let k = 0; k < s.idx; k++) y += game.tab[s.i][k].up ? upOff : 3
    return { x: px(s.i), y }
  }

  const isDragging = (s: Src) => {
    if (!drag) return false
    if (drag.src.kind !== s.kind) return false
    if (s.kind === "waste") return true
    if (s.kind === "found") return (drag.src as { i: number }).i === s.i
    const d = drag.src as { i: number; idx: number }
    return d.i === s.i && s.idx >= d.idx
  }
  const isSel = (s: Src) => {
    if (!sel || sel.kind !== s.kind) return false
    if (s.kind === "waste") return true
    if (s.kind === "found") return (sel as { i: number }).i === s.i
    const d = sel as { i: number; idx: number }
    return d.i === s.i && s.idx >= d.idx
  }

  const emptyTabClick = (i: number) => {
    if (sel) {
      tryMove(sel, { kind: "tab", i })
      setSel(null)
    }
  }
  const emptyFoundClick = (i: number) => {
    if (sel) {
      tryMove(sel, { kind: "found", i })
      setSel(null)
    }
  }

  /* ---------- menus ---------- */
  const options = () => launch("solopts", { drawThree, scoring, timed, showStatus, keepScore, apply: (o: { drawThree: boolean; scoring: Scoring; timed: boolean; showStatus: boolean; keepScore: boolean }) => {
      const changed = o.drawThree !== drawThree || o.scoring !== scoring
      setDrawThree(o.drawThree)
      setScoring(o.scoring)
      setTimed(o.timed)
      setShowStatus(o.showStatus)
      setKeepScore(o.keepScore)
      if (changed) setTimeout(() => newGame(true), 0)
    } }, { parentId: win.id, modal: true })

  const menus = [
    {
      label: "&Game",
      items: [
        { label: "&Deal", accel: "F2", onClick: () => newGame(true) },
        { sep: true },
        { label: "Dec&k...", onClick: () => launch("soldeck", { back, apply: (b: number) => setBack(b) }, { parentId: win.id, modal: true }) },
        { label: "&Options...", onClick: options },
        { sep: true },
        { label: "&Undo", disabled: !undo, onClick: () => { if (undo) { setGame(undo.game); setScore(undo.score); setUndo(null); setSel(null) } } },
        { sep: true },
        { label: "E&xit", onClick: () => wm.close(win.id) },
      ],
    },
    {
      label: "&Help",
      items: [
        { label: "&Contents", onClick: () => launch("help", { topic: "solitaire" }) },
        { label: "&Search for Help on...", disabled: true },
        { label: "&How to Play", onClick: () => wm.msgBox({ parentId: win.id, title: "Solitaire", text: "The object is to use all the cards in the deck to build up the four suit stacks in ascending order, beginning with the aces.\n\nDrag cards between the seven row stacks, building down in alternating colors. Click the deck to turn over cards. Double-click a card to move it to a suit stack.", icon: "info" }) },
        { sep: true },
        { label: "&About Solitaire...", onClick: () => wm.msgBox({ parentId: win.id, title: "About Solitaire", text: "Microsoft Solitaire\nWindows 95\n\nby Wes Cherry\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) },
      ],
    },
  ]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (wm.getSnapshot().activeId !== win.id) return
      if (e.key === "F2") newGame(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [newGame, win.id])

  /* ---------- render ---------- */
  const cards: React.ReactNode[] = []
  let z = 1
  // stock
  if (game.stock.length) {
    game.stock.slice(-3).forEach((c, k, arr) => {
      cards.push(<CardView key={c.id} card={c} faceDown back={back} x={px(0) + (arr.length - 1 - k) * 0} y={TOP} z={z++} onPointerDown={(e) => { e.stopPropagation(); drawFromStock() }} />)
    })
  } else {
    cards.push(<Slot key="stock" x={px(0)} y={TOP} label={game.waste.length ? "O" : ""} onPointerDown={drawFromStock} />)
  }
  // waste
  const wasteShow = drawThree ? game.waste.slice(-3) : game.waste.slice(-1)
  wasteShow.forEach((c, k, arr) => {
    const top = k === arr.length - 1
    const src: Src = { kind: "waste" }
    cards.push(
      <CardView
        key={c.id}
        card={c}
        back={back}
        x={px(1) + k * (drawThree ? 12 : 0)}
        y={TOP}
        z={z++}
        selected={top && isSel(src)}
        style={top && isDragging(src) ? { visibility: "hidden" } : undefined}
        onPointerDown={top ? (e) => onCardDown(e, src) : (e) => e.stopPropagation()}
        onDoubleClick={top ? () => autoToFoundation(src) : undefined}
      />,
    )
  })
  // foundations
  game.found.forEach((f, i) => {
    if (!f.length) cards.push(<Slot key={`f${i}`} x={px(3 + i)} y={TOP} onPointerDown={() => emptyFoundClick(i)} />)
    else {
      const c = f[f.length - 1]
      const src: Src = { kind: "found", i }
      cards.push(<CardView key={c.id} card={c} back={back} x={px(3 + i)} y={TOP} z={z++} selected={isSel(src)} style={isDragging(src) ? { visibility: "hidden" } : undefined} onPointerDown={(e) => onCardDown(e, src)} />)
    }
  })
  // tableau
  game.tab.forEach((pile, i) => {
    if (!pile.length) cards.push(<Slot key={`t${i}`} x={px(i)} y={TAB_Y} onPointerDown={() => emptyTabClick(i)} />)
    let y = TAB_Y
    pile.forEach((tc, idx) => {
      const src: Src = { kind: "tab", i, idx }
      cards.push(
        <CardView
          key={tc.card.id}
          card={tc.card}
          faceDown={!tc.up}
          back={back}
          x={px(i)}
          y={y}
          z={z++}
          selected={isSel(src)}
          style={isDragging(src) ? { visibility: "hidden" } : undefined}
          onPointerDown={(e) => onCardDown(e, src)}
          onDoubleClick={idx === pile.length - 1 ? () => autoToFoundation(src) : undefined}
        />,
      )
      y += tc.up ? upOff : 3
    })
  })

  return (
    <>
      <MenuBar menus={menus} />
      <div
        ref={areaRef}
        style={{ flex: 1, background: "#008000", position: "relative", overflow: "hidden", userSelect: "none" }}
        onPointerDown={() => setSel(null)}
      >
        {cards}
        {drag &&
          drag.cards.map((c, k) => <CardView key={`d${c.id}`} card={c} back={back} x={drag.x} y={drag.y + k * upOff} z={1000 + k} style={{ pointerEvents: "none" }} />)}
        {bounce.map((b, k) => (
          <CardView key={`b${b.card.id}-${k}`} card={b.card} x={b.x} y={b.y} z={2000 + k} style={{ pointerEvents: "none" }} />
        ))}
        {won && !bounce.length && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "var(--face)", boxShadow: "var(--raised)", padding: 16, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
              <div>You won! Deal again?</div>
              <div className="row gap8">
                <Button isDefault onClick={() => newGame(true)}>&Yes</Button>
                <Button onClick={() => setWon(false)}>&No</Button>
              </div>
            </div>
          </div>
        )}
      </div>
      {showStatus && <StatusBar cells={[scoring === "none" ? "" : `Score: ${score}`, timed ? `Time: ${time}` : ""]} />}
    </>
  )
}

function SolOptions({ win }: AppProps) {
  const p = win.props as { drawThree: boolean; scoring: Scoring; timed: boolean; showStatus: boolean; keepScore: boolean; apply: (o: { drawThree: boolean; scoring: Scoring; timed: boolean; showStatus: boolean; keepScore: boolean }) => void }
  const [o, setO] = useState({ drawThree: p.drawThree, scoring: p.scoring, timed: p.timed, showStatus: p.showStatus, keepScore: p.keepScore })
  return (
    <div className="dlg">
      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <div className="groupbox col" style={{ gap: 6, flex: 1 }}>
          <span className="legend">Draw</span>
          <Radio name="draw" label="Draw &one" checked={!o.drawThree} onChange={() => setO({ ...o, drawThree: false })} />
          <Radio name="draw" label="Draw &three" checked={o.drawThree} onChange={() => setO({ ...o, drawThree: true })} />
        </div>
        <div className="groupbox col" style={{ gap: 6, flex: 1 }}>
          <span className="legend">Scoring</span>
          <Radio name="sc" label="&Standard" checked={o.scoring === "standard"} onChange={() => setO({ ...o, scoring: "standard" })} />
          <Radio name="sc" label="&Vegas" checked={o.scoring === "vegas"} onChange={() => setO({ ...o, scoring: "vegas" })} />
          <Radio name="sc" label="&None" checked={o.scoring === "none"} onChange={() => setO({ ...o, scoring: "none" })} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        <Checkbox label="&Timed game" checked={o.timed} onChange={(v) => setO({ ...o, timed: v })} />
        <Checkbox label="Status &bar" checked={o.showStatus} onChange={(v) => setO({ ...o, showStatus: v })} />
        <Checkbox label="&Outline dragging" checked={false} onChange={() => {}} />
        <Checkbox label="&Keep score" checked={o.keepScore} disabled={o.scoring !== "vegas"} onChange={(v) => setO({ ...o, keepScore: v })} />
      </div>
      <div className="dlg-buttons">
        <Button isDefault onClick={() => { p.apply(o); wm.close(win.id) }}>OK</Button>
        <Button onClick={() => wm.close(win.id)}>Cancel</Button>
      </div>
    </div>
  )
}

registerApp({ id: "solopts", name: "Options", icon: "game_solitaire", component: SolOptions, width: 330, height: 200, resizable: false, minimizable: false, maximizable: false, noTaskbar: true })

function SolDeck({ win }: AppProps) {
  const p = win.props as { back: number; apply: (b: number) => void }
  const [b, setB] = useState(p.back)
  const backs = ["#0000a8", "#006000", "#800000", "#4a2a00", "#303060", "#5a005a"]
  return (
    <div className="dlg">
      <div>Select Card Back</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
        {backs.map((c, i) => (
          <div key={c} onClick={() => setB(i)} onDoubleClick={() => { p.apply(i); wm.close(win.id) }} style={{ width: 36, height: 48, background: c, border: `2px solid ${b === i ? "#000" : "#fff"}`, borderRadius: 3, boxShadow: b === i ? "0 0 0 2px var(--highlight)" : "none" }} />
        ))}
      </div>
      <div className="dlg-buttons">
        <Button isDefault onClick={() => { p.apply(b); wm.close(win.id) }}>OK</Button>
        <Button onClick={() => wm.close(win.id)}>Cancel</Button>
      </div>
    </div>
  )
}

registerApp({ id: "soldeck", name: "Select Card Back", icon: "game_solitaire", component: SolDeck, width: 300, height: 150, resizable: false, minimizable: false, maximizable: false, noTaskbar: true })

registerApp({
  id: "solitaire",
  name: "Solitaire",
  icon: "game_solitaire",
  component: Solitaire,
  width: 600,
  height: 440,
  minW: 585,
  minH: 320,
  singleton: true,
  exe: "SOL.EXE",
  startMenu: ["Programs", "Accessories", "Games"],
})
