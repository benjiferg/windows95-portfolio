"use client"

import { useSyncExternalStore } from "react"

/* ------------------------------------------------------------------ */
/*  Machine power state: boot sequence, shutdown, restart, DOS mode     */
/* ------------------------------------------------------------------ */

export type Phase = "bios" | "starting" | "splash" | "desktop" | "shutdown" | "off" | "dosmode" | "restarting"

interface SysState {
  phase: Phase
  bootCount: number
  startMenuOpen: boolean
  /** request to toggle start menu (Ctrl+Esc) */
  startMenuToggle: number
  screenSaverActive: boolean
}

let state: SysState = { phase: "bios", bootCount: 0, startMenuOpen: false, startMenuToggle: 0, screenSaverActive: false }
const listeners = new Set<() => void>()
function set(p: Partial<SysState>) {
  state = { ...state, ...p }
  listeners.forEach((l) => l())
}

export const system = {
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  get: () => state,
  setPhase(phase: Phase) {
    set({ phase })
  },
  shutdown() {
    set({ phase: "shutdown" })
  },
  restart() {
    set({ phase: "restarting" })
  },
  dosMode() {
    set({ phase: "dosmode" })
  },
  powerOn() {
    set({ phase: "bios", bootCount: state.bootCount + 1 })
  },
  toggleStartMenu() {
    set({ startMenuToggle: state.startMenuToggle + 1 })
  },
  setStartMenuOpen(open: boolean) {
    if (state.startMenuOpen !== open) set({ startMenuOpen: open })
  },
  setScreenSaver(active: boolean) {
    if (state.screenSaverActive !== active) set({ screenSaverActive: active })
  },
}

export function useSystem(): SysState {
  return useSyncExternalStore(system.subscribe, system.get, system.get)
}
