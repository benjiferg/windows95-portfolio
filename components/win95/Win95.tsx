"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import "@/components/apps"
import { useWM, wm, launch } from "@/lib/win95/store"
import { useSettings, applyScheme, settings } from "@/lib/win95/settings"
import { system, useSystem } from "@/lib/win95/system"
import { sounds } from "@/lib/win95/sounds"
import { contextMenu, ContextMenuHost } from "./Menu"
import { Window } from "./Window"
import { Desktop } from "./Desktop"
import { Taskbar } from "./Taskbar"
import { BiosScreen, SplashScreen, ShutdownWait, OffScreen } from "./Boot"
import { ScreenSaver } from "./ScreenSaver"
import { DosPrompt } from "@/components/apps/DosPrompt"

export function Win95() {
  const sys = useSystem()
  const s = useSettings()
  const { windows, activeId } = useWM()
  const [saver, setSaver] = useState(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const booted = useRef(false)

  /* color scheme */
  useEffect(() => applyScheme(s.colorScheme), [s.colorScheme])

  /* on reaching the desktop */
  useEffect(() => {
    if (sys.phase !== "desktop") return
    if (booted.current) return
    booted.current = true
    sounds.startup()
    if (settings.get().showWelcome) {
      setTimeout(() => launch("welcome"), 600)
    }
  }, [sys.phase])

  /* shutdown / restart handling */
  useEffect(() => {
    if (sys.phase === "shutdown" || sys.phase === "restarting") {
      wm.closeAll()
      contextMenu.hide()
      sounds.shutdown()
    }
    if (sys.phase === "bios") booted.current = false
  }, [sys.phase])

  /* global keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sys.phase !== "desktop") return
      if (e.altKey && e.key === "F4") {
        e.preventDefault()
        const id = wm.getSnapshot().activeId
        if (id) wm.requestClose(id)
      } else if (e.ctrlKey && e.key === "Escape") {
        e.preventDefault()
        system.toggleStartMenu()
      } else if (e.key === "Meta" && !e.ctrlKey && !e.altKey) {
        // Windows key
        e.preventDefault()
        system.toggleStartMenu()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [sys.phase])

  /* screen saver idle timer */
  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    const st = settings.get()
    if (st.screenSaver === "none" || sys.phase !== "desktop") return
    idleTimer.current = setTimeout(() => setSaver(true), Math.max(1, st.screenSaverWait) * 60 * 1000)
  }, [sys.phase])

  useEffect(() => {
    resetIdle()
    const ev = ["pointermove", "pointerdown", "keydown", "wheel"]
    ev.forEach((n) => window.addEventListener(n, resetIdle, { passive: true }))
    return () => {
      ev.forEach((n) => window.removeEventListener(n, resetIdle))
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [resetIdle, s.screenSaver, s.screenSaverWait])

  useEffect(() => {
    system.setScreenSaver(saver)
  }, [saver])

  /* unlock audio on first gesture */
  useEffect(() => {
    const unlock = () => {
      sounds.unlock()
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
    window.addEventListener("pointerdown", unlock)
    window.addEventListener("keydown", unlock)
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [])

  /* ---------------- phases ---------------- */
  if (sys.phase === "bios") {
    return <BiosScreen onDone={() => system.setPhase("splash")} />
  }
  if (sys.phase === "splash") {
    return <SplashScreen onDone={() => system.setPhase("desktop")} />
  }
  if (sys.phase === "shutdown") {
    return <ShutdownWait onDone={() => system.setPhase("off")} />
  }
  if (sys.phase === "restarting") {
    return <ShutdownWait restart onDone={() => system.powerOn()} />
  }
  if (sys.phase === "off") {
    return <OffScreen onPowerOn={() => system.powerOn()} />
  }

  const blockedIds = new Set(windows.filter((w) => w.parentId && w.modal).map((w) => w.parentId!))

  return (
    <div className="screen" onContextMenu={(e) => e.preventDefault()}>
      <Desktop />
      {windows.map((w) => (
        <Window key={w.id} win={w} active={w.id === activeId} blocked={blockedIds.has(w.id)} />
      ))}
      <Taskbar />
      <ContextMenuHost />
      {sys.phase === "dosmode" && (
        <DosPrompt
          win={{
            id: "dosmode",
            appId: "dos",
            title: "MS-DOS",
            icon: "ms_dos",
            x: 0,
            y: 0,
            w: 0,
            h: 0,
            z: 0,
            minimized: false,
            maximized: true,
            resizable: false,
            minimizable: false,
            maximizable: false,
            minW: 0,
            minH: 0,
            taskbar: false,
            props: { fullscreen: true },
          }}
        />
      )}
      {saver && <ScreenSaver mode={s.screenSaver} text={s.marqueeText} onExit={() => setSaver(false)} />}
    </div>
  )
}
