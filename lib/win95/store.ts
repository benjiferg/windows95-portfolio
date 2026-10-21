"use client"

import { useSyncExternalStore } from "react"
import { getApp, type WinState } from "./registry"
import type { IconName } from "./icons"

/* ------------------------------------------------------------------ */
/*  A tiny external store so that non-React code (DOS prompt, menus)   */
/*  can open windows too.                                               */
/* ------------------------------------------------------------------ */

export interface WMState {
  windows: WinState[]
  activeId: string | null
}

export interface OpenOptions {
  appId: string
  title?: string
  icon?: IconName
  props?: Record<string, unknown>
  x?: number
  y?: number
  w?: number
  h?: number
  parentId?: string
  modal?: boolean
  /** center relative to parent / screen */
  center?: boolean
}

type Listener = () => void

let seq = 1
let zTop = 10
let cascade = 0

function screenSize() {
  if (typeof window === "undefined") return { w: 1024, h: 768 }
  return { w: window.innerWidth, h: window.innerHeight - 28 }
}

class WindowManager {
  private state: WMState = { windows: [], activeId: null }
  private listeners = new Set<Listener>()

  subscribe = (l: Listener) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  getSnapshot = () => this.state

  private set(next: Partial<WMState>) {
    this.state = { ...this.state, ...next }
    this.listeners.forEach((l) => l())
  }

  get(id: string) {
    return this.state.windows.find((w) => w.id === id)
  }

  findByApp(appId: string) {
    return this.state.windows.filter((w) => w.appId === appId)
  }

  /** Open a window for a registered app. Returns the window id. */
  open(opts: OpenOptions): string {
    const def = getApp(opts.appId)
    if (!def) {
      console.warn("Unknown app", opts.appId)
      return ""
    }
    if (def.singleton) {
      const existing = this.findByApp(def.id)[0]
      if (existing) {
        if (opts.props) this.update(existing.id, { props: { ...existing.props, ...opts.props } })
        this.focus(existing.id)
        return existing.id
      }
    }
    const scr = screenSize()
    const w = Math.min(opts.w ?? def.width, scr.w - 4)
    const h = Math.min(opts.h ?? def.height, scr.h - 4)
    let x = opts.x
    let y = opts.y
    const parent = opts.parentId ? this.get(opts.parentId) : undefined
    if (x === undefined || y === undefined) {
      if (opts.center || parent) {
        const cx = parent ? parent.x + parent.w / 2 : scr.w / 2
        const cy = parent ? parent.y + parent.h / 2 : scr.h / 2
        x = Math.round(cx - w / 2)
        y = Math.round(cy - h / 2)
      } else {
        const off = (cascade++ % 8) * 22
        x = 60 + off
        y = 40 + off
      }
    }
    x = Math.max(0, Math.min(x, scr.w - w))
    y = Math.max(0, Math.min(y, scr.h - h))

    const props = opts.props ?? {}
    const id = `w${seq++}`
    const win: WinState = {
      id,
      appId: def.id,
      title: opts.title ?? (def.title ? def.title(props) : def.name),
      icon: opts.icon ?? def.icon,
      x,
      y,
      w,
      h,
      z: ++zTop,
      minimized: false,
      maximized: false,
      resizable: def.resizable !== false,
      minimizable: def.minimizable !== false,
      maximizable: def.maximizable !== false && def.resizable !== false,
      minW: def.minW ?? 150,
      minH: def.minH ?? 60,
      taskbar: !def.noTaskbar && !opts.parentId,
      parentId: opts.parentId,
      modal: opts.modal,
      props,
    }
    this.set({ windows: [...this.state.windows, win], activeId: id })
    return id
  }

  /** Apps can veto closing (e.g. unsaved changes). Return true to allow. */
  private closeGuards = new Map<string, () => Promise<boolean> | boolean>()
  setCloseGuard(id: string, guard: (() => Promise<boolean> | boolean) | null) {
    if (guard) this.closeGuards.set(id, guard)
    else this.closeGuards.delete(id)
  }

  /** Close via the UI: runs the close guard first. */
  async requestClose(id: string) {
    const guard = this.closeGuards.get(id)
    if (guard) {
      this.focus(id)
      const ok = await guard()
      if (!ok) return
    }
    this.close(id)
  }

  close(id: string) {
    const victim = this.get(id)
    if (!victim) return
    this.closeGuards.delete(id)
    // close children (dialogs) too
    const ids = new Set<string>([id])
    let grew = true
    while (grew) {
      grew = false
      for (const w of this.state.windows) {
        if (w.parentId && ids.has(w.parentId) && !ids.has(w.id)) {
          ids.add(w.id)
          grew = true
        }
      }
    }
    const windows = this.state.windows.filter((w) => !ids.has(w.id))
    let activeId = this.state.activeId
    if (activeId && ids.has(activeId)) {
      // focus the parent if any, else top-most remaining
      const parent = victim.parentId && windows.find((w) => w.id === victim.parentId)
      const top = parent || windows.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]
      activeId = top ? top.id : null
      if (top) top.z = ++zTop
    }
    this.set({ windows, activeId })
  }

  /** Focus a window. If it has a modal child, focus that instead. */
  focus(id: string) {
    const win = this.get(id)
    if (!win) return
    const modalChild = this.state.windows.find((w) => w.parentId === id && w.modal)
    const target = modalChild ?? win
    const windows = this.state.windows.map((w) =>
      w.id === target.id ? { ...w, z: ++zTop, minimized: false } : w,
    )
    this.set({ windows, activeId: target.id })
  }

  blur() {
    this.set({ activeId: null })
  }

  minimize(id: string) {
    const win = this.get(id)
    if (!win) return
    const windows = this.state.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w))
    let activeId = this.state.activeId
    if (activeId === id) {
      const top = windows.filter((w) => !w.minimized && !w.parentId).sort((a, b) => b.z - a.z)[0]
      activeId = top ? top.id : null
    }
    this.set({ windows, activeId })
  }

  toggleMaximize(id: string) {
    const win = this.get(id)
    if (!win || !win.maximizable) return
    const scr = screenSize()
    if (win.maximized) {
      const r = win.restore ?? { x: 60, y: 40, w: 400, h: 300 }
      this.update(id, { maximized: false, ...r, restore: undefined })
    } else {
      this.update(id, {
        maximized: true,
        restore: { x: win.x, y: win.y, w: win.w, h: win.h },
        x: -3,
        y: -3,
        w: scr.w + 6,
        h: scr.h + 6,
      })
    }
    this.focus(id)
  }

  update(id: string, patch: Partial<WinState>) {
    const windows = this.state.windows.map((w) => (w.id === id ? { ...w, ...patch } : w))
    this.set({ windows })
  }

  setTitle(id: string, title: string) {
    const w = this.get(id)
    if (w && w.title !== title) this.update(id, { title })
  }

  setProps(id: string, props: Record<string, unknown>) {
    const w = this.get(id)
    if (w) this.update(id, { props: { ...w.props, ...props } })
  }

  move(id: string, x: number, y: number) {
    this.update(id, { x, y })
  }

  resize(id: string, rect: { x: number; y: number; w: number; h: number }) {
    this.update(id, rect)
  }

  closeAll() {
    this.set({ windows: [], activeId: null })
  }

  minimizeAll() {
    const windows = this.state.windows.map((w) => (w.parentId ? w : { ...w, minimized: true }))
    this.set({ windows, activeId: null })
  }

  cascade() {
    const scr = screenSize()
    let i = 0
    const windows = this.state.windows.map((w) => {
      if (w.parentId || w.minimized) return w
      const off = (i++ % 10) * 26
      return {
        ...w,
        maximized: false,
        x: off,
        y: off,
        w: Math.min(w.restore?.w ?? w.w, scr.w - off),
        h: Math.min(w.restore?.h ?? w.h, scr.h - off),
      }
    })
    this.set({ windows })
  }

  tile(direction: "h" | "v") {
    const scr = screenSize()
    const targets = this.state.windows.filter((w) => !w.parentId && !w.minimized)
    const n = targets.length
    if (!n) return
    const cols = direction === "v" ? n : 1
    const rows = direction === "v" ? 1 : n
    const cw = Math.floor(scr.w / cols)
    const ch = Math.floor(scr.h / rows)
    const windows = this.state.windows.map((w) => {
      const i = targets.indexOf(w)
      if (i < 0) return w
      const c = direction === "v" ? i : 0
      const r = direction === "v" ? 0 : i
      return { ...w, maximized: false, x: c * cw, y: r * ch, w: cw, h: ch }
    })
    this.set({ windows })
  }

  /* ---------------- dialogs ---------------- */

  /** Show a Win95 message box. Resolves with the button label pressed. */
  msgBox(opts: {
    parentId?: string
    title: string
    text: string
    icon?: "error" | "warning" | "question" | "info" | "none"
    buttons?: string[]
    defaultButton?: number
  }): Promise<string> {
    return new Promise((resolve) => {
      this.open({
        appId: "msgbox",
        parentId: opts.parentId,
        modal: !!opts.parentId,
        title: opts.title,
        props: { ...opts, resolve },
      })
    })
  }

  /** Simple text prompt dialog. Resolves with the string or null if cancelled. */
  prompt(opts: {
    parentId?: string
    title: string
    label: string
    value?: string
    icon?: IconName
    okLabel?: string
  }): Promise<string | null> {
    return new Promise((resolve) => {
      this.open({
        appId: "promptbox",
        parentId: opts.parentId,
        modal: !!opts.parentId,
        title: opts.title,
        props: { ...opts, resolve },
      })
    })
  }
}

export const wm = new WindowManager()

export function useWM(): WMState {
  return useSyncExternalStore(wm.subscribe, wm.getSnapshot, wm.getSnapshot)
}

/** Launch an app by id with optional props. */
export function launch(appId: string, props?: Record<string, unknown>, opts?: Partial<OpenOptions>) {
  return wm.open({ appId, props, ...opts })
}
