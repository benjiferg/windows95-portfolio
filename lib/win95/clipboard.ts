"use client"

import { useSyncExternalStore } from "react"

/* Internal clipboard mirror (the browser clipboard may be inaccessible). */

let text = ""
const listeners = new Set<() => void>()

export const clipboard = {
  get: () => text,
  set(t: string) {
    text = t
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}

export function useClipboard() {
  return useSyncExternalStore(clipboard.subscribe, clipboard.get, () => "")
}
