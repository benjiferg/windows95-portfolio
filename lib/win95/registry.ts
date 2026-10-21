import type { ComponentType } from "react"
import type { IconName } from "./icons"

export interface WinState {
  id: string
  appId: string
  title: string
  icon: IconName
  x: number
  y: number
  w: number
  h: number
  z: number
  minimized: boolean
  maximized: boolean
  /** rect before maximize */
  restore?: { x: number; y: number; w: number; h: number }
  resizable: boolean
  minimizable: boolean
  maximizable: boolean
  minW: number
  minH: number
  /** show a button on the taskbar */
  taskbar: boolean
  /** owner window (dialogs) — a modal child blocks its parent */
  parentId?: string
  modal?: boolean
  /** arbitrary per-instance data (file path, folder, message text...) */
  props: Record<string, unknown>
}

export interface AppProps {
  win: WinState
}

export interface AppDef {
  id: string
  name: string
  icon: IconName
  component: ComponentType<AppProps>
  width: number
  height: number
  minW?: number
  minH?: number
  resizable?: boolean
  minimizable?: boolean
  maximizable?: boolean
  /** only one instance; launching again focuses it */
  singleton?: boolean
  /** hide from taskbar (dialogs) */
  noTaskbar?: boolean
  /** title override; defaults to name. Can read props. */
  title?: (props: Record<string, unknown>) => string
  /** DOS executable name, e.g. NOTEPAD.EXE */
  exe?: string
  /** Start-menu placement path, e.g. ["Programs","Accessories"]. Omit to hide. */
  startMenu?: string[]
  /** sort order within start menu folder */
  order?: number
}

const registry = new Map<string, AppDef>()

export function registerApp(def: AppDef) {
  registry.set(def.id, def)
  return def
}

export function getApp(id: string): AppDef | undefined {
  return registry.get(id)
}

export function allApps(): AppDef[] {
  return Array.from(registry.values())
}

export function appByExe(exe: string): AppDef | undefined {
  const up = exe.toUpperCase().replace(/\.EXE$/, "")
  return allApps().find((a) => a.exe && a.exe.toUpperCase().replace(/\.EXE$/, "") === up)
}
