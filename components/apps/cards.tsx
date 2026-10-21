"use client"

import React from "react"

/* ------------------------------------------------------------------ */
/*  Shared playing-card model + renderer for Solitaire/FreeCell/Hearts  */
/* ------------------------------------------------------------------ */

export type Suit = "S" | "H" | "D" | "C"
export interface Card {
  id: number // 0..51
  suit: Suit
  rank: number // 1 (A) .. 13 (K)
}

export const SUITS: Suit[] = ["C", "D", "H", "S"]
export const SUIT_GLYPH: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" }
export const RANK_LABEL = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]

export function isRed(c: Card) {
  return c.suit === "H" || c.suit === "D"
}

export function makeDeck(): Card[] {
  const deck: Card[] = []
  for (let i = 0; i < 52; i++) deck.push({ id: i, suit: SUITS[i % 4], rank: Math.floor(i / 4) + 1 })
  return deck
}

/** Standard shuffle (Fisher-Yates). */
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Microsoft FreeCell deal (the classic LCG so game numbers match the real thing).
 * Returns 8 cascades.
 */
export function freecellDeal(seed: number): Card[][] {
  let state = seed >>> 0
  const rnd = () => {
    state = (state * 214013 + 2531011) >>> 0
    return (state >>> 16) & 0x7fff
  }
  const deck = makeDeck()
  const cascades: Card[][] = [[], [], [], [], [], [], [], []]
  let n = 52
  for (let i = 0; i < 52; i++) {
    const j = rnd() % n
    ;[deck[j], deck[n - 1]] = [deck[n - 1], deck[j]]
    cascades[i % 8].push(deck[n - 1])
    n--
  }
  return cascades
}

export const CARD_W = 71
export const CARD_H = 96

export function CardView({
  card,
  faceDown,
  x,
  y,
  z,
  selected,
  onPointerDown,
  onDoubleClick,
  style,
  back = 0,
}: {
  card: Card
  faceDown?: boolean
  x: number
  y: number
  z?: number
  selected?: boolean
  onPointerDown?: (e: React.PointerEvent) => void
  onDoubleClick?: (e: React.MouseEvent) => void
  style?: React.CSSProperties
  back?: number
}) {
  const red = isRed(card)
  const backs = ["#0000a8", "#006000", "#800000", "#4a2a00", "#303060", "#5a005a"]
  if (faceDown) {
    return (
      <div
        className="card back"
        style={{ left: x, top: y, zIndex: z, backgroundColor: backs[back % backs.length], ...style }}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        data-card={card.id}
      />
    )
  }
  const label = RANK_LABEL[card.rank]
  const glyph = SUIT_GLYPH[card.suit]
  return (
    <div
      className={`card ${red ? "red" : "black"} ${selected ? "sel" : ""}`}
      style={{ left: x, top: y, zIndex: z, ...style }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      data-card={card.id}
    >
      <div className="cr tl">
        {label}
        <br />
        {glyph}
      </div>
      <div className="cs">{card.rank > 10 ? (card.rank === 11 ? "J" : card.rank === 12 ? "Q" : "K") : glyph}</div>
      <div className="cr br">
        {label}
        <br />
        {glyph}
      </div>
    </div>
  )
}

export function Slot({ x, y, label, onPointerDown }: { x: number; y: number; label?: string; onPointerDown?: (e: React.PointerEvent) => void }) {
  return (
    <div className="card-slot" style={{ left: x, top: y, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,0.35)", fontSize: 28 }} onPointerDown={onPointerDown}>
      {label}
    </div>
  )
}
