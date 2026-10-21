"use client"

import React, { useEffect, useRef } from "react"
import type { ScreenSaverId } from "@/lib/win95/settings"

/* ------------------------------------------------------------------ */
/*  Screen savers: Marquee, Mystify Your Mind, Flying Through Space,    */
/*  Flying Windows, Blank Screen. Canvas based, exits on any input.     */
/* ------------------------------------------------------------------ */

export function ScreenSaver({
  mode,
  text,
  onExit,
  preview,
}: {
  mode: ScreenSaverId
  text: string
  onExit?: () => void
  preview?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (preview || !onExit) return
    let armed = false
    const arm = setTimeout(() => (armed = true), 400)
    const exit = () => armed && onExit()
    window.addEventListener("pointermove", exit)
    window.addEventListener("pointerdown", exit)
    window.addEventListener("keydown", exit)
    return () => {
      clearTimeout(arm)
      window.removeEventListener("pointermove", exit)
      window.removeEventListener("pointerdown", exit)
      window.removeEventListener("keydown", exit)
    }
  }, [onExit, preview])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let raf = 0
    let W = 0
    let H = 0
    const resize = () => {
      const r = canvas.getBoundingClientRect()
      W = canvas.width = Math.max(1, Math.floor(r.width))
      H = canvas.height = Math.max(1, Math.floor(r.height))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const scale = preview ? 0.25 : 1

    /* ---- Marquee ---- */
    let mx = W
    const marquee = () => {
      ctx.fillStyle = "#000"
      ctx.fillRect(0, 0, W, H)
      const size = Math.round(64 * scale)
      ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`
      ctx.fillStyle = "#ffff00"
      ctx.textBaseline = "middle"
      const tw = ctx.measureText(text).width
      ctx.fillText(text, mx, H / 2)
      mx -= 3 * scale
      if (mx < -tw) mx = W
    }

    /* ---- Mystify ---- */
    type Poly = { pts: { x: number; y: number; vx: number; vy: number }[]; hue: number; trail: { x: number; y: number }[][] }
    const polys: Poly[] = [0, 1].map((k) => ({
      pts: Array.from({ length: 4 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() * 4 + 2) * (Math.random() < 0.5 ? -1 : 1) * scale,
        vy: (Math.random() * 4 + 2) * (Math.random() < 0.5 ? -1 : 1) * scale,
      })),
      hue: k * 180,
      trail: [],
    }))
    const mystify = () => {
      ctx.fillStyle = "#000"
      ctx.fillRect(0, 0, W, H)
      for (const p of polys) {
        for (const pt of p.pts) {
          pt.x += pt.vx
          pt.y += pt.vy
          if (pt.x < 0 || pt.x > W) pt.vx *= -1
          if (pt.y < 0 || pt.y > H) pt.vy *= -1
        }
        p.trail.push(p.pts.map((q) => ({ x: q.x, y: q.y })))
        if (p.trail.length > 12) p.trail.shift()
        p.hue = (p.hue + 1) % 360
        p.trail.forEach((shape, i) => {
          ctx.strokeStyle = `hsl(${(p.hue + i * 6) % 360} 100% ${30 + i * 4}%)`
          ctx.beginPath()
          shape.forEach((q, j) => (j ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)))
          ctx.closePath()
          ctx.stroke()
        })
      }
    }

    /* ---- Starfield ---- */
    const stars = Array.from({ length: preview ? 60 : 300 }, () => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random(),
    }))
    const starfield = () => {
      ctx.fillStyle = "#000"
      ctx.fillRect(0, 0, W, H)
      for (const s of stars) {
        s.z -= 0.012
        if (s.z <= 0.02) {
          s.x = Math.random() * 2 - 1
          s.y = Math.random() * 2 - 1
          s.z = 1
        }
        const px = W / 2 + (s.x / s.z) * (W / 2)
        const py = H / 2 + (s.y / s.z) * (H / 2)
        const size = Math.max(1, (1 - s.z) * 3 * scale)
        const b = Math.round(120 + (1 - s.z) * 135)
        ctx.fillStyle = `rgb(${b},${b},${b})`
        ctx.fillRect(px, py, size, size)
      }
    }

    /* ---- Flying Windows ---- */
    const flags = Array.from({ length: preview ? 10 : 40 }, () => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random(),
    }))
    const drawFlag = (x: number, y: number, s: number) => {
      const colors = ["#f33b2d", "#35b03a", "#1e5bd6", "#f6d12b"]
      const cell = s / 2
      ctx.fillStyle = "#000"
      ctx.fillRect(x - 1, y - 1, s + 2, s + 2)
      colors.forEach((c, i) => {
        ctx.fillStyle = c
        ctx.fillRect(x + (i % 2) * cell, y + Math.floor(i / 2) * cell, cell - 1, cell - 1)
      })
    }
    const flying = () => {
      ctx.fillStyle = "#000"
      ctx.fillRect(0, 0, W, H)
      for (const f of flags) {
        f.z -= 0.006
        if (f.z <= 0.03) {
          f.x = Math.random() * 2 - 1
          f.y = Math.random() * 2 - 1
          f.z = 1
        }
        const px = W / 2 + (f.x / f.z) * (W / 2)
        const py = H / 2 + (f.y / f.z) * (H / 2)
        const size = Math.max(3, (1 - f.z) * 48 * scale)
        drawFlag(px, py, size)
      }
    }

    const blank = () => {
      ctx.fillStyle = "#000"
      ctx.fillRect(0, 0, W, H)
    }

    const fns: Record<ScreenSaverId, () => void> = { marquee, mystify, starfield, flyingwindows: flying, blank, none: blank }
    const tick = () => {
      fns[mode]()
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [mode, text, preview])

  return <canvas ref={ref} className={preview ? "" : "screensaver"} style={preview ? { width: "100%", height: "100%", display: "block" } : undefined} />
}
