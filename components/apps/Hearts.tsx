"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm, launch } from "@/lib/win95/store"
import { sounds } from "@/lib/win95/sounds"
import { profile } from "@/lib/win95/portfolio"
import { MenuBar } from "@/components/win95/Menu"
import { Button, StatusBar, TextInput } from "@/components/win95/controls"
import { CARD_H, CARD_W, CardView, makeDeck, shuffle, type Card } from "./cards"

/* ------------------------------------------------------------------ */
/*  Hearts — you vs. three computer players                            */
/* ------------------------------------------------------------------ */

const NAMES = [profile.firstName, "Pauline", "Michele", "Ben"]
type Phase = "pass" | "play" | "handover" | "gameover" | "idle"

interface State {
  hands: Card[][]
  passSel: Card[]
  trick: { player: number; card: Card }[]
  leader: number
  turn: number
  heartsBroken: boolean
  taken: Card[][]
  scores: number[]
  handNo: number
  phase: Phase
  firstTrick: boolean
}

const points = (c: Card) => (c.suit === "H" ? 1 : c.suit === "S" && c.rank === 12 ? 13 : 0)
const sortHand = (h: Card[]) => h.slice().sort((a, b) => (a.suit === b.suit ? a.rank - b.rank : ["C", "D", "S", "H"].indexOf(a.suit) - ["C", "D", "S", "H"].indexOf(b.suit)))

function dealHands(): Card[][] {
  const d = shuffle(makeDeck())
  return [0, 1, 2, 3].map((i) => sortHand(d.slice(i * 13, i * 13 + 13)))
}

function initial(scores = [0, 0, 0, 0], handNo = 0): State {
  const hands = dealHands()
  const dir = handNo % 4
  return {
    hands,
    passSel: [],
    trick: [],
    leader: 0,
    turn: 0,
    heartsBroken: false,
    taken: [[], [], [], []],
    scores,
    handNo,
    phase: dir === 3 ? "play" : "pass",
    firstTrick: true,
  }
}

function startPlay(s: State): State {
  const leader = s.hands.findIndex((h) => h.some((c) => c.suit === "C" && c.rank === 2))
  return { ...s, phase: "play", leader, turn: leader, trick: [], firstTrick: true, heartsBroken: false }
}

function legalPlays(s: State, player: number): Card[] {
  const hand = s.hands[player]
  if (s.trick.length === 0) {
    if (s.firstTrick) return hand.filter((c) => c.suit === "C" && c.rank === 2)
    if (!s.heartsBroken) {
      const nonHearts = hand.filter((c) => c.suit !== "H")
      if (nonHearts.length) return nonHearts
    }
    return hand
  }
  const lead = s.trick[0].card.suit
  const follow = hand.filter((c) => c.suit === lead)
  if (follow.length) return follow
  if (s.firstTrick) {
    const safe = hand.filter((c) => points(c) === 0)
    if (safe.length) return safe
  }
  return hand
}

/** Simple but competent AI. */
function aiPlay(s: State, player: number): Card {
  const legal = legalPlays(s, player)
  const hand = s.hands[player]
  const high = (cs: Card[]) => cs.reduce((a, b) => (b.rank > a.rank ? b : a))
  const low = (cs: Card[]) => cs.reduce((a, b) => (b.rank < a.rank ? b : a))
  if (s.trick.length === 0) {
    // lead: lowest card of a long suit, avoid spades if holding Q
    const noQ = legal.filter((c) => !(c.suit === "S" && c.rank >= 12))
    const pool = noQ.length ? noQ : legal
    return low(pool)
  }
  const lead = s.trick[0].card.suit
  const following = legal.filter((c) => c.suit === lead)
  const trickHigh = s.trick.filter((t) => t.card.suit === lead).reduce((a, b) => (b.card.rank > a.card.rank ? b : a)).card
  const trickPts = s.trick.reduce((a, t) => a + points(t.card), 0)
  const isLast = s.trick.length === 3
  if (following.length) {
    const under = following.filter((c) => c.rank < trickHigh.rank)
    if (isLast && trickPts === 0) {
      // safe to win: play highest but dump QS? no — avoid taking QS
      const winners = following.filter((c) => !(c.suit === "S" && c.rank === 12))
      return winners.length ? high(winners) : low(following)
    }
    if (under.length) return high(under)
    // must win: play lowest winner (but not QS if possible)
    const nonQ = following.filter((c) => !(c.suit === "S" && c.rank === 12))
    return nonQ.length ? low(nonQ) : following[0]
  }
  // can't follow: dump QS, then high hearts, then highest card
  const qs = legal.find((c) => c.suit === "S" && c.rank === 12)
  if (qs) return qs
  const hearts = legal.filter((c) => c.suit === "H")
  if (hearts.length) return high(hearts)
  void hand
  return high(legal)
}

function aiPass(hand: Card[]): Card[] {
  const score = (c: Card) => (c.suit === "S" && c.rank >= 12 ? 100 + c.rank : c.suit === "H" ? 50 + c.rank : c.rank)
  return hand.slice().sort((a, b) => score(b) - score(a)).slice(0, 3)
}

export function Hearts({ win }: AppProps) {
  const [s, setS] = useState<State>(() => ({ ...initial(), phase: "idle" }))
  const [message, setMessage] = useState("Click Game > New to start (F2).")
  const [handResult, setHandResult] = useState<number[] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 640, h: 440 })

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const newGame = useCallback(() => {
    const st = initial()
    setHandResult(null)
    setS(st.phase === "play" ? startPlay(st) : st)
    setMessage(st.phase === "pass" ? `Select 3 cards to pass ${["left", "right", "across"][st.handNo % 4]}.` : "Play.")
  }, [])

  // AI turns
  useEffect(() => {
    if (s.phase !== "play") return
    if (s.trick.length === 4) {
      timer.current = setTimeout(() => finishTrick(), 900)
      return () => {
        if (timer.current) clearTimeout(timer.current)
      }
    }
    if (s.turn !== 0) {
      timer.current = setTimeout(() => {
        const card = aiPlay(s, s.turn)
        playCard(s.turn, card)
      }, 500)
      return () => {
        if (timer.current) clearTimeout(timer.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s])

  const playCard = (player: number, card: Card) => {
    setS((prev) => {
      if (prev.phase !== "play" || prev.turn !== player) return prev
      const hands = prev.hands.map((h, i) => (i === player ? h.filter((c) => c.id !== card.id) : h))
      const trick = [...prev.trick, { player, card }]
      return { ...prev, hands, trick, turn: (player + 1) % 4, heartsBroken: prev.heartsBroken || card.suit === "H" }
    })
  }

  const finishTrick = () => {
    setS((prev) => {
      if (prev.trick.length !== 4) return prev
      const lead = prev.trick[0].card.suit
      const winner = prev.trick.filter((t) => t.card.suit === lead).reduce((a, b) => (b.card.rank > a.card.rank ? b : a)).player
      const taken = prev.taken.map((t, i) => (i === winner ? [...t, ...prev.trick.map((x) => x.card)] : t))
      const next: State = { ...prev, taken, trick: [], leader: winner, turn: winner, firstTrick: false }
      if (next.hands.every((h) => h.length === 0)) {
        // score hand
        const pts = taken.map((t) => t.reduce((a, c) => a + points(c), 0))
        const shooter = pts.findIndex((p) => p === 26)
        const handPts = shooter >= 0 ? pts.map((_, i) => (i === shooter ? 0 : 26)) : pts
        const scores = prev.scores.map((sc, i) => sc + handPts[i])
        setHandResult(handPts)
        if (shooter >= 0) sounds.tada()
        const over = scores.some((x) => x >= 100)
        return { ...next, scores, phase: over ? "gameover" : "handover" }
      }
      return next
    })
  }

  const nextHand = () => {
    const st = initial(s.scores, s.handNo + 1)
    setHandResult(null)
    setS(st.phase === "play" ? startPlay(st) : st)
    setMessage(st.phase === "pass" ? `Select 3 cards to pass ${["left", "right", "across"][st.handNo % 4]}.` : "Play.")
  }

  const togglePass = (c: Card) => {
    if (s.phase !== "pass") return
    setS((prev) => {
      const has = prev.passSel.some((x) => x.id === c.id)
      if (has) return { ...prev, passSel: prev.passSel.filter((x) => x.id !== c.id) }
      if (prev.passSel.length >= 3) return prev
      return { ...prev, passSel: [...prev.passSel, c] }
    })
  }

  const doPass = () => {
    if (s.passSel.length !== 3) return
    const dir = s.handNo % 4 // 0 left, 1 right, 2 across
    const offset = dir === 0 ? 1 : dir === 1 ? 3 : 2
    const passes = s.hands.map((h, i) => (i === 0 ? s.passSel : aiPass(h)))
    const hands = s.hands.map((h, i) => {
      const from = (i - offset + 4) % 4
      const remaining = h.filter((c) => !passes[i].some((p) => p.id === c.id))
      return sortHand([...remaining, ...passes[from]])
    })
    const st = startPlay({ ...s, hands, passSel: [] })
    setS(st)
    setMessage(st.turn === 0 ? "Your turn. Lead the 2 of clubs." : `${NAMES[st.turn]} leads.`)
  }

  const humanPlay = (c: Card) => {
    if (s.phase !== "play" || s.turn !== 0) return
    const legal = legalPlays(s, 0)
    if (!legal.some((l) => l.id === c.id)) {
      if (s.trick.length === 0 && c.suit === "H" && !s.heartsBroken) setMessage("Hearts have not been broken.")
      else if (s.firstTrick && s.trick.length === 0) setMessage("You must lead the 2 of clubs.")
      else if (s.firstTrick && points(c) > 0) setMessage("No points on the first trick.")
      else setMessage(`You must follow suit (${s.trick[0]?.card.suit === "H" ? "hearts" : s.trick[0]?.card.suit === "S" ? "spades" : s.trick[0]?.card.suit === "D" ? "diamonds" : "clubs"}).`)
      sounds.ding()
      return
    }
    setMessage("")
    playCard(0, c)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (wm.getSnapshot().activeId !== win.id) return
      if (e.key === "F2") newGame()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [newGame, win.id])

  const menus = [
    {
      label: "&Game",
      items: [
        { label: "&New Game", accel: "F2", onClick: newGame },
        { sep: true },
        { label: "&Score...", onClick: () => wm.msgBox({ parentId: win.id, title: "Score", text: NAMES.map((n, i) => `${n.padEnd(10)} ${s.scores[i]}`).join("\n"), icon: "none" }) },
        { label: "&Options...", onClick: () => launch("heartsopts", {}, { parentId: win.id, modal: true }) },
        { sep: true },
        { label: "E&xit", onClick: () => wm.close(win.id) },
      ],
    },
    {
      label: "&Help",
      items: [
        { label: "&Contents", onClick: () => launch("help", { topic: "hearts" }) },
        { label: "&How to Play", onClick: () => wm.msgBox({ parentId: win.id, title: "Hearts", text: "The object is to have the lowest score at the end of the game.\n\nEach heart is worth one point and the queen of spades is worth 13. The player with the 2 of clubs leads. You must follow suit if you can. Hearts cannot be led until a heart has been played. Take all 26 points in a hand to \"shoot the moon\" and give everyone else 26 instead.\n\nThe game ends when a player reaches 100 points.", icon: "info" }) },
        { sep: true },
        { label: "&About Hearts...", onClick: () => wm.msgBox({ parentId: win.id, title: "About Hearts", text: "The Microsoft Hearts Network\nWindows 95\n\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) },
      ],
    },
  ]

  /* ---------- layout ---------- */
  const W = size.w
  const H = size.h
  const cx = W / 2
  const cy = H / 2 - 20
  const hand = s.hands[0]
  const handW = Math.min(W - 40, (hand.length - 1) * 24 + CARD_W)
  const step = hand.length > 1 ? (handW - CARD_W) / (hand.length - 1) : 0
  const handX = cx - handW / 2
  const handY = H - CARD_H - 8
  const legal = s.phase === "play" && s.turn === 0 ? legalPlays(s, 0) : []

  const trickPos = (player: number) => {
    const d = 60
    if (player === 0) return { x: cx - CARD_W / 2, y: cy - CARD_H / 2 + d }
    if (player === 1) return { x: cx - CARD_W / 2 - d - 10, y: cy - CARD_H / 2 }
    if (player === 2) return { x: cx - CARD_W / 2, y: cy - CARD_H / 2 - d }
    return { x: cx - CARD_W / 2 + d + 10, y: cy - CARD_H / 2 }
  }

  const opp = (player: number) => {
    const n = s.hands[player].length
    const nodes: React.ReactNode[] = []
    for (let i = 0; i < n; i++) {
      let x = 0
      let y = 0
      if (player === 2) {
        x = cx - ((n - 1) * 14 + CARD_W) / 2 + i * 14
        y = 8
      } else if (player === 1) {
        x = 8
        y = cy - ((n - 1) * 10 + CARD_H) / 2 + i * 10 - 20
      } else {
        x = W - CARD_W - 8
        y = cy - ((n - 1) * 10 + CARD_H) / 2 + i * 10 - 20
      }
      nodes.push(<div key={`${player}-${i}`} className="card back" style={{ left: x, top: y, zIndex: i, transform: player === 2 ? "none" : "none" }} />)
    }
    return nodes
  }

  const nameTag = (player: number) => {
    const pos = player === 2 ? { left: cx - 45, top: CARD_H + 14 } : player === 1 ? { left: 8, top: cy + 104 } : player === 3 ? { left: W - 98, top: cy + 104 } : { left: 8, top: H - 24 }
    return (
      <div key={`n${player}`} style={{ position: "absolute", ...pos, color: "#fff", fontWeight: s.turn === player && s.phase === "play" ? 700 : 400, background: "rgba(0,0,0,0.25)", padding: "1px 6px", width: 90, textAlign: "center" }}>
        {NAMES[player]} {s.phase !== "idle" ? `(${s.scores[player]})` : ""}
      </div>
    )
  }

  return (
    <>
      <MenuBar menus={menus} />
      <div ref={areaRef} style={{ flex: 1, background: "#008000", position: "relative", overflow: "hidden" }}>
        {s.phase !== "idle" && (
          <>
            {opp(1)}
            {opp(2)}
            {opp(3)}
            {[0, 1, 2, 3].map(nameTag)}
            {s.trick.map((t, i) => {
              const p = trickPos(t.player)
              return <CardView key={t.card.id} card={t.card} x={p.x} y={p.y} z={100 + i} />
            })}
            {hand.map((c, i) => {
              const selected = s.passSel.some((x) => x.id === c.id)
              const dim = s.phase === "play" && s.turn === 0 && !legal.some((l) => l.id === c.id)
              return (
                <CardView
                  key={c.id}
                  card={c}
                  x={handX + i * step}
                  y={handY - (selected ? 16 : 0)}
                  z={200 + i}
                  style={{ opacity: dim ? 0.8 : 1 }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    if (s.phase === "pass") togglePass(c)
                    else humanPlay(c)
                  }}
                />
              )
            })}
            {s.phase === "pass" && (
              <div style={{ position: "absolute", left: cx - 50, top: cy - 12 }}>
                <Button isDefault disabled={s.passSel.length !== 3} onClick={doPass} style={{ width: 100 }}>
                  Pass {["Left", "Right", "Across"][s.handNo % 4]}
                </Button>
              </div>
            )}
          </>
        )}
        {s.phase === "idle" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "var(--face)", boxShadow: "var(--raised)", padding: 16, display: "flex", flexDirection: "column", gap: 10, width: 300 }}>
              <div style={{ fontWeight: 700 }}>The Microsoft Hearts Network</div>
              <div>Welcome to the Microsoft Hearts Network. What is your name?</div>
              <TextInput defaultValue={profile.firstName} readOnly />
              <div className="col gap4">
                <label className="radio"><input type="radio" defaultChecked /> <span>I want to be &dealer</span></label>
                <label className="radio"><input type="radio" disabled /> <span>I want to &connect to another game</span></label>
              </div>
              <div className="dlg-buttons">
                <Button isDefault onClick={newGame}>OK</Button>
                <Button onClick={() => wm.close(win.id)}>Quit</Button>
              </div>
            </div>
          </div>
        )}
        {(s.phase === "handover" || s.phase === "gameover") && handResult && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "var(--face)", boxShadow: "var(--raised)", padding: 16, display: "flex", flexDirection: "column", gap: 10, minWidth: 260 }}>
              <div style={{ fontWeight: 700 }}>{s.phase === "gameover" ? "Game Over" : "Hand Over"}</div>
              <table style={{ borderSpacing: "0 2px" }}>
                <thead>
                  <tr><th style={{ textAlign: "left" }}>Player</th><th>This hand</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {NAMES.map((n, i) => (
                    <tr key={n} style={{ fontWeight: s.phase === "gameover" && s.scores[i] === Math.min(...s.scores) ? 700 : 400 }}>
                      <td>{n}</td>
                      <td className="center">{handResult[i]}</td>
                      <td className="center">{s.scores[i]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {s.phase === "gameover" && <div>{NAMES[s.scores.indexOf(Math.min(...s.scores))]} wins!</div>}
              <div className="dlg-buttons">
                {s.phase === "gameover" ? <Button isDefault onClick={newGame}>New Game</Button> : <Button isDefault onClick={nextHand}>OK</Button>}
              </div>
            </div>
          </div>
        )}
      </div>
      <StatusBar cells={[message || (s.phase === "play" ? (s.turn === 0 ? "Your turn." : `${NAMES[s.turn]}'s turn.`) : ""), s.phase === "play" ? (s.heartsBroken ? "Hearts broken" : "Hearts not broken") : ""]} />
    </>
  )
}

registerApp({
  id: "heartsopts",
  name: "Hearts Options",
  icon: "cardfile",
  component: ({ win }: AppProps) => (
    <div className="dlg">
      <div className="groupbox col gap4" style={{ paddingTop: 16 }}>
        <span className="legend">Animation speed</span>
        <label className="radio"><input type="radio" /> <span>&Slow</span></label>
        <label className="radio"><input type="radio" defaultChecked /> <span>&Normal</span></label>
        <label className="radio"><input type="radio" /> <span>&Fast</span></label>
      </div>
      <label className="check"><input type="checkbox" defaultChecked /> <span>&Sound</span></label>
      <div className="dlg-buttons">
        <Button isDefault onClick={() => wm.close(win.id)}>OK</Button>
        <Button onClick={() => wm.close(win.id)}>Cancel</Button>
      </div>
    </div>
  ),
  width: 240,
  height: 180,
  resizable: false,
  minimizable: false,
  maximizable: false,
  noTaskbar: true,
})

registerApp({
  id: "hearts",
  name: "Hearts",
  icon: "cardfile",
  component: Hearts,
  width: 660,
  height: 500,
  minW: 520,
  minH: 420,
  singleton: true,
  exe: "MSHEARTS.EXE",
  startMenu: ["Programs", "Accessories", "Games"],
})
